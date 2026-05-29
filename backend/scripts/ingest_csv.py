import sys
import os
import uuid
import pandas as pd
from sqlalchemy.orm import Session

# Add the parent directory to sys.path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.raw_import import RawCandidateImport, RawPanelImport

def clean_value(val):
    """Safely handle NaNs, floats that are NaNs, and empty strings."""
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ['nan', 'nat', 'none']:
        return None
    return val_str

def ingest_candidates(db: Session, csv_path: str):
    print(f"Ingesting Candidates from {csv_path}...")
    batch_id = str(uuid.uuid4())
    try:
        # utf-8-sig automatically handles BOM if present
        df = pd.read_csv(
            csv_path,
            encoding='latin1',
            skipinitialspace=True
        )
    except Exception as e:
        print(f"Failed to read Candidates CSV: {e}")
        return
        
    # Map exact expected CSV headers to DB columns
    column_mapping = {
        'Name': 'name',
        'Contact Number': 'contact_number',
        'Email ID': 'email_id',
        'Vendor/HR/Internal Referral': 'vendor_hr_internal_referral',
        'Current Location': 'current_location',
        'Preferred Location': 'preferred_location',
        'Current Organisation': 'current_organisation',
        'Total YOE': 'total_yoe',
        'Relevant YOE (in PBCS)': 'relevant_yoe_pbcs',
        'Notice Period (In how many days can they join if already serving NP)': 'notice_period',
        'L1 Status': 'l1_status',
        'L1 Interviewer': 'l1_interviewer',
        'L2 Status': 'l2_status',
        'L2 Interviewer': 'l2_interviewer',
        'Final Round with Sumit': 'final_round_with_sumit',
        'Comment': 'comment'
    }
    
    # Rename columns that match, ignoring extra ones gracefully
    actual_columns = {}
    for col in df.columns:
        clean_col = col.strip()
        if clean_col in column_mapping:
            actual_columns[col] = column_mapping[clean_col]
            
    df = df.rename(columns=actual_columns)
    
    rows_added = 0
    for idx, row in df.iterrows():
        # Minimum check to skip totally empty rows from dirty Excel sheets
        if pd.isna(row.get('name')) and pd.isna(row.get('email_id')):
            print(f"Skipping row {idx+2}: missing both Name and Email ID")
            continue
            
        record = RawCandidateImport(
            import_batch_id=batch_id,
            name=clean_value(row.get('name')),
            contact_number=clean_value(row.get('contact_number')),
            email_id=clean_value(row.get('email_id')),
            vendor_hr_internal_referral=clean_value(row.get('vendor_hr_internal_referral')),
            current_location=clean_value(row.get('current_location')),
            preferred_location=clean_value(row.get('preferred_location')),
            current_organisation=clean_value(row.get('current_organisation')),
            total_yoe=clean_value(row.get('total_yoe')),
            relevant_yoe_pbcs=clean_value(row.get('relevant_yoe_pbcs')),
            notice_period=clean_value(row.get('notice_period')),
            l1_status=clean_value(row.get('l1_status')),
            l1_interviewer=clean_value(row.get('l1_interviewer')),
            l2_status=clean_value(row.get('l2_status')),
            l2_interviewer=clean_value(row.get('l2_interviewer')),
            final_round_with_sumit=clean_value(row.get('final_round_with_sumit')),
            comment=clean_value(row.get('comment'))
        )
        db.add(record)
        rows_added += 1
        
    db.commit()
    print(f"Successfully ingested {rows_added} candidate records in batch {batch_id}.")

def ingest_panels(db: Session, csv_path: str):
    print(f"Ingesting Panels from {csv_path}...")
    batch_id = str(uuid.uuid4())
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig', skipinitialspace=True)
    except Exception as e:
        print(f"Failed to read Panels CSV: {e}")
        return
        
    # Map CSV headers to DB columns
    column_mapping = {
        'S.No': 's_no',
        'Panel Name': 'panel_name',
        'Interview For': 'interview_for',
        'Hours (30 minutes each)': 'hours_30_minutes_each',
        '7th May 2026': 'may_7_2026',
        '8th May 2026': 'may_8_2026',
        '11th May 2026': 'may_11_2026',
        '12th May 2026': 'may_12_2026',
        '13th May 2026': 'may_13_2026',
        '14th May 2026': 'may_14_2026',
        '15th May 2026': 'may_15_2026',
        '18th May 2026': 'may_18_2026',
        '19th May 2026': 'may_19_2026',
        '20th May 2026': 'may_20_2026',
        '21st May 2026': 'may_21_2026',
        '22nd May 2026': 'may_22_2026',
        '25th May 2026': 'may_25_2026',
        '26th May 2026': 'may_26_2026',
        '27th May 2026': 'may_27_2026',
        '28th May 2026': 'may_28_2026',
        '29th May 2026': 'may_29_2026'
    }
    
    actual_columns = {}
    for col in df.columns:
        clean_col = col.strip()
        if clean_col in column_mapping:
            actual_columns[col] = column_mapping[clean_col]
            
    df = df.rename(columns=actual_columns)
    
    rows_added = 0
    for idx, row in df.iterrows():
        if pd.isna(row.get('panel_name')):
            print(f"Skipping row {idx+2}: missing Panel Name")
            continue
            
        record = RawPanelImport(
            import_batch_id=batch_id,
            s_no=clean_value(row.get('s_no')),
            panel_name=clean_value(row.get('panel_name')),
            interview_for=clean_value(row.get('interview_for')),
            hours_30_minutes_each=clean_value(row.get('hours_30_minutes_each')),
            may_7_2026=clean_value(row.get('may_7_2026')),
            may_8_2026=clean_value(row.get('may_8_2026')),
            may_11_2026=clean_value(row.get('may_11_2026')),
            may_12_2026=clean_value(row.get('may_12_2026')),
            may_13_2026=clean_value(row.get('may_13_2026')),
            may_14_2026=clean_value(row.get('may_14_2026')),
            may_15_2026=clean_value(row.get('may_15_2026')),
            may_18_2026=clean_value(row.get('may_18_2026')),
            may_19_2026=clean_value(row.get('may_19_2026')),
            may_20_2026=clean_value(row.get('may_20_2026')),
            may_21_2026=clean_value(row.get('may_21_2026')),
            may_22_2026=clean_value(row.get('may_22_2026')),
            may_25_2026=clean_value(row.get('may_25_2026')),
            may_26_2026=clean_value(row.get('may_26_2026')),
            may_27_2026=clean_value(row.get('may_27_2026')),
            may_28_2026=clean_value(row.get('may_28_2026')),
            may_29_2026=clean_value(row.get('may_29_2026'))
        )
        db.add(record)
        rows_added += 1
        
    db.commit()
    print(f"Successfully ingested {rows_added} panel records in batch {batch_id}.")

def run():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    candidates_csv = os.path.join(base_dir, "data", "imports", "Oracle_EPM_Interview_Tracker.csv")
    panels_csv = os.path.join(base_dir, "data", "imports", "Hiring_Panel_Availability.csv")
    
    db = SessionLocal()
    try:
        if os.path.exists(candidates_csv):
            ingest_candidates(db, candidates_csv)
        else:
            print(f"Candidates CSV not found at: {candidates_csv}")
            
        if os.path.exists(panels_csv):
            ingest_panels(db, panels_csv)
        else:
            print(f"Panels CSV not found at: {panels_csv}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
