from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.candidate import Candidate
from app.schemas.panel import PanelMember

class InterviewBase(BaseModel):
    candidate_id: int
    panel_id: Optional[int] = None
    round_type: str
    scheduled_at: Optional[datetime] = None
    status: str = "Scheduled"
    outcome: Optional[str] = None
    feedback_notes: Optional[str] = None

class InterviewCreate(BaseModel):
    candidate_id: int
    panel_id: Optional[int] = None
    round_type: str
    scheduled_at: Optional[datetime] = None

class InterviewUpdate(BaseModel):
    panel_id: Optional[int] = None
    round_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None
    outcome: Optional[str] = None
    feedback_notes: Optional[str] = None

class Interview(InterviewBase):
    id: int
    candidate: Optional[Candidate] = None
    panel_member: Optional[PanelMember] = None

    class Config:
        from_attributes = True
