from sqlalchemy import create_engine, text, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Use the property from settings
SQLALCHEMY_DATABASE_URL = settings.get_db_url

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def reset_sequence_if_empty(db, model):
    """Fallback utility (can be removed later as before_insert handles it globally)"""
    count = db.query(model).count()
    if count == 0:
        table_name = model.__tablename__
        try:
            db.execute(text(f"ALTER SEQUENCE {table_name}_id_seq RESTART WITH 1"))
            db.commit()
        except:
            db.rollback()

@event.listens_for(Base, 'before_insert', propagate=True)
def before_insert_reset_sequence(mapper, connection, target):
    """
    Globally ensures that any new insert tightly packs the ID based on MAX(id) + 1.
    This prevents ID gaps when records are deleted.
    """
    if not hasattr(target, '__tablename__'):
        return
        
    table_name = target.__tablename__
    try:
        # Get the current maximum ID (or 0 if table is empty) and add 1
        result = connection.execute(text(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table_name}"))
        next_id = result.scalar()
        # Reset the PostgreSQL sequence to that ID
        connection.execute(text(f"ALTER SEQUENCE {table_name}_id_seq RESTART WITH {next_id}"))
    except Exception:
        # Silently pass if the sequence doesn't exist or we're not on Postgres
        pass
