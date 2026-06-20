"""Resume upload + candidate state inspection."""
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import coordinator, vectorizer
from app.agents.vectorizer import EmptyResume, UnsupportedResume
from app.core.auth import (
    AuthIdentity,
    Principal,
    authenticated_principal,
    current_user,
    require_recruiter,
)
from app.database.session import get_session
from app.models.db import Candidate, CandidateStatus, JobDescription, UserRole
from app.models.schemas import (
    CandidateProfileUpdate,
    CandidateRead,
    ScheduleInterviewIn,
    UploadResult,
)
from app.services import state as state_svc
from app.services.email import send_final_interview_email

router = APIRouter()


@router.post("/me/resume", response_model=UploadResult, status_code=201)
async def upload_my_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    identity: AuthIdentity = Depends(authenticated_principal),
) -> UploadResult:
    """Zero-Click candidate self-onboarding. A signed-up candidate uploads their own
    resume into the GLOBAL POOL (job_id=None). Gated by the lightweight token-only auth
    so it works on the candidate's very first action, before any Candidate row exists.
    Upserts by user_id — re-uploading replaces the candidate's pool record."""
    # Strict auth-email binding: the verified JWT email is the single source of truth
    # and is NOT NULL on the row. Fail fast (422) rather than 500 at the DB INSERT.
    if not identity.email:
        raise HTTPException(status_code=422, detail="Verified email required in Auth token")

    blob = await file.read()
    try:
        candidate = await vectorizer.ingest(
            session, file.filename or "", blob,
            user_id=identity.user_id, role=UserRole.CANDIDATE,
            # Authoritative contact address from the verified JWT — not the résumé text,
            # which often has no parseable email and would persist as "".
            email=identity.email,
            # Location from the verified JWT user_metadata (auth-level location tracking).
            city=identity.city,
        )
    except UnsupportedResume as e:
        raise HTTPException(415, str(e)) from e
    except EmptyResume as e:
        raise HTTPException(422, str(e)) from e

    # Zero-Click: a freshly pooled candidate is autonomously matched against every job.
    background_tasks.add_task(coordinator.run_full_pipeline_all_jobs_bg)

    return UploadResult(
        candidate_id=candidate.id,
        full_name=candidate.full_name,
        email=candidate.email,
        status=candidate.status,
    )


@router.patch("/me", response_model=CandidateRead)
async def update_my_profile(
    body: CandidateProfileUpdate,
    session: AsyncSession = Depends(get_session),
    identity: AuthIdentity = Depends(authenticated_principal),
) -> CandidateRead:
    """Sync the candidate's editable profile fields (full_name, city) from the auth layer
    into their Candidate row. Closes the JWT<->DB drift that would otherwise corrupt
    Agent 2's geo-gate when a candidate edits their city without re-uploading a resume.
    Only the fields present in the payload are touched."""
    candidate = (
        await session.execute(select(Candidate).where(Candidate.user_id == identity.user_id))
    ).scalar_one_or_none()
    if candidate is None:
        raise HTTPException(404, "No candidate profile found for this user")

    if body.full_name is not None:
        candidate.full_name = body.full_name
    if body.city is not None:
        candidate.city = body.city
    await session.commit()
    await session.refresh(candidate)
    return CandidateRead.model_validate(candidate)


@router.get("/graded", response_model=list[CandidateRead])
async def list_graded(
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(require_recruiter),
) -> list[CandidateRead]:
    """The recruiter's review queue: candidates who finished the interview and were
    graded by Agent 5 (status PENDING_RECRUITER).

    MULTI-TENANCY: joins Candidate -> JobDescription and filters by the job's
    recruiter_id == this recruiter's identity, so Recruiter A can never see a
    candidate who interviewed for Recruiter B's job.

    NOTE: declared BEFORE /{candidate_id} so the literal "graded" segment isn't
    captured by the UUID path param.
    """
    # Prefer the durable recruiter snapshot (survives job deletion). Fall back to live
    # job ownership only for legacy rows that predate the snapshot. No INNER JOIN, so a
    # graded candidate whose job was deleted (job_id NULL) is no longer dropped.
    owned_job_ids = select(JobDescription.id).where(
        JobDescription.recruiter_id == principal.user_id
    )
    rows = (
        await session.execute(
            select(Candidate)
            .where(
                Candidate.status.in_(
                    [
                        CandidateStatus.PENDING_RECRUITER,
                        CandidateStatus.FINAL_INTERVIEW_SCHEDULED,
                    ]
                ),
                or_(
                    Candidate.recruiter_id_snapshot == principal.user_id,
                    and_(
                        Candidate.recruiter_id_snapshot.is_(None),
                        Candidate.job_id.in_(owned_job_ids),
                    ),
                ),
            )
            .order_by(Candidate.ai_evaluation_score.desc().nullslast())
        )
    ).scalars().all()
    return [CandidateRead.model_validate(r) for r in rows]


