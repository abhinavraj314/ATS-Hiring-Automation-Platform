import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TypedDict

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# Assessment course mapping for future enrollment workflows
# Moodle course IDs for the ATS Assessments site (course 1 is the site front page).
ASSESSMENT_COURSE_MAP: Dict[str, int] = {
    "POWER_PLATFORM": 2,
    "SQL": 4,
    "ORACLE_EPM": 3,
}

STUDENT_ROLE_ID = 5
PASS_THRESHOLD_PERCENTAGE = 70.0


class AssessmentGrade(TypedDict):
    """Normalized assessment grade for a Moodle user in a course."""

    course_id: int
    user_id: int
    assessment_name: str
    score: Optional[float]
    max_score: Optional[float]
    percentage: Optional[float]
    passed: bool


@dataclass
class MoodleResult:
    """Structured response from a Moodle REST API call."""

    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class MoodleService:
    """Client for Moodle Web Services REST API."""

    def __init__(self, moodle_url: str, token: str, timeout: int = 30) -> None:
        self.moodle_url = moodle_url.rstrip("/")
        self.token = token.strip() if token else ""
        self.timeout = timeout
        self._api_endpoint = f"{self.moodle_url}/webservice/rest/server.php"

    def _validate_config(self) -> Optional[MoodleResult]:
        if not self.moodle_url:
            return MoodleResult(
                success=False,
                error="MOODLE_URL is not configured",
                error_code="config_error",
            )
        if not self.token:
            return MoodleResult(
                success=False,
                error="MOODLE_TOKEN is not configured",
                error_code="config_error",
            )
        return None

    def _call(self, wsfunction: str, params: Optional[Dict[str, Any]] = None) -> MoodleResult:
        config_error = self._validate_config()
        if config_error:
            logger.error(config_error.error)
            return config_error

        payload: Dict[str, Any] = {
            "wstoken": self.token,
            "wsfunction": wsfunction,
            "moodlewsrestformat": "json",
        }
        if params:
            payload.update(params)

        logger.debug("Calling Moodle API function '%s'", wsfunction)

        try:
            response = requests.post(
                self._api_endpoint,
                data=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except requests.Timeout:
            logger.error("Moodle request timed out for function '%s'", wsfunction)
            return MoodleResult(
                success=False,
                error="Moodle request timed out",
                error_code="timeout",
            )
        except requests.ConnectionError as exc:
            logger.error("Failed to connect to Moodle at '%s': %s", self.moodle_url, exc)
            return MoodleResult(
                success=False,
                error=f"Failed to connect to Moodle at {self.moodle_url}",
                error_code="connection_error",
            )
        except requests.RequestException as exc:
            logger.error("Moodle HTTP request failed for '%s': %s", wsfunction, exc)
            return MoodleResult(
                success=False,
                error=str(exc),
                error_code="request_error",
            )

        try:
            result = response.json()
        except ValueError as exc:
            logger.error("Invalid JSON response from Moodle for '%s': %s", wsfunction, exc)
            return MoodleResult(
                success=False,
                error="Invalid JSON response from Moodle",
                error_code="invalid_response",
            )

        if isinstance(result, dict) and result.get("exception"):
            error_message = result.get("message", "Unknown Moodle error")
            error_code = result.get("errorcode", result.get("exception"))
            logger.error(
                "Moodle API exception [%s] for '%s': %s",
                error_code,
                wsfunction,
                error_message,
            )
            return MoodleResult(
                success=False,
                error=error_message,
                error_code=error_code,
            )

        logger.info("Moodle API call '%s' completed successfully", wsfunction)
        return MoodleResult(success=True, data=result)

    def get_site_info(self) -> MoodleResult:
        """Verify connectivity and return Moodle site metadata."""
        return self._call("core_webservice_get_site_info")

    def get_user_by_email(self, email: str) -> MoodleResult:
        """Look up a Moodle user by email address."""
        params = {
            "criteria[0][key]": "email",
            "criteria[0][value]": email.strip(),
        }
        result = self._call("core_user_get_users", params)
        if result.success and isinstance(result.data, dict) and "users" in result.data:
            return MoodleResult(
                success=True,
                data=result.data["users"],
                error=result.error,
                error_code=result.error_code,
            )
        return result

    def create_user(
        self,
        username: str,
        password: str,
        firstname: str,
        lastname: str,
        email: str,
    ) -> MoodleResult:
        """Create a Moodle user account."""
        params = {
            "users[0][username]": username,
            "users[0][password]": password,
            "users[0][firstname]": firstname,
            "users[0][lastname]": lastname,
            "users[0][email]": email,
            "users[0][auth]": "manual",
        }
        result = self._call("core_user_create_users", params)

        if result.success and isinstance(result.data, list) and result.data:
            created_user = result.data[0]
            logger.info(
                "Created Moodle user id=%s username='%s'",
                created_user.get("id"),
                created_user.get("username", username),
            )

        return result

    @staticmethod
    def _is_duplicate_enrollment(result: MoodleResult) -> bool:
        """Return True when Moodle reports the user is already enrolled."""
        error_code = (result.error_code or "").lower()
        error_message = (result.error or "").lower()
        duplicate_indicators = (
            "already enrolled",
            "useralreadyenrolled",
            "enrolmentexists",
        )
        return any(
            indicator in error_code or indicator in error_message
            for indicator in duplicate_indicators
        )

    @staticmethod
    def _is_enrollment_notification_failure(result: MoodleResult) -> bool:
        """Return True when enrollment succeeded but Moodle could not send email."""
        error_code = (result.error_code or "").lower()
        error_message = (result.error or "").lower()
        return "message was not sent" in error_code or "message was not sent" in error_message

    def enroll_user(
        self,
        moodle_user_id: int,
        course_id: int,
        role_id: int = STUDENT_ROLE_ID,
    ) -> MoodleResult:
        """Enroll a Moodle user into a course with the given role."""
        params = {
            "enrolments[0][roleid]": role_id,
            "enrolments[0][userid]": moodle_user_id,
            "enrolments[0][courseid]": course_id,
        }
        result = self._call("enrol_manual_enrol_users", params)

        enrollment_data = {
            "userid": moodle_user_id,
            "courseid": course_id,
            "roleid": role_id,
        }

        if not result.success and self._is_duplicate_enrollment(result):
            logger.info(
                "User id=%s is already enrolled in course id=%s (role id=%s)",
                moodle_user_id,
                course_id,
                role_id,
            )
            return MoodleResult(
                success=True,
                data={**enrollment_data, "already_enrolled": True},
            )

        if not result.success and self._is_enrollment_notification_failure(result):
            logger.warning(
                "User id=%s enrolled in course id=%s, but Moodle failed to send "
                "the welcome notification: %s",
                moodle_user_id,
                course_id,
                result.error,
            )
            return MoodleResult(
                success=True,
                data={
                    **enrollment_data,
                    "already_enrolled": False,
                    "notification_sent": False,
                },
            )

        if result.success:
            logger.info(
                "Enrolled user id=%s into course id=%s with role id=%s",
                moodle_user_id,
                course_id,
                role_id,
            )
            return MoodleResult(
                success=True,
                data={**enrollment_data, "already_enrolled": False},
            )

        return result

    @staticmethod
    def _parse_grade_value(value: Any) -> Optional[float]:
        """Convert a Moodle grade field to a float when present."""
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _select_assessment_grade_item(grade_items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Pick the primary quiz/module grade item from a Moodle grade report."""
        module_items = [
            item
            for item in grade_items
            if item.get("itemtype") == "mod" and item.get("itemmodule") == "quiz"
        ]
        if not module_items:
            module_items = [item for item in grade_items if item.get("itemtype") == "mod"]
        if not module_items:
            return None

        graded_items = [
            item for item in module_items if MoodleService._parse_grade_value(item.get("graderaw")) is not None
        ]
        return graded_items[0] if graded_items else module_items[0]

    @staticmethod
    def _build_assessment_grade(
        moodle_user_id: int,
        course_id: int,
        grade_item: Dict[str, Any],
    ) -> AssessmentGrade:
        """Build a normalized assessment grade payload from a Moodle grade item."""
        score = MoodleService._parse_grade_value(grade_item.get("graderaw"))
        max_score = MoodleService._parse_grade_value(grade_item.get("grademax"))
        percentage: Optional[float] = None

        if score is not None and max_score is not None and max_score > 0:
            percentage = round((score / max_score) * 100, 2)

        assessment_name = grade_item.get("itemname") or "Assessment"
        passed = percentage is not None and percentage >= PASS_THRESHOLD_PERCENTAGE

        return AssessmentGrade(
            course_id=course_id,
            user_id=moodle_user_id,
            assessment_name=assessment_name,
            score=score,
            max_score=max_score,
            percentage=percentage,
            passed=passed,
        )

    def get_user_grades(self, moodle_user_id: int, course_id: int) -> MoodleResult:
        """Retrieve assessment grade results for a Moodle user in a course."""
        params = {
            "courseid": course_id,
            "userid": moodle_user_id,
        }
        result = self._call("gradereport_user_get_grade_items", params)
        if not result.success:
            return result

        user_grades = result.data.get("usergrades", []) if isinstance(result.data, dict) else []
        if not user_grades:
            logger.info(
                "No grade records found for user id=%s in course id=%s",
                moodle_user_id,
                course_id,
            )
            return MoodleResult(
                success=False,
                error="No grade data found for this user in the course",
                error_code="no_grades",
            )

        grade_items = user_grades[0].get("gradeitems", [])
        assessment_item = self._select_assessment_grade_item(grade_items)
        if not assessment_item:
            logger.info(
                "No assessment grade items found for user id=%s in course id=%s",
                moodle_user_id,
                course_id,
            )
            return MoodleResult(
                success=False,
                error="No assessment grade items found for this course",
                error_code="no_grades",
            )

        grade = self._build_assessment_grade(moodle_user_id, course_id, assessment_item)

        if grade["score"] is None:
            logger.info(
                "User id=%s has no completed attempts for '%s' in course id=%s",
                moodle_user_id,
                grade["assessment_name"],
                course_id,
            )
        else:
            logger.info(
                "Retrieved grade for user id=%s in course id=%s: %s/%s (%.2f%%, passed=%s)",
                moodle_user_id,
                course_id,
                grade["score"],
                grade["max_score"],
                grade["percentage"] or 0,
                grade["passed"],
            )

        return MoodleResult(success=True, data=grade)


def get_moodle_service() -> MoodleService:
    """Factory function to retrieve the configured MoodleService."""
    return MoodleService(
        moodle_url=settings.MOODLE_URL,
        token=settings.MOODLE_TOKEN or "",
    )
