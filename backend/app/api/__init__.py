"""Aggregates all v1 routers."""
from fastapi import APIRouter

from app.api import candidates, interviews, jobs

router = APIRouter()
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
router.include_router(interviews.router, prefix="/interviews", tags=["interviews"])
