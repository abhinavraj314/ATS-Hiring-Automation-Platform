from sentence_transformers import SentenceTransformer

class EmbeddingModel:
    _instance = None

    @classmethod
    def get_model(cls):
        if cls._instance is None:
            print("Loading sentence-transformers/all-MiniLM-L6-v2...")
            cls._instance = SentenceTransformer("all-MiniLM-L6-v2")
        return cls._instance

def get_embedding(text: str):
    model = EmbeddingModel.get_model()
    # Ensure text is string and return as a numpy array or tensor
    return model.encode(text, convert_to_tensor=True)

def get_embeddings(texts: list[str]):
    model = EmbeddingModel.get_model()
    return model.encode(texts, convert_to_tensor=True)
