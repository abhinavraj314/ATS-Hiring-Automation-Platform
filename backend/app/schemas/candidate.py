from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class CandidateBase(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[str] = None
    education: Optional[str] = None
    experience_years: int = 0
    current_org: Optional[str] = None
    notice_period: Optional[str] = None
    status: str = "Applied"

class CandidateCreate(CandidateBase):
    job_id: int
    file_path: str
    raw_text: Optional[str] = None

class Candidate(CandidateBase):
    id: int
    job_id: int
    job_title: Optional[str] = None
    score: float
    score_breakdown: Optional[Dict[str, Any]] = None
    semantic_score: Optional[float] = None
    match_signals: Optional[Dict[str, Any]] = None
    reapplication_details: Optional[Dict[str, Any]] = None
    file_path: str
    raw_text: Optional[str] = None

    class Config:
        from_attributes = True
