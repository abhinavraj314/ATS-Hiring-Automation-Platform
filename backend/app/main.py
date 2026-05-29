from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

from contextlib import asynccontextmanager

from app.api.v1.api import api_router
from app.services.semantic_matcher import semantic_matcher

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the semantic model on startup
    semantic_matcher.load_model()
    yield
    # Clean up resources if necessary
    
app = FastAPI(
    title="Hiring Automation Platform API",
    description="Enterprise-grade ATS backend",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Welcome to the Hiring Automation Platform API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
