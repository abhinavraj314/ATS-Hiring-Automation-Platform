from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RecruiterFeedbackEventBase(BaseModel):
    action_type: str  # 'SHORTLIST', 'REJECT', 'HIRE', etc.
    rejection_reason_category: Optional[str] = None
    feedback_notes: Optional[str] = None

class RecruiterFeedbackEventCreate(RecruiterFeedbackEventBase):
    pass

class RecruiterFeedbackEventSchema(RecruiterFeedbackEventBase):
    id: int
    candidate_id: int
    job_id: int
    recruiter_id: Optional[int] = None
    original_semantic_score: float
    model_version: str
    created_at: datetime

    class Config:
        from_attributes = True