@router.get("/{candidate_id}", response_model=CandidateRead)
async def get_candidate(
    candidate_id: UUID,
    principal: Principal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> CandidateRead:
    c = await state_svc.get_candidate(session, candidate_id)
    if c is None:
        raise HTTPException(404, "Candidate not found")
    # Recruiters may read any candidate; a candidate may read only their own record.
    if principal.role != UserRole.RECRUITER and c.user_id != principal.user_id:
        raise HTTPException(403, "Cannot access another candidate's record")
    return CandidateRead.model_validate(c)


@router.get("/by-job/{job_id}", response_model=list[CandidateRead])
async def list_by_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: Principal = Depends(require_recruiter),
) -> list[CandidateRead]:
    """Recruiter-only: the shortlist of candidates locked to a given job."""
    rows = await state_svc.list_candidates_for_job(session, job_id)
    return [CandidateRead.model_validate(r) for r in rows]


# --- HITL recruiter overrides (Phase 3). Each is recruiter-only, transaction-safe
#     (row-locked), and strictly bounded by the state machine -> 409 if illegal. -----

@router.post("/{candidate_id}/hire", response_model=CandidateRead)
async def hire_candidate(
    candidate_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: Principal = Depends(require_recruiter),
) -> CandidateRead:
    """Hire -> HIRED (terminal); releases the candidate from matching/interview loops."""
    try:
        c = await state_svc.hire(session, candidate_id)
    except state_svc.IllegalTransition as e:
        raise HTTPException(409, str(e)) from e
    return CandidateRead.model_validate(c)


@router.post("/{candidate_id}/reject", response_model=CandidateRead)
async def reject_candidate(
    candidate_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: Principal = Depends(require_recruiter),
) -> CandidateRead:
    """Reject -> back to POOL with a persistent scalar penalty (embedding untouched)."""
    try:
        c = await state_svc.reject(session, candidate_id)
    except state_svc.IllegalTransition as e:
        raise HTTPException(409, str(e)) from e
    return CandidateRead.model_validate(c)


@router.post("/{candidate_id}/schedule-human-interview", response_model=CandidateRead)
async def schedule_human_interview(
    candidate_id: UUID,
    body: ScheduleInterviewIn,
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(require_recruiter),
) -> CandidateRead:
    """HITL final handoff: book a human interview with an AI-vetted candidate.

    Emails the candidate and CC's the recruiter on one thread (neither address is exposed
    until this invite is sent), then advances PENDING_RECRUITER -> FINAL_INTERVIEW_SCHEDULED.
    The email is sent BEFORE the status flip, so a delivery failure doesn't leave the
    candidate marked as scheduled without an invite going out.
    """
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(404, "Candidate not found")
    if candidate.status != CandidateStatus.PENDING_RECRUITER:
        raise HTTPException(
            409,
            f"Cannot schedule a final interview from status {candidate.status.value} "
            "(expected pending_recruiter)",
        )

    jd = await session.get(JobDescription, candidate.job_id) if candidate.job_id else None
    job_title = jd.title if jd else "the role"

    await send_final_interview_email(
        to=candidate.email,
        cc=principal.email,
        job_title=job_title,
        scheduled_time=body.scheduled_time,
        meeting_link=body.meeting_link,
    )

    candidate.status = CandidateStatus.FINAL_INTERVIEW_SCHEDULED
    await session.commit()
    await session.refresh(candidate)
    return CandidateRead.model_validate(candidate)
