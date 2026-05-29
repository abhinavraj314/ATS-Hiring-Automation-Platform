from sentence_transformers import util
from model import get_embedding

class SemanticMatcher:
    def __init__(self):
        pass

    def match_candidate_to_job(self, candidate: dict, job_description: str) -> dict:
        """
        Matches a single candidate to a job description.
        Returns a dict with overall score and section-level signals.
        """
        # 1. Embed the Job Description
        jd_embedding = get_embedding(job_description)

        # 2. Embed the whole resume for an overall score
        full_resume_embedding = get_embedding(candidate["full_text"])
        overall_score = util.cos_sim(jd_embedding, full_resume_embedding).item()

        # 3. Embed individual chunks for basic reasoning/signals
        signals = {}
        for section_name, section_text in candidate["chunks"].items():
            if not section_text.strip():
                continue
            
            # Skip very short sections to avoid noisy signals
            if len(section_text.split()) < 5:
                continue

            chunk_emb = get_embedding(section_text)
            score = util.cos_sim(jd_embedding, chunk_emb).item()
            signals[section_name] = round(score, 3)

        return {
            "candidate_id": candidate["id"],
            "candidate_name": candidate["name"],
            "overall_score": round(overall_score, 3),
            "signals": signals
        }

    def rank_candidates(self, candidates: list[dict], job_description: str) -> list[dict]:
        """
        Takes a list of candidate dicts and a JD, returns ranked results.
        """
        results = []
        for candidate in candidates:
            match_result = self.match_candidate_to_job(candidate, job_description)
            results.append(match_result)

        # Sort by overall score descending
        results.sort(key=lambda x: x["overall_score"], reverse=True)
        return results
