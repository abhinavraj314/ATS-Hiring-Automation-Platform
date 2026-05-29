from typing import Dict, Any, List
from app.schemas.job import Job
from app.schemas.candidate import CandidateBase

class ScoringEngine:
    @staticmethod
    def calculate_score(job: Job, candidate: Dict[str, Any]) -> Dict[str, Any]:
        score = 0.0
        breakdown = {
            "strengths": [],
            "weaknesses": [],
            "details": {}
        }

        # 1. Skills Matching (50%)
        job_skills = [s.strip().lower() for s in job.required_skills.split(",")]
        candidate_skills = [s.strip().lower() for s in candidate.get("skills", "").split(",")]
        
        matches = [s for s in job_skills if any(s in cs for cs in candidate_skills)]
        missing = [s for s in job_skills if s not in matches]
        
        skills_score = (len(matches) / len(job_skills)) * 50 if job_skills else 50
        score += skills_score
        
        for s in matches:
            breakdown["strengths"].append(f"Matched skill: {s}")
        for s in missing:
            breakdown["weaknesses"].append(f"Missing skill: {s}")
        
        breakdown["details"]["skills"] = f"{len(matches)}/{len(job_skills)} matched"

        # 2. Experience Matching (25%)
        # If candidate exp >= job min_exp, full 25 points. Else partial.
        cand_exp = candidate.get("experience_years", 0)
        if cand_exp >= job.min_experience:
            exp_score = 25
            breakdown["strengths"].append(f"Experience ({cand_exp} yrs) meets requirements ({job.min_experience} yrs)")
        else:
            exp_score = (cand_exp / job.min_experience) * 25 if job.min_experience > 0 else 25
            breakdown["weaknesses"].append(f"Limited experience: {cand_exp} yrs (Expected: {job.min_experience} yrs)")
        
        score += exp_score
        breakdown["details"]["experience"] = f"{cand_exp} years"

        # 3. Base points for Education/Parsing (25%)
        # For Phase 1, we give a base score if essential info is found
        base_score = 0
        if candidate.get("email"): base_score += 10
        if candidate.get("full_name") != "Unknown": base_score += 15
        
        score += base_score
        breakdown["details"]["profile_completeness"] = f"{(base_score/25)*100}%"

        return {
            "overall_score": round(score, 2),
            "breakdown": breakdown
        }
