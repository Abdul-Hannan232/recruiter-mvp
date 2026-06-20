"""Outreach email delivery for Agent 3.

Dual-mode by design:
  * LIVE   — when SMTP_HOST + SMTP_USER + SMTP_PASSWORD are all configured, the
             message is sent over SMTP (STARTTLS) via aiosmtplib.
  * RENDER — otherwise the email is composed and logged but NOT sent, so the layout
             can be verified end-to-end before credentials exist. Returns the same
             shape either way, with `sent` indicating which path ran.
"""
import logging
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger("services.email")


def smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def _build_message(to: str, subject: str, html_body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@recruiter.ai"
    msg["To"] = to
    msg["Subject"] = subject
    # Plaintext fallback first, then the HTML alternative.
    msg.set_content("This email requires an HTML-capable client.")
    msg.add_alternative(html_body, subtype="html")
    return msg


async def send_email(to: str, subject: str, html_body: str) -> dict:
    """Send (or render) an outreach email. Returns {sent, mode, to, subject}."""
    msg = _build_message(to, subject, html_body)

    if not smtp_configured():
        # RENDER-ONLY: surface the full draft so the layout is verifiable now.
        log.info(
            "EMAIL (render-only, SMTP not configured)\n  to: %s\n  subject: %s\n%s\n%s",
            to, subject, html_body, "-" * 60,
        )
        return {"sent": False, "mode": "render-only", "to": to, "subject": subject}

    # LIVE send. Gmail app passwords are displayed in space-separated groups of 4 but
    # must be supplied without spaces — normalise so either form in .env works.
    import aiosmtplib

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD.replace(" ", ""),
        start_tls=settings.SMTP_STARTTLS,
    )
    log.info("EMAIL sent live to %s (subject=%r)", to, subject)
    return {"sent": True, "mode": "smtp", "to": to, "subject": subject}


async def send_final_interview_email(
    *,
    to: str,
    cc: str | None,
    job_title: str,
    scheduled_time,
    meeting_link: str | None = None,
) -> dict:
    """Final human-interview invite. Emails the CANDIDATE and CC's the RECRUITER on the
    same thread, so neither party's address is exposed until this invite is sent. Plain
    text by design — the candidate replies in-thread to confirm/propose a time. Dual-mode
    (live aiosmtplib / render-only log), mirroring send_email."""
    when = (
        scheduled_time.strftime("%A, %d %B %Y at %H:%M")
        if hasattr(scheduled_time, "strftime")
        else str(scheduled_time)
    )
    link_line = f"\n\nMeeting link: {meeting_link}" if meeting_link else ""
    body_text = (
        f"Congratulations, you have been selected for a final interview for the role of "
        f"{job_title}. The recruiter has proposed {when}. Please reply directly to this "
        f"email thread to confirm your availability or propose an alternative time."
        f"{link_line}"
    )

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@recruiter.ai"
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
        # Candidates hit plain "Reply", not "Reply-All", so Cc alone misses the recruiter.
        # Reply-To routes the candidate's direct reply straight to the recruiter.
        msg["Reply-To"] = cc
    msg["Subject"] = f"Final interview invitation — {job_title}"
    msg.set_content(body_text)

    if not smtp_configured():
        log.info(
            "EMAIL (render-only, SMTP not configured)\n  to: %s\n  cc: %s\n  subject: %s\n%s\n%s",
            to, cc, msg["Subject"], body_text, "-" * 60,
        )
        return {"sent": False, "mode": "render-only", "to": to, "cc": cc}

    import aiosmtplib

    # aiosmtplib derives recipients from the To/Cc headers, so the recruiter (Cc) is
    # included on the same thread automatically.
    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD.replace(" ", ""),
        start_tls=settings.SMTP_STARTTLS,
    )
    log.info("EMAIL (final-interview) sent to %s (cc=%s)", to, cc)
    return {"sent": True, "mode": "smtp", "to": to, "cc": cc}
