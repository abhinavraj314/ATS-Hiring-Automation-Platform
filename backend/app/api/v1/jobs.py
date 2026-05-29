from typing import Any, List
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db, reset_sequence_if_empty
from app.api.deps import get_current_user
from app.models.user import User as UserModel
from app.models.job import Job as JobModel
from app.models.candidate import Candidate as CandidateModel
from app.schemas.job import Job, JobCreate, JobUpdate
from app.services.jd_parser import JDParser
from app.services.semantic_matcher import semantic_matcher

router = APIRouter()

@router.post("/parse", response_model=JobCreate)
async def parse_jd(
    *,
    current_user: UserModel = Depends(get_current_user),
    file: UploadFile = File(...)
) -> Any:
    UPLOAD_DIR = "data/jds"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        parsed_data = JDParser.parse_jd(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse JD: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    return parsed_data

@router.get("/", response_model=List[Job])
def read_jobs(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    jobs = db.query(JobModel).filter(JobModel.owner_id == current_user.id).offset(skip).limit(limit).all()
    return jobs

@router.post("/", response_model=Job)
def create_job(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    job_in: JobCreate,
) -> Any:
    job = JobModel(
        **job_in.model_dump(),
        owner_id=current_user.id
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.get("/{id}", response_model=Job)
def read_job(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
) -> Any:
    job = db.query(JobModel).filter(JobModel.id == id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
) -> None:
    job = db.query(JobModel).filter(JobModel.id == id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    reset_sequence_if_empty(db, JobModel)
    return None

@router.patch("/{id}", response_model=Job)
def update_job(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
    job_in: JobUpdate,
) -> Any:
    job = db.query(JobModel).filter(JobModel.id == id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    update_data = job_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(job, field, update_data[field])
        
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.get("/{id}/recommendations")
def get_recommendations(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
) -> Any:
    # Verify job ownership
    job = db.query(JobModel).filter(JobModel.id == id, JobModel.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Get all candidates for this job
    candidates = db.query(CandidateModel).filter(CandidateModel.job_id == id).all()
    
    from app.models.match import CandidateJobMatch
    from app.models.embedding import CandidateEmbedding, JobEmbedding
    
    # We will compute/ensure embeddings and matches exist for all candidates of this job
    job_emb_record = db.query(JobEmbedding).filter(JobEmbedding.job_id == job.id).first()
    if not job_emb_record:
        # Compute Job Embedding
        jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
        if job.required_skills:
            jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
        if job.preferred_skills:
            jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
        job_emb = semantic_matcher.compute_embedding(jd_text)
        job_emb_record = JobEmbedding(job_id=job.id, embedding=job_emb)
        db.add(job_emb_record)
        db.commit()
        db.refresh(job_emb_record)
        
    recommendations = []
    for candidate in candidates:
        # Check if match already exists
        match = db.query(CandidateJobMatch).filter(
            CandidateJobMatch.candidate_id == candidate.id,
            CandidateJobMatch.job_id == job.id
        ).first()
        
        if not match:
            # Check if Candidate embedding exists, else compute
            cand_emb_record = db.query(CandidateEmbedding).filter(CandidateEmbedding.candidate_id == candidate.id).first()
            if not cand_emb_record:
                cand_emb = semantic_matcher.compute_embedding(candidate.raw_text or "")
                cand_emb_record = CandidateEmbedding(candidate_id=candidate.id, embedding=cand_emb)
                db.add(cand_emb_record)
                db.commit()
                db.refresh(cand_emb_record)
            
            # Compute match score
            match_score = semantic_matcher.compute_match_score(job_emb_record.embedding, cand_emb_record.embedding)
            jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
            if job.required_skills:
                jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
            if job.preferred_skills:
                jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
            match_signals = semantic_matcher.extract_match_signals(jd_text, candidate.raw_text or "")
            
            match = CandidateJobMatch(
                candidate_id=candidate.id,
                job_id=job.id,
                semantic_score=match_score,
                match_signals=match_signals
            )
            db.add(match)
            db.commit()
            db.refresh(match)
            
        recommendations.append({
            "candidate_id": candidate.id,
            "similarity_score": match.semantic_score
        })
        
    return {"recommendations": recommendations}


