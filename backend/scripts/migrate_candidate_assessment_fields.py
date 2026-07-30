"""
Migration: add Moodle assessment tracking fields to candidates table.

Run from the backend directory:
    python scripts/migrate_candidate_assessment_fields.py
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.database import engine


MIGRATION_STATEMENTS = [
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS moodle_user_id INTEGER",
    (
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "
        "assessment_status VARCHAR DEFAULT 'NOT_ASSIGNED' NOT NULL"
    ),
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_score DOUBLE PRECISION",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_percentage DOUBLE PRECISION",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_assigned_at TIMESTAMP",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMP",
    (
        "UPDATE candidates SET assessment_status = 'NOT_ASSIGNED' "
        "WHERE assessment_status IS NULL"
    ),
]


def run_migration() -> None:
    print("Migrating candidate assessment fields...")
    with engine.connect() as conn:
        for statement in MIGRATION_STATEMENTS:
            conn.execute(text(statement))
        conn.commit()
    print("Candidate assessment migration completed successfully.")


if __name__ == "__main__":
    run_migration()
