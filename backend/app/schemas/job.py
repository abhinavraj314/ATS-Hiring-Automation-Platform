from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class JobBase(BaseModel):
    title: str
    description: str
    required_skills: str
    min_experience: int = 0
    preferred_skills: Optional[str] = None
    raw_jd_text: Optional[str] = None

class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    min_experience: Optional[int] = None
    preferred_skills: Optional[str] = None
    raw_jd_text: Optional[str] = None

class Job(JobBase):
    id: int
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True
