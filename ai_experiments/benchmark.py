import os
import sys
import time
import json
import numpy as np
from sentence_transformers import SentenceTransformer, util

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Import generic data loader
GENERIC_DIR = os.path.join(CURRENT_DIR, "generic_evaluation")
if GENERIC_DIR not in sys.path:
    sys.path.append(GENERIC_DIR)
import data_loader as gen_loader

# Import domain data loader
DOMAIN_DIR = os.path.join(CURRENT_DIR, "domain_specific_evaluation")
if DOMAIN_DIR not in sys.path:
    sys.path.append(DOMAIN_DIR)
import domain_specific_evaluation.data_loader as dom_loader

def compute_metrics(jobs, resumes, model):
    """Computes MRR and NDCG@10 using heuristic ground truth."""
    if not jobs or not resumes:
        return {"MRR": 0.0, "NDCG@10": 0.0}
        
    mrr_sum = 0
    ndcg_sum = 0
    
    # Precompute resume embeddings
    res_texts = [r["full_text"] for r in resumes]
    res_embs = model.encode(res_texts, convert_to_tensor=True, show_progress_bar=False)
    
    for job in jobs:
        jd_text = job["description"]
        jd_emb = model.encode(jd_text, convert_to_tensor=True, show_progress_bar=False)
        
        # Calculate similarities
        cos_scores = util.cos_sim(jd_emb, res_embs)[0].cpu().numpy()
        
        # Determine heuristic ground truth based on keyword overlap
        jd_skills_str = job["chunks"].get("RequiredSkills", "")
        if not jd_skills_str:
            jd_skills_str = job["chunks"].get("Description", "") # fallback if no skills
            
        jd_skills = set(s.strip().lower() for s in jd_skills_str.split(","))
        jd_skills.discard("")
        
        ground_truth_scores = []
        for res in resumes:
            res_skills_str = res.get("skills", "")
            if not res_skills_str:
                res_skills_str = res["chunks"].get("Skills", "")
            res_skills = set(s.strip().lower() for s in res_skills_str.split(","))
            res_skills.discard("")
            
            overlap = len(jd_skills.intersection(res_skills))
            # Just to give a little bit of variance, if overlap > 0 we consider it relevant
            ground_truth_scores.append(overlap)
            
        # Rank candidates based on model cosine similarity
        ranked_indices = np.argsort(cos_scores)[::-1]
        
        # MRR: find the rank of the first candidate with overlap > 0
        mrr = 0
        for rank, idx in enumerate(ranked_indices):
            if ground_truth_scores[idx] > 0:
                mrr = 1.0 / (rank + 1)
                break
        mrr_sum += mrr
        
        # NDCG@10
        dcg = 0
        idcg = 0
        
        # Ideal ranking
        ideal_indices = np.argsort(ground_truth_scores)[::-1]
        
        for i in range(min(10, len(ranked_indices))):
            idx = ranked_indices[i]
            rel = ground_truth_scores[idx]
            dcg += (2**rel - 1) / np.log2(i + 2)
            
            ideal_idx = ideal_indices[i]
            ideal_rel = ground_truth_scores[ideal_idx]
            idcg += (2**ideal_rel - 1) / np.log2(i + 2)
            
        ndcg = dcg / idcg if idcg > 0 else 0
        ndcg_sum += ndcg
        
    return {
        "MRR": round(mrr_sum / len(jobs), 4),
        "NDCG@10": round(ndcg_sum / len(jobs), 4)
    }

def run_benchmark(model_name_or_path="all-MiniLM-L6-v2"):
    print(f"--- Benchmarking Model: {model_name_or_path} ---")
    model = SentenceTransformer(model_name_or_path)
    
    print("\n[Tier 1] Generic Evaluation")
    gen_jobs = gen_loader.load_jobs(limit=10)
    gen_resumes = gen_loader.load_resumes(limit=50)
    gen_metrics = compute_metrics(gen_jobs, gen_resumes, model)
    print(f"Generic Metrics: MRR={gen_metrics['MRR']}, NDCG@10={gen_metrics['NDCG@10']}")
    
    print("\n[Tier 2] Domain-Specific Evaluation")
    dom_jobs = dom_loader.load_jobs_from_db()
    dom_resumes = dom_loader.load_domain_resumes()
    dom_metrics = compute_metrics(dom_jobs, dom_resumes, model)
    print(f"Domain Metrics: MRR={dom_metrics['MRR']}, NDCG@10={dom_metrics['NDCG@10']}")
    
    return {
        "generic": gen_metrics,
        "domain": dom_metrics
    }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="all-MiniLM-L6-v2")
    args = parser.parse_args()
    
    run_benchmark(args.model)
