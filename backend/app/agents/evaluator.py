"""
Agent 5 — Evaluator.

Runs asynchronously after the interview ends (scheduled via FastAPI
BackgroundTasks). Synthesises the transcript + code submissions into a
quantitative rubric and persists the result.
"""
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat
from app.database.session import SessionLocal
from app.models.db import Candidate, CandidateState, Interview
from app.services import state as state_svc

log = logging.getLogger("agents.evaluator")


RUBRIC = (
    "Return STRICT JSON with keys: "
    '{"technical": 0-10, "communication": 0-10, "problem_solving": 0-10, '
    '"culture_fit": 0-10, "summary": "<2-3 sentences>"}. '
    "Base scores on the transcript and code submissions only."
)


async def _score(transcript: str, code_submissions: list[dict] | None) -> dict:
    raw = await chat(
        [
            {"role": "system", "content": "You are a strict, fair interview evaluator. " + RUBRIC},
            {
                "role": "user",
                "content": (
                    f"TRANSCRIPT:\n{transcript}\n\n"
                    f"CODE SUBMISSIONS:\n{json.dumps(code_submissions or [], indent=2)}"
                ),
            },
        ],
        temperature=0.0,
    )
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.error("evaluator.bad_json", extra={"raw": raw[:400]})
        return {"technical": 0, "communication": 0, "problem_solving": 0,
                "culture_fit": 0, "summary": "Evaluation failed to parse."}


async def run(candidate_id: UUID) -> dict:
    """Entry point. Loads the interview, scores it, persists, advances state."""
    async with SessionLocal() as session:  # type: AsyncSession
        candidate = await session.get(Candidate, candidate_id)
        if candidate is None:
            raise ValueError(f"Candidate {candidate_id} not found")
        interview = candidate.interview
        if interview is None or not interview.transcript:
            raise ValueError("Interview transcript not available")

        rubric = await _score(interview.transcript, interview.code_submissions)
        final = (
            rubric.get("technical", 0)
            + rubric.get("communication", 0)
            + rubric.get("problem_solving", 0)
            + rubric.get("culture_fit", 0)
        ) / 4.0

        interview.rubric = rubric
        interview.final_score = final
        interview.ended_at = interview.ended_at or datetime.now(timezone.utc)
        await session.commit()

        await state_svc.transition(session, candidate_id, CandidateState.EVALUATED)
        return {"final_score": final, "rubric": rubric}
