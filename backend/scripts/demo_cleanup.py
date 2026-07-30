"""
Demo Cleanup Script

Keeps ONLY these ATS candidates:
1. bhuvii.3140@gmail.com
2. basement.0777@gmail.com
3. abhiii.3140@gmail.com

Deletes all other candidates and their associated ATS records.
Does NOT modify Jobs, Recruiters, Moodle users, courses, grades, quiz attempts, or enrollments.

Run from the backend directory:
    python scripts/demo_cleanup.py --dry-run
    python scripts/demo_cleanup.py
"""

import os
import sys
import argparse

# Append backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.job import Job
from app.models.user import User
from app.models.panel import PanelMember, PanelAvailability
from app.models.candidate import Candidate
from app.models.candidate_note import CandidateNote
from app.models.embedding import CandidateEmbedding
from app.models.feedback import RecruiterFeedbackEvent
from app.models.interview import Interview
from app.models.match import CandidateJobMatch
from app.models.raw_import import RawCandidateImport


CANDIDATE_IDS_TO_KEEP = {11, 15, 10}


def run_cleanup(db: Session, dry_run: bool):
    print("=" * 60)
    print("DEMO ATS ENVIRONMENT CLEANUP")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (No changes will be saved)' if dry_run else 'REAL RUN (Changes will be written to DB)'}")
    print("-" * 60)

    # 1. Fetch all candidates
    all_candidates = db.query(Candidate).all()
    
    keep_list = []
    delete_list = []
    
    for c in all_candidates:
        if c.id in CANDIDATE_IDS_TO_KEEP:
            keep_list.append(c)
        else:
            delete_list.append(c)

    # Show exactly which candidates will be kept
    print("\n[KEEP LIST] The following candidates will be KEPT:")
    if not keep_list:
        print("  (None found)")
    for c in keep_list:
        print(f"  * ID: {c.id} | Name: {c.full_name} | Email: {c.email} | Job ID: {c.job_id} | Status: {c.status} | Assessment Status: {c.assessment_status}")

    # Show exactly which candidates will be deleted
    print(f"\n[DELETE LIST] The following {len(delete_list)} candidates will be DELETED:")
    if not delete_list:
        print("  (None found)")
    for c in delete_list:
        print(f"  - ID: {c.id} | Name: {c.full_name} | Email: {c.email} | Job ID: {c.job_id} | Status: {c.status} | Assessment Status: {c.assessment_status}")

    if not delete_list:
        print("\nNo candidates to delete. Environment is already clean.")
        return

    # 2. Gather matching records to delete
    delete_candidate_ids = [c.id for c in delete_list]
    delete_emails = [c.email for c in delete_list if c.email]

    # Find records linked by candidate ID
    matches = db.query(CandidateJobMatch).filter(CandidateJobMatch.candidate_id.in_(delete_candidate_ids)).all()
    embeddings = db.query(CandidateEmbedding).filter(CandidateEmbedding.candidate_id.in_(delete_candidate_ids)).all()
    notes = db.query(CandidateNote).filter(CandidateNote.candidate_id.in_(delete_candidate_ids)).all()
    interviews = db.query(Interview).filter(Interview.candidate_id.in_(delete_candidate_ids)).all()
    feedbacks = db.query(RecruiterFeedbackEvent).filter(RecruiterFeedbackEvent.candidate_id.in_(delete_candidate_ids)).all()
    
    # Clean staging raw imports matching delete emails
    raw_imports = db.query(RawCandidateImport).filter(RawCandidateImport.email_id.in_(delete_emails)).all()

    # Print summary by table
    print("\n" + "-" * 60)
    print("DELETION SUMMARY BY TABLE:")
    print("-" * 60)
    print(f"  Candidates (candidates):              {len(delete_list)}")
    print(f"  CandidateJobMatch (candidate_job_matches): {len(matches)}")
    print(f"  CandidateEmbedding (candidate_embeddings): {len(embeddings)}")
    print(f"  CandidateNote (candidate_notes):          {len(notes)}")
    print(f"  Interview (interviews):                   {len(interviews)}")
    print(f"  RecruiterFeedbackEvent (recruiter_feedback_events): {len(feedbacks)}")
    print(f"  RawCandidateImport (raw_candidates_import): {len(raw_imports)}")
    print("-" * 60)

    if dry_run:
        print("\nDry run completed. No records were modified.")
        return

    # Request confirmation
    try:
        confirm = input("\nAre you sure you want to permanently delete these records? (yes/no): ").strip().lower()
    except (IOError, KeyboardInterrupt):
        print("\nInteractive confirmation not possible or cancelled. Deletion aborted.")
        return

    if confirm != "yes":
        print("Deletion cancelled by user.")
        return

    print("\nDeleting records...")
    
    for record in matches:
        db.delete(record)
    for record in embeddings:
        db.delete(record)
    for record in notes:
        db.delete(record)
    for record in interviews:
        db.delete(record)
    for record in feedbacks:
        db.delete(record)
    for record in raw_imports:
        db.delete(record)
    for record in delete_list:
        db.delete(record)

    db.commit()
    print("Database updates committed successfully. ATS demo environment is now clean!")


def main():
    parser = argparse.ArgumentParser(description="Clean up ATS demo environment to keep only three specified candidates.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate the cleanup process without writing changes to the database.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        run_cleanup(db, dry_run=args.dry_run)
    except Exception as exc:
        db.rollback()
        print(f"\n[ERROR] Cleanup failed: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
