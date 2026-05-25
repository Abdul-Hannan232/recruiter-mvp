"""
Sequential funnel orchestrator. Runs Agents 1 -> 2 -> 3 inside FastAPI BackgroundTasks.

Hard gate: if Agent 2's match score falls below MATCH_THRESHOLD, the candidate is
marked REJECTED and the pipeline terminates BEFORE invoking the (expensive)
Coordinator agent. This is the token-conservation rule.

Agents 4 (Interviewer) and 5 (Evaluator) are triggered by explicit user events
(starting an interview, ending an interview) and not by this orchestrator.
"""
from uuid import UUID

from app.agents import coordinator, matcher, vectorizer
from app.core.config import settings
from app.database.session import SessionLocal
from app.models.db import CandidateState
from app.services import state as state_svc


async def run_intake_pipeline(candidate_id: UUID) -> None:
    """Agent 1 -> Agent 2 -> Agent 3 (sequential, with hard gate at Agent 2)."""
    async with SessionLocal() as session:
        # Agent 1 — Vectorizer
        await vectorizer.run(session, candidate_id)
        await state_svc.transition(session, candidate_id, CandidateState.VECTORIZED)

        # Agent 2 — Matcher (deterministic hard gate)
        score = await matcher.run(session, candidate_id)
        if score < settings.MATCH_THRESHOLD:
            await state_svc.transition(session, candidate_id, CandidateState.REJECTED)
            return  # terminate to conserve LLM tokens
        await state_svc.transition(session, candidate_id, CandidateState.MATCHED)

        # Agent 3 — Coordinator (outreach)
        await coordinator.run(session, candidate_id)
        await state_svc.transition(session, candidate_id, CandidateState.CONTACTED)
