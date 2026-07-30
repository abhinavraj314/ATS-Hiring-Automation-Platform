from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User as UserModel
from app.schemas.assessment import AssessmentSyncSummary
from app.services.assessment_sync_service import sync_all_assigned_assessments

router = APIRouter()


@router.post("/sync", response_model=AssessmentSyncSummary)
def sync_assessments(
    *,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
) -> Any:
    """Sync Moodle assessment results for all ASSIGNED candidates."""
    summary = sync_all_assigned_assessments(db, current_user.id)
    return summary
