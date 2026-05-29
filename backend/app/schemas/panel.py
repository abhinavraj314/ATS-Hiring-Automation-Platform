from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, time

class PanelAvailabilityBase(BaseModel):
    available_date: date
    start_time: time
    end_time: time

class PanelAvailabilityCreate(PanelAvailabilityBase):
    pass

class PanelAvailability(PanelAvailabilityBase):
    id: int
    panel_id: int

    class Config:
        from_attributes = True

class PanelMemberBase(BaseModel):
    name: str
    email: EmailStr
    interview_for: Optional[str] = None

class PanelMemberCreate(PanelMemberBase):
    pass

class PanelMember(PanelMemberBase):
    id: int
    availabilities: List[PanelAvailability] = []

    class Config:
        from_attributes = True
