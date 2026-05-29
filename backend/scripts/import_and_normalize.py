import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

# Add the parent directory to sys.path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.candidate import Candidate
from app.models.panel import PanelMember, PanelAvailability
from app.models.interview import Interview
from app.models.raw_import import RawCandidateImport, RawPanelImport
from app.models.job import Job

def process_raw_panels(db: Session):
    print("Processing Raw Panels...")
    raw_panels = db.query(RawPanelImport).filter(RawPanelImport.status_flag == "PENDING").all()
    
    # Mapping the specific raw column names to actual date objects
    # 7th May 2026, 8th May 2026, etc.
    date_columns = {
        'may_7_2026': datetime(2026, 5, 7).date(),
        'may_8_2026': datetime(2026, 5, 8).date(),
        'may_11_2026': datetime(2026, 5, 11).date(),
        'may_12_2026': datetime(2026, 5, 12).date(),
        'may_13_2026': datetime(2026, 5, 13).date(),
        'may_14_2026': datetime(2026, 5, 14).date(),
        'may_15_2026': datetime(2026, 5, 15).date(),
        'may_18_2026': datetime(2026, 5, 18).date(),
        'may_19_2026': datetime(2026, 5, 19).date(),
        'may_20_2026': datetime(2026, 5, 20).date(),
        'may_21_2026': datetime(2026, 5, 21).date(),
        'may_22_2026': datetime(2026, 5, 22).date(),
        'may_25_2026': datetime(2026, 5, 25).date(),
        'may_26_2026': datetime(2026, 5, 26).date(),
        'may_27_2026': datetime(2026, 5, 27).date(),
        'may_28_2026': datetime(2026, 5, 28).date(),
        'may_29_2026': datetime(2026, 5, 29).date()
    }
    
    for rp in raw_panels:
        if not rp.panel_name:
            continue
            
        # Email isn't in the new spreadsheet, so we'll generate a placeholder or use the name as unique for MVP
        placeholder_email = f"{rp.panel_name.replace(' ', '.').lower()}@example.com"
        
        # Upsert panel member
        member = db.query(PanelMember).filter(PanelMember.name == rp.panel_name).first()
        if not member:
            member = PanelMember(
                name=rp.panel_name,
                email=placeholder_email,
                interview_for=rp.interview_for,
            )
            db.add(member)
            db.commit()
            db.refresh(member)
            
        # Add availability slots
        for col_name, avail_date in date_columns.items():
            slots_col = getattr(rp, col_name)
            if slots_col and str(slots_col).strip().upper() == 'X':
                try:
                    # Time is in hours_30_minutes_each, e.g., '10:00 AM'
                    time_str = str(rp.hours_30_minutes_each).strip()
                    if time_str:
                        start_time = datetime.strptime(time_str, "%I:%M %p").time()
                        # Add 30 minutes for end time
                        end_dt = datetime.combine(avail_date, start_time) + timedelta(minutes=30)
                        end_time = end_dt.time()
                        
                        # Check if this exact slot already exists for the member to prevent duplicates
                        exists = db.query(PanelAvailability).filter(
                            PanelAvailability.panel_id == member.id,
                            PanelAvailability.available_date == avail_date,
                            PanelAvailability.start_time == start_time,
                            PanelAvailability.end_time == end_time
                        ).first()
                        
                        if not exists:
                            avail = PanelAvailability(
                                panel_id=member.id,
                                available_date=avail_date,
                                start_time=start_time,
                                end_time=end_time
                            )
                            db.add(avail)
                except Exception as e:
                    print(f"Error parsing availability for {rp.panel_name} on {avail_date} with time {rp.hours_30_minutes_each}: {e}")
                    
        rp.status_flag = "PROCESSED"
        db.commit()

def process_raw_candidates(db: Session):
    print("Processing Raw Candidates...")
    raw_cands = db.query(RawCandidateImport).filter(RawCandidateImport.status_flag == "PENDING").all()
    
    for rc in raw_cands:
        if not rc.name:
            continue
            
        # 1. Upsert Candidate
        # Email might be present in the new sheet (email_id)
        email = rc.email_id if rc.email_id else f"{rc.name.replace(' ', '.').lower()}@placeholder.com"
        
        candidate = db.query(Candidate).filter(Candidate.email == email).first()
        if not candidate:
            # Safely parse YOE
            yoe = 0
            if rc.total_yoe:
                try:
                    yoe = int(float(str(rc.total_yoe).strip()))
                except ValueError:
                    pass
                    
            candidate = Candidate(
                full_name=rc.name,
                email=email,
                phone=rc.contact_number,
                current_org=rc.current_organisation,
                notice_period=rc.notice_period,
                experience_years=yoe,
                status="Applied" # Default starting status
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)
            
        # 2. Process Interview Rounds
        rounds = [
            ("L1", rc.l1_interviewer, None, rc.l1_status), # Date isn't explicitly in candidate sheet, just interviewer/status
            ("L2", rc.l2_interviewer, None, rc.l2_status),
            ("FINAL", rc.final_round_with_sumit, None, rc.final_round_with_sumit) # using Sumit round column as final
        ]
        
        for round_type, panel_name, round_date, round_status in rounds:
            if not panel_name and not round_status:
                continue
                
            # Find or create a panel member placeholder if they don't exist by name
            panel_id = None
            if panel_name and str(panel_name).lower() != 'nan':
                member = db.query(PanelMember).filter(func.lower(PanelMember.name) == str(panel_name).lower()).first()
                if not member:
                    # Create placeholder
                    member = PanelMember(
                        name=panel_name, 
                        email=f"{str(panel_name).replace(' ', '_').lower()}@example.com"
                    )
                    db.add(member)
                    try:
                        db.commit()
                        db.refresh(member)
                    except Exception as e:
                        db.rollback()
                        # If email exists, find by email instead
                        email = f"{str(panel_name).replace(' ', '_').lower()}@example.com"
                        member = db.query(PanelMember).filter(PanelMember.email == email).first()
                panel_id = member.id if member else None

            # Check if this interview round already exists for the candidate
            exists = db.query(Interview).filter(
                Interview.candidate_id == candidate.id,
                Interview.round_type == round_type
            ).first()
            
            if exists:
                exists.panel_id = panel_id
                exists.outcome = round_status
                exists.status = "Completed" if round_status else "Scheduled"
                if round_type == "FINAL":
                    exists.feedback_notes = rc.comment
            else:
                interview = Interview(
                    candidate_id=candidate.id,
                    panel_id=panel_id,
                    round_type=round_type,
                    outcome=round_status,
                    status="Completed" if round_status else "Scheduled",
                    feedback_notes=rc.comment if round_type == "FINAL" else None
                )
                db.add(interview)
            
        rc.status_flag = "PROCESSED"
        db.commit()

def run():
    db = SessionLocal()
    try:
        process_raw_panels(db)
        process_raw_candidates(db)
        print("Data transformation and normalization completed successfully.")
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()
