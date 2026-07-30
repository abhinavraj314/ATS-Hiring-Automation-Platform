from typing import Any, List, Optional
from datetime import datetime, timezone, timedelta, time
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db, reset_sequence_if_empty
from app.api.deps import get_current_user
from app.models.user import User as UserModel
from app.models.candidate import Candidate as CandidateModel
from app.models.panel import PanelMember as PanelMemberModel
from app.models.interview import Interview as InterviewModel
from app.schemas.interview import Interview, InterviewCreate, InterviewUpdate

router = APIRouter()

def validate_future_datetime(dt: datetime, timezone_offset: Optional[int] = None):
    if not dt:
        return
    # Use timezone offset if provided to construct the client timezone
    offset_minutes = timezone_offset if timezone_offset is not None else 0
    client_tz = timezone(timedelta(minutes=-offset_minutes))
    
    # Get current time in client's timezone or UTC
    client_now = datetime.now(client_tz)
    
    # If the input dt is timezone-naive, localize it to the client's timezone or UTC
    if dt.tzinfo is None:
        dt_aware = dt.replace(tzinfo=client_tz)
    else:
        dt_aware = dt.astimezone(client_tz)
        
    if dt_aware <= client_now:
        raise HTTPException(status_code=400, detail="The scheduled date and time must be in the future.")

    # Enforce 30-minute interval alignment
    if dt_aware.minute not in (0, 30) or dt_aware.second != 0 or dt_aware.microsecond != 0:
        raise HTTPException(status_code=400, detail="Interviews can only be scheduled at 30-minute intervals (e.g. 10:00 or 10:30).")

    # Enforce working hours (08:00 AM to 09:00 PM, meaning latest start time is 08:30 PM)
    EARLIEST_START = time(8, 0, 0)
    LATEST_START = time(20, 30, 0)
    scheduled_time = dt_aware.time()
    
    if scheduled_time < EARLIEST_START or scheduled_time > LATEST_START:
        raise HTTPException(status_code=400, detail="Interviews must be scheduled within working hours (08:00 AM to 09:00 PM).")


def validate_panel_member_slot_availability(
    db: Session,
    panel_id: Optional[int],
    scheduled_at: Optional[datetime],
    ignore_interview_id: Optional[int] = None,
) -> None:
    if not panel_id or not scheduled_at:
        return

    panel_member = db.query(PanelMemberModel).filter(PanelMemberModel.id == panel_id).first()
    if not panel_member:
        raise HTTPException(status_code=404, detail="Panel member not found")

    conflict = db.query(InterviewModel).filter(
        InterviewModel.panel_id == panel_id,
        InterviewModel.scheduled_at == scheduled_at,
        InterviewModel.status != "Cancelled",
    )

    if ignore_interview_id is not None:
        conflict = conflict.filter(InterviewModel.id != ignore_interview_id)

    existing_conflict = conflict.first()
    if existing_conflict:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Panel member '{panel_member.name}' is already booked for "
                f"{scheduled_at.strftime('%Y-%m-%d %H:%M')}. Please choose a different slot."
            ),
        )


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
    x_timezone_offset: Optional[int] = Header(None, alias="X-Timezone-Offset"),
) -> Any:
    """Schedule a new interview for a candidate."""
    if interview_in.scheduled_at:
        validate_future_datetime(interview_in.scheduled_at, x_timezone_offset)

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
        if not latest_l1 or latest_l1.outcome not in ("Pass", "Hold"):
            raise HTTPException(status_code=400, detail="Cannot schedule L2. Candidate must pass L1 first.")
    elif interview_in.round_type == "FINAL":
        latest_l2 = get_latest_round("L2")
        if not latest_l2 or latest_l2.outcome not in ("Pass", "Hold"):
            raise HTTPException(status_code=400, detail="Cannot schedule FINAL. Candidate must pass L2 first.")
    elif interview_in.round_type != "L1":
        raise HTTPException(status_code=400, detail=f"Invalid round type: {interview_in.round_type}. Allowed: L1, L2, FINAL")

    validate_panel_member_slot_availability(
        db,
        interview_in.panel_id,
        interview_in.scheduled_at,
    )

    interview = InterviewModel(
        candidate_id=interview_in.candidate_id,
        panel_id=interview_in.panel_id,
        round_type=interview_in.round_type,
        scheduled_at=interview_in.scheduled_at,
        status="Scheduled"
    )
    db.add(interview)
    
    from_status = candidate.status
    candidate.current_round = interview_in.round_type
    
    status_changed = False
    if candidate.status == "Shortlisted":
        candidate.status = "Interviewing"
        status_changed = True
        
    db.commit()
    db.refresh(interview)
    db.refresh(candidate)
    
    if candidate.status == "Interviewing":
        try:
            from app.services.email import send_status_email
            
            interview_date = interview.scheduled_at.strftime("%Y-%m-%d %H:%M") if interview.scheduled_at else None
            interview_link = getattr(interview, "meeting_link", None)
            
            send_status_email(
                candidate_email=candidate.email,
                candidate_name=candidate.full_name,
                job_title=candidate.job.title if candidate.job else "Unknown Position",
                from_status=from_status,
                to_status="Interviewing",
                interview_date=interview_date,
                interview_link=interview_link
            )
        except Exception as e:
            print(f"Failed to send status transition email during interview creation: {e}")
            
    return interview

@router.patch("/{id}", response_model=Interview)
def update_interview(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    id: int,
    interview_in: InterviewUpdate,
    x_timezone_offset: Optional[int] = Header(None, alias="X-Timezone-Offset"),
) -> Any:
    """Update interview details, outcome, status, or feedback notes."""
    interview = db.query(InterviewModel).filter(InterviewModel.id == id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Extract non-None updates
    update_data = interview_in.dict(exclude_unset=True)
    
    if "scheduled_at" in update_data and update_data["scheduled_at"] is not None:
        validate_future_datetime(update_data["scheduled_at"], x_timezone_offset)
    
    # Enforce outcome validity
    if "outcome" in update_data and update_data["outcome"] is not None:
        new_status = update_data.get("status", interview.status)
        if new_status != "Completed":
            raise HTTPException(status_code=400, detail="Interview must be 'Completed' to receive an outcome.")

    for field, value in update_data.items():
        setattr(interview, field, value)

    panel_id_to_check = update_data.get("panel_id", interview.panel_id)
    scheduled_at_to_check = update_data.get("scheduled_at", interview.scheduled_at)
    validate_panel_member_slot_availability(
        db,
        panel_id_to_check,
        scheduled_at_to_check,
        ignore_interview_id=interview.id,
    )

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
