"""
Agent 1 — Vectorizer.

Parses PDF/DOCX resumes into plain text, then generates a dense embedding
with text-embedding-3-small. Persists both to the candidate row.
"""
from io import BytesIO
from uuid import UUID

from docx import Document
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import embed
from app.models.db import Candidate


class UnsupportedResume(ValueError):
    pass


def extract_text(filename: str, blob: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        reader = PdfReader(BytesIO(blob))
        return "\n".join((p.extract_text() or "") for p in reader.pages).strip()
    if name.endswith(".docx"):
        doc = Document(BytesIO(blob))
        return "\n".join(p.text for p in doc.paragraphs).strip()
    raise UnsupportedResume(f"Unsupported file type: {filename}")


async def run(session: AsyncSession, candidate_id: UUID) -> list[float]:
    """Compute and persist the resume embedding."""
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:
        raise ValueError(f"Candidate {candidate_id} not found")
    vector = await embed(candidate.resume_text)
    candidate.embedding = vector
    await session.commit()
    return vector
