import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.candidate import (
    ASSESSMENT_STATUS_ASSIGNED,
    ASSESSMENT_STATUS_FAILED,
    ASSESSMENT_STATUS_PASSED,
    Candidate,
)
from app.models.job import Job
from app.services.moodle_service import ASSESSMENT_COURSE_MAP, get_moodle_service

logger = logging.getLogger(__name__)


@dataclass
class AssessmentSyncResult:
    """Structured result from syncing a candidate's Moodle assessment."""

    candidate_id: int
    outcome: str
    assessment_status: Optional[str] = None
    assessment_score: Optional[float] = None
    assessment_percentage: Optional[float] = None
    error: Optional[str] = None


def sync_candidate_assessment(
    candidate: Candidate,
    job: Job,
    db: Session,
) -> AssessmentSyncResult:
    """
    Sync Moodle assessment grades for a candidate assigned to an assessment.

    Only processes candidates with assessment_status=ASSIGNED and a moodle_user_id.
    Candidates without a completed Moodle attempt are left unchanged.
    """
    if candidate.assessment_status != ASSESSMENT_STATUS_ASSIGNED:
        logger.debug(
            "Skipping assessment sync for candidate id=%s: status is '%s'",
            candidate.id,
            candidate.assessment_status,
        )
        return AssessmentSyncResult(
            candidate_id=candidate.id,
            outcome="skipped",
            assessment_status=candidate.assessment_status,
            error="Candidate is not in ASSIGNED status",
        )

    if not candidate.moodle_user_id:
        logger.warning(
            "Skipping assessment sync for candidate id=%s: moodle_user_id is missing",
            candidate.id,
        )
        return AssessmentSyncResult(
            candidate_id=candidate.id,
            outcome="skipped",
            assessment_status=candidate.assessment_status,
            error="Missing moodle_user_id",
        )

    if not job.assessment_template:
        logger.warning(
            "Skipping assessment sync for candidate id=%s: job id=%s has no assessment_template",
            candidate.id,
            job.id,
        )
        return AssessmentSyncResult(
            candidate_id=candidate.id,
            outcome="error",
            assessment_status=candidate.assessment_status,
            error="Job assessment template is not configured",
        )

    course_id = ASSESSMENT_COURSE_MAP.get(job.assessment_template)
    if not course_id:
        logger.error(
            "No Moodle course mapping for template '%s' (candidate id=%s)",
            job.assessment_template,
            candidate.id,
        )
        return AssessmentSyncResult(
            candidate_id=candidate.id,
            outcome="error",
            assessment_status=candidate.assessment_status,
            error=f"Unknown assessment template: {job.assessment_template}",
        )

    try:
        moodle = get_moodle_service()
        grade_result = moodle.get_user_grades(
            moodle_user_id=candidate.moodle_user_id,
            course_id=course_id,
        )

        if not grade_result.success:
            if grade_result.error_code == "no_grades":
                logger.info(
                    "No Moodle grades yet for candidate id=%s (moodle_user_id=%s)",
                    candidate.id,
                    candidate.moodle_user_id,
                )
                return AssessmentSyncResult(
                    candidate_id=candidate.id,
                    outcome="pending",
                    assessment_status=candidate.assessment_status,
                )

            logger.error(
                "Moodle grade sync failed for candidate id=%s: %s",
                candidate.id,
                grade_result.error,
            )
            return AssessmentSyncResult(
                candidate_id=candidate.id,
                outcome="error",
                assessment_status=candidate.assessment_status,
                error=grade_result.error or "Failed to retrieve Moodle grades",
            )

        grade_data = grade_result.data if isinstance(grade_result.data, dict) else {}
        score = grade_data.get("score")
        percentage = grade_data.get("percentage")

        if score is None or percentage is None:
            logger.info(
                "Candidate id=%s has no completed Moodle assessment attempt yet",
                candidate.id,
            )
            return AssessmentSyncResult(
                candidate_id=candidate.id,
                outcome="pending",
                assessment_status=candidate.assessment_status,
            )

        passed = percentage >= job.passing_score
        new_status = ASSESSMENT_STATUS_PASSED if passed else ASSESSMENT_STATUS_FAILED

        candidate.assessment_score = float(score)
        candidate.assessment_percentage = float(percentage)
        candidate.assessment_completed_at = datetime.utcnow()
        candidate.assessment_status = new_status
        db.add(candidate)

        logger.info(
            "Synced assessment for candidate id=%s: score=%s, percentage=%s%%, status=%s",
            candidate.id,
            candidate.assessment_score,
            candidate.assessment_percentage,
            new_status,
        )

        return AssessmentSyncResult(
            candidate_id=candidate.id,
            outcome="passed" if passed else "failed",
            assessment_status=new_status,
            assessment_score=candidate.assessment_score,
            assessment_percentage=candidate.assessment_percentage,
        )

    except Exception as exc:
        logger.exception(
            "Unexpected error syncing assessment for candidate id=%s: %s",
            candidate.id,
            exc,
        )
        return AssessmentSyncResult(
            candidate_id=candidate.id,
            outcome="error",
            assessment_status=candidate.assessment_status,
            error=str(exc),
        )


def sync_all_assigned_assessments(db: Session, owner_id: int) -> Dict[str, int]:
    """Sync all ASSIGNED candidates for jobs owned by the given recruiter."""
    rows = (
        db.query(Candidate, Job)
        .join(Job, Candidate.job_id == Job.id)
        .filter(
            Candidate.assessment_status == ASSESSMENT_STATUS_ASSIGNED,
            Candidate.moodle_user_id.isnot(None),
            Job.owner_id == owner_id,
        )
        .all()
    )

    summary = {"processed": 0, "passed": 0, "failed": 0, "pending": 0}

    for candidate, job in rows:
        result = sync_candidate_assessment(candidate, job, db)
        summary["processed"] += 1

        if result.outcome == "passed":
            summary["passed"] += 1
        elif result.outcome == "failed":
            summary["failed"] += 1
        elif result.outcome == "pending":
            summary["pending"] += 1

    db.commit()
    logger.info(
        "Assessment sync completed for owner id=%s: processed=%s, passed=%s, failed=%s, pending=%s",
        owner_id,
        summary["processed"],
        summary["passed"],
        summary["failed"],
        summary["pending"],
    )
    return summary
