"""End-to-end smoke test for Agent 5 — the Evaluator — mocked LLM, live DB.

Drives a single candidate through the entire funnel against the running Supabase
on port 54322 and verifies the 2-stage interview AI filter:

    POOL -> MATCHED -> OUTREACH_SENT -> INTERVIEWING -> INTERVIEW_COMPLETED
         --(Agent 5 / ?wait=true)--> PENDING_RECRUITER

Steps:
  1. Boot the app via TestClient (lifespan runs init_db, which self-heals the
     candidate_status enum to include PENDING_RECRUITER).
  2. Upload a resume (Agent 1)            -> POOL.
  3. Create a JD + batch match (Agent 2)  -> MATCHED.
  4. Autonomous outreach (Agent 3)        -> OUTREACH_SENT.
  5. Mint a WebRTC token (Agent 4)        -> INTERVIEWING.
  6. POST /complete?wait=true (Agent 5)   -> INTERVIEW_COMPLETED then PENDING_RECRUITER,
     asserting the inline decision payload (mock pass, score 85).
  7. Security gate: completing a fresh POOL candidate must be refused (409).

No API keys, no uvicorn. Run:  uv run python test_evaluator.py
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
INTERVIEWS_URL = "/api/v1/interviews"


def make_pdf(body: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), body)
    blob = doc.tobytes()
    doc.close()
    return blob


def db_status(candidate_id: str) -> CandidateStatus:
    """Read a candidate's status via an independent sync session (committed data)."""
    engine = create_engine(settings.DATABASE_URL)
    try:
        with Session(engine) as session:
            row = session.scalar(select(Candidate).where(Candidate.id == candidate_id))
            return row.status
    finally:
        engine.dispose()


def upload_candidate(client: TestClient, tag: str) -> str:
    pdf = make_pdf(f"{tag}\n{tag}@example.com\nPython, FastAPI, pgvector.")
    resp = client.post(UPLOAD_URL, files={"file": (f"{tag}.pdf", pdf, "application/pdf")})
    resp.raise_for_status()
    return resp.json()["candidate_id"]


def main() -> None:
    print(f"Using DATABASE_URL = {settings.DATABASE_URL}\n")

    with TestClient(app) as client:
        print("STEP 1: Driving a candidate to OUTREACH_SENT (Agents 1->2->3)...")
        cid = upload_candidate(client, "evaluatee")
        assert db_status(cid) == CandidateStatus.POOL
        resp = client.post(
            JOBS_URL,
            json={
                "title": "Senior Backend Engineer",
                "requirements_text": "Python, FastAPI, PostgreSQL and pgvector experience.",
            },
        )
        resp.raise_for_status()
        job_id = resp.json()["id"]
        # Large top_k so our fresh candidate is included even if the pool has stale rows.
        client.post(f"{JOBS_URL}/{job_id}/match", params={"top_k": 1000}).raise_for_status()
        assert db_status(cid) == CandidateStatus.MATCHED
        client.post(f"{JOBS_URL}/{job_id}/outreach", params={"wait": "true"}).raise_for_status()
        assert db_status(cid) == CandidateStatus.OUTREACH_SENT
        print(f"        -> candidate {cid} is OUTREACH_SENT\n")

        print(f"STEP 2: GET {INTERVIEWS_URL}/{cid}/webrtc-token (Agent 4)...")
        resp = client.get(f"{INTERVIEWS_URL}/{cid}/webrtc-token")
        print(f"        -> HTTP {resp.status_code} | body = {resp.json()}")
        resp.raise_for_status()
        assert db_status(cid) == CandidateStatus.INTERVIEWING
        print("        -> status is now INTERVIEWING\n")

        print(f"STEP 3: POST {INTERVIEWS_URL}/{cid}/complete?wait=true (Agent 5)...")
        resp = client.post(
            f"{INTERVIEWS_URL}/{cid}/complete",
            params={"wait": "true"},
            json={"transcript": "Strong system design answers; clean pgvector usage."},
        )
        print(f"        -> HTTP {resp.status_code} | body = {resp.json()}")
        resp.raise_for_status()
        payload = resp.json()
        assert payload["decision"] == "pass", payload
        assert payload["score"] == 85, payload
        assert payload["new_status"] == CandidateStatus.PENDING_RECRUITER.value, payload
        assert db_status(cid) == CandidateStatus.PENDING_RECRUITER
        print("        -> Agent 5 PASSED them; status is now PENDING_RECRUITER\n")

        print("STEP 4: Security gate — completing a fresh POOL candidate must 409...")
        pool_cid = upload_candidate(client, "poolonly_eval")
        resp = client.post(f"{INTERVIEWS_URL}/{pool_cid}/complete", params={"wait": "true"})
        print(f"        -> HTTP {resp.status_code} (expected 409) | {resp.json()}")
        assert resp.status_code == 409
        assert db_status(pool_cid) == CandidateStatus.POOL  # unchanged
        print("        -> refused, candidate stayed in POOL\n")

    print("DONE: Agent 5 evaluation verified end-to-end against the live DB.")


if __name__ == "__main__":
    main()
