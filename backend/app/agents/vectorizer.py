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

import fitz  # PyMuPDF
from docx import Document
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat, embed
from app.models.db import Candidate, CandidateStatus


class UnsupportedResume(ValueError):
    """Raised for an unrecognised file type."""


class EmptyResume(ValueError):
    """Raised when no usable text could be extracted from the file."""


_EXTRACT_SYSTEM = (
    "You are a resume parser. From the resume text, extract the candidate's full "
    "name and email address. Respond with ONLY a JSON object of the exact form "
    '{"full_name": "...", "email": "..."} and nothing else. Use an empty string '
    "for any field you cannot find."
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
    """LLM-extract {full_name, email} from resume text (mocked in local dev)."""
    raw = await chat(
        [
            {"role": "system", "content": _EXTRACT_SYSTEM},
            {"role": "user", "content": text},
        ]
    )
    data = json.loads(raw)
    return {
        "full_name": (data.get("full_name") or "Unknown Candidate").strip(),
        "email": (data.get("email") or "").strip(),
    }


async def ingest(session: AsyncSession, filename: str, blob: bytes) -> Candidate:
    """Full Agent-1 upload path → a persisted, embedded Candidate in the POOL."""
    text = extract_text(filename, blob)
    if not text:
        raise EmptyResume("Could not extract any text from the resume")

    profile = await extract_profile(text)
    vector = await embed(text)

    candidate = Candidate(
        job_id=None,  # Talent Pool: unassigned until a recruiter matches against a JD
        full_name=profile["full_name"],
        email=profile["email"],
        original_resume_text=text,
        resume_embedding=vector,
        status=CandidateStatus.POOL,
    )
    session.add(candidate)
    await session.commit()
    await session.refresh(candidate)
    return candidate
