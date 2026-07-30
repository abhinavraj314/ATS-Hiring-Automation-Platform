import os
import shutil
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import csv
from io import StringIO
from fastapi.responses import FileResponse, StreamingResponse, Response
from sqlalchemy.orm import Session
from app.core.database import get_db, reset_sequence_if_empty
from app.api.deps import get_current_user
from app.models.user import User as UserModel
from app.models.job import Job as JobModel
from app.models.candidate import Candidate as CandidateModel
from app.models.candidate_note import CandidateNote as CandidateNoteModel
from app.schemas.candidate import Candidate
from app.schemas.candidate_note import CandidateNote, CandidateNoteCreate
from sqlalchemy import nullslast, func
from datetime import datetime, timedelta
from app.services.parser import ResumeParser
from app.services.scoring import ScoringEngine
from app.models.match import CandidateJobMatch
from app.models.embedding import CandidateEmbedding, JobEmbedding
from app.services.semantic_matcher import semantic_matcher
from app.services.assessment_service import assign_assessment_if_eligible
from app.models.feedback import RecruiterFeedbackEvent as RecruiterFeedbackModel
from app.schemas.feedback import RecruiterFeedbackEventCreate
from app.models.interview import Interview as InterviewModel

router = APIRouter()

UPLOAD_DIR = "data/resumes"

