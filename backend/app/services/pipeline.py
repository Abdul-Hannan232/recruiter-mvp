"""
Sequential matching funnel. Runs Agents 2 -> 3 once a pooled candidate is matched
to a job (Agent 1 / Vectorizer already ran at upload time).

Hard gate: if Agent 2's match score falls below MATCH_THRESHOLD, the candidate is
marked REJECTED and the pipeline terminates BEFORE invoking the (expensive)
Coordinator agent. This is the token-conservation rule.

Agents 4 (Interviewer) and 5 (Evaluator) are triggered by explicit user events
(starting an interview, ending an interview) and not by this orchestrator.
"""
from uuid import UUID

from app.agents import coordinator, matcher
from app.core.config import settings
from app.database.session import SessionLocal
from app.models.db import CandidateStatus
from app.services import state as state_svc


async def run_matching_pipeline(candidate_id: UUID) -> None:
    """Agent 2 -> Agent 3 (sequential, with hard gate at Agent 2).

    Talent Pool architecture: Agent 1 (Vectorizer) already embedded the resume at
    upload time, so this pipeline begins at the matcher. It is invoked once a
    candidate has been assigned a job_id (recruiter-initiated matching), not on
    upload.
    """
    async with SessionLocal() as session:
        # Agent 2 — Matcher (deterministic hard gate)
        score = await matcher.run(session, candidate_id)
        if score < settings.MATCH_THRESHOLD:
            await state_svc.transition(session, candidate_id, CandidateStatus.REJECTED)
            return  # terminate to conserve LLM tokens
        await state_svc.transition(session, candidate_id, CandidateStatus.MATCHED)

        # Agent 3 — Coordinator (outreach)
        await coordinator.run(session, candidate_id)
        await state_svc.transition(session, candidate_id, CandidateStatus.OUTREACH_SENT)
