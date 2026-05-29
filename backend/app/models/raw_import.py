from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base
from datetime import datetime

class RawCandidateImport(Base):
    """
    Staging table for Candidate spreadsheet data.
    Mapped directly to CSV headers using snake_case.
    """
    __tablename__ = "raw_candidates_import"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status_flag = Column(String, default="PENDING") # PENDING, PROCESSED, ERROR
    
    # Explicit CSV mappings
    name = Column(String, nullable=True)
    contact_number = Column(String, nullable=True)
    email_id = Column(String, nullable=True)
    vendor_hr_internal_referral = Column(String, nullable=True)
    current_location = Column(String, nullable=True)
    preferred_location = Column(String, nullable=True)
    current_organisation = Column(String, nullable=True)
    total_yoe = Column(String, nullable=True)
    relevant_yoe_pbcs = Column(String, nullable=True)
    notice_period = Column(String, nullable=True)
    
    l1_status = Column(String, nullable=True)
    l1_interviewer = Column(String, nullable=True)
    
    l2_status = Column(String, nullable=True)
    l2_interviewer = Column(String, nullable=True)
    
    final_round_with_sumit = Column(String, nullable=True)
    comment = Column(String, nullable=True)


class RawPanelImport(Base):
    """
    Staging table for Panel Availability spreadsheet data.
    Mapped directly to CSV headers.
    """
    __tablename__ = "raw_panel_import"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status_flag = Column(String, default="PENDING") # PENDING, PROCESSED, ERROR
    
    s_no = Column(String, nullable=True)
    panel_name = Column(String, nullable=True)
    interview_for = Column(String, nullable=True)
    hours_30_minutes_each = Column(String, nullable=True)
    
    # Hardcoded date columns to match the user's specific spreadsheet
    may_7_2026 = Column(String, nullable=True)
    may_8_2026 = Column(String, nullable=True)
    may_11_2026 = Column(String, nullable=True)
    may_12_2026 = Column(String, nullable=True)
    may_13_2026 = Column(String, nullable=True)
    may_14_2026 = Column(String, nullable=True)
    may_15_2026 = Column(String, nullable=True)
    may_18_2026 = Column(String, nullable=True)
    may_19_2026 = Column(String, nullable=True)
    may_20_2026 = Column(String, nullable=True)
    may_21_2026 = Column(String, nullable=True)
    may_22_2026 = Column(String, nullable=True)
    may_25_2026 = Column(String, nullable=True)
    may_26_2026 = Column(String, nullable=True)
    may_27_2026 = Column(String, nullable=True)
    may_28_2026 = Column(String, nullable=True)
    may_29_2026 = Column(String, nullable=True)
