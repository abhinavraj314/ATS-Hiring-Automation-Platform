"""
Delete test/demo candidates and their related records.

Run from the backend directory:
    python scripts/cleanup_test_candidates.py --dry-run
    python scripts/cleanup_test_candidates.py
"""
import argparse
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.user import User
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.candidate_note import CandidateNote
from app.models.panel import PanelMember, PanelAvailability
from app.models.embedding import CandidateEmbedding, JobEmbedding
from app.models.feedback import RecruiterFeedbackEvent
from app.models.interview import Interview
from app.models.match import CandidateJobMatch


def _split_full_name(full_name: str | None) -> tuple[str, str]:
    parts = (full_name or "").strip().split()
    if not parts:
        return "", ""
    first_name = parts[0]
    last_name = parts[-1] if len(parts) > 1 else ""
    return first_name, last_name


def is_test_candidate(candidate: Candidate) -> bool:
    """Return True when a candidate matches test-data cleanup rules."""
    email = (candidate.email or "").strip().lower()
    first_name, last_name = _split_full_name(candidate.full_name)

    if email and "@example.com" in email:
        return True
    if email.startswith("ats_"):
        return True
    if "test" in first_name.lower():
        return True
    if last_name and "test" in last_name.lower():
        return True
    return False


def find_test_candidates(db: Session) -> list[Candidate]:
    candidates = db.query(Candidate).all()
    return [candidate for candidate in candidates if is_test_candidate(candidate)]

def cleanup_candidate_by_email(
    db: Session,
    email: str,
    dry_run: bool = False,
) -> dict[str, int]:
    candidate = (
        db.query(Candidate)
        .filter(Candidate.email.ilike(email))
        .first()
    )

    summary = {
        "candidates_deleted": 0,
        "matches_deleted": 0,
        "embeddings_deleted": 0,
    }

    print("=" * 60)
    print("CANDIDATE CLEANUP")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'DELETE'}")
    print(f"Target email: {email}")
    print("-" * 60)

    if not candidate:
        print("Candidate not found.")
        return summary

    print(
        f"id={candidate.id} | "
        f"name={candidate.full_name} | "
        f"email={candidate.email}"
    )

    matches = (
        db.query(CandidateJobMatch)
        .filter(CandidateJobMatch.candidate_id == candidate.id)
        .all()
    )

    embeddings = (
        db.query(CandidateEmbedding)
        .filter(CandidateEmbedding.candidate_id == candidate.id)
        .all()
    )

    notes = (
        db.query(CandidateNote)
        .filter(CandidateNote.candidate_id == candidate.id)
        .all()
    )

    interviews = (
        db.query(Interview)
        .filter(Interview.candidate_id == candidate.id)
        .all()
    )

    feedback_events = (
        db.query(RecruiterFeedbackEvent)
        .filter(RecruiterFeedbackEvent.candidate_id == candidate.id)
        .all()
    )

    print(f"CandidateJobMatch: {len(matches)}")
    print(f"CandidateEmbedding: {len(embeddings)}")
    print(f"CandidateNote: {len(notes)}")
    print(f"Interview: {len(interviews)}")
    print(f"RecruiterFeedbackEvent: {len(feedback_events)}")

    if dry_run:
        print("Dry run complete.")
        return summary

    db.query(CandidateJobMatch).filter(
        CandidateJobMatch.candidate_id == candidate.id
    ).delete(synchronize_session=False)

    db.query(CandidateEmbedding).filter(
        CandidateEmbedding.candidate_id == candidate.id
    ).delete(synchronize_session=False)

    db.query(CandidateNote).filter(
        CandidateNote.candidate_id == candidate.id
    ).delete(synchronize_session=False)

    db.query(Interview).filter(
        Interview.candidate_id == candidate.id
    ).delete(synchronize_session=False)

    db.query(RecruiterFeedbackEvent).filter(
        RecruiterFeedbackEvent.candidate_id == candidate.id
    ).delete(synchronize_session=False)

    # Flush/commit child deletions
    db.commit()

    # Now delete the candidate
    db.delete(candidate)
    db.commit()

    summary["candidates_deleted"] = 1
    summary["matches_deleted"] = len(matches)
    summary["embeddings_deleted"] = len(embeddings)

    print("Candidate deleted successfully.")
    return summary

def cleanup_test_candidates(db: Session, dry_run: bool = False) -> dict[str, int]:
    test_candidates = find_test_candidates(db)
    candidate_ids = [candidate.id for candidate in test_candidates]

    summary = {
        "candidates_deleted": 0,
        "matches_deleted": 0,
        "embeddings_deleted": 0,
    }

    print("=" * 60)
    print("TEST CANDIDATE CLEANUP")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'DELETE'}")
    print(f"Matched candidates: {len(test_candidates)}")
    print("-" * 60)

    if not test_candidates:
        print("No test candidates found.")
        return summary

    for candidate in test_candidates:
        first_name, last_name = _split_full_name(candidate.full_name)
        print(
            f"  id={candidate.id} | email={candidate.email} | "
            f"name={candidate.full_name} | assessment_status={candidate.assessment_status}"
        )
        print(f"    first_name={first_name!r} last_name={last_name!r}")

    if not candidate_ids:
        return summary

    matches = (
        db.query(CandidateJobMatch)
        .filter(CandidateJobMatch.candidate_id.in_(candidate_ids))
        .all()
    )
    embeddings = (
        db.query(CandidateEmbedding)
        .filter(CandidateEmbedding.candidate_id.in_(candidate_ids))
        .all()
    )
    notes = db.query(CandidateNote).filter(CandidateNote.candidate_id.in_(candidate_ids)).all()
    interviews = db.query(Interview).filter(Interview.candidate_id.in_(candidate_ids)).all()
    feedback_events = (
        db.query(RecruiterFeedbackEvent)
        .filter(RecruiterFeedbackEvent.candidate_id.in_(candidate_ids))
        .all()
    )

    print("-" * 60)
    print(f"Related records to remove:")
    print(f"  CandidateJobMatch: {len(matches)}")
    print(f"  CandidateEmbedding: {len(embeddings)}")
    print(f"  CandidateNote: {len(notes)}")
    print(f"  Interview: {len(interviews)}")
    print(f"  RecruiterFeedbackEvent: {len(feedback_events)}")
    print(
        "  Assessment fields: stored on candidate rows "
        "(moodle_user_id, assessment_status, scores, timestamps)"
    )

    if dry_run:
        print("-" * 60)
        print("Dry run complete. No records were deleted.")
        return summary

    for match in matches:
        db.delete(match)
    for embedding in embeddings:
        db.delete(embedding)
    for note in notes:
        db.delete(note)
    for interview in interviews:
        db.delete(interview)
    for event in feedback_events:
        db.delete(event)
    for candidate in test_candidates:
        db.delete(candidate)

    db.commit()

    summary["candidates_deleted"] = len(test_candidates)
    summary["matches_deleted"] = len(matches)
    summary["embeddings_deleted"] = len(embeddings)

    print("-" * 60)
    print("Cleanup summary:")
    print(f"  Candidates deleted: {summary['candidates_deleted']}")
    print(f"  Matches deleted: {summary['matches_deleted']}")
    print(f"  Embeddings deleted: {summary['embeddings_deleted']}")
    print("=" * 60)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Delete test/demo candidates and related records")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without deleting",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        cleanup_candidate_by_email(
            db,
            email="abhinik.0701@gmail.com",
            dry_run=args.dry_run,
        )
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Cleanup failed: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
