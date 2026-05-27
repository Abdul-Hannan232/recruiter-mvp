"""End-to-end smoke test for Agent 3 — the autonomous Coordinator — mocked, live DB.

Drives the full autonomous path against the running Supabase on port 54322:

  1. Boots the app via TestClient (lifespan runs init_db / create_all).
  2. Uploads two resumes -> two POOL candidates (Agent 1, mocked).
  3. Creates + matches a Job so the candidates become MATCHED (Agent 2).
  4. POST /jobs/{job_id}/outreach?wait=true -> Agent 3 drafts + "sends" emails.
  5. Confirms each candidate advanced to OUTREACH_SENT in a fresh sync session.

The generated emails are emitted via the 'agents.coordinator' logger, so we set
logging to INFO to print them to the terminal.

NOTE: _llm.chat() is a fixed local mock (returns canned JSON, not prose), so the
printed "body" is that placeholder. The per-candidate interview link, however, is
built in Python and logged on its own line — that's the real thing Agent 3 injects
and is what you should eyeball here.

No API keys, no uvicorn. Run:  python test_coordinator.py
"""
import logging

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

import fitz  # PyMuPDF
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models.db import Candidate, CandidateStatus
from main import app

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

UPLOAD_URL = "/api/v1/candidates/upload"
JOBS_URL = "/api/v1/jobs"


def make_pdf(body: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), body)
    blob = doc.tobytes()
    doc.close()
    return blob


def main() -> None:
    print(f"Using DATABASE_URL = {settings.DATABASE_URL}\n")

    with TestClient(app) as client:
        print("STEP 1: Uploading two resumes into the Talent Pool...")
        candidate_ids = []
        for i in range(2):
            pdf = make_pdf(f"Candidate {i}\ncand{i}@example.com\nPython, FastAPI, pgvector.")
            resp = client.post(
                UPLOAD_URL, files={"file": (f"resume_{i}.pdf", pdf, "application/pdf")}
            )
            resp.raise_for_status()
            candidate_ids.append(resp.json()["candidate_id"])
            print(f"        -> POOL candidate {candidate_ids[-1]}")
        print()

        print("STEP 2: Creating the Job...")
        resp = client.post(
            JOBS_URL,
            json={
                "title": "Senior Backend Engineer",
                "requirements_text": "Python, FastAPI, PostgreSQL and pgvector experience.",
            },
        )
        resp.raise_for_status()
        job_id = resp.json()["id"]
        print(f"        -> job_id = {job_id}\n")

        print("STEP 3: Matching the pool (Agent 2) so candidates become MATCHED...")
        resp = client.post(f"{JOBS_URL}/{job_id}/match", params={"top_k": 50})
        resp.raise_for_status()
        print(f"        -> {resp.json()}\n")

        print(f"STEP 4: POST {JOBS_URL}/{job_id}/outreach?wait=true (Agent 3)...")
        print("        (generated emails are logged below)\n")
        resp = client.post(f"{JOBS_URL}/{job_id}/outreach", params={"wait": "true"})
        print(f"\n        -> HTTP {resp.status_code}")
        resp.raise_for_status()
        summary = resp.json()
        print(f"        -> summary = {summary}\n")

    print("STEP 5: Verifying OUTREACH_SENT via a fresh sync session...")
    engine = create_engine(settings.DATABASE_URL)
    with Session(engine) as session:
        rows = session.scalars(
            select(Candidate).where(Candidate.id.in_(candidate_ids))
        ).all()
        all_ok = True
        for row in rows:
            ok = row.status == CandidateStatus.OUTREACH_SENT
            print(f"        [{'OK ' if ok else 'FAIL'}] {row.id} status={row.status.value}")
            all_ok = all_ok and ok
    engine.dispose()

    print()
    assert summary["outreach_completed"] >= 2, "expected outreach for our 2 candidates"
    assert all_ok, "every candidate must advance to OUTREACH_SENT"
    print("DONE: Agent 3 autonomous coordinator verified end-to-end against the live DB.")


if __name__ == "__main__":
    main()
