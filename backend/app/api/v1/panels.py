from typing import Any, List, Optional
from datetime import date, time, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db, reset_sequence_if_empty
from app.api.deps import get_current_user
from app.models.user import User as UserModel
from app.models.panel import PanelMember as PanelMemberModel, PanelAvailability as PanelAvailabilityModel
from app.models.interview import Interview as InterviewModel
from app.schemas.panel import PanelMember, PanelMemberCreate, PanelAvailability, PanelAvailabilityCreate

router = APIRouter()

BLOCKING_INTERVIEW_STATUSES = {"Scheduled"}

def validate_future_availability(avail_date: date, start_time: time, end_time: time, timezone_offset: Optional[int] = None):
    # Use timezone offset if provided to construct the client timezone
    offset_minutes = timezone_offset if timezone_offset is not None else 0
    client_tz = timezone(timedelta(minutes=-offset_minutes))
    
    # Get current time in client's timezone
    client_now = datetime.now(client_tz)
    
    # Combine date and times into timezone-naive datetimes
    start_dt_naive = datetime.combine(avail_date, start_time)
    end_dt_naive = datetime.combine(avail_date, end_time)
    
    # Localize both to the client timezone
    start_dt = start_dt_naive.replace(tzinfo=client_tz)
    end_dt = end_dt_naive.replace(tzinfo=client_tz)
    
    if start_dt <= client_now:
        raise HTTPException(status_code=400, detail="Availability slot start time must be in the future.")
    if end_dt <= client_now:
        raise HTTPException(status_code=400, detail="Availability slot end time must be in the future.")
    if start_dt >= end_dt:
        raise HTTPException(status_code=400, detail="Slot start time must be before end time.")

    # Enforce 30-minute interval alignment
    if start_time.minute not in (0, 30) or start_time.second != 0 or start_time.microsecond != 0:
        raise HTTPException(status_code=400, detail="Availability start time must be aligned to a 30-minute interval (e.g. 08:00 or 08:30).")
    if end_time.minute not in (0, 30) or end_time.second != 0 or end_time.microsecond != 0:
        raise HTTPException(status_code=400, detail="Availability end time must be aligned to a 30-minute interval (e.g. 09:00 or 09:30).")

    # Enforce working hours (08:00 AM to 09:00 PM)
    EARLIEST_START = time(8, 0, 0)
    LATEST_END = time(21, 0, 0)
    
    if start_time < EARLIEST_START or end_time > LATEST_END:
        raise HTTPException(status_code=400, detail="Availability slots must fall within working hours (08:00 AM to 09:00 PM).")

    # Enforce minimum slot duration of 30 minutes
    duration = end_dt - start_dt
    if duration.total_seconds() < 1800:
        raise HTTPException(status_code=400, detail="Availability slot must be at least 30 minutes long.")



@router.get("/", response_model=List[PanelMember])
def list_panel_members(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Any:
    panel_members = db.query(PanelMemberModel).all()
    panel_ids = [panel_member.id for panel_member in panel_members]

    all_availabilities = []
    if panel_ids:
        all_availabilities = db.query(PanelAvailabilityModel).filter(
            PanelAvailabilityModel.panel_id.in_(panel_ids)
        ).all()

    active_interviews = []
    if panel_ids:
        active_interviews = db.query(InterviewModel).filter(
            InterviewModel.panel_id.in_(panel_ids),
            InterviewModel.status.in_(sorted(BLOCKING_INTERVIEW_STATUSES)),
        ).all()

    availabilities_by_panel = {}
    occupied_availability_ids_by_panel = {}

    for availability in all_availabilities:
        availabilities_by_panel.setdefault(availability.panel_id, []).append(availability)

    for interview in active_interviews:
        if interview.panel_id is None or interview.scheduled_at is None:
            continue

        interview_date = interview.scheduled_at.date()
        interview_time = interview.scheduled_at.time()

        for availability in availabilities_by_panel.get(interview.panel_id, []):
            if availability.available_date != interview_date:
                continue
            if availability.start_time <= interview_time < availability.end_time:
                occupied_availability_ids_by_panel.setdefault(availability.panel_id, set()).add(availability.id)

    for panel_member in panel_members:
        occupied_ids = occupied_availability_ids_by_panel.get(panel_member.id, set())
        panel_member.availabilities = [
            availability
            for availability in availabilities_by_panel.get(panel_member.id, [])
            if availability.id not in occupied_ids
        ]

    return panel_members

@router.post("/", response_model=PanelMember)
def create_panel_member(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    panel_in: PanelMemberCreate,
) -> Any:
    # Check if email already exists
    existing = db.query(PanelMemberModel).filter(PanelMemberModel.email == panel_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Panel member with this email already exists.")
    
    panel_member = PanelMemberModel(**panel_in.dict())
    db.add(panel_member)
    db.commit()
    db.refresh(panel_member)
    return panel_member

@router.delete("/{panel_id}")
def delete_panel_member(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    panel_id: int,
) -> Any:
    panel_member = db.query(PanelMemberModel).filter(PanelMemberModel.id == panel_id).first()
    if not panel_member:
        raise HTTPException(status_code=404, detail="Panel member not found")
        
    db.delete(panel_member)
    db.commit()
    reset_sequence_if_empty(db, PanelMemberModel)
    return {"status": "success"}

@router.post("/{panel_id}/availability", response_model=PanelAvailability)
def add_availability(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    panel_id: int,
    availability_in: PanelAvailabilityCreate,
    x_timezone_offset: Optional[int] = Header(None, alias="X-Timezone-Offset"),
) -> Any:
    # Validate that availability is in the future
    validate_future_availability(
        availability_in.available_date,
        availability_in.start_time,
        availability_in.end_time,
        x_timezone_offset
    )

    panel_member = db.query(PanelMemberModel).filter(PanelMemberModel.id == panel_id).first()
    if not panel_member:
        raise HTTPException(status_code=404, detail="Panel member not found")
        
    avail = PanelAvailabilityModel(
        panel_id=panel_id,
        **availability_in.dict()
    )
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail

@router.delete("/availability/{avail_id}")
def delete_availability(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
    avail_id: int,
) -> Any:
    avail = db.query(PanelAvailabilityModel).filter(PanelAvailabilityModel.id == avail_id).first()
    if not avail:
        raise HTTPException(status_code=404, detail="Availability block not found")
        
    db.delete(avail)
    db.commit()
    reset_sequence_if_empty(db, PanelAvailabilityModel)
    return {"status": "success"}
