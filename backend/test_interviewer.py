"""State-transition smoke test for Agent 4 — the WebRTC ticket booth — mocked, live DB.

Verifies the interview lifecycle against the running Supabase on port 54322:

    OUTREACH_SENT --(GET webrtc-token)--> INTERVIEWING --(POST complete)--> INTERVIEW_COMPLETED
                                                          --(Agent 5)-->     PENDING_RECRUITER

Steps:
  1. Boot the app via TestClient (lifespan runs init_db, which also widens the
     candidate_status enum to include INTERVIEWING / INTERVIEW_COMPLETED).
  2. Drive a candidate to OUTREACH_SENT (Agents 1 -> 2 -> 3).
  3. GET  /interviews/{id}/webrtc-token  -> asserts {token, model} + INTERVIEWING.
  4. WS   /ws/code/{id}                  -> accepted while INTERVIEWING.
  5. POST /interviews/{id}/complete       -> Agent 5 (mock) passes them; asserts
     PENDING_RECRUITER (the background eval runs before TestClient returns).
  6. Security gates: a fresh POOL candidate must be refused a token (403) AND
     refused a WebSocket connection (closed, code 1008).

The OpenAI ephemeral-token call is mocked (GA /v1/realtime/client_secrets shape),
so this needs no API key or network. Run:  python test_interviewer.py
"""
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

import fitz  # PyMuPDF
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import settings
from app.models.db import Candidate, CandidateStatus
from main import app

# Mock upstream payload mirroring OpenAI's GA client_secrets response: the
# ephemeral key is the top-level "value"; session metadata is nested.
MOCK_EK = "ek_mock_ephemeral_token_123"


async def fake_mint_ephemeral_token(*, voice=None, instructions=None) -> dict:
    return {
        "value": MOCK_EK,
        "expires_at": 9999999999,
        "session": {"id": "sess_mock", "model": settings.OPENAI_REALTIME_MODEL},
    }

UPLOAD_URL = "/api/v1/candidates/upload"
JOBS_URL = "/api/v1/jobs"
INTERVIEWS_URL = "/api/v1/interviews"
WS_CODE_URL = "/ws/code"


def make_pdf(body: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), body)
    blob = doc.tobytes()
    doc.close()
    return blob


def db_status(candidate_id: str) -> CandidateStatus:
    """Read a candidate's status via an independent sync session."""
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

    # Patch the OpenAI mint so the token pipeline runs offline with the GA shape.
    with TestClient(app) as client, patch(
        "app.agents.interviewer.mint_ephemeral_token", new=fake_mint_ephemeral_token
    ):
        print("STEP 1: Driving a candidate to OUTREACH_SENT (Agents 1->2->3)...")
        cid = upload_candidate(client, "interviewee")
        resp = client.post(
            JOBS_URL,
            json={
                "title": "Senior Backend Engineer",
                "requirements_text": "Python, FastAPI, PostgreSQL and pgvector experience.",
            },
        )
        resp.raise_for_status()
        job_id = resp.json()["id"]
        client.post(f"{JOBS_URL}/{job_id}/match", params={"top_k": 50}).raise_for_status()
        client.post(f"{JOBS_URL}/{job_id}/outreach", params={"wait": "true"}).raise_for_status()
        assert db_status(cid) == CandidateStatus.OUTREACH_SENT
        print(f"        -> candidate {cid} is OUTREACH_SENT\n")

        print(f"STEP 2: GET {INTERVIEWS_URL}/{cid}/webrtc-token ...")
        resp = client.get(f"{INTERVIEWS_URL}/{cid}/webrtc-token")
        print(f"        -> HTTP {resp.status_code} | body = {resp.json()}")
        resp.raise_for_status()
        body = resp.json()
        assert body["token"] == MOCK_EK, body
        assert body["model"] == settings.OPENAI_REALTIME_MODEL, body
        assert db_status(cid) == CandidateStatus.INTERVIEWING
        print("        -> token minted; status is now INTERVIEWING\n")

        print(f"STEP 2b: WS {WS_CODE_URL}/{cid} should be ACCEPTED while INTERVIEWING...")
        with client.websocket_connect(f"{WS_CODE_URL}/{cid}") as ws:
            ws.send_json({"language": "python", "code": "def add(a, b):\n    return a + b\n"})
        print("        -> WebSocket accepted and code snapshot relayed\n")

        print(f"STEP 3: POST {INTERVIEWS_URL}/{cid}/complete ...")
        resp = client.post(f"{INTERVIEWS_URL}/{cid}/complete")
        print(f"        -> HTTP {resp.status_code} | body = {resp.json()}")
        resp.raise_for_status()
        # /complete now hands off to Agent 5; the background eval (mock = pass) runs
        # before TestClient returns, advancing INTERVIEW_COMPLETED -> PENDING_RECRUITER.
        assert db_status(cid) == CandidateStatus.PENDING_RECRUITER
        print("        -> Agent 5 passed them; status is now PENDING_RECRUITER\n")

        print("STEP 4: Security gate — a POOL candidate must be refused a token...")
        pool_cid = upload_candidate(client, "poolonly")
        resp = client.get(f"{INTERVIEWS_URL}/{pool_cid}/webrtc-token")
        print(f"        -> HTTP {resp.status_code} (expected 403) | {resp.json()}")
        assert resp.status_code == 403
        assert db_status(pool_cid) == CandidateStatus.POOL  # unchanged
        print("        -> refused, candidate stayed in POOL\n")

        print(f"STEP 4b: WS {WS_CODE_URL}/{pool_cid} must be REJECTED for a POOL candidate...")
        try:
            with client.websocket_connect(f"{WS_CODE_URL}/{pool_cid}"):
                raise AssertionError("WebSocket should have been rejected for a POOL candidate")
        except WebSocketDisconnect as e:
            assert e.code == 1008, f"expected policy-violation 1008, got {e.code}"
            print("        -> WebSocket rejected (1008 policy violation)\n")

    print("DONE: Agent 4 state transitions verified end-to-end against the live DB.")


if __name__ == "__main__":
    main()
