"""Resume upload + candidate state inspection."""
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import vectorizer
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
from app.models.schemas import CandidateRead, UploadResult
from app.services import state as state_svc

router = APIRouter()


@router.post("/me/resume", response_model=UploadResult, status_code=201)
async def upload_my_resume(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    identity: AuthIdentity = Depends(authenticated_principal),
) -> UploadResult:
    """Zero-Click candidate self-onboarding. A signed-up candidate uploads their own
    resume into the GLOBAL POOL (job_id=None). Gated by the lightweight token-only auth
    so it works on the candidate's very first action, before any Candidate row exists.
    Upserts by user_id — re-uploading replaces the candidate's pool record."""
    blob = await file.read()
    try:
        candidate = await vectorizer.ingest(
            session, file.filename or "", blob,
            user_id=identity.user_id, role=UserRole.CANDIDATE,
        )
    except UnsupportedResume as e:
        raise HTTPException(415, str(e)) from e
    except EmptyResume as e:
        raise HTTPException(422, str(e)) from e

    return UploadResult(
        candidate_id=candidate.id,
        full_name=candidate.full_name,
        email=candidate.email,
        status=candidate.status,
    )


@router.post("/upload", response_model=UploadResult, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    _: Principal = Depends(require_recruiter),
) -> UploadResult:
    """Talent Pool intake. Parse + extract + embed + persist inline (Agent 1).

    Recruiter-only: candidates are ingested into the pool by a recruiter uploading a
    resume. The candidate is added job-agnostically (job_id is None). Matching against
    a JD happens later via a recruiter-initiated flow.
    """
    blob = await file.read()
    try:
        candidate = await vectorizer.ingest(session, file.filename or "", blob)
    except UnsupportedResume as e:
        raise HTTPException(415, str(e)) from e
    except EmptyResume as e:
        raise HTTPException(422, str(e)) from e

    return UploadResult(
        candidate_id=candidate.id,
        full_name=candidate.full_name,
        email=candidate.email,
        status=candidate.status,
    )


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
    rows = (
        await session.execute(
            select(Candidate)
            .join(JobDescription, Candidate.job_id == JobDescription.id)
            .where(
                Candidate.status == CandidateStatus.PENDING_RECRUITER,
                JobDescription.recruiter_id == principal.user_id,
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


@router.post("/{candidate_id}/uncalled", response_model=CandidateRead)
async def uncalled_candidate(
    candidate_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: Principal = Depends(require_recruiter),
) -> CandidateRead:
    """Uncalled Archive -> back to baseline POOL with core metrics unchanged (no penalty)."""
    try:
        c = await state_svc.release_uncalled(session, candidate_id)
    except state_svc.IllegalTransition as e:
        raise HTTPException(409, str(e)) from e
    return CandidateRead.model_validate(c)
