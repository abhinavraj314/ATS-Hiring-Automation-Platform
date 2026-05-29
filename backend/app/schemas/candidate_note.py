from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CandidateNoteBase(BaseModel):
    comment: str

class CandidateNoteCreate(CandidateNoteBase):
    pass

class CandidateNote(CandidateNoteBase):
    id: int
    candidate_id: int
    recruiter_id: int
    created_at: datetime

    class Config:
        from_attributes = True
