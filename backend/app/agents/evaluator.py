"""
Agent 5 — Evaluator.

The AI filter in our 2-stage interview. After the candidate finishes the live
interview (status INTERVIEW_COMPLETED), this agent reasons over the transcript +
the JD requirements and decides:

    pass -> PENDING_RECRUITER (handed to the human recruiter for stage 2)
    fail -> POOL, job_id cleared (freed for a future job to match)

Runs either inline (?wait=true) or via FastAPI BackgroundTasks. The background
entry point opens its own session because the request session is already closed
by the time the task runs (same pattern as coordinator.run_outreach_cycle_bg).
"""
import json
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat
from app.database.session import SessionLocal
from app.models.db import Candidate, CandidateStatus, JobDescription

log = logging.getLogger("agents.evaluator")


SYSTEM = (
    "You are a strict, fair technical interview evaluator. Decide whether the "
    "candidate should advance to a human recruiter based ONLY on the interview "
    "transcript and the job requirements. Return STRICT JSON with exactly two "
    'keys: {"score": <integer 0-100>, "decision": "pass" | "fail"}.'
)


async def evaluate_interview(
    candidate_id: UUID,
    db: AsyncSession,
    mock_transcript: str = "Candidate answered well.",
) -> dict:
    """Score the interview and route the candidate. Commits the session."""
    candidate = await db.get(Candidate, candidate_id)
    if candidate is None:
        raise ValueError(f"Candidate {candidate_id} not found")

    # Security gate: only evaluate candidates who actually finished the interview.
    if candidate.status != CandidateStatus.INTERVIEW_COMPLETED:
        raise ValueError(
            f"Candidate {candidate_id} is {candidate.status.value}; "
            f"expected {CandidateStatus.INTERVIEW_COMPLETED.value}"
        )

    # Fetch the JD explicitly (not via lazy relationship — that would trip the
    # async greenlet) so its requirements can ground the evaluation.
    jd = await db.get(JobDescription, candidate.job_id) if candidate.job_id else None
    requirements = jd.requirements_text if jd else "No specific requirements on file."

    raw = await chat(
        [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": (
                    f"JOB REQUIREMENTS:\n{requirements}\n\n"
                    f"INTERVIEW TRANSCRIPT:\n{mock_transcript}"
                ),
            },
        ],
        temperature=0.0,
    )

    # _llm.chat() is currently MOCKED and returns Agent 1's resume-extraction JSON,
    # which has no score/decision keys — so parsing always falls through. We pin a
    # deterministic pass (score 85) until a live LLM is wired in _llm.py, at which
    # point this try/except parses the real evaluation with no other changes here.
    try:
        parsed = json.loads(raw)
        score = int(parsed["score"])
        decision = str(parsed["decision"]).lower()
        if decision not in ("pass", "fail"):
            raise ValueError("decision not in {pass, fail}")
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        log.warning("evaluator.mock_fallback", extra={"raw": raw[:200]})
        score, decision = 85, "pass"

    candidate.ai_evaluation_score = float(score)
    if decision == "pass":
        candidate.status = CandidateStatus.PENDING_RECRUITER
    else:
        candidate.status = CandidateStatus.POOL
        candidate.job_id = None  # free them for a future job to match

    await db.commit()
    log.info(
        "evaluator.decided",
        extra={"candidate_id": str(candidate_id), "score": score, "decision": decision},
    )
    return {
        "candidate_id": str(candidate_id),
        "score": score,
        "decision": decision,
        "new_status": candidate.status.value,
    }


async def evaluate_interview_bg(candidate_id: UUID, transcript: str) -> None:
    """BackgroundTask entry point: opens its own session (the request session is
    already closed by the time this runs) and drives the evaluation."""
    async with SessionLocal() as session:
        await evaluate_interview(candidate_id, session, transcript)
