from app.core.database import engine, Base
from app.models.candidate import Candidate
from app.models.candidate_note import CandidateNote
from app.models.user import User
from app.models.job import Job
from sqlalchemy import text

Base.metadata.create_all(bind=engine)

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_org VARCHAR'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notice_period VARCHAR'))
    conn.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS reapplication_details JSON'))
    conn.commit()

print('DB migrated successfully')
