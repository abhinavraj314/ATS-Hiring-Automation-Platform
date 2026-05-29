import sqlite3
import json
import hashlib
import torch
import os
from sentence_transformers import SentenceTransformer

# Re-use our singleton, but provide batch capabilities
class EmbeddingModel:
    _instance = None

    @classmethod
    def get_model(cls):
        if cls._instance is None:
            print("Loading sentence-transformers/all-MiniLM-L6-v2...")
            # Use CPU or GPU depending on what's available
            device = "cuda" if torch.cuda.is_available() else "cpu"
            cls._instance = SentenceTransformer("all-MiniLM-L6-v2", device=device)
        return cls._instance

class EmbeddingCache:
    def __init__(self, db_path="embeddings_cache.db"):
        self.db_path = os.path.join(os.path.dirname(__file__), db_path)
        self._init_db()
        self.model = EmbeddingModel.get_model()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS embeddings (
                hash TEXT PRIMARY KEY,
                vector BLOB
            )
        ''')
        conn.commit()
        conn.close()

    def _hash_text(self, text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    def _serialize_tensor(self, tensor: torch.Tensor) -> bytes:
        # Move to CPU, convert to list of floats, json dump, then bytes
        return json.dumps(tensor.cpu().tolist()).encode('utf-8')

    def _deserialize_tensor(self, blob: bytes) -> torch.Tensor:
        # Load from json list, convert to tensor
        return torch.tensor(json.loads(blob.decode('utf-8')))

    def get_embedding(self, text: str) -> torch.Tensor:
        """Get single embedding with cache check."""
        if not text.strip():
            # Return zero tensor for empty text
            return torch.zeros(384) # all-MiniLM-L6-v2 dimension

        text_hash = self._hash_text(text)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT vector FROM embeddings WHERE hash = ?", (text_hash,))
        row = cursor.fetchone()
        
        if row:
            conn.close()
            return self._deserialize_tensor(row[0])
            
        # Cache miss, generate
        emb = self.model.encode(text, convert_to_tensor=True)
        
        cursor.execute("INSERT OR IGNORE INTO embeddings (hash, vector) VALUES (?, ?)", 
                       (text_hash, self._serialize_tensor(emb)))
        conn.commit()
        conn.close()
        return emb

    def get_embeddings_batch(self, texts: list[str]) -> list[torch.Tensor]:
        """Get batch of embeddings, utilizing cache where possible to avoid redundant compute."""
        results = [None] * len(texts)
        missing_indices = []
        missing_texts = []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check cache for all
        for i, text in enumerate(texts):
            if not text.strip():
                results[i] = torch.zeros(384)
                continue
                
            text_hash = self._hash_text(text)
            cursor.execute("SELECT vector FROM embeddings WHERE hash = ?", (text_hash,))
            row = cursor.fetchone()
            
            if row:
                results[i] = self._deserialize_tensor(row[0])
            else:
                missing_indices.append(i)
                missing_texts.append(text)
                
        # Generate missing embeddings in one batch
        if missing_texts:
            print(f"Generating {len(missing_texts)} embeddings (cache miss)...")
            new_embs = self.model.encode(missing_texts, convert_to_tensor=True, show_progress_bar=False)
            
            # Since encode returns a 2D tensor, we iterate over it
            for i, text in enumerate(missing_texts):
                emb = new_embs[i]
                orig_index = missing_indices[i]
                results[orig_index] = emb
                
                # Save to cache if not already present in this transaction
                text_hash = self._hash_text(text)
                cursor.execute("INSERT OR IGNORE INTO embeddings (hash, vector) VALUES (?, ?)", 
                               (text_hash, self._serialize_tensor(emb)))
                
            conn.commit()
            
        conn.close()
        return results