@router.post("/upload/{job_id}", response_model=Candidate)
async def upload_resume(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    job_id: int,
    file: UploadFile = File(...)
) -> Any:
    # Verify job ownership
    job = db.query(JobModel).filter(JobModel.id == job_id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Parse resume
    try:
        parsed_data = ResumeParser.parse_resume(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse resume: {str(e)}")
        
    # Check for reapplication
    reapplication_details = None
    if parsed_data.get("email") or parsed_data.get("phone"):
        past_cands = db.query(CandidateModel).filter(
            (CandidateModel.email == parsed_data.get("email")) |
            (CandidateModel.phone == parsed_data.get("phone"))
        ).order_by(CandidateModel.id.desc()).all()
        
        if past_cands:
            past_cand = past_cands[0]
            past_job = db.query(JobModel).filter(JobModel.id == past_cand.job_id).first()
            reapplication_details = {
                "candidate_id": past_cand.id,
                "job_id": past_cand.job_id,
                "job_title": past_job.title if past_job else "Unknown Job",
                "status": past_cand.status,
            }

    # Score candidate
    scoring_result = ScoringEngine.calculate_score(job, parsed_data)

    # Create candidate record
    candidate = CandidateModel(
        full_name=parsed_data["full_name"],
        email=parsed_data["email"],
        phone=parsed_data["phone"],
        skills=parsed_data["skills"],
        experience_years=parsed_data["experience_years"],
        raw_text=parsed_data["raw_text"],
        file_path=file_path,
        job_id=job_id,
        score=scoring_result["overall_score"],
        score_breakdown=scoring_result["breakdown"],
        status="Applied",
        reapplication_details=reapplication_details
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    # Contextual Semantic Ranking
    try:
        # Get or create Job Embedding
        job_emb_record = db.query(JobEmbedding).filter(JobEmbedding.job_id == job.id).first()
        jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
        if job.required_skills:
            jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
        if job.preferred_skills:
            jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
            
        if not job_emb_record:
            job_emb = semantic_matcher.compute_embedding(jd_text)
            job_emb_record = JobEmbedding(job_id=job.id, embedding=job_emb)
            db.add(job_emb_record)
            db.commit()
            db.refresh(job_emb_record)
            
        # Create Candidate Embedding
        cand_emb = semantic_matcher.compute_embedding(candidate.raw_text or "")
        cand_emb_record = CandidateEmbedding(candidate_id=candidate.id, embedding=cand_emb)
        db.add(cand_emb_record)
        
        # Create Contextual Match with dynamic skills comparison
        match_score = semantic_matcher.compute_match_score(job_emb_record.embedding, cand_emb)
        match_signals = semantic_matcher.extract_match_signals(
            jd_text, 
            candidate.raw_text or "",
            job_skills=job.required_skills,
            candidate_skills=candidate.skills
        )
        
        match_record = CandidateJobMatch(
            candidate_id=candidate.id,
            job_id=job.id,
            semantic_score=match_score,
            match_signals=match_signals
        )
        db.add(match_record)

        assign_assessment_if_eligible(candidate, job, match_score, db)

        # Auto-shortlist logic
        if match_score > 80.0 and candidate.status not in ["Selected", "Rejected", "Interviewing"]:
            candidate.status = "Shortlisted"
            
        db.commit()
        db.refresh(candidate)
        
        # Attach semantic info to model for response
        candidate.semantic_score = match_score
        candidate.match_signals = match_signals
        
    except Exception as e:
        print(f"Failed to generate semantic match: {e}")
        db.rollback()

    return candidate

@router.get("/reports/dashboard")
def get_reports_dashboard(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    job_id: Optional[str] = "all",
    status: Optional[str] = "all",
    min_score: Optional[float] = 0.0,
    max_score: Optional[float] = 100.0,
) -> Any:
    # 1. Base Query: candidates whose jobs are owned by the current recruiter
    query = db.query(CandidateModel, CandidateJobMatch)\
        .select_from(CandidateModel)\
        .join(JobModel)\
        .outerjoin(CandidateJobMatch, (CandidateModel.id == CandidateJobMatch.candidate_id) & (CandidateModel.job_id == CandidateJobMatch.job_id))\
        .filter(JobModel.owner_id == current_user.id)\
        .distinct(CandidateModel.id)
    
    # Apply filters
    if job_id and job_id != "all":
        try:
            job_id_num = int(job_id)
            query = query.filter(CandidateModel.job_id == job_id_num)
        except ValueError:
            pass
            
    if status and status != "all":
        query = query.filter(CandidateModel.status == status)
        
    score_col = func.coalesce(CandidateJobMatch.semantic_score, CandidateModel.score)
    query = query.filter(score_col >= min_score).filter(score_col <= max_score)
    
    results = query.all()
    
    # Process results into local list of candidates with semantic_score attached
    filtered_candidates = []
    for cand, match in results:
        cand.semantic_score = match.semantic_score if match else 0.0
        cand.match_signals = match.match_signals if match else None
        filtered_candidates.append(cand)
        
    total_count = len(filtered_candidates)
    
    # A. Active Candidates (status != "Rejected")
    active_candidates = [c for c in filtered_candidates if (c.status or "").lower() != "rejected"]
    active_count = len(active_candidates)
    
    # WoW delta: we can compute how many active candidates were added in the last 7 days.
    # Since CandidateJobMatch has created_at, we check how many matches were created in last 7 days.
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    new_active_this_week = 0
    for cand, match in results:
        if (cand.status or "").lower() != "rejected":
            created_at = match.created_at if (match and match.created_at) else None
            if created_at:
                if created_at.tzinfo is not None:
                    created_at = created_at.replace(tzinfo=None)
                if created_at >= seven_days_ago:
                    new_active_this_week += 1
                    
    # B. New Candidates This Week (total candidates created in the last 7 days)
    new_candidates_this_week = 0
    for cand, match in results:
        created_at = match.created_at if (match and match.created_at) else None
        if created_at:
            if created_at.tzinfo is not None:
                created_at = created_at.replace(tzinfo=None)
            if created_at >= seven_days_ago:
                new_candidates_this_week += 1

    # C. Qualified Candidates (semantic score >= 65%)
    qualified_candidates = [c for c in filtered_candidates if (c.semantic_score or c.score or 0.0) >= 65.0]
    qualified_count = len(qualified_candidates)
    
    # D. Selected Candidates / Hiring Success Rate
    selected_candidates = [c for c in filtered_candidates if (c.status or "").lower() == "selected"]
    selected_count = len(selected_candidates)
    hiring_success_rate = round((selected_count / total_count * 100)) if total_count > 0 else 0

    # Candidates in Interview Stage
    interviewing_candidates = len([c for c in filtered_candidates if (c.status or "").lower() == "interviewing"])

    # E. Assessment Metrics
    # Filter states mapping:
    # Passed = PASSED
    # Failed = FAILED
    # Awaiting Attempt = ASSIGNED, IN_PROGRESS
    # Assigned = everything except NOT_ASSIGNED
    assigned_cands = [c for c in filtered_candidates if c.assessment_status != "NOT_ASSIGNED"]
    passed_cands = [c for c in filtered_candidates if c.assessment_status == "PASSED"]
    failed_cands = [c for c in filtered_candidates if c.assessment_status == "FAILED"]
    awaiting_cands = [c for c in filtered_candidates if c.assessment_status in ("ASSIGNED", "IN_PROGRESS")]
    
    completed_assessments = len(passed_cands) + len(failed_cands)
    assessment_pass_rate = round((len(passed_cands) / completed_assessments * 100)) if completed_assessments > 0 else 0

    # 2. Open Roles at a Glance
    jobs = db.query(JobModel).filter(JobModel.owner_id == current_user.id).all()
    roles_data = []
    for job in jobs:
        # Get candidates for this job
        job_cands = [c for c in filtered_candidates if c.job_id == job.id]
        job_cand_count = len(job_cands)
        strong_matches_count = len([c for c in job_cands if (c.semantic_score or c.score or 0.0) >= 80.0])
        avg_score = round(sum(c.semantic_score or c.score or 0.0 for c in job_cands) / job_cand_count) if job_cand_count > 0 else 0
        
        roles_data.append({
            "job_id": job.id,
            "title": job.title,
            "candidate_count": job_cand_count,
            "strong_matches": strong_matches_count,
            "avg_match_score": avg_score,
            "created_at": job.created_at.isoformat() if job.created_at else None
        })
    # Sort by strong_matches ascending (show bottlenecks first)
    roles_data.sort(key=lambda x: x["strong_matches"])

    # 3. Skill Demand vs Candidate Supply
    target_skills = [
        "Oracle PBCS",
        "Power Automate",
        "Oracle FCCS",
        "Oracle Hyperion",
        "SAP BPC",
        "Anaplan",
        "OneStream"
    ]
    skill_chart_data = []
    for skill in target_skills:
        job_count = 0
        for job in jobs:
            skills_str = (job.required_skills or "").lower()
            desc_str = (job.description or "").lower()
            title_str = (job.title or "").lower()
            if skill.lower() in skills_str or skill.lower() in desc_str or skill.lower() in title_str:
                job_count += 1
                
        cand_count = 0
        for cand in qualified_candidates:
            cand_skills_str = (cand.skills or "").lower()
            if skill.lower() in cand_skills_str:
                cand_count += 1
                
        skill_chart_data.append({
            "skill": skill,
            "job_openings": job_count,
            "qualified_candidates": cand_count
        })

    # 4. Semantic Match Quality Tiers
    excellent_count = len([c for c in filtered_candidates if (c.semantic_score or c.score or 0.0) >= 90.0])
    strong_fit_count = len([c for c in filtered_candidates if 70.0 <= (c.semantic_score or c.score or 0.0) < 90.0])
    trainable_count = len([c for c in filtered_candidates if 50.0 <= (c.semantic_score or c.score or 0.0) < 70.0])
    weak_fit_count = len([c for c in filtered_candidates if (c.semantic_score or c.score or 0.0) < 50.0])
    
    excellent_pct = round((excellent_count / total_count * 100)) if total_count > 0 else 0
    strong_fit_pct = round((strong_fit_count / total_count * 100)) if total_count > 0 else 0
    trainable_pct = round((trainable_count / total_count * 100)) if total_count > 0 else 0
    weak_fit_pct = round((weak_fit_count / total_count * 100)) if total_count > 0 else 0

    semantic_match_quality = [
        {"tier": "Excellent Match (90-100%)", "count": excellent_count, "pct": excellent_pct, "color": "bg-green-600"},
        {"tier": "Strong Fit (70-89%)", "count": strong_fit_count, "pct": strong_fit_pct, "color": "bg-green-50"},
        {"tier": "Trainable (50-69%)", "count": trainable_count, "pct": trainable_pct, "color": "bg-amber-500"},
        {"tier": "Weak Fit (Below 50%)", "count": weak_fit_count, "pct": weak_fit_pct, "color": "bg-red-500"}
    ]

    # 5. Candidate Pipeline Distribution
    pipeline_stages = ["Applied", "Under Review", "Shortlisted", "Interviewing", "Selected", "Rejected"]
    pipeline_distribution = []
    for stage in pipeline_stages:
        count = len([c for c in filtered_candidates if (c.status or "").lower() == stage.lower()])
        pipeline_distribution.append({
            "stage": stage,
            "count": count
        })

    # 6. Interview Outcomes
    job_ids = [job.id for job in jobs]
    interviews = []
    if job_ids:
        interviews = db.query(InterviewModel)\
            .join(CandidateModel)\
            .filter(CandidateModel.job_id.in_(job_ids))\
            .filter(InterviewModel.status != "Cancelled")\
            .all()
            
    round_types = ["L1", "L2", "FINAL"]
    interview_outcomes = []
    for rt in round_types:
        rt_interviews = [i for i in interviews if i.round_type and i.round_type.upper() == rt]
        total_rt = len(rt_interviews)
        
        pass_count = len([i for i in rt_interviews if i.outcome and i.outcome.lower() == "pass"])
        fail_count = len([i for i in rt_interviews if i.outcome and i.outcome.lower() == "fail"])
        hold_count = len([i for i in rt_interviews if i.outcome and i.outcome.lower() == "hold"])
        
        pass_pct = round((pass_count / total_rt * 100)) if total_rt > 0 else 0
        fail_pct = round((fail_count / total_rt * 100)) if total_rt > 0 else 0
        hold_pct = round((hold_count / total_rt * 100)) if total_rt > 0 else 0
        
        interview_outcomes.append({
            "round": rt,
            "total": total_rt,
            "pass": pass_count,
            "pass_pct": pass_pct,
            "fail": fail_count,
            "fail_pct": fail_pct,
            "hold": hold_count,
            "hold_pct": hold_pct
        })

    # Calculate the current proxy metric for assessment-assignment to later hiring-stage progression.
    # This is intentionally a proxy metric because the candidate model does not store an application timestamp.
    candidates_with_assigned_assessments = [c for c in filtered_candidates if c.assessment_assigned_at is not None]
    assessment_to_stage_days = []
    
    if candidates_with_assigned_assessments:
        cand_ids = [c.id for c in candidates_with_assigned_assessments]
        events = db.query(RecruiterFeedbackModel).filter(
            RecruiterFeedbackModel.candidate_id.in_(cand_ids),
            RecruiterFeedbackModel.action_type.in_(["INTERVIEWING", "SELECTED", "HIRE"])
        ).order_by(RecruiterFeedbackModel.created_at.asc()).all()
        
        feedback_events = {}
        for event in events:
            if event.candidate_id not in feedback_events:
                feedback_events[event.candidate_id] = {}
            if event.action_type not in feedback_events[event.candidate_id]:
                feedback_events[event.candidate_id][event.action_type] = event.created_at
                
        for c in candidates_with_assigned_assessments:
            start_date = c.assessment_assigned_at
            if start_date.tzinfo is not None:
                start_date = start_date.replace(tzinfo=None)
                
            end_date = None
            c_events = feedback_events.get(c.id, {})
            
            if "SELECTED" in c_events:
                end_date = c_events["SELECTED"]
            elif "HIRE" in c_events:
                end_date = c_events["HIRE"]
            elif "INTERVIEWING" in c_events:
                end_date = c_events["INTERVIEWING"]
                
            if not end_date:
                if c.status == "Selected":
                    end_date = c.assessment_completed_at or datetime.utcnow()
                elif c.status == "Interviewing":
                    end_date = c.assessment_completed_at or datetime.utcnow()
                    
            if end_date:
                if end_date.tzinfo is not None:
                    end_date = end_date.replace(tzinfo=None)
                diff_days = (end_date - start_date).days
                if diff_days >= 0:
                    assessment_to_stage_days.append((start_date, diff_days))

    avg_assessment_to_stage_days = None
    assessment_to_stage_comparison = None
    
    if assessment_to_stage_days:
        avg_assessment_to_stage_days = round(sum(d for _, d in assessment_to_stage_days) / len(assessment_to_stage_days), 1)
        
        assessment_to_stage_days.sort(key=lambda x: x[0])
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        current_cohort = [d for sd, d in assessment_to_stage_days if sd >= thirty_days_ago]
        previous_cohort = [d for sd, d in assessment_to_stage_days if sd < thirty_days_ago]
        
        if not current_cohort or not previous_cohort:
            half = len(assessment_to_stage_days) // 2
            previous_cohort = [d for _, d in assessment_to_stage_days[:half]]
            current_cohort = [d for _, d in assessment_to_stage_days[half:]]
            
        if current_cohort and previous_cohort:
            avg_current = sum(current_cohort) / len(current_cohort)
            avg_previous = sum(previous_cohort) / len(previous_cohort)
            assessment_to_stage_comparison = round(avg_current - avg_previous, 1)

    return {
        "pipeline_health": {
            "active_candidates": active_count,
            "active_wow_change": new_active_this_week,
            "new_candidates_this_week": new_candidates_this_week,
            "qualified_leads": qualified_count,
            "selected_candidates": selected_count,
            "hiring_success_rate": hiring_success_rate,
            "interviewing_candidates": interviewing_candidates,
            "assessments_assigned": len(assigned_cands),
            "passed_count": len(passed_cands),
            "failed_count": len(failed_cands),
            "awaiting_attempt_count": len(awaiting_cands),
            "completed_assessments": completed_assessments,
            "assessment_pass_rate": assessment_pass_rate,
            "avg_assessment_to_stage_days": avg_assessment_to_stage_days,
            "assessment_to_stage_comparison": assessment_to_stage_comparison,
            "avg_time_to_hire": avg_assessment_to_stage_days,
            "time_to_hire_comparison": assessment_to_stage_comparison
        },
        "open_roles": roles_data,
        "skill_demand_supply": skill_chart_data,
        "semantic_match_quality": semantic_match_quality,
        "pipeline_distribution": pipeline_distribution,
        "interview_outcomes": interview_outcomes
    }

@router.get("/all", response_model=List[Candidate])
def list_all_candidates(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Any:
    results = db.query(CandidateModel, CandidateJobMatch)\
        .select_from(CandidateModel)\
        .join(JobModel)\
        .outerjoin(CandidateJobMatch, (CandidateModel.id == CandidateJobMatch.candidate_id) & (CandidateModel.job_id == CandidateJobMatch.job_id))\
        .filter(JobModel.owner_id == current_user.id)\
        .order_by(nullslast(CandidateJobMatch.semantic_score.desc()), CandidateModel.score.desc())\
        .all()
        
    final_candidates = []
    for cand, match in results:
        cand.semantic_score = match.semantic_score if match else 0.0
        cand.match_signals = match.match_signals if match else None
        final_candidates.append(cand)
        
    return final_candidates

@router.get("/shortlisted", response_model=List[Candidate])
def list_shortlisted_candidates(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Any:
    results = db.query(CandidateModel, CandidateJobMatch)\
        .select_from(CandidateModel)\
        .join(JobModel)\
        .outerjoin(CandidateJobMatch, (CandidateModel.id == CandidateJobMatch.candidate_id) & (CandidateModel.job_id == CandidateJobMatch.job_id))\
        .filter(
            JobModel.owner_id == current_user.id,
            CandidateModel.status.in_(["Shortlisted", "Interviewing", "Selected"])
        )\
        .order_by(nullslast(CandidateJobMatch.semantic_score.desc()), CandidateModel.score.desc())\
        .all()
        
    final_candidates = []
    for cand, match in results:
        cand.semantic_score = match.semantic_score if match else 0.0
        cand.match_signals = match.match_signals if match else None
        final_candidates.append(cand)
        
    return final_candidates

@router.get("/job/{job_id}", response_model=List[Candidate])
def list_candidates(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    job_id: int
) -> Any:
    # Verify job ownership
    job = db.query(JobModel).filter(JobModel.id == job_id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    results = db.query(CandidateModel, CandidateJobMatch)\
        .outerjoin(CandidateJobMatch, (CandidateModel.id == CandidateJobMatch.candidate_id) & (CandidateModel.job_id == CandidateJobMatch.job_id))\
        .filter(CandidateModel.job_id == job_id)\
        .order_by(nullslast(CandidateJobMatch.semantic_score.desc()), CandidateModel.score.desc())\
        .all()
        
    final_candidates = []
    for cand, match in results:
        cand.semantic_score = match.semantic_score if match else 0.0
        cand.match_signals = match.match_signals if match else None
        final_candidates.append(cand)
        
    return final_candidates

@router.get("/job/{job_id}/export")
def export_candidates(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    job_id: int
) -> Any:
    # Verify job ownership
    job = db.query(JobModel).filter(JobModel.id == job_id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    results = db.query(CandidateModel, CandidateJobMatch)\
        .outerjoin(CandidateJobMatch, (CandidateModel.id == CandidateJobMatch.candidate_id) & (CandidateModel.job_id == CandidateJobMatch.job_id))\
        .filter(CandidateModel.job_id == job_id)\
        .order_by(nullslast(CandidateJobMatch.semantic_score.desc()), CandidateModel.score.desc())\
        .all()

    # Generate CSV
    f = StringIO()
    writer = csv.writer(f)
    writer.writerow([
        "ID", "Name", "Email", "Phone", "Status", "AI Match Score", "Legacy Score",
        "Experience (Yrs)", "Skills", "Current Org", "Notice Period"
    ])
    
    for cand, match in results:
        semantic_score = match.semantic_score if match else 0.0
        writer.writerow([
            cand.id, cand.full_name, cand.email, cand.phone, cand.status, f"{semantic_score}%", round(cand.score, 2),
            cand.experience_years, cand.skills, cand.current_org or "", cand.notice_period or ""
        ])
        
    f.seek(0)
    response = StreamingResponse(iter([f.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=candidates_job_{job_id}.csv"
    return response

@router.get("/export/all")
def export_all_candidates(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    format: str = "json"
) -> Any:
    """
    Export all candidates owned by current recruiter.
    Supports both JSON and CSV formats.
    """
    try:
        import json
        
        # Query all jobs owned by current user
        jobs = db.query(JobModel).filter(JobModel.owner_id == current_user.id).all()
        job_ids = [job.id for job in jobs]
        
        if not job_ids:
            if format.lower() == "csv":
                headers = ["Full Name", "Email", "Phone", "Skills", "Experience (Years)", "Status", "Job Title", "Score", "Semantic Score"]
                csv_content = ",".join(headers)
                response = Response(content=csv_content, media_type="text/csv")
                response.headers["Content-Disposition"] = "attachment; filename=ats_candidate_export.csv"
            else:
                response = Response(content=json.dumps([]), media_type="application/json")
                response.headers["Content-Disposition"] = "attachment; filename=ats_candidate_export.json"
            return response
        
        # Query all candidates for user's jobs
        candidates = db.query(CandidateModel)\
            .filter(CandidateModel.job_id.in_(job_ids))\
            .order_by(CandidateModel.id.desc())\
            .all()
        
        export_data = []
        
        for cand in candidates:
            try:
                # Get job info
                job = db.query(JobModel).filter(JobModel.id == cand.job_id).first()
                
                # Get match info
                match = db.query(CandidateJobMatch).filter(
                    CandidateJobMatch.candidate_id == cand.id,
                    CandidateJobMatch.job_id == cand.job_id
                ).first()
                
                # Get notes for candidate
                notes = db.query(CandidateNoteModel).filter(CandidateNoteModel.candidate_id == cand.id).all()
                notes_list = [note.comment for note in notes]
                
                # Build candidate export data
                cand_data = {
                    "id": cand.id,
                    "full_name": cand.full_name or "",
                    "email": cand.email or "",
                    "phone": cand.phone or "",
                    "skills": [s.strip() for s in (cand.skills or "").split(",") if s.strip()],
                    "experience_years": cand.experience_years or 0,
                    "status": cand.status or "Applied",
                    "score": float(cand.score) if cand.score is not None else 0.0,
                    "semantic_score": float(match.semantic_score) if match and match.semantic_score is not None else 0.0,
                    "job_title": job.title if job else "Unknown",
                    "job_id": cand.job_id,
                    "notes_count": len(notes_list)
                }
                export_data.append(cand_data)
            except Exception as candidate_error:
                import logging
                logging.error(f"Error processing candidate {cand.id}: {str(candidate_error)}")
                continue
        
        if format.lower() == "csv":
            # Generate CSV
            output = StringIO()
            writer = csv.DictWriter(
                output,
                fieldnames=[
                    "full_name", "email", "phone", "skills", "experience_years",
                    "status", "job_title", "score", "semantic_score", "notes_count"
                ]
            )
            writer.writeheader()
            
            for item in export_data:
                writer.writerow({
                    "full_name": item["full_name"],
                    "email": item["email"],
                    "phone": item["phone"],
                    "skills": "; ".join(item["skills"]),
                    "experience_years": item["experience_years"],
                    "status": item["status"],
                    "job_title": item["job_title"],
                    "score": f"{item['score']:.2f}",
                    "semantic_score": f"{item['semantic_score']:.2f}",
                    "notes_count": item["notes_count"]
                })
            
            response = Response(content=output.getvalue(), media_type="text/csv")
            response.headers["Content-Disposition"] = "attachment; filename=ats_candidate_export.csv"
            return response
        else:
            # Generate JSON
            json_str = json.dumps(export_data, indent=2)
            response = Response(content=json_str, media_type="application/json")
            response.headers["Content-Disposition"] = "attachment; filename=ats_candidate_export.json"
            return response
            
    except Exception as e:
        import logging
        logging.error(f"Export failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.patch("/{id}/status", response_model=Candidate)
def update_status(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
    status: str
) -> Any:
    candidate = db.query(CandidateModel).join(JobModel).filter(
        CandidateModel.id == id, JobModel.owner_id == current_user.id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    ALLOWED_TRANSITIONS = {
        "Applied": ["Under Review", "Rejected"],
        "Under Review": ["Shortlisted", "Rejected"],
        "Shortlisted": ["Interviewing", "Rejected"],
        "Interviewing": ["Selected", "Rejected"],
        "Selected": [],
        "Rejected": []
    }
    
    from_status = candidate.status
    if status != candidate.status:
        allowed = ALLOWED_TRANSITIONS.get(candidate.status, [])
        if status not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid transition from {candidate.status} to {status}")
            
        candidate.status = status
        db.commit()
        db.refresh(candidate)

        # Trigger email notification
        try:
            from app.services.email import send_status_email
            
            interview_date = None
            if status == "Interviewing":
                interview = db.query(InterviewModel).filter(
                    InterviewModel.candidate_id == candidate.id,
                    InterviewModel.status == "Scheduled"
                ).order_by(InterviewModel.id.desc()).first()
                if interview and interview.scheduled_at:
                    interview_date = interview.scheduled_at.strftime("%Y-%m-%d %H:%M")
            
            send_status_email(
                candidate_email=candidate.email,
                candidate_name=candidate.full_name,
                job_title=candidate.job.title if candidate.job else "Unknown Position",
                from_status=from_status,
                to_status=status,
                interview_date=interview_date,
                interview_link=None
            )
        except Exception as e:
            print(f"Failed to send status transition email: {e}")
    
    match_record = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.candidate_id == candidate.id,
        CandidateJobMatch.job_id == candidate.job_id
    ).first()
    
    candidate.semantic_score = match_record.semantic_score if match_record else 0.0
    candidate.match_signals = match_record.match_signals if match_record else None
    
    # Log implicit feedback event
    action = "SHORTLIST" if status == "Shortlisted" else "REJECT" if status == "Rejected" else status.upper()
    try:
        feedback = RecruiterFeedbackModel(
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            recruiter_id=current_user.id,
            action_type=action,
            original_semantic_score=candidate.semantic_score
        )
        db.add(feedback)
        db.commit()
    except Exception as e:
        print(f"Failed to log implicit feedback event: {e}")
        db.rollback()
        
    return candidate

@router.get("/{id}", response_model=Candidate)
def get_candidate(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int
) -> Any:
    """Retrieve details of a single candidate by ID."""
    candidate = db.query(CandidateModel).join(JobModel).filter(
        CandidateModel.id == id, JobModel.owner_id == current_user.id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    match_record = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.candidate_id == candidate.id,
        CandidateJobMatch.job_id == candidate.job_id
    ).first()
    
    candidate.semantic_score = match_record.semantic_score if match_record else 0.0
    candidate.match_signals = match_record.match_signals if match_record else None
    
    return candidate

@router.get("/{id}/similar", response_model=List[Candidate])
def get_similar_candidates(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int
) -> Any:
    """Find candidates with highly similar semantic vector profiles using dense embeddings."""
    candidate = db.query(CandidateModel).join(JobModel).filter(
        CandidateModel.id == id, JobModel.owner_id == current_user.id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    # Get target candidate's embedding
    target_emb_record = db.query(CandidateEmbedding).filter(CandidateEmbedding.candidate_id == id).first()
    if not target_emb_record or not target_emb_record.embedding:
        return []
        
    # Get all other candidate embeddings for jobs owned by current user
    other_embs = db.query(CandidateEmbedding, CandidateModel)\
        .join(CandidateModel, CandidateEmbedding.candidate_id == CandidateModel.id)\
        .join(JobModel, CandidateModel.job_id == JobModel.id)\
        .filter(JobModel.owner_id == current_user.id, CandidateModel.id != id)\
        .all()
        
    similarities = []
    for emb_rec, cand in other_embs:
        if not emb_rec.embedding:
            continue
        # Compute similarity
        score = semantic_matcher.compute_match_score(target_emb_record.embedding, emb_rec.embedding)
        
        # Attach semantic match metadata
        match_rec = db.query(CandidateJobMatch).filter(
            CandidateJobMatch.candidate_id == cand.id,
            CandidateJobMatch.job_id == cand.job_id
        ).first()
        cand.semantic_score = match_rec.semantic_score if match_rec else 0.0
        cand.match_signals = match_rec.match_signals if match_rec else None
        
        similarities.append((cand, score))
        
    # Sort by similarity score descending, take top 5
    similarities.sort(key=lambda x: x[1], reverse=True)
    top_similar = [item[0] for item in similarities[:5]]
    
    return top_similar

@router.post("/{id}/feedback", status_code=201)
def add_recruiter_feedback(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
    feedback_in: RecruiterFeedbackEventCreate
) -> Any:
    """Explicitly capture detailed recruiter feedback and telemetry, updating candidate status atomically."""
    candidate = db.query(CandidateModel).join(JobModel).filter(
        CandidateModel.id == id, JobModel.owner_id == current_user.id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    match_record = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.candidate_id == candidate.id,
        CandidateJobMatch.job_id == candidate.job_id
    ).first()
    original_score = match_record.semantic_score if match_record else 0.0
    
    action_type = feedback_in.action_type.upper()
    target_status = None
    if action_type in ("SHORTLIST", "SHORTLISTED"):
        target_status = "Shortlisted"
        action_type = "SHORTLIST"
    elif action_type in ("REJECT", "REJECTED"):
        target_status = "Rejected"
        action_type = "REJECT"

    from_status = candidate.status
    
    try:
        if target_status and candidate.status != target_status:
            ALLOWED_TRANSITIONS = {
                "Applied": ["Under Review", "Rejected"],
                "Under Review": ["Shortlisted", "Rejected"],
                "Shortlisted": ["Interviewing", "Rejected"],
                "Interviewing": ["Selected", "Rejected"],
                "Selected": [],
                "Rejected": []
            }
            allowed = ALLOWED_TRANSITIONS.get(candidate.status, [])
            if target_status not in allowed:
                raise HTTPException(status_code=400, detail=f"Invalid transition from {candidate.status} to {target_status}")

            candidate.status = target_status

        feedback = RecruiterFeedbackModel(
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            recruiter_id=current_user.id,
            action_type=action_type,
            original_semantic_score=original_score,
            rejection_reason_category=feedback_in.rejection_reason_category,
            feedback_notes=feedback_in.feedback_notes
        )
        db.add(feedback)
        
        # Single atomic commit for both status update and feedback record
        db.commit()
        db.refresh(candidate)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to log feedback: {str(e)}")

    if target_status and from_status != target_status:
        try:
            from app.services.email import send_status_email
            send_status_email(
                candidate_email=candidate.email,
                candidate_name=candidate.full_name,
                job_title=candidate.job.title if candidate.job else "Unknown Position",
                from_status=from_status,
                to_status=target_status,
                interview_date=None,
                interview_link=None
            )
        except Exception as e:
            print(f"Failed to send status transition email: {e}")

    return {
        "status": "success",
        "message": "Recruiter telemetry feedback logged successfully",
        "candidate_id": candidate.id,
        "new_status": candidate.status
    }

@router.get("/{id}/resume")
def get_resume(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int
) -> Any:
    candidate = db.query(CandidateModel).join(JobModel).filter(
        CandidateModel.id == id, JobModel.owner_id == current_user.id
    ).first()
    if not candidate or not candidate.file_path or not os.path.exists(candidate.file_path):
        raise HTTPException(status_code=404, detail="Resume not found")
    
    return FileResponse(candidate.file_path, media_type="application/pdf", filename=os.path.basename(candidate.file_path))

@router.delete("/job/{job_id}/rejected")
def delete_rejected_candidates(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    job_id: int
) -> Any:
    job = db.query(JobModel).filter(JobModel.id == job_id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    rejected_candidates = db.query(CandidateModel).filter(
        CandidateModel.job_id == job_id, CandidateModel.status == "rejected"
    ).all()
    
    count = 0
    for candidate in rejected_candidates:
        if candidate.file_path and os.path.exists(candidate.file_path):
            try:
                os.remove(candidate.file_path)
            except:
                pass
        db.delete(candidate)
        count += 1
        
    db.commit()
    reset_sequence_if_empty(db, CandidateModel)
    return {"status": "success", "deleted_count": count}

@router.post("/{id}/notes", response_model=CandidateNote)
def add_note(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
    note_in: CandidateNoteCreate
) -> Any:
    candidate = db.query(CandidateModel).join(JobModel).filter(
        CandidateModel.id == id, JobModel.owner_id == current_user.id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    note = CandidateNoteModel(
        candidate_id=id,
        recruiter_id=current_user.id,
        comment=note_in.comment
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@router.get("/{id}/notes", response_model=List[CandidateNote])
def get_notes(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int
) -> Any:
    candidate = db.query(CandidateModel).join(JobModel).filter(
        CandidateModel.id == id, JobModel.owner_id == current_user.id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    return db.query(CandidateNoteModel).filter(CandidateNoteModel.candidate_id == id).order_by(CandidateNoteModel.created_at.desc()).all()
