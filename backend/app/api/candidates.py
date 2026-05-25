"""Resume upload + candidate state inspection."""
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.vectorizer import UnsupportedResume, extract_text
from app.database.session import get_session
from app.models.db import Candidate, JobDescription
from app.models.schemas import CandidateRead
from app.services import pipeline, state as state_svc

router = APIRouter()


@router.post("/upload", response_model=CandidateRead, status_code=201)
async def upload_resume(
    background: BackgroundTasks,
    job_id: UUID = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> CandidateRead:
    jd = await session.get(JobDescription, job_id)
    if jd is None:
        raise HTTPException(404, "Job not found")

    blob = await file.read()
    try:
        text = extract_text(file.filename or "", blob)
    except UnsupportedResume as e:
        raise HTTPException(415, str(e)) from e
    if not text:
        raise HTTPException(422, "Could not extract any text from the resume")

    candidate = Candidate(
        job_id=job_id, full_name=full_name, email=email, resume_text=text
    )
    session.add(candidate)
    await session.commit()
    await session.refresh(candidate)

    # Kick off Agents 1 -> 2 -> 3 in-process. Strict sequential funnel.
    background.add_task(pipeline.run_intake_pipeline, candidate.id)
    return CandidateRead.model_validate(candidate)


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
