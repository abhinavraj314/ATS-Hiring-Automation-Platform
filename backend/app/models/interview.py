from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, Time
from sqlalchemy.orm import relationship
from app.core.database import Base

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    panel_id = Column(Integer, ForeignKey("panel_members.id"), nullable=True)
    
    round_type = Column(String)  # L1, L2, FINAL, HR, etc.
    scheduled_at = Column(DateTime, nullable=True)
    
    # Status of the interview block
    status = Column(String, default="Scheduled")  # Scheduled, Completed, No Show, Cancelled
    outcome = Column(String, nullable=True)  # Pass, Fail, Hold
    feedback_notes = Column(Text, nullable=True)

    candidate = relationship("Candidate")
    panel_member = relationship("PanelMember")

