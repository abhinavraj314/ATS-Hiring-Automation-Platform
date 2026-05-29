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
        
    def load_model(self):
        """Loads the sentence transformer model."""
        try:
            model_path = settings.SEMANTIC_MODEL_PATH
            if not os.path.exists(model_path):
                logger.error(f"Semantic model not found at {model_path}. Semantic recommendations will be disabled.")
                return
                
            logger.info(f"Loading semantic model from {model_path}...")
            # Use CPU if no GPU
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model = SentenceTransformer(model_path, device=device)
            logger.info("Semantic model loaded successfully.")
            
        except Exception as e:
            logger.error(f"Failed to load semantic model: {e}")
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

    def extract_match_signals(self, jd_text: str, resume_text: str) -> Dict[str, Any]:
        """
        Simple heuristic overlap extraction to explain why a candidate matched.
        In production, this would use a robust NER system or LLM extraction.
        """
        common_keywords = [
            "power apps", "power automate", "dataverse", "sharepoint", 
            "sql", "oracle epm", "pbcs", "epbcs", "fccs", "essbase", "tagetik", 
            "financial consolidation", "azure", "apis", "ci/cd", "devops", 
            "agile", "governance", "integration"
        ]
        
        matched = []
        jd_lower = jd_text.lower()
        res_lower = resume_text.lower()
        
        for kw in common_keywords:
            if kw in jd_lower and kw in res_lower:
                matched.append(kw.title())
                
        return {
            "matched_skills": matched
        }

semantic_matcher = SemanticMatcherService()
