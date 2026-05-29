import json
import os
from sentence_transformers import util
from data_loader import load_jobs, load_resumes
from embedding_cache import EmbeddingCache
import time

def evaluate():
    print("Initializing bulk evaluation...")
    cache = EmbeddingCache()
    
    # 1. Load Data
    jobs = load_jobs(limit=None) # 10 jobs for fast iteration
    resumes = load_resumes(limit=None) # 100 resumes
    
    print(f"Loaded {len(jobs)} jobs and {len(resumes)} resumes.")
    
    # 2. Pre-compute all resume chunk embeddings to leverage batching and caching
    print("Pre-computing resume embeddings...")
    start = time.time()
    
    all_candidate_chunks = []
    # Collect all chunks to embed them in a massive batch if not cached
    for res in resumes:
        all_candidate_chunks.append(res["full_text"])
        for chunk_text in res["chunks"].values():
            if chunk_text.strip():
                all_candidate_chunks.append(chunk_text)
                
    cache.get_embeddings_batch(all_candidate_chunks)
    print(f"Pre-computing took {time.time() - start:.2f}s")
    
    # 3. Evaluate each job
    results_db = {} # job_id -> list of candidate matches
    
    for job in jobs:
        print(f"Evaluating Job: {job['title']} ({job['id']})")
        jd_embedding = cache.get_embedding(job["description"])
        
        job_results = []
        for candidate in resumes:
            # Overall Score
            full_emb = cache.get_embedding(candidate["full_text"])
            overall_score = util.cos_sim(jd_embedding, full_emb).item()
            
            # Signals
            signals = {}
            for section_name, section_text in candidate["chunks"].items():
                if not section_text.strip():
                    continue
                if len(section_text.split()) < 5:
                    continue
                    
                chunk_emb = cache.get_embedding(section_text)
                score = util.cos_sim(jd_embedding, chunk_emb).item()
                signals[section_name] = round(score, 3)
                
            job_results.append({
                "candidate_id": candidate["id"],
                "candidate_name": candidate["name"],
                "overall_score": round(overall_score, 3),
                "signals": signals
            })
            
        # Sort candidates for this job
        job_results.sort(key=lambda x: x["overall_score"], reverse=True)
        results_db[job["id"]] = {
            "job_title": job["title"],
            "candidates": job_results
        }

    # 4. Save results to a local JSON file for the inspector to use
    output_path = os.path.join(os.path.dirname(__file__), "evaluation_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results_db, f, indent=2, ensure_ascii=False)
        
    print(f"Evaluation complete. Results saved to {output_path}")

if __name__ == "__main__":
    evaluate()
