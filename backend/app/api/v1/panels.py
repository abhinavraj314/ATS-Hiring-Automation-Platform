from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db, reset_sequence_if_empty
from app.api.deps import get_current_user
from app.models.user import User as UserModel
from app.models.panel import PanelMember as PanelMemberModel, PanelAvailability as PanelAvailabilityModel
from app.schemas.panel import PanelMember, PanelMemberCreate, PanelAvailability, PanelAvailabilityCreate

router = APIRouter()

@router.get("/", response_model=List[PanelMember])
def list_panel_members(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Any:
    return db.query(PanelMemberModel).all()

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
) -> Any:
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
