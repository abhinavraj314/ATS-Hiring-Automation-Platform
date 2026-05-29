import os
import sys
import json
import torch
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader
import logging

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("trainer")

def train(model_name="all-MiniLM-L6-v2", epochs=3, batch_size=16):
    """
    Fine-tunes a SentenceTransformer model using the domain-specific triplets 
    and MultipleNegativesRankingLoss.
    """
    pairs_file = os.path.join(CURRENT_DIR, "domain_specific_evaluation", "training_pairs.json")
    if not os.path.exists(pairs_file):
        logger.error(f"Training pairs not found at {pairs_file}. Run pair_generator.py first.")
        return
        
    logger.info("Loading training pairs...")
    with open(pairs_file, "r", encoding="utf-8") as f:
        pairs = json.load(f)
        
    if not pairs:
        logger.error("Training pairs file is empty.")
        return
        
    train_examples = []
    for p in pairs:
        # We need pairs of (Anchor, Positive) for MNRL. 
        # Passing (Anchor, Positive, Negative) to MNRL uses the negative as a hard negative!
        if "negative" in p and p["negative"]:
            train_examples.append(InputExample(texts=[p["anchor"], p["positive"], p["negative"]]))
        else:
            train_examples.append(InputExample(texts=[p["anchor"], p["positive"]]))
            
    logger.info(f"Loaded {len(train_examples)} training examples.")
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Loading base model {model_name} on {device}...")
    model = SentenceTransformer(model_name, device=device)
    
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=batch_size)
    
    # MultipleNegativesRankingLoss is excellent for retrieval tasks.
    train_loss = losses.MultipleNegativesRankingLoss(model=model)
    
    output_path = os.path.join(CURRENT_DIR, "fine_tuned_domain_model")
    logger.info(f"Starting training for {epochs} epochs...")
    
    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=epochs,
        warmup_steps=int(len(train_dataloader) * epochs * 0.1), # 10% warmup
        output_path=output_path,
        show_progress_bar=True
    )
    
    logger.info(f"Training complete. Model saved to {output_path}")

if __name__ == "__main__":
    train()
