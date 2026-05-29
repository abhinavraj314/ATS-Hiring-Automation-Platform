from sqlalchemy import Column, Integer, String, JSON, ForeignKey
from app.core.database import Base

class CandidateEmbedding(Base):
    __tablename__ = "candidate_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), index=True, unique=True)
    embedding = Column(JSON) # JSON array of floats
    model_version = Column(String, default="domain_model_v1")

class JobEmbedding(Base):
    __tablename__ = "job_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), index=True, unique=True)
    embedding = Column(JSON) # JSON array of floats
    model_version = Column(String, default="domain_model_v1")
