import os
import sys
import argparse

# Add backend root to path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.job import Job as JobModel
from app.models.candidate import Candidate as CandidateModel
from app.models.embedding import CandidateEmbedding, JobEmbedding
from app.models.match import CandidateJobMatch
from app.services.semantic_matcher import semantic_matcher

def run_audit(db: Session):
    print("=" * 60)
    print("DATABASE VECTOR SYNCHRONIZATION DIAGNOSTIC RUN")
    print("=" * 60)

    # 1. Model Status Checks
    print("\n[Step 1] Model Health & Status Checks")
    print("-" * 40)
    print("Loading semantic model...")
    semantic_matcher.load_model()
    
    is_healthy = semantic_matcher.is_model_loaded
    status_text = "HEALTHY (Active)" if is_healthy else "BYPASSED (Model Missing or Fail)"
    print(f"Model Load Status: {status_text}")
    # Safely obtain model path; fallback if attribute missing
    model_path = getattr(semantic_matcher.model, 'model_path', '../ai_experiments/model_registry/domain_model_v1')
    print(f"Target Path: {os.path.abspath(model_path)}")

    # 2. Job Embedding Alignment Checks
    print("\n[Step 2] Job Embeddings Audit")
    print("-" * 40)
    jobs = db.query(JobModel).all()
    total_jobs = len(jobs)
    job_embeddings = db.query(JobEmbedding).all()
    total_job_embs = len(job_embeddings)
    
    missing_job_embs = []
    invalid_job_dimensions = []
    
    for job in jobs:
        emb_rec = db.query(JobEmbedding).filter(JobEmbedding.job_id == job.id).first()
        if not emb_rec:
            missing_job_embs.append(job.id)
        elif not emb_rec.embedding:
            missing_job_embs.append(job.id)
        elif len(emb_rec.embedding) != 384:
            invalid_job_dimensions.append((job.id, len(emb_rec.embedding)))

    print(f"Total Jobs in DB: {total_jobs}")
    print(f"Total Job Embeddings: {total_job_embs}")
    print(f"Jobs Missing Embeddings: {len(missing_job_embs)} {f'(IDs: {missing_job_embs})' if missing_job_embs else ''}")
    print(f"Jobs with Invalid Dimensions (Expected 384): {len(invalid_job_dimensions)} {f'(Details: {invalid_job_dimensions})' if invalid_job_dimensions else ''}")

    # 3. Candidate Alignment Checks
    print("\n[Step 3] Candidate Embeddings & Match Audit")
    print("-" * 40)
    candidates = db.query(CandidateModel).all()
    total_candidates = len(candidates)
    
    missing_cand_embs = []
    missing_cand_matches = []
    invalid_cand_dimensions = []
    empty_matches = []
    
    for candidate in candidates:
        emb_rec = db.query(CandidateEmbedding).filter(CandidateEmbedding.candidate_id == candidate.id).first()
        if not emb_rec:
            missing_cand_embs.append(candidate.id)
        elif not emb_rec.embedding:
            missing_cand_embs.append(candidate.id)
        elif len(emb_rec.embedding) != 384:
            invalid_cand_dimensions.append((candidate.id, len(emb_rec.embedding)))
            
        match_rec = db.query(CandidateJobMatch).filter(
            CandidateJobMatch.candidate_id == candidate.id,
            CandidateJobMatch.job_id == candidate.job_id
        ).first()
        if not match_rec:
            missing_cand_matches.append(candidate.id)
        elif match_rec.semantic_score == 0.0 and is_healthy:
            empty_matches.append(candidate.id)

    print(f"Total Candidates in DB: {total_candidates}")
    print(f"Candidates Missing Embeddings: {len(missing_cand_embs)} {f'(IDs: {missing_cand_embs})' if missing_cand_embs else ''}")
    print(f"Candidates Missing Match Records: {len(missing_cand_matches)} {f'(IDs: {missing_cand_matches})' if missing_cand_matches else ''}")
    print(f"Candidates with Invalid Dimensions (Expected 384): {len(invalid_cand_dimensions)} {f'(Details: {invalid_cand_dimensions})' if invalid_cand_dimensions else ''}")
    print(f"Candidates with Zero Semantic Fit Scores: {len(empty_matches)} {f'(IDs: {empty_matches})' if empty_matches else ''}")

    print("\n" + "=" * 60)
    print("AUDIT SUMMARY REPORT")
    print("=" * 60)
    if not missing_job_embs and not missing_cand_embs and not missing_cand_matches and not invalid_job_dimensions and not invalid_cand_dimensions:
        print("SUCCESS: Database vector structures are 100% synchronized and valid!")
    else:
        print("WARNING: Vector mismatches or missing values detected.")
        print("Run with the '--sync' flag to resolve all database gaps automatically.")
    print("=" * 60)

    return {
        "missing_job_embs": missing_job_embs,
        "missing_cand_embs": missing_cand_embs,
        "missing_cand_matches": missing_cand_matches,
        "is_healthy": is_healthy
    }

