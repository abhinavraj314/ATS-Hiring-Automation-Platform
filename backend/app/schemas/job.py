from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

AssessmentTemplate = Literal["POWER_PLATFORM", "ORACLE_EPM", "SQL"]


class JobBase(BaseModel):
    title: str
    description: str
    required_skills: str
    min_experience: int = 0
    preferred_skills: Optional[str] = None
    raw_jd_text: Optional[str] = None
    assessment_required: bool = False
    assessment_template: Optional[AssessmentTemplate] = None
    passing_score: int = Field(default=70, ge=0, le=100)

    @model_validator(mode="after")
    def validate_assessment_config(self) -> "JobBase":
        if self.assessment_required and not self.assessment_template:
            raise ValueError(
                "assessment_template is required when assessment_required is True"
            )
        return self


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    min_experience: Optional[int] = None
    preferred_skills: Optional[str] = None
    raw_jd_text: Optional[str] = None
    assessment_required: Optional[bool] = None
    assessment_template: Optional[AssessmentTemplate] = None
    passing_score: Optional[int] = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def validate_assessment_config(self) -> "JobUpdate":
        if self.assessment_required is True and not self.assessment_template:
            raise ValueError(
                "assessment_template is required when assessment_required is True"
            )
        return self


class Job(JobBase):
    id: int
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True
