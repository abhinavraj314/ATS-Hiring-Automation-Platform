import os
import sys
import json
import random
import logging

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from data_loader import load_jobs_from_db, load_domain_resumes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pair_generator")

def generate_pairs(output_path="training_pairs.json"):
    """
    Heuristically generates training triplets (Anchor JD, Positive Resume, Hard Negative Resume).
    In a production system, this would come from actual ATS recruiter actions.
    """
    logger.info("Loading domain jobs and resumes...")
    jobs = load_jobs_from_db()
    resumes = load_domain_resumes()
    
    if not jobs or not resumes:
        logger.error("Not enough data to generate pairs.")
        return
        
    pairs = []
    
    for job in jobs:
        # Extract job skills for heuristic matching
        jd_skills = set(s.strip().lower() for s in job["chunks"].get("RequiredSkills", "").split(","))
        jd_skills.discard("")
        
        scored_resumes = []
        for resume in resumes:
            # First, check if the skills are parsed properly under 'skills' or inside chunks
            res_skills_str = resume.get("skills", "")
            if not res_skills_str: # fallback to looking at chunks if 'skills' key is not present at top level
                res_skills_str = resume["chunks"].get("Skills", "")
                
            res_skills = set(s.strip().lower() for s in res_skills_str.split(","))
            res_skills.discard("")
            
            overlap = len(jd_skills.intersection(res_skills))
            scored_resumes.append((overlap, resume))
            
        # Sort resumes by overlap (descending)
        scored_resumes.sort(key=lambda x: x[0], reverse=True)
        
        num_candidates = len(scored_resumes)
        if num_candidates < 3:
            logger.warning(f"Not enough candidates to form triplets for job {job['title']}.")
            continue
            
        # Positives: high overlap
        positives = [r for score, r in scored_resumes[:max(1, num_candidates // 3)] if score > 0]
        # Negatives: low or zero overlap
        negatives = [r for score, r in scored_resumes[-max(1, num_candidates // 2):]]
        
        for pos in positives:
            if negatives:
                neg = random.choice(negatives)
                
                pairs.append({
                    "anchor": job["description"],
                    "positive": pos["full_text"],
                    "negative": neg["full_text"],
                    "job_id": job["id"],
                    "pos_res_id": pos["id"],
                    "neg_res_id": neg["id"]
                })
                
    logger.info(f"Generated {len(pairs)} heuristic training triplets.")
    
    out_file = os.path.join(CURRENT_DIR, output_path)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(pairs, f, indent=2, ensure_ascii=False)
        
    logger.info(f"Pairs saved to {out_file}")
    return pairs

if __name__ == "__main__":
    generate_pairs()
