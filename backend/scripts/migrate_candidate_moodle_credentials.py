"""
Migration: add Moodle credential fields to candidates table.

Run from the backend directory:
    python scripts/migrate_candidate_moodle_credentials.py
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.database import engine


MIGRATION_STATEMENTS = [
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS moodle_username VARCHAR",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS moodle_temp_password VARCHAR",
]


def run_migration() -> None:
    print("Migrating candidate Moodle credential fields...")
    with engine.connect() as conn:
        for statement in MIGRATION_STATEMENTS:
            conn.execute(text(statement))
        conn.commit()
    print("Candidate Moodle credential migration completed successfully.")


if __name__ == "__main__":
    run_migration()
