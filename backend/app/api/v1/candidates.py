import os
import shutil
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import csv
from io import StringIO
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db, reset_sequence_if_empty
from app.api.deps import get_current_user
from app.models.user import User as UserModel
from app.models.job import Job as JobModel
from app.models.candidate import Candidate as CandidateModel
from app.models.candidate_note import CandidateNote as CandidateNoteModel
from app.schemas.candidate import Candidate
from app.schemas.candidate_note import CandidateNote, CandidateNoteCreate
from sqlalchemy import nullslast
from app.services.parser import ResumeParser
from app.services.scoring import ScoringEngine
from app.models.match import CandidateJobMatch
from app.models.embedding import CandidateEmbedding, JobEmbedding
from app.services.semantic_matcher import semantic_matcher

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
        
        # Create Contextual Match
        match_score = semantic_matcher.compute_match_score(job_emb_record.embedding, cand_emb)
        match_signals = semantic_matcher.extract_match_signals(jd_text, candidate.raw_text or "")
        
        match_record = CandidateJobMatch(
            candidate_id=candidate.id,
            job_id=job.id,
            semantic_score=match_score,
            match_signals=match_signals
        )
        db.add(match_record)
        
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
    
    if status != candidate.status:
        allowed = ALLOWED_TRANSITIONS.get(candidate.status, [])
        if status not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid transition from {candidate.status} to {status}")
    
    candidate.status = status
    db.commit()
    db.refresh(candidate)
    
    match_record = db.query(CandidateJobMatch).filter(
        CandidateJobMatch.candidate_id == candidate.id,
        CandidateJobMatch.job_id == candidate.job_id
    ).first()
    
    candidate.semantic_score = match_record.semantic_score if match_record else 0.0
    candidate.match_signals = match_record.match_signals if match_record else None
    
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
    return candidate

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
