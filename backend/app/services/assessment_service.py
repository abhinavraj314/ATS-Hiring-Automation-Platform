import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.candidate import (
    ASSESSMENT_STATUS_ASSIGNED,
    ASSESSMENT_STATUS_NOT_ASSIGNED,
    Candidate,
)
from app.core.config import settings
from app.models.job import Job
from app.services.email import get_assessment_display_name, send_assessment_invitation_email
from app.services.moodle_service import ASSESSMENT_COURSE_MAP, get_moodle_service

logger = logging.getLogger(__name__)

SEMANTIC_SCORE_ASSIGNMENT_THRESHOLD = 60.0


@dataclass
class AssessmentAssignmentResult:
    """Structured result from an assessment assignment attempt."""

    assigned: bool
    skipped: bool
    skip_reason: Optional[str] = None
    moodle_user_id: Optional[int] = None
    course_id: Optional[int] = None
    assessment_template: Optional[str] = None
    error: Optional[str] = None


def _split_name(full_name: Optional[str]) -> tuple[str, str]:
    """Split a full name into Moodle firstname and lastname."""
    if not full_name or not full_name.strip():
        return "Candidate", "User"

    parts = full_name.strip().split(None, 1)
    firstname = parts[0]
    lastname = parts[1] if len(parts) > 1 else "Candidate"
    return firstname, lastname


def _build_moodle_username(candidate: Candidate) -> str:
    """Build a unique Moodle username for a candidate."""
    if candidate.email:
        local_part = candidate.email.split("@")[0].lower()
        local_part = re.sub(r"[^a-z0-9._-]", "", local_part)
        if local_part:
            return f"ats_{local_part}_{candidate.id}"

    return f"ats_candidate_{candidate.id}"


def _build_moodle_password() -> str:
    """Build a Moodle-compliant password."""
    return f"AtsTest#{secrets.token_hex(8)}"


