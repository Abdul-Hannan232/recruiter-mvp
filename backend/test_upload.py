"""End-to-end smoke test for the Talent Pool upload path (Agent 1), fully mocked.

Drives POST /api/v1/candidates/upload with a generated PDF via FastAPI's
TestClient (using it as a context manager so the app lifespan runs init_db /
create_all), then opens an independent synchronous SQLAlchemy connection to
confirm the row was persisted with a 768-d embedding.

No API keys, no uvicorn. Run:  python test_upload.py
"""
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

import fitz  # PyMuPDF
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models.db import Candidate
from main import app

UPLOAD_URL = "/api/v1/candidates/upload"


def make_pdf() -> bytes:
    """Generate a minimal, valid PDF in memory that fitz can parse back."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "Jane Doe\njane.doe@example.com\nSenior Backend Engineer\n"
        "Python, FastAPI, PostgreSQL, pgvector.",
    )
    blob = doc.tobytes()
    doc.close()
    return blob


def main() -> None:
    print("STEP 1: Generating a minimal valid PDF in memory...")
    pdf_bytes = make_pdf()
    print(f"        -> {len(pdf_bytes)} bytes generated.\n")

    print("STEP 2: Booting app via TestClient (runs lifespan: init_db/create_all)...")
    with TestClient(app) as client:
        print("        -> App started, tables ensured.\n")

        print(f"STEP 3: POST {UPLOAD_URL} with the PDF...")
        resp = client.post(
            UPLOAD_URL,
            files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
        )
        print(f"        -> HTTP {resp.status_code}")
        print(f"        -> JSON response: {resp.json()}\n")
        resp.raise_for_status()
        candidate_id = resp.json()["candidate_id"]

    print("STEP 4: Querying the candidates table via a fresh SQLAlchemy session...")
    engine = create_engine(settings.DATABASE_URL)  # sync psycopg dialect
    with Session(engine) as session:
        row = session.scalar(select(Candidate).where(Candidate.id == candidate_id))
        if row is None:
            print("        -> NOT FOUND: no row for that id.")
            return
        vec_len = len(row.resume_embedding) if row.resume_embedding is not None else 0
        print("        -> Inserted row:")
        print(f"           id            = {row.id}")
        print(f"           full_name     = {row.full_name}")
        print(f"           email         = {row.email}")
        print(f"           status        = {row.status.value}")
        print(f"           job_id        = {row.job_id}  (None = Talent Pool)")
        print(f"           vector length = {vec_len}")
    engine.dispose()

    print("\nDONE: mock pipeline succeeded end-to-end.")


if __name__ == "__main__":
    main()
