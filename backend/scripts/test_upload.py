import os
import sys

# Add parent directory to path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.job import Job
from app.services.semantic_matcher import semantic_matcher

def verify():
    semantic_matcher.load_model()
    
    db = SessionLocal()
    job = db.query(Job).first()
    
    if not job:
        print("No job found to test.")
        return
        
    jd_text = f"Title: {job.title}\n{job.description}"
    resume_text = "Experienced software engineer with deep knowledge of Power Apps, Power Automate, and Azure. 5 years of experience."
    
    job_emb = semantic_matcher.compute_embedding(jd_text)
    res_emb = semantic_matcher.compute_embedding(resume_text)
    
    score = semantic_matcher.compute_match_score(job_emb, res_emb)
    signals = semantic_matcher.extract_match_signals(jd_text, resume_text)
    
    print(f"Match Score: {score}%")
    print(f"Signals: {signals}")

if __name__ == "__main__":
    verify()
