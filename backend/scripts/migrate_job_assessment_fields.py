"""
Migration: add assessment configuration fields to jobs table.

Run from the backend directory:
    python scripts/migrate_job_assessment_fields.py
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.database import engine


MIGRATION_STATEMENTS = [
    (
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "
        "assessment_required BOOLEAN DEFAULT FALSE NOT NULL"
    ),
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assessment_template VARCHAR",
    (
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "
        "passing_score INTEGER DEFAULT 70 NOT NULL"
    ),
    "UPDATE jobs SET assessment_required = FALSE WHERE assessment_required IS NULL",
    "UPDATE jobs SET passing_score = 70 WHERE passing_score IS NULL",
]


def run_migration() -> None:
    print("Migrating job assessment configuration fields...")
    with engine.connect() as conn:
        for statement in MIGRATION_STATEMENTS:
            conn.execute(text(statement))
        conn.commit()
    print("Job assessment migration completed successfully.")


if __name__ == "__main__":
    run_migration()
