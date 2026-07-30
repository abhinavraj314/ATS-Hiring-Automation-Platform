from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class RecruiterFeedbackEvent(Base):
    __tablename__ = "recruiter_feedback_events"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    
    action_type = Column(String)  # 'SHORTLIST', 'REJECT', 'HIRE', 'STRETCH_INTERVIEW'
    original_semantic_score = Column(Float, default=0.0)
    model_version = Column(String, default="domain_model_v1")
    rejection_reason_category = Column(String, nullable=True)
    feedback_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
