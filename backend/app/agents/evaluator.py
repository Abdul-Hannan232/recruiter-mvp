"""
Agent 5 — Evaluator.

Runs SILENTLY in the background after the candidate finishes the interview
(status INTERVIEW_COMPLETED). It aggregates the full picture — resume, job
description, raw transcript, and every persisted code submission — then asks
deepseek-v4-pro for a structured evaluation.

SECURITY: the result is never returned to the candidate. It is persisted to the
Candidate row (recruiter-only) and the candidate is routed to PENDING_RECRUITER
for the human-in-the-loop decision.
"""
import json
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat
from app.core.config import settings
from app.database.session import SessionLocal
from app.models.db import (
    Candidate,
    CandidateStatus,
    Interview,
    JobDescription,
)

log = logging.getLogger("agents.evaluator")


SYSTEM = (
    "You are a Senior HR Technical Evaluator. Assess the candidate strictly and "
    "fairly using ONLY the supplied resume, job description, and interview "
    "transcript. Do not invent facts not present in the inputs.\n\n"
    "You will NOT receive raw code submissions. You must base your `code_review` and "
    "`technical_score` strictly on the transcript, analyzing how well the candidate "
    "verbally explained, defended, and optimized their code during the AI's "
    "cross-examination.\n\n"
    "Respond with ONLY a single valid JSON object (no prose, no markdown fences) "
    "matching EXACTLY this schema:\n"
    "{\n"
    '  "technical_score": <int 0-10>,\n'
    '  "communication_score": <int 0-10>,\n'
    '  "strengths": [<string>, ...],\n'
    '  "weaknesses": [<string>, ...],\n'
    '  "code_review": "<string analyzing their code submissions>",\n'
    '  "final_recommendation": "HIRE" | "SHORTLIST" | "REJECT"\n'
    "}"
)

_VALID_RECS = {"HIRE", "SHORTLIST", "REJECT"}


def _build_user_prompt(
    candidate: Candidate,
    jd: JobDescription | None,
    transcript: str,
) -> str:
    requirements = jd.requirements_text if jd else "No specific requirements on file."
    title = jd.title if jd else "(unspecified role)"
    return (
        f"# JOB: {title}\n## REQUIREMENTS\n{requirements}\n\n"
        f"# CANDIDATE RESUME\n{candidate.original_resume_text}\n\n"
        f"# INTERVIEW TRANSCRIPT\n{transcript}\n\n"
        "Evaluate now and return the JSON object."
    )


def _parse_evaluation(raw: str) -> dict:
    """Strict parse + light coercion of Agent 5's JSON. Tolerates stray code fences."""
    text = raw.strip()
    if text.startswith("```"):
        # strip ```json ... ``` fences if the model added them despite instructions
        text = text.split("```", 2)[1] if "```" in text[3:] else text.strip("`")
        text = text.removeprefix("json").strip()
    parsed = json.loads(text)
    parsed["technical_score"] = int(parsed["technical_score"])
    parsed["communication_score"] = int(parsed["communication_score"])
    parsed["strengths"] = list(parsed.get("strengths") or [])
    parsed["weaknesses"] = list(parsed.get("weaknesses") or [])
    parsed["code_review"] = str(parsed.get("code_review") or "")
    rec = str(parsed["final_recommendation"]).upper().strip()
    if rec not in _VALID_RECS:
        raise ValueError(f"final_recommendation not in {_VALID_RECS}: {rec!r}")
    parsed["final_recommendation"] = rec
    return parsed


async def evaluate_interview(candidate_id: UUID, db: AsyncSession) -> dict:
    """Aggregate the candidate's full record, run the LLM evaluation, persist it
    (recruiter-only), and route to PENDING_RECRUITER. Commits the session."""
    candidate = await db.get(Candidate, candidate_id)
    if candidate is None:
        raise ValueError(f"Candidate {candidate_id} not found")
    # Only evaluate candidates who actually finished the interview.
    if candidate.status != CandidateStatus.INTERVIEW_COMPLETED:
        raise ValueError(
            f"Candidate {candidate_id} is {candidate.status.value}; "
            f"expected {CandidateStatus.INTERVIEW_COMPLETED.value}"
        )

    # --- Data aggregation ---------------------------------------------------
    jd = await db.get(JobDescription, candidate.job_id) if candidate.job_id else None

    iv = (
        await db.execute(select(Interview).where(Interview.candidate_id == candidate_id))
    ).scalar_one_or_none()
    transcript = (iv.transcript_text if iv and iv.transcript_text else "").strip() or (
        "(no transcript captured)"
    )

    # --- LLM evaluation (deepseek-v4-pro, forced JSON) ----------------------
    # No raw code is supplied: the technical signal is the transcript of the AI's
    # cross-examination (see SYSTEM prompt). code_review/technical_score are graded
    # on how the candidate verbally explained and defended their code.
    raw = await chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": _build_user_prompt(candidate, jd, transcript)},
        ],
        model=settings.DEEPSEEK_PRO_MODEL,
        temperature=0.0,
        response_format={"type": "json_object"},
    )

    try:
        evaluation = _parse_evaluation(raw)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
        log.error("evaluator.parse_failed", extra={"candidate_id": str(candidate_id), "err": str(e)})
        raise

    # --- Persist (recruiter-only) + route to HITL ---------------------------
    candidate.ai_evaluation_score = float(evaluation["technical_score"])
    candidate.evaluation_summary = json.dumps(evaluation)
    # Snapshot the owning recruiter so the dashboard can still fetch this candidate
    # even if the job is deleted later (which would NULL candidate.job_id).
    if jd is not None and jd.recruiter_id is not None:
        candidate.recruiter_id_snapshot = jd.recruiter_id
    candidate.status = CandidateStatus.PENDING_RECRUITER
    await db.commit()

    log.info(
        "evaluator.decided",
        extra={
            "candidate_id": str(candidate_id),
            "technical_score": evaluation["technical_score"],
            "recommendation": evaluation["final_recommendation"],
        },
    )
    return evaluation


async def evaluate_interview_bg(candidate_id: UUID) -> None:
    """BackgroundTask entry point: opens its own session (the request session is
    already closed by the time this runs) and drives the evaluation silently."""
    async with SessionLocal() as session:
        try:
            await evaluate_interview(candidate_id, session)
        except Exception:  # never bubble into the (already-returned) request
            log.exception("evaluator.bg_failed", extra={"candidate_id": str(candidate_id)})