def run_sync(db: Session, audit_results: dict):
    if not audit_results["is_healthy"]:
        print("\nERROR: Cannot run synchronization while model loading is bypassed or failing.")
        return

    print("\n" + "=" * 60)
    print("RETROACTIVE VECTOR SYNCHRONIZATION RUN")
    print("=" * 60)

    # 1. Sync Jobs
    if audit_results["missing_job_embs"]:
        print(f"\nSyncing {len(audit_results['missing_job_embs'])} missing Job embeddings...")
        for j_id in audit_results["missing_job_embs"]:
            job = db.query(JobModel).filter(JobModel.id == j_id).first()
            if not job:
                continue
            
            print(f"  -> Generating embedding for Job #{job.id}: '{job.title}'...")
            jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
            if job.required_skills:
                jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
            if job.preferred_skills:
                jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
                
            job_emb = semantic_matcher.compute_embedding(jd_text)
            
            # Clean old if exists
            db.query(JobEmbedding).filter(JobEmbedding.job_id == job.id).delete()
            job_emb_record = JobEmbedding(job_id=job.id, embedding=job_emb)
            db.add(job_emb_record)
            db.commit()
            print(f"  [OK] Saved Job vector (dimensions: {len(job_emb)})")

    # 2. Sync Candidates
    cands_to_sync = list(set(audit_results["missing_cand_embs"] + audit_results["missing_cand_matches"]))
    if cands_to_sync:
        print(f"\nSyncing {len(cands_to_sync)} candidates with missing embeddings or match profiles...")
        for c_id in cands_to_sync:
            candidate = db.query(CandidateModel).filter(CandidateModel.id == c_id).first()
            if not candidate:
                continue
            
            job = db.query(JobModel).filter(JobModel.id == candidate.job_id).first()
            if not job:
                print(f"  [ERROR] Skipping candidate #{candidate.id} - job #{candidate.job_id} not found.")
                continue
                
            print(f"  -> Processing candidate #{candidate.id}: '{candidate.full_name}'...")
            
            # Ensure Candidate Embedding exists
            cand_emb_record = db.query(CandidateEmbedding).filter(CandidateEmbedding.candidate_id == candidate.id).first()
            if not cand_emb_record or not cand_emb_record.embedding:
                print("     Computing profile embedding vector...")
                cand_emb = semantic_matcher.compute_embedding(candidate.raw_text or "")
                if cand_emb_record:
                    cand_emb_record.embedding = cand_emb
                else:
                    cand_emb_record = CandidateEmbedding(candidate_id=candidate.id, embedding=cand_emb)
                    db.add(cand_emb_record)
                db.commit()
            else:
                cand_emb = cand_emb_record.embedding

            # Fetch job embedding
            job_emb_record = db.query(JobEmbedding).filter(JobEmbedding.job_id == job.id).first()
            if not job_emb_record:
                print(f"     [WARN] Computing missing Job #{job.id} vector first...")
                jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
                if job.required_skills:
                    jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
                if job.preferred_skills:
                    jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
                job_emb = semantic_matcher.compute_embedding(jd_text)
                job_emb_record = JobEmbedding(job_id=job.id, embedding=job_emb)
                db.add(job_emb_record)
                db.commit()
                db.refresh(job_emb_record)

            # Compute match score and signals
            print("     Matching dimensions and computing similarity score...")
            match_score = semantic_matcher.compute_match_score(job_emb_record.embedding, cand_emb)
            jd_text = f"Title: {job.title}\n\nDescription:\n{job.description}"
            if job.required_skills:
                jd_text += f"\n\nRequired Skills:\n{job.required_skills}"
            if job.preferred_skills:
                jd_text += f"\n\nPreferred Skills:\n{job.preferred_skills}"
            
            match_signals = semantic_matcher.extract_match_signals(
                jd_text, 
                candidate.raw_text or "",
                job_skills=job.required_skills,
                candidate_skills=candidate.skills
            )
            
            # Clean old if exists
            db.query(CandidateJobMatch).filter(
                CandidateJobMatch.candidate_id == candidate.id,
                CandidateJobMatch.job_id == job.id
            ).delete()
            
            match_record = CandidateJobMatch(
                candidate_id=candidate.id,
                job_id=job.id,
                semantic_score=match_score,
                match_signals=match_signals
            )
            db.add(match_record)
            
            # Auto-shortlist validation
            if match_score > 80.0 and candidate.status not in ["Selected", "Rejected", "Interviewing", "Interview Scheduled", "Interviewed"]:
                print(f"     Score is {match_score}% > 80.0%. Auto-shortlisting candidate status!")
                candidate.status = "Shortlisted"
                db.add(candidate)
                
            db.commit()
            print(f"  [OK] Synced match details. Similarity score: {match_score}%")

    print("\n" + "=" * 60)
    print("SYNCHRONIZATION COMPLETE")
    print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description="ATS Database Vector Synchronization Utility")
    parser.add_argument("--sync", action="store_true", help="Retroactively synchronize missing or corrupt vector embeddings and matching records")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        audit_results = run_audit(db)
        if args.sync:
            run_sync(db, audit_results)
            print("\nRe-running diagnostic verification...")
            run_audit(db)
    except Exception as e:
        print(f"Error during synchronization execution: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
