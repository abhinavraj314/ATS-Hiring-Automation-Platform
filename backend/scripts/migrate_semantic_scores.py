import os
import sys

# Add parent directory to path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.job import Job as JobModel
from app.models.candidate import Candidate as CandidateModel
from app.models.match import CandidateJobMatch
from app.models.embedding import CandidateEmbedding, JobEmbedding
from app.services.semantic_matcher import semantic_matcher

def migrate_candidates():
    print("Loading semantic model...")
    semantic_matcher.load_model()
    if not semantic_matcher.model:
        print("Failed to load model. Exiting.")
        return

    db: Session = SessionLocal()
    try:
        # Find all candidates without a semantic match record
        candidates_to_migrate = db.query(CandidateModel).outerjoin(
            CandidateJobMatch, 
            CandidateModel.id == CandidateJobMatch.candidate_id
        ).filter(CandidateJobMatch.id == None).all()
        
        print(f"Found {len(candidates_to_migrate)} candidates to migrate.")
        
        for idx, candidate in enumerate(candidates_to_migrate):
            job = db.query(JobModel).filter(JobModel.id == candidate.job_id).first()
            if not job:
                print(f"Skipping candidate {candidate.id} - job {candidate.job_id} not found.")
                continue
                
            print(f"Processing candidate {idx+1}/{len(candidates_to_migrate)} (ID: {candidate.id})...")
            
            # Get or create Job Embedding
            job_emb_record = db.query(JobEmbedding).filter(JobEmbedding.job_id == job.id).first()
            jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
            if job.required_skills:
                jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
            if job.preferred_skills:
                jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
                
            if not job_emb_record:
                job_emb = semantic_matcher.compute_embedding(jd_text)
                job_emb_record = JobEmbedding(job_id=job.id, embedding=job_emb)
                db.add(job_emb_record)
                db.commit()
                db.refresh(job_emb_record)
                
            # Create Candidate Embedding
            cand_emb = semantic_matcher.compute_embedding(candidate.raw_text or "")
            cand_emb_record = CandidateEmbedding(candidate_id=candidate.id, embedding=cand_emb)
            db.add(cand_emb_record)
            
            # Create Contextual Match
            match_score = semantic_matcher.compute_match_score(job_emb_record.embedding, cand_emb)
            match_signals = semantic_matcher.extract_match_signals(jd_text, candidate.raw_text or "")
            
            match_record = CandidateJobMatch(
                candidate_id=candidate.id,
                job_id=job.id,
                semantic_score=match_score,
                match_signals=match_signals
            )
            db.add(match_record)
            
            # Auto-shortlist logic
            if match_score > 80.0 and candidate.status not in ["Selected", "Rejected", "Interview Scheduled", "Interviewed"]:
                candidate.status = "Shortlisted"
                db.add(candidate)
                
            db.commit()
            
        print("Migration complete!")
    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting semantic migration script...")
    migrate_candidates()
