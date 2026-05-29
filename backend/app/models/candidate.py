from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String, index=True)
    phone = Column(String)
    skills = Column(Text)  # Parsed skills
    education = Column(Text)
    experience_years = Column(Integer, default=0)
    current_org = Column(String, nullable=True)
    notice_period = Column(String, nullable=True)
    raw_text = Column(Text)  # Extracted text from file
    file_path = Column(String)
    
    score = Column(Float, default=0.0)
    score_breakdown = Column(JSON)  # For explainable AI insights
    
    status = Column(String, default="Applied")  # Applied, Under Review, Shortlisted, Interviewing, Selected, Rejected
    current_round = Column(String, nullable=True)  # L1, L2, Final, etc.
    reapplication_details = Column(JSON, nullable=True)
    
    job_id = Column(Integer, ForeignKey("jobs.id"))
    
    job = relationship("Job")

    @property
    def job_title(self) -> str:
        return self.job.title if self.job else None
