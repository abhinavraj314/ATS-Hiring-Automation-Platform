import json
import argparse
import os

def load_results():
    path = os.path.join(os.path.dirname(__file__), "evaluation_results.json")
    if not os.path.exists(path):
        print("Results file not found. Run evaluator.py first.")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def list_jobs(results):
    print("\n--- Evaluated Jobs ---")
    for j_id, data in results.items():
        print(f"[{j_id}] {data['job_title']}")
    print("-" * 22)

def show_top_matches(results, job_id, top_n=5):
    if job_id not in results:
        print(f"Job {job_id} not found.")
        return
        
    data = results[job_id]
    print(f"\n=== Top {top_n} Matches for: {data['job_title']} ===")
    
    candidates = data["candidates"][:top_n]
    for i, c in enumerate(candidates, 1):
        print(f"\n{i}. {c['candidate_name']} (ID: {c['candidate_id']})")
        print(f"   Overall Score: {c['overall_score']:.3f}")
        print("   Signals:")
        for section, score in c['signals'].items():
            print(f"     - {section}: {score:.3f}")

def show_weak_matches(results, job_id, bottom_n=5):
    if job_id not in results:
        print(f"Job {job_id} not found.")
        return
        
    data = results[job_id]
    print(f"\n=== Bottom {bottom_n} Matches for: {data['job_title']} ===")
    
    # Bottom N candidates
    candidates = data["candidates"][-bottom_n:]
    for i, c in enumerate(candidates, 1):
        print(f"\n{i}. {c['candidate_name']} (ID: {c['candidate_id']})")
        print(f"   Overall Score: {c['overall_score']:.3f}")

def main():
    parser = argparse.ArgumentParser(description="Inspect Semantic Evaluation Results")
    parser.add_argument("--list-jobs", action="store_true", help="List all evaluated jobs")
    parser.add_argument("--job-id", type=str, help="Job ID to inspect")
    parser.add_argument("--top", type=int, default=5, help="Show top N matches (default 5)")
    parser.add_argument("--bottom", type=int, default=0, help="Show bottom N matches")
    
    args = parser.parse_args()
    results = load_results()
    
    if not results:
        return
        
    if args.list_jobs or not args.job_id:
        list_jobs(results)
        
    if args.job_id:
        if args.top > 0:
            show_top_matches(results, args.job_id, args.top)
        if args.bottom > 0:
            show_weak_matches(results, args.job_id, args.bottom)

if __name__ == "__main__":
    main()
