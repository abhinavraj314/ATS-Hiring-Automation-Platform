import os
import logging
from typing import List, Dict, Any, Optional
import torch
import numpy as np
from sentence_transformers import SentenceTransformer, util
from app.core.config import settings

logger = logging.getLogger(__name__)

class SemanticMatcherService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SemanticMatcherService, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if self.initialized:
            return
            
        self.model = None
        self.initialized = True
        
    @property
    def is_model_loaded(self) -> bool:
        """Returns True if the SentenceTransformer model is successfully loaded."""
        return self.model is not None

    SYNONYM_ONTOLOGY = {
        "power apps": ["powerapps", "power apps", "canvas apps", "model-driven apps", "ms powerapps", "power platform"],
        "power automate": ["power automate", "powerautomate", "ms flow", "microsoft flow", "flow"],
        "dataverse": ["dataverse", "common data service", "cds"],
        "oracle pbcs": ["pbcs", "oracle pbcs", "planning and budgeting cloud", "hyperion planning", "hyperion"],
        "oracle epbcs": ["epbcs", "oracle epbcs", "enterprise planning and budgeting cloud"],
        "oracle fccs": ["fccs", "oracle fccs", "financial consolidation and close", "hyperion financial management", "hfm"],
        "cch tagetik": ["tagetik", "cch tagetik", "tagetik cpm"],
        "sql": ["sql", "t-sql", "pl-sql", "postgresql", "mysql", "oracle sql", "sql server"],
        "azure": ["azure", "microsoft azure", "azure cloud", "ms azure"],
        "devops": ["devops", "ci/cd", "ci-cd", "jenkins", "github actions", "azure devops"],
        "sharepoint": ["sharepoint", "sharepoint online", "ms sharepoint"]
    }

    def load_model(self):
        """Loads the sentence transformer model with graceful fallback in case of errors."""
        try:
            model_path = settings.SEMANTIC_MODEL_PATH
            if not model_path:
                logger.warning("SEMANTIC_MODEL_PATH is not configured. Semantic matching will be bypassed.")
                self.model = None
                return

            if not os.path.exists(model_path):
                logger.warning(
                    f"Semantic model directory NOT found at: '{model_path}'. "
                    "Operational actions will bypass semantic scoring and fall back to legacy heuristics."
                )
                self.model = None
                return
                
            logger.info(f"Loading semantic model from '{model_path}'...")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model = SentenceTransformer(model_path, device=device)
            logger.info(f"Semantic model loaded successfully on device: {device}")
            
        except Exception as e:
            logger.error(
                f"CRITICAL MODEL LOAD FAILURE: {str(e)}. "
                "The application will successfully boot and run using legacy scoring engine fallbacks."
            )
            self.model = None
            
    def compute_embedding(self, text: str) -> List[float]:
        """Computes embedding for a single text string and returns it as a float list for JSON storage."""
        if not self.model:
            return []
        emb = self.model.encode(text, convert_to_tensor=True, show_progress_bar=False)
        return emb.cpu().numpy().tolist()

    def compute_match_score(self, jd_emb_list: List[float], res_emb_list: List[float]) -> float:
        """Computes cosine similarity between a job embedding and a resume embedding."""
        if not self.model or not jd_emb_list or not res_emb_list:
            return 0.0
        jd_emb = torch.tensor(jd_emb_list)
        res_emb = torch.tensor(res_emb_list)
        score = util.cos_sim(jd_emb, res_emb)[0][0].item()
        
        # Normalize score slightly for UI presentation (0-100%)
        ui_score = round(max(0, min(1, score)) * 100, 1)
        return ui_score

    def extract_match_signals(
        self, 
        jd_text: str, 
        resume_text: str, 
        job_skills: Optional[str] = None, 
        candidate_skills: Optional[str] = None,
        preferred_skills: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dynamically extracts skill matches and gaps between Job and Candidate.
        Leverages custom Synonym Ontology and groups gaps by severity with reasoning,
        generating candidate strengths, weaknesses, and interviewer focus areas.
        """
        import re
        
        # Parse Required Skills
        jd_req_skills = []
        if job_skills:
            jd_req_skills = [s.strip() for s in job_skills.split(",") if s.strip()]
        else:
            try:
                from app.services.parser import ResumeParser
                for skill in ResumeParser.COMMON_SKILLS:
                    if re.search(rf'\b{re.escape(skill)}\b', jd_text, re.IGNORECASE):
                        jd_req_skills.append(skill)
            except Exception:
                pass

        # Parse Preferred Skills
        jd_pref_skills = []
        if preferred_skills:
            jd_pref_skills = [s.strip() for s in preferred_skills.split(",") if s.strip()]
            
        cand_skills = []
        if candidate_skills:
            cand_skills = [s.strip() for s in candidate_skills.split(",") if s.strip()]
            
        matched = []
        missing = []
        skill_gap_analysis = []
        
        cand_skills_lower = [s.lower() for s in cand_skills]
        resume_lower = (resume_text or "").lower()

        def has_skill_match(skill_name: str) -> bool:
            skill_name_lower = skill_name.lower()
            # 1. Direct match in candidate parsed skills list
            if skill_name_lower in cand_skills_lower:
                return True
                
            # 2. Check synonyms in ontology
            synonyms = self.SYNONYM_ONTOLOGY.get(skill_name_lower, [skill_name_lower])
            for syn in synonyms:
                syn_lower = syn.lower()
                if syn_lower in cand_skills_lower:
                    return True
                # Word-boundary check in raw resume text
                if re.search(rf'\b{re.escape(syn_lower)}\b', resume_lower):
                    return True
            return False

        # Evaluate Required Gaps (Critical)
        for skill in jd_req_skills:
            if has_skill_match(skill):
                matched.append(skill)
            else:
                missing.append(skill)
                skill_gap_analysis.append({
                    "skill": skill,
                    "severity": "Critical",
                    "reason": f"Required core skill '{skill}' is missing. Candidate profile and resume do not demonstrate experience in this technology or related synonyms."
                })

        # Evaluate Preferred Gaps (Preferred)
        for skill in jd_pref_skills:
            if has_skill_match(skill):
                matched.append(skill)
            else:
                missing.append(skill)
                skill_gap_analysis.append({
                    "skill": skill,
                    "severity": "Preferred",
                    "reason": f"Preferred skill '{skill}' is not present. This is not a disqualifier, but would have added secondary value to the role alignment."
                })

        # Heuristic Fallback if matched list is entirely empty (ensure mock data stays fully integrated)
        if not matched:
            common_keywords = [
                "Power Apps", "Power Automate", "Dataverse", "SharePoint", 
                "SQL", "Oracle EPM", "PBCS", "EPBCS", "FCCS", "Essbase", "Tagetik", 
                "Financial Consolidation", "Azure", "APIs", "CI/CD", "DevOps", 
                "Agile", "Governance", "Integration"
            ]
            for kw in common_keywords:
                if re.search(rf'\b{re.escape(kw)}\b', jd_text, re.IGNORECASE) and re.search(rf'\b{re.escape(kw)}\b', resume_lower):
                    if kw not in matched:
                        matched.append(kw)

        # Dynamic Strengths & Weaknesses Profiler
        strengths = []
        weaknesses = []
        interview_focus_areas = []

        if matched:
            strengths.append(f"Demonstrated core technical match in: {', '.join(matched[:4])}")
        
        # Check experience years if possible from surrounding candidate details (or add general markers)
        if len(matched) > len(missing):
            strengths.append("High technical alignment: Candidate meets the majority of core job requirements.")
        else:
            weaknesses.append("Significant technical skill gaps: Candidate is missing several primary core competencies.")

        for gap in skill_gap_analysis:
            if gap["severity"] == "Critical":
                weaknesses.append(f"Missing core technology: {gap['skill']}")
                interview_focus_areas.append(f"Technical drill-down: Probe depth of knowledge and potential to ramp-up on '{gap['skill']}'.")
            else:
                interview_focus_areas.append(f"Preferred tool exploration: Assess if candidate has equivalent alternative experience to '{gap['skill']}'.")

        # Fallback focus area if clean match
        if not interview_focus_areas:
            interview_focus_areas.append("Comprehensive alignment: Focus on architectural design patterns and project delivery experience.")

        return {
            "matched_skills": list(dict.fromkeys(matched)),
            "missing_skills": list(dict.fromkeys(missing)),
            "skill_gap_analysis": skill_gap_analysis,
            "strengths": list(dict.fromkeys(strengths)),
            "weaknesses": list(dict.fromkeys(weaknesses)),
            "interview_focus_areas": list(dict.fromkeys(interview_focus_areas))
        }

semantic_matcher = SemanticMatcherService()
