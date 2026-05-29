from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

model = SentenceTransformer('all-MiniLM-L6-v2')

resume = "Graphic designer with Figma, Illustrator, UI branding"
job = "Python FastAPI PostgreSQL REST APIs Docker"

resume_emb = model.encode([resume])
job_emb = model.encode([job])

score = cosine_similarity(resume_emb, job_emb)

print(score)