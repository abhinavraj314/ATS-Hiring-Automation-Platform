from sqlalchemy import Boolean, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

ASSESSMENT_TEMPLATE_POWER_PLATFORM = "POWER_PLATFORM"
ASSESSMENT_TEMPLATE_ORACLE_EPM = "ORACLE_EPM"
ASSESSMENT_TEMPLATE_SQL = "SQL"

ASSESSMENT_TEMPLATES = (
    ASSESSMENT_TEMPLATE_POWER_PLATFORM,
    ASSESSMENT_TEMPLATE_ORACLE_EPM,
    ASSESSMENT_TEMPLATE_SQL,
)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=False)
    required_skills = Column(Text)  # Comma-separated or JSON
    preferred_skills = Column(Text, nullable=True)
    raw_jd_text = Column(Text, nullable=True)
    min_experience = Column(Integer, default=0)
    assessment_required = Column(Boolean, default=False, nullable=False)
    assessment_template = Column(String, nullable=True)
    passing_score = Column(Integer, default=70, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    owner_id = Column(Integer, ForeignKey("users.id"))
