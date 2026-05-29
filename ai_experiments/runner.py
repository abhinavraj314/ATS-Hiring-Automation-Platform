import os
import json
from resume_parser import load_resumes
from mock_data import MOCK_JOBS
from matcher import SemanticMatcher

def print_separator():
    print("=" * 60)

def main():
    print_separator()
    print("PHASE 2 EXPERIMENT: SEMANTIC RESUME-JOB MATCHING")
    print_separator()

    # 1. Load Resumes
    resumes_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "resumes"))
    print(f"Loading resumes from: {resumes_dir}")
    candidates = load_resumes(resumes_dir)
    print(f"Successfully loaded {len(candidates)} resumes.")
    
    if not candidates:
        print("No resumes found. Please ensure PDFs are in the resumes directory.")
        return

    # Initialize matcher (this will trigger model download/load on first use)
    matcher = SemanticMatcher()

    # 2. Run matching for each mock job
    for job in MOCK_JOBS:
        print_separator()
        print(f"MATCHING CANDIDATES FOR JOB: {job['title']} (ID: {job['id']})")
        print_separator()

        results = matcher.rank_candidates(candidates, job["description"])

        print("\n--- LEADERBOARD ---")
        for i, res in enumerate(results, 1):
            print(f"{i}. {res['candidate_name']} - Score: {res['overall_score']:.3f}")
            
            # Print basic reasoning/signals
            print("   Signals:")
            for section, score in res['signals'].items():
                print(f"     - {section}: {score:.3f}")
            print()

if __name__ == "__main__":
    main()