def assign_assessment_if_eligible(
    candidate: Candidate,
    job: Job,
    match_score: float,
    db: Session,
) -> AssessmentAssignmentResult:
    """
    Assign a Moodle assessment when the candidate meets eligibility criteria.

    Eligibility:
    - semantic match_score >= 60
    - job.assessment_required is True
    - candidate.assessment_status is NOT_ASSIGNED
    """
    if match_score < SEMANTIC_SCORE_ASSIGNMENT_THRESHOLD:
        logger.debug(
            "Skipping assessment for candidate id=%s: match_score %.1f < %.1f",
            candidate.id,
            match_score,
            SEMANTIC_SCORE_ASSIGNMENT_THRESHOLD,
        )
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=True,
            skip_reason="match_score_below_threshold",
        )

    if not job.assessment_required:
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=True,
            skip_reason="assessment_not_required",
        )

    if candidate.assessment_status != ASSESSMENT_STATUS_NOT_ASSIGNED:
        logger.info(
            "Skipping assessment for candidate id=%s: status already '%s'",
            candidate.id,
            candidate.assessment_status,
        )
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=True,
            skip_reason="already_assigned_or_in_progress",
        )

    if candidate.moodle_user_id:
        logger.info(
            "Skipping assessment for candidate id=%s: moodle_user_id already set (%s)",
            candidate.id,
            candidate.moodle_user_id,
        )
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=True,
            skip_reason="moodle_user_already_linked",
        )

    if not job.assessment_template:
        logger.warning(
            "Job id=%s requires assessment but has no assessment_template configured",
            job.id,
        )
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=True,
            skip_reason="missing_assessment_template",
        )

    course_id = ASSESSMENT_COURSE_MAP.get(job.assessment_template)
    if not course_id:
        logger.error(
            "No Moodle course mapping found for template '%s' (job id=%s)",
            job.assessment_template,
            job.id,
        )
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=False,
            assessment_template=job.assessment_template,
            error=f"Unknown assessment template: {job.assessment_template}",
        )

    if not candidate.email or not candidate.email.strip():
        logger.warning(
            "Cannot assign Moodle assessment for candidate id=%s: email is missing",
            candidate.id,
        )
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=True,
            skip_reason="missing_candidate_email",
        )

    try:
        moodle = get_moodle_service()
        firstname, lastname = _split_name(candidate.full_name)
        username = _build_moodle_username(candidate)
        
        # Look up existing candidate with same email in local database to reuse temp password
        existing_candidate = (
            db.query(Candidate)
            .filter(Candidate.email == candidate.email.strip())
            .filter(Candidate.moodle_temp_password.isnot(None))
            .filter(Candidate.moodle_temp_password != "")
            .order_by(Candidate.id.desc())
            .first()
        )
        if existing_candidate:
            password = existing_candidate.moodle_temp_password
        else:
            password = _build_moodle_password()

        logger.info(
            "Assigning Moodle assessment for candidate id=%s to course id=%s (template=%s)",
            candidate.id,
            course_id,
            job.assessment_template,
        )

        moodle_user_id = None
        moodle_username = None

        # Step 1 & 2: Add Moodle user lookup by email
        lookup_result = moodle.get_user_by_email(candidate.email.strip())
        if lookup_result.success and isinstance(lookup_result.data, list) and len(lookup_result.data) > 0:
            moodle_user_id = lookup_result.data[0].get("id")
            moodle_username = lookup_result.data[0].get("username")
            logger.info(
                "Found existing Moodle user for email '%s': id=%s, username='%s'. Skipping user creation.",
                candidate.email.strip(),
                moodle_user_id,
                moodle_username,
            )
        else:
            logger.info(
                "Moodle user for email '%s' not found. Creating new user.",
                candidate.email.strip(),
            )
            create_result = moodle.create_user(
                username=username,
                password=password,
                firstname=firstname,
                lastname=lastname,
                email=candidate.email.strip(),
            )
            if not create_result.success or not isinstance(create_result.data, list):
                logger.error(
                    "Moodle user creation failed for candidate id=%s: %s",
                    candidate.id,
                    create_result.error,
                )
                return AssessmentAssignmentResult(
                    assigned=False,
                    skipped=False,
                    course_id=course_id,
                    assessment_template=job.assessment_template,
                    error=create_result.error or "Moodle user creation failed",
                )

            moodle_user_id = create_result.data[0].get("id")
            moodle_username = create_result.data[0].get("username", username)

        if not moodle_user_id:
            logger.error(
                "Moodle user lookup/creation returned no user id for candidate id=%s",
                candidate.id,
            )
            return AssessmentAssignmentResult(
                assigned=False,
                skipped=False,
                course_id=course_id,
                assessment_template=job.assessment_template,
                error="Moodle user lookup/creation returned no user id",
            )

        # Step 3: Continue existing flow (enroll_user)
        enroll_result = moodle.enroll_user(
            moodle_user_id=moodle_user_id,
            course_id=course_id,
        )
        if not enroll_result.success:
            logger.error(
                "Moodle enrollment failed for candidate id=%s (moodle_user_id=%s): %s",
                candidate.id,
                moodle_user_id,
                enroll_result.error,
            )
            return AssessmentAssignmentResult(
                assigned=False,
                skipped=False,
                moodle_user_id=moodle_user_id,
                course_id=course_id,
                assessment_template=job.assessment_template,
                error=enroll_result.error or "Moodle enrollment failed",
            )

        candidate.moodle_user_id = moodle_user_id
        candidate.moodle_username = moodle_username
        candidate.moodle_temp_password = password
        candidate.assessment_status = ASSESSMENT_STATUS_ASSIGNED
        candidate.assessment_assigned_at = datetime.utcnow()
        db.add(candidate)

        logger.info(
            "Assessment assigned for candidate id=%s: moodle_user_id=%s, course_id=%s",
            candidate.id,
            moodle_user_id,
            course_id,
        )

        try:
            email_sent = send_assessment_invitation_email(
                candidate_email=candidate.email.strip(),
                candidate_name=candidate.full_name or "Candidate",
                job_title=job.title,
                assessment_name=get_assessment_display_name(job.assessment_template),
                moodle_url=settings.MOODLE_URL,
                moodle_username=candidate.moodle_username or "",
                moodle_temp_password=candidate.moodle_temp_password or "",
                passing_score=job.passing_score,
            )
            if not email_sent:
                logger.warning(
                    "Assessment invitation email was not sent for candidate id=%s",
                    candidate.id,
                )
        except Exception as email_exc:
            logger.error(
                "Failed to send assessment invitation email for candidate id=%s: %s",
                candidate.id,
                email_exc,
            )

        return AssessmentAssignmentResult(
            assigned=True,
            skipped=False,
            moodle_user_id=moodle_user_id,
            course_id=course_id,
            assessment_template=job.assessment_template,
        )

    except Exception as exc:
        logger.exception(
            "Unexpected error assigning Moodle assessment for candidate id=%s: %s",
            candidate.id,
            exc,
        )
        return AssessmentAssignmentResult(
            assigned=False,
            skipped=False,
            assessment_template=job.assessment_template,
            course_id=course_id,
            error=str(exc),
        )
