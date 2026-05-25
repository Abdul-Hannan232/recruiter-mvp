"""Job Description CRUD."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_session
from app.models.db import JobDescription
from app.models.schemas import JobCreate, JobRead

router = APIRouter()


@router.post("", response_model=JobRead, status_code=201)
async def create_job(body: JobCreate, session: AsyncSession = Depends(get_session)) -> JobRead:
    jd = JobDescription(title=body.title, description=body.description)
    session.add(jd)
    await session.commit()
    await session.refresh(jd)
    return JobRead.model_validate(jd)


@router.get("", response_model=list[JobRead])
async def list_jobs(session: AsyncSession = Depends(get_session)) -> list[JobRead]:
    rows = (await session.execute(select(JobDescription))).scalars().all()
    return [JobRead.model_validate(r) for r in rows]


@router.get("/{job_id}", response_model=JobRead)
async def get_job(job_id: UUID, session: AsyncSession = Depends(get_session)) -> JobRead:
    jd = await session.get(JobDescription, job_id)
    if jd is None:
        raise HTTPException(404, "Job not found")
    return JobRead.model_validate(jd)
