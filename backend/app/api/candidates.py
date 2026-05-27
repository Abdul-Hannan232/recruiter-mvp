"""Resume upload + candidate state inspection."""
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import vectorizer
from app.agents.vectorizer import EmptyResume, UnsupportedResume
from app.database.session import get_session
from app.models.schemas import CandidateRead, UploadResult
from app.services import state as state_svc

router = APIRouter()


@router.post("/upload", response_model=UploadResult, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> UploadResult:
    """Talent Pool intake. Parse + extract + embed + persist inline (Agent 1).

    The candidate is added job-agnostically (job_id is None). Matching against a JD
    happens later via a recruiter-initiated flow.
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


@router.get("/{candidate_id}", response_model=CandidateRead)
async def get_candidate(
    candidate_id: UUID, session: AsyncSession = Depends(get_session)
) -> CandidateRead:
    c = await state_svc.get_candidate(session, candidate_id)
    if c is None:
        raise HTTPException(404, "Candidate not found")
    return CandidateRead.model_validate(c)


@router.get("/by-job/{job_id}", response_model=list[CandidateRead])
async def list_by_job(
    job_id: UUID, session: AsyncSession = Depends(get_session)
) -> list[CandidateRead]:
    rows = await state_svc.list_candidates_for_job(session, job_id)
    return [CandidateRead.model_validate(r) for r in rows]
