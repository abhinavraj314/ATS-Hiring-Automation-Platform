from app.core.database import engine, Base
from app.models.candidate import Candidate
from app.models.candidate_note import CandidateNote
from app.models.user import User
from app.models.job import Job
from app.models.feedback import RecruiterFeedbackEvent
from sqlalchemy import text

Base.metadata.create_all(bind=engine)

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_org VARCHAR'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notice_period VARCHAR'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS reapplication_details JSON'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS moodle_user_id INTEGER'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS moodle_username VARCHAR'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS moodle_temp_password VARCHAR'))
    conn.execute(text(
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "
        "assessment_status VARCHAR DEFAULT 'NOT_ASSIGNED' NOT NULL"
    ))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_score DOUBLE PRECISION'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_percentage DOUBLE PRECISION'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_assigned_at TIMESTAMP'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMP'))
    conn.execute(text(
        "UPDATE candidates SET assessment_status = 'NOT_ASSIGNED' "
        "WHERE assessment_status IS NULL"
    ))
    conn.execute(text(
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "
        "assessment_required BOOLEAN DEFAULT FALSE NOT NULL"
    ))
    conn.execute(text(
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assessment_template VARCHAR"
    ))
    conn.execute(text(
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "
        "passing_score INTEGER DEFAULT 70 NOT NULL"
    ))
    conn.execute(text(
        "UPDATE jobs SET assessment_required = FALSE "
        "WHERE assessment_required IS NULL"
    ))
    conn.execute(text(
        "UPDATE jobs SET passing_score = 70 WHERE passing_score IS NULL"
    ))
    conn.commit()

print('DB migrated successfully')
