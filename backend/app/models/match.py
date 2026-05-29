from sqlalchemy import Column, Integer, String, Float, JSON, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class CandidateJobMatch(Base):
    __tablename__ = "candidate_job_matches"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), index=True)
    
    semantic_score = Column(Float, default=0.0)
    match_signals = Column(JSON, nullable=True)
    model_version = Column(String, default="domain_model_v1")
    embedding_metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
