from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db, reset_sequence_if_empty
from app.api.deps import get_current_user
from app.models.user import User as UserModel
from app.models.candidate import Candidate as CandidateModel
from app.models.panel import PanelMember as PanelMemberModel
from app.models.interview import Interview as InterviewModel
from app.schemas.interview import Interview, InterviewCreate, InterviewUpdate

router = APIRouter()

@router.get("/", response_model=List[Interview])
def list_interviews(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Any:
    """List all interviews across all candidates."""
    return db.query(InterviewModel).order_by(InterviewModel.scheduled_at.desc()).all()

@router.get("/candidate/{candidate_id}", response_model=List[Interview])
def list_candidate_interviews(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    candidate_id: int
) -> Any:
    """List all interviews for a specific candidate."""
    # Verify candidate exists
    candidate = db.query(CandidateModel).filter(CandidateModel.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    return db.query(InterviewModel).filter(InterviewModel.candidate_id == candidate_id).order_by(InterviewModel.id.asc()).all()

@router.post("/", response_model=Interview)
def create_interview(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    interview_in: InterviewCreate,
) -> Any:
    """Schedule a new interview for a candidate."""
    # Verify candidate exists
    candidate = db.query(CandidateModel).filter(CandidateModel.id == interview_in.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Fetch existing non-cancelled interviews for sequence validation
    existing_interviews = db.query(InterviewModel).filter(
        InterviewModel.candidate_id == candidate.id,
        InterviewModel.status != "Cancelled"
    ).order_by(InterviewModel.id.asc()).all()

    # Rule 1: No Stacking (No active Scheduled rounds)
    for existing in existing_interviews:
        if existing.status == "Scheduled":
            raise HTTPException(status_code=400, detail="Candidate already has an active scheduled interview.")

    def get_latest_round(r_type: str):
        rounds = [r for r in existing_interviews if r.round_type == r_type]
        return rounds[-1] if rounds else None

    # Rule 2: Cannot schedule a round that has already been passed
    latest_target = get_latest_round(interview_in.round_type)
    if latest_target and latest_target.outcome == "Pass":
        raise HTTPException(status_code=400, detail=f"Candidate has already passed {interview_in.round_type}.")

    # Rule 3: Sequencing Enforcement (L1 -> L2 -> FINAL)
    if interview_in.round_type == "L2":
        latest_l1 = get_latest_round("L1")
        if not latest_l1 or latest_l1.outcome != "Pass":
            raise HTTPException(status_code=400, detail="Cannot schedule L2. Candidate must pass L1 first.")
    elif interview_in.round_type == "FINAL":
        latest_l2 = get_latest_round("L2")
        if not latest_l2 or latest_l2.outcome != "Pass":
            raise HTTPException(status_code=400, detail="Cannot schedule FINAL. Candidate must pass L2 first.")
    elif interview_in.round_type != "L1":
        raise HTTPException(status_code=400, detail=f"Invalid round type: {interview_in.round_type}. Allowed: L1, L2, FINAL")

    # If panel member is specified, verify they exist
    if interview_in.panel_id:
        panel_member = db.query(PanelMemberModel).filter(PanelMemberModel.id == interview_in.panel_id).first()
        if not panel_member:
            raise HTTPException(status_code=404, detail="Panel member not found")

    interview = InterviewModel(
        candidate_id=interview_in.candidate_id,
        panel_id=interview_in.panel_id,
        round_type=interview_in.round_type,
        scheduled_at=interview_in.scheduled_at,
        status="Scheduled"
    )
    db.add(interview)
    
    candidate.current_round = interview_in.round_type
    
    if candidate.status == "Shortlisted":
        candidate.status = "Interviewing"
        
    db.commit()
    db.refresh(interview)
    return interview

@router.patch("/{id}", response_model=Interview)
def update_interview(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
    interview_in: InterviewUpdate,
) -> Any:
    """Update interview details, outcome, status, or feedback notes."""
    interview = db.query(InterviewModel).filter(InterviewModel.id == id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Extract non-None updates
    update_data = interview_in.dict(exclude_unset=True)
    
    # Enforce outcome validity
    if "outcome" in update_data and update_data["outcome"] is not None:
        new_status = update_data.get("status", interview.status)
        if new_status != "Completed":
            raise HTTPException(status_code=400, detail="Interview must be 'Completed' to receive an outcome.")

    for field, value in update_data.items():
        setattr(interview, field, value)

    # Verify panel member if it is changing
    if "panel_id" in update_data and update_data["panel_id"] is not None:
        panel_member = db.query(PanelMemberModel).filter(PanelMemberModel.id == update_data["panel_id"]).first()
        if not panel_member:
            raise HTTPException(status_code=404, detail="Panel member not found")

    db.commit()
    db.refresh(interview)
    return interview

@router.delete("/{id}")
def delete_interview(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
) -> Any:
    """Delete / Cancel an interview block."""
    interview = db.query(InterviewModel).filter(InterviewModel.id == id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    db.delete(interview)
    db.commit()
    reset_sequence_if_empty(db, InterviewModel)
    return {"status": "success"}
