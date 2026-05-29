import psycopg2
from sqlalchemy import create_engine
from app.core.database import Base, engine
from app.core.config import settings
from app.models.user import User
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.panel import PanelMember, PanelAvailability
from app.models.interview import Interview
from app.models.raw_import import RawCandidateImport, RawPanelImport
from app.models.match import CandidateJobMatch
from app.models.embedding import CandidateEmbedding, JobEmbedding

def create_database():
    """Create the database if it doesn't exist."""
    conn = None
    try:
        # Connect to default 'postgres' database
        conn = psycopg2.connect(
            dbname="postgres",
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_SERVER
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        # Check if database exists
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{settings.POSTGRES_DB}'")
        exists = cur.fetchone()
        
        if not exists:
            print(f"Creating database {settings.POSTGRES_DB}...")
            cur.execute(f"CREATE DATABASE {settings.POSTGRES_DB}")
        else:
            print(f"Database {settings.POSTGRES_DB} already exists.")
            
        cur.close()
    except Exception as e:
        print(f"Error checking/creating database: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("Initializing database...")
    create_database()
    
    print("Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Done!")
    except Exception as e:
        print(f"Error creating tables: {e}")
        print("\nTIP: Make sure your PostgreSQL server is running and the credentials in .env are correct.")
