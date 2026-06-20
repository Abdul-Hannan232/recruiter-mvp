"""
Agent 1 — Vectorizer (Talent Pool intake).

The single entry point `ingest()` runs the full upload path synchronously inside
the request cycle:
  1. Parse PDF (PyMuPDF/fitz) or DOCX (python-docx) into clean plain text.
  2. Extract the candidate's full_name + email via the LLM (mocked locally).
  3. Embed the resume text into a 768-d pgvector (mocked locally).
  4. Persist a job-agnostic Candidate row in the POOL.
"""
import json
from io import BytesIO
from uuid import UUID

import fitz  # PyMuPDF
from docx import Document
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat, embed
from app.core.config import settings
from app.models.db import Candidate, CandidateStatus, UserRole


class UnsupportedResume(ValueError):
    """Raised for an unrecognised file type."""


class EmptyResume(ValueError):
    """Raised when no usable text could be extracted from the file."""


_EXTRACT_SYSTEM = (
    "You are a resume parser. From the resume text, extract the candidate's full "
    "name. Respond with ONLY a JSON object of the exact form "
    '{"full_name": "..."} and nothing else. Use an empty string if you cannot find it.'
)


def extract_text(filename: str, blob: bytes) -> str:
    """Extract raw text from a PDF/DOCX blob; strip null bytes and whitespace."""
    name = filename.lower()
    if name.endswith(".pdf"):
        with fitz.open(stream=blob, filetype="pdf") as doc:
            raw = "\n".join(page.get_text() for page in doc)
    elif name.endswith(".docx"):
        document = Document(BytesIO(blob))
        raw = "\n".join(p.text for p in document.paragraphs)
    else:
        raise UnsupportedResume(f"Unsupported file type: {filename}")
    return raw.replace("\x00", "").strip()


async def extract_profile(text: str) -> dict[str, str]:
    """LLM-extract {full_name} from resume text.

    Email is intentionally NOT parsed here: the candidate's verified Supabase Auth
    email is the single, absolute source of truth and is bound directly in ingest().
    """
    raw = await chat(
        [
            {"role": "system", "content": _EXTRACT_SYSTEM},
            {"role": "user", "content": text},
        ],
        model=settings.DEEPSEEK_FLASH_MODEL,  # Agent 1: fast extraction
    )
    data = json.loads(raw)
    return {"full_name": (data.get("full_name") or "Unknown Candidate").strip()}


async def ingest(
    session: AsyncSession,
    filename: str,
    blob: bytes,
    *,
    email: str,
    city: str | None = None,
    user_id: UUID | None = None,
    role: UserRole = UserRole.CANDIDATE,
) -> Candidate:
    """Full Agent-1 upload path → a persisted, embedded Candidate in the global POOL.

    ``email`` is REQUIRED and is the candidate's verified Supabase Auth email — the
    single, absolute source of truth for the contact address. It is bound to the row
    verbatim; the résumé is never consulted for an email. (All resumes are uploaded by
    the authenticated candidate themselves via /candidates/me/resume, so an auth email
    always exists.)

    When ``user_id`` is supplied (candidate self-upload), the row is linked to the
    Supabase identity and UPSERTED — a re-upload refreshes that candidate's record
    rather than creating a duplicate. job_id is None on first ingest (job-agnostic
    pool); a recruiter's JD match assigns it later.

    Funnel-state protection: if the existing candidate has already advanced past POOL
    (SHORTLISTED / INTERVIEWING / PENDING_RECRUITER / etc.), a re-upload only refreshes
    the resume text + embedding — it does NOT reset job_id or status, so an in-flight
    candidate is never knocked out of the pipeline.
    """
    text = extract_text(filename, blob)
    if not text:
        raise EmptyResume("Could not extract any text from the resume")

    profile = await extract_profile(text)
    vector = await embed(text)

    candidate: Candidate | None = None
    if user_id is not None:
        candidate = (
            await session.execute(select(Candidate).where(Candidate.user_id == user_id))
        ).scalar_one_or_none()

    if candidate is None:
        candidate = Candidate(user_id=user_id, role=role, status=CandidateStatus.POOL)
        session.add(candidate)

    # Always refresh the parsed resume content + embedding.
    candidate.full_name = profile["full_name"]
    # Verified Supabase Auth email — bound directly, never sourced from the résumé.
    candidate.email = email
    # City from the verified Supabase Auth metadata (location tracking).
    candidate.city = city
    candidate.original_resume_text = text
    candidate.resume_embedding = vector

    # Only (re)set pool state when the candidate is brand-new or still in POOL. An
    # in-flight candidate (past POOL) keeps their job_id and status untouched.
    if candidate.status == CandidateStatus.POOL:
        candidate.job_id = None

    await session.commit()
    await session.refresh(candidate)
    return candidate
