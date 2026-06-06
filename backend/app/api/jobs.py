"""Job Description CRUD."""
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import coordinator, matcher
from app.agents._llm import embed
from app.core.auth import Principal, require_recruiter
from app.database.session import get_session
from app.models.db import JobDescription
from app.models.schemas import JobCreate, JobRead, MatchSummary

# Every job operation (CRUD, matching, outreach) is a recruiter action, so the RBAC
# gate is applied router-wide rather than per-route.
router = APIRouter(dependencies=[Depends(require_recruiter)])


@router.post("", response_model=JobRead, status_code=201)
async def create_job(
    body: JobCreate,
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(require_recruiter),
) -> JobRead:
    # Embed the requirements text up front (768-d) so the batch matcher can run
    # against this JD without any further LLM/embedding calls. Stamp the owning
    # recruiter so the job is scoped to this tenant.
    jd_vector = await embed(body.requirements_text)
    jd = JobDescription(
        recruiter_id=principal.user_id,
        title=body.title,
        requirements_text=body.requirements_text,
        jd_embedding=jd_vector,
    )
    session.add(jd)
    await session.commit()
    await session.refresh(jd)
    return JobRead.model_validate(jd)


@router.get("", response_model=list[JobRead])
async def list_jobs(
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(require_recruiter),
) -> list[JobRead]:
    # Tenant isolation: a recruiter only ever lists their own jobs.
    rows = (
        await session.execute(
            select(JobDescription).where(JobDescription.recruiter_id == principal.user_id)
        )
    ).scalars().all()
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


@router.post("/{job_id}/outreach", status_code=202)
async def outreach_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    response: Response,
    wait: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Trigger Agent 3's autonomous outreach for this job's MATCHED candidates.

    Default (wait=false): schedule the cycle as a BackgroundTask and return 202
    instantly. wait=true: await it inline and return 200 with the real summary
    (handy for tests / synchronous callers).
    """
    jd = await session.get(JobDescription, job_id)
    if jd is None:
        raise HTTPException(404, "Job not found")

    if wait:
        summary = await coordinator.run_outreach_cycle(job_id, session)
        response.status_code = 200
        return summary

    background_tasks.add_task(coordinator.run_outreach_cycle_bg, job_id)
    return {"status": "accepted", "job_id": str(job_id)}
