import sys
import os
import random
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.job import Job
# Add backend root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.candidate import Candidate
from app.models.panel import PanelMember
from app.models.interview import Interview
from app.models.raw_import import RawCandidateImport

ALLOWED_EMAILS = [
    "rupesh.lakhotia3@gmail.com",
    "giridharkumar92@gmail.com",
    "gurukumar3399@gmail.com",
    "hemkantasnh167@gmail.com",
    "hyp.lokesh@gmail.com",
    "narendra.r2026@gmail.com"
]

JOB_IDS = [
    9, 10, 5, 6, 7, 8,
    11, 12, 13, 14, 15, 16,
    19, 22, 25, 17, 20, 23,
    26, 18, 21, 24, 27
]


def normalize_round(raw_status: str):
    """
    Spreadsheet semantics:

    blank           -> round never reached
    To be schedule  -> reached round, not scheduled yet
    Scheduled       -> passed/completed round
    On Hold         -> hold at this round
    Rejected        -> failed at this round
    """

    if not raw_status:
        return None, None

    status_text = str(raw_status).strip().lower()

    if "to be schedule" in status_text:
        return "Pending", "Pending"

    if "scheduled" in status_text:
        return "Completed", "Pass"

    if "reject" in status_text or "fail" in status_text:
        return "Completed", "Fail"

    if "hold" in status_text:
        return "Completed", "Hold"

    return "Completed", raw_status


def process_selected_candidates(db: Session):

    print("Processing Selected Candidates Only...")

    raw_candidates = (
        db.query(RawCandidateImport)
        .filter(func.lower(RawCandidateImport.email_id).in_(ALLOWED_EMAILS))
        .all()
    )

    print(f"Found {len(raw_candidates)} matching candidates.")

    for index, rc in enumerate(raw_candidates):

        if not rc.name:
            continue

        email = rc.email_id.lower().strip()

        # Assign deterministic rotating job ID
        assigned_job_id = JOB_IDS[index % len(JOB_IDS)]

        # Check if candidate already exists
        candidate = db.query(Candidate).filter(
            func.lower(Candidate.email) == email
        ).first()

        if not candidate:

            # Safely parse experience
            yoe = 0

            if rc.total_yoe:
                try:
                    yoe = int(float(str(rc.total_yoe).strip()))
                except:
                    pass

            candidate = Candidate(
                full_name=rc.name,
                email=email,
                phone=rc.contact_number,
                current_org=rc.current_organisation,
                notice_period=rc.notice_period,
                experience_years=yoe,
                status="Applied",
                job_id=assigned_job_id
            )

            db.add(candidate)
            db.commit()
            db.refresh(candidate)

            print(
                f"Created candidate: {candidate.full_name} "
                f"(Job ID: {assigned_job_id})"
            )

        # Process L1 and L2 only
        rounds = [
            ("L1", rc.l1_interviewer, rc.l1_status),
            ("L2", rc.l2_interviewer, rc.l2_status)
        ]

        for round_type, panel_name, round_status in rounds:

            # blank = round never happened
            if not round_status:
                continue

            panel_id = None

            # Find/Create panel member
            if panel_name and str(panel_name).lower() != "nan":

                member = db.query(PanelMember).filter(
                    func.lower(PanelMember.name) == str(panel_name).lower()
                ).first()

                if not member:

                    member = PanelMember(
                        name=panel_name,
                        email=f"{str(panel_name).replace(' ', '_').lower()}@example.com"
                    )

                    db.add(member)

                    try:
                        db.commit()
                        db.refresh(member)

                    except:
                        db.rollback()

                        member = db.query(PanelMember).filter(
                            PanelMember.email ==
                            f"{str(panel_name).replace(' ', '_').lower()}@example.com"
                        ).first()

                panel_id = member.id if member else None

            # Prevent duplicate rounds
            exists = db.query(Interview).filter(
                Interview.candidate_id == candidate.id,
                Interview.round_type == round_type
            ).first()

            if exists:
                continue

            interview_status, interview_outcome = normalize_round(round_status)

            interview = Interview(
                candidate_id=candidate.id,
                panel_id=panel_id,
                round_type=round_type,
                outcome=interview_outcome,
                status=interview_status,
                feedback_notes=rc.comment
            )

            db.add(interview)

            print(
                f"Added {round_type} for {candidate.full_name} "
                f"({interview_outcome})"
            )

        # Update current_round intelligently
        if rc.l2_status:
            candidate.current_round = "L2"

        elif rc.l1_status:
            candidate.current_round = "L1"

        # Update candidate workflow state
        latest_status = None

        if rc.l2_status:
            latest_status = str(rc.l2_status).strip().lower()

        elif rc.l1_status:
            latest_status = str(rc.l1_status).strip().lower()

        if latest_status:

            if "reject" in latest_status or "fail" in latest_status:
                candidate.status = "Rejected"

            elif "hold" in latest_status:
                candidate.status = "Interviewed"

            elif "to be schedule" in latest_status:
                candidate.status = "Shortlisted"

            elif "scheduled" in latest_status:
                candidate.status = "Interviewed"

        db.commit()

    print("Selected candidate import completed successfully.")


def run():

    db = SessionLocal()

    try:
        process_selected_candidates(db)

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()

    finally:
        db.close()


if __name__ == "__main__":
    run()