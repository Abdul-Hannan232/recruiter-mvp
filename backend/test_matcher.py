"""End-to-end smoke test for Agent 2 — the batch Matcher — fully mocked, live DB.

Verifies the "Top-K Math Gate" flow against the running Supabase on port 54322
(read from settings.DATABASE_URL / .env). It:

  1. Boots the app via TestClient (lifespan runs init_db / create_all).
  2. Uploads two resumes -> two POOL candidates (Agent 1, mocked embeddings).
  3. Creates a Job via POST /jobs (now embeds the JD into a 768-d vector).
  4. Triggers POST /jobs/{job_id}/match and inspects the summary JSON.
  5. Re-opens a fresh sync session to confirm the matched candidates flipped to
     MATCHED and were locked to the job's id.

Because the local mock embed() returns an identical 768-d vector for every text,
the cosine distance is ~0 for all candidates, so every pooled candidate inside
top_k clears the < 0.6 gate. That's exactly what we want to exercise the path.

No API keys, no uvicorn. Run:  python test_matcher.py
"""
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

import fitz  # PyMuPDF
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models.db import Candidate, CandidateStatus
from main import app

UPLOAD_URL = "/api/v1/candidates/upload"
JOBS_URL = "/api/v1/jobs"


def make_pdf(body: str) -> bytes:
    """Generate a minimal, valid PDF in memory that fitz can parse back."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), body)
    blob = doc.tobytes()
    doc.close()
    return blob


def main() -> None:
    print(f"Using DATABASE_URL = {settings.DATABASE_URL}")
    print(f"MATCH_DISTANCE_THRESHOLD = {settings.MATCH_DISTANCE_THRESHOLD}\n")

    with TestClient(app) as client:
        print("STEP 1: Uploading two resumes into the Talent Pool...")
        uploaded_ids = []
        for i in range(2):
            pdf = make_pdf(
                f"Candidate {i}\ncand{i}@example.com\nPython, FastAPI, pgvector."
            )
            resp = client.post(
                UPLOAD_URL,
                files={"file": (f"resume_{i}.pdf", pdf, "application/pdf")},
            )
            resp.raise_for_status()
            cid = resp.json()["candidate_id"]
            uploaded_ids.append(cid)
            print(f"        -> POOL candidate {cid}")
        print()

        print("STEP 2: Creating a Job (embeds the JD into a 768-d vector)...")
        resp = client.post(
            JOBS_URL,
            json={
                "title": "Senior Backend Engineer",
                "requirements_text": "Python, FastAPI, PostgreSQL and pgvector experience.",
            },
        )
        print(f"        -> HTTP {resp.status_code}")
        resp.raise_for_status()
        job_id = resp.json()["id"]
        print(f"        -> job_id = {job_id}\n")

        print(f"STEP 3: POST {JOBS_URL}/{job_id}/match?top_k=50 ...")
        resp = client.post(f"{JOBS_URL}/{job_id}/match", params={"top_k": 50})
        print(f"        -> HTTP {resp.status_code}")
        resp.raise_for_status()
        summary = resp.json()
        print(f"        -> summary = {summary}\n")

    print("STEP 4: Verifying matched candidates via a fresh sync session...")
    engine = create_engine(settings.DATABASE_URL)  # sync psycopg dialect
    with Session(engine) as session:
        rows = session.scalars(
            select(Candidate).where(Candidate.id.in_(uploaded_ids))
        ).all()
        all_ok = True
        for row in rows:
            locked = str(row.job_id) == str(job_id)
            matched = row.status == CandidateStatus.MATCHED
            flag = "OK " if (locked and matched) else "FAIL"
            print(
                f"        [{flag}] {row.id} status={row.status.value} "
                f"job_id={row.job_id}"
            )
            all_ok = all_ok and locked and matched
    engine.dispose()

    print()
    assert summary["matched_and_locked"] >= 2, "expected our 2 uploads to be matched"
    assert all_ok, "every uploaded candidate must be MATCHED and locked to the job"
    print("DONE: Agent 2 batch matcher verified end-to-end against the live DB.")


if __name__ == "__main__":
    main()
