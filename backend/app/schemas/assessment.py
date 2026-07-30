from pydantic import BaseModel


class AssessmentSyncSummary(BaseModel):
    processed: int
    passed: int
    failed: int
    pending: int
