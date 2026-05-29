from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class PanelMember(Base):
    __tablename__ = "panel_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    interview_for = Column(String)  # "Frontend, Backend, etc."
    team = Column(String, nullable=True)
    domain = Column(String, nullable=True)

    # Relationship back to panel availability
    availabilities = relationship("PanelAvailability", back_populates="panel_member", cascade="all, delete-orphan")
    # Will have relationship to INTERVIEW later

class PanelAvailability(Base):
    __tablename__ = "panel_availability"

    id = Column(Integer, primary_key=True, index=True)
    panel_id = Column(Integer, ForeignKey("panel_members.id"))
    available_date = Column(Date)
    start_time = Column(Time)
    end_time = Column(Time)

    panel_member = relationship("PanelMember", back_populates="availabilities")
