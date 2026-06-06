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
