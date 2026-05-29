import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.embedding import CandidateEmbedding, JobEmbedding
from app.models.match import CandidateJobMatch
from app.services.parser import ResumeParser
from app.services.scoring import ScoringEngine
from app.services.semantic_matcher import semantic_matcher

CANDIDATE_RESUMES = {
    "hyp.lokesh@gmail.com": "data/resumes/Lokesh PS.pdf",
    "narendra.r2026@gmail.com": "data/resumes/NARENDRA REDDY.pdf",
    "hemkantasnh167@gmail.com": "data/resumes/Hemkanta Sinha.pdf",
    "rupesh.lakhotia3@gmail.com": "data/resumes/Rupesh Lakhotia.pdf",
    "gurukumar3399@gmail.com": "data/resumes/Guru Kumar.pdf",
    "giridharkumar92@gmail.com": "data/resumes/Giridhar Kumar.pdf"
}

def parse_and_score_manual():
    db = SessionLocal()
    try:
        # Load semantic matcher model
        print("Loading semantic matcher model...")
        semantic_matcher.load_model()
        if not semantic_matcher.model:
            print("WARNING: Semantic matcher model failed to load. Using fallback / zero embeddings.")

        for email, relative_path in CANDIDATE_RESUMES.items():
            print(f"\n==================================================")
            print(f"Processing candidate: {email}")
            
            # Find candidate in db
            candidate = db.query(Candidate).filter(Candidate.email == email).first()
            if not candidate:
                print(f"ERROR: Candidate with email {email} not found in database.")
                continue

            file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', relative_path))
            if not os.path.exists(file_path):
                print(f"ERROR: Resume file not found at: {file_path}")
                continue

            # Update file_path in candidate record
            candidate.file_path = relative_path
            
            # Parse resume
            print(f"Parsing resume at: {file_path}")
            parsed_data = ResumeParser.parse_resume(file_path)
            
            # Update parsed fields
            candidate.full_name = parsed_data["full_name"]
            candidate.skills = parsed_data["skills"]
            candidate.experience_years = parsed_data["experience_years"]
            candidate.education = parsed_data["education"]
            candidate.raw_text = parsed_data["raw_text"]
            if parsed_data["phone"] and not candidate.phone:
                candidate.phone = parsed_data["phone"]

            # Load the job
            job = db.query(Job).filter(Job.id == candidate.job_id).first()
            if not job:
                print(f"ERROR: Job ID {candidate.job_id} not found for candidate {email}.")
                continue

            # Heuristic Score candidate
            print("Calculating heuristic score...")
            scoring_result = ScoringEngine.calculate_score(job, parsed_data)
            candidate.score = scoring_result["overall_score"]
            candidate.score_breakdown = scoring_result["breakdown"]

            # Contextual Semantic Ranking / Embedding
            try:
                # 1. Job Embedding
                job_emb_record = db.query(JobEmbedding).filter(JobEmbedding.job_id == job.id).first()
                jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
                if job.required_skills:
                    jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
                if job.preferred_skills:
                    jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
                
                if not job_emb_record:
                    print(f"Computing Job Embedding for Job ID: {job.id}...")
                    job_emb = semantic_matcher.compute_embedding(jd_text)
                    job_emb_record = JobEmbedding(job_id=job.id, embedding=job_emb)
                    db.add(job_emb_record)
                    db.commit()
                    db.refresh(job_emb_record)

                # 2. Candidate Embedding
                print("Computing Candidate Embedding...")
                cand_emb = semantic_matcher.compute_embedding(candidate.raw_text or "")
                
                # Update or insert CandidateEmbedding
                cand_emb_record = db.query(CandidateEmbedding).filter(CandidateEmbedding.candidate_id == candidate.id).first()
                if cand_emb_record:
                    cand_emb_record.embedding = cand_emb
                else:
                    cand_emb_record = CandidateEmbedding(candidate_id=candidate.id, embedding=cand_emb)
                    db.add(cand_emb_record)

                # 3. Contextual Match
                print("Computing Contextual Match Score...")
                match_score = semantic_matcher.compute_match_score(job_emb_record.embedding, cand_emb)
                match_signals = semantic_matcher.extract_match_signals(jd_text, candidate.raw_text or "")
                
                match_record = db.query(CandidateJobMatch).filter(
                    CandidateJobMatch.candidate_id == candidate.id,
                    CandidateJobMatch.job_id == job.id
                ).first()

                if match_record:
                    match_record.semantic_score = match_score
                    match_record.match_signals = match_signals
                else:
                    match_record = CandidateJobMatch(
                        candidate_id=candidate.id,
                        job_id=job.id,
                        semantic_score=match_score,
                        match_signals=match_signals
                    )
                    db.add(match_record)

                # Auto-shortlist logic
                # Only auto-shortlist if score > 80% and candidate is in basic status
                print(f"Semantic match score calculated: {match_score}%")
                if match_score > 80.0 and candidate.status not in ["Selected", "Rejected", "Interview Scheduled", "Interviewed"]:
                    print(f"Semantic score > 80.0! Auto-shortlisting candidate...")
                    candidate.status = "Shortlisted"
                    
            except Exception as semantic_error:
                print(f"ERROR: Failed to generate semantic match for {email}: {semantic_error}")
                db.rollback()

            db.commit()
            print(f"Successfully processed and updated candidate: {candidate.full_name}")

        print("\nManual parsing and scoring task completed successfully.")

    except Exception as e:
        print(f"General ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parse_and_score_manual()
