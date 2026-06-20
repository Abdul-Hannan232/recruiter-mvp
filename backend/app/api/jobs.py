"""Job Description CRUD."""
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import coordinator, matcher
from app.agents._llm import embed
from app.core.auth import Principal, require_recruiter
from app.database.session import get_session
from app.models.db import Candidate, CandidateStatus, JobDescription
from app.models.schemas import JobCreate, JobRead, MatchSummary

# Every job operation (CRUD, matching, outreach) is a recruiter action, so the RBAC
# gate is applied router-wide rather than per-route.
router = APIRouter(dependencies=[Depends(require_recruiter)])


@router.post("", response_model=JobRead, status_code=201)
async def create_job(
    body: JobCreate,
    background_tasks: BackgroundTasks,
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
        city=body.city,
        jd_embedding=jd_vector,
    )
    session.add(jd)
    await session.commit()
    await session.refresh(jd)

    # Zero-Click: post a JD and the engine autonomously matches the pool + reaches out.
    background_tasks.add_task(coordinator.run_full_pipeline_bg, jd.id)
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


# In-flight candidate statuses reset to POOL when a role is closed.
_IN_FLIGHT = [
    CandidateStatus.MATCHED,
    CandidateStatus.SHORTLISTED,
    CandidateStatus.INTERVIEWING,
    CandidateStatus.PENDING_RECRUITER,
    CandidateStatus.FINAL_INTERVIEW_SCHEDULED,
]


@router.post("/{job_id}/close", response_model=JobRead)
async def close_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(require_recruiter),
) -> JobRead:
    """Close a role: deactivate it and release every in-flight candidate back to the POOL.

    Tenant-isolated — only the owning recruiter may close their job. The bulk reset moves
    MATCHED / SHORTLISTED / INTERVIEWING / PENDING_RECRUITER / FINAL_INTERVIEW_SCHEDULED
    candidates back to POOL and unlocks them (job_id + interview_room_id cleared) so they
    are free for future matching. HIRED / REJECTED (terminal) candidates are untouched.
    """
    jd = await session.get(JobDescription, job_id)
    if jd is None or jd.recruiter_id != principal.user_id:
        # 404 (not 403) so we never leak the existence of another tenant's job.
        raise HTTPException(404, "Job not found")

    await session.execute(
        update(Candidate)
        .where(Candidate.job_id == job_id, Candidate.status.in_(_IN_FLIGHT))
        .values(status=CandidateStatus.POOL, job_id=None, interview_room_id=None)
    )
    jd.is_active = False
    await session.commit()
    await session.refresh(jd)
    return JobRead.model_validate(jd)


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(require_recruiter),
) -> Response:
    """Hard-delete a SINGLE job, strictly scoped to its id AND the owning recruiter.

    The scoped fetch (id == job_id AND recruiter_id == caller) guarantees one tenant can
    never delete another's role, and that exactly one job is removed. In-flight candidates
    are released to the POOL (status reset, job_id + interview_room_id cleared) before the
    delete; any remaining references (e.g. terminal candidates, interview transcripts) are
    SET NULL by the FK on delete, so history survives.
    """
    jd = (
        await session.execute(
            select(JobDescription).where(
                JobDescription.id == job_id,
                JobDescription.recruiter_id == principal.user_id,
            )
        )
    ).scalar_one_or_none()
    if jd is None:
        raise HTTPException(404, "Job not found")

    await session.execute(
        update(Candidate)
        .where(Candidate.job_id == job_id, Candidate.status.in_(_IN_FLIGHT))
        .values(status=CandidateStatus.POOL, job_id=None, interview_room_id=None)
    )
    await session.delete(jd)
    await session.commit()
    return Response(status_code=204)
