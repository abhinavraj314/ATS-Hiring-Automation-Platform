from fastapi import APIRouter
from app.api.v1 import auth, jobs, candidates, panels, interviews

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
api_router.include_router(panels.router, prefix="/panels", tags=["panels"])
api_router.include_router(interviews.router, prefix="/interviews", tags=["interviews"])

