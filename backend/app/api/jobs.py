"""Job Description CRUD."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import matcher
from app.agents._llm import embed
from app.database.session import get_session
from app.models.db import JobDescription
from app.models.schemas import JobCreate, JobRead, MatchSummary

router = APIRouter()


@router.post("", response_model=JobRead, status_code=201)
async def create_job(body: JobCreate, session: AsyncSession = Depends(get_session)) -> JobRead:
    # Embed the requirements text up front (768-d) so the batch matcher can run
    # against this JD without any further LLM/embedding calls.
    jd_vector = await embed(body.requirements_text)
    jd = JobDescription(
        title=body.title,
        requirements_text=body.requirements_text,
        jd_embedding=jd_vector,
    )
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


@router.post("/{job_id}/match", response_model=MatchSummary)
async def match_job(
    job_id: UUID,
    top_k: int = 50,
    session: AsyncSession = Depends(get_session),
) -> MatchSummary:
    """Trigger Agent 2's batch matcher: lock the closest pool candidates to this job."""
    jd = await session.get(JobDescription, job_id)
    if jd is None:
        raise HTTPException(404, "Job not found")
    summary = await matcher.run_matching_cycle(job_id, session, top_k=top_k)
    return MatchSummary(**summary)
