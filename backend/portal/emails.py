"""
Two emails, both plain text.

One tells the client a new drawing is waiting. One tells the architect it was
approved. Neither is allowed to fail loudly: a mail server outage must never
lose an upload or an approval.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _send(subject: str, body: str, to: str) -> None:
    if not to:
        return
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Notification email failed (subject=%s)", subject)


def notify_admins_of_registration(architect) -> None:
    """Tell the superusers that someone is waiting at the door.

    Without this, approval-gated signup quietly becomes a black hole: the
    account exists, nobody knows, and the person never hears back.
    """
    from .models import Architect

    recipients = list(
        Architect.objects.filter(is_superuser=True, is_active=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    if not recipients:
        logger.warning(
            "New registration from %s but no active superuser to notify",
            architect.email,
        )
        return

    subject = f"Account request: {architect.practice_name}"
    body = (
        f"{architect.practice_name} has asked for an account.\n\n"
        f"Email: {architect.email}\n"
        f"Phone: {architect.phone or '-'}\n\n"
        "The account is inactive until you approve it. Open the admin, go to "
        "Architects, select them and run 'Approve selected accounts'.\n"
    )
    for recipient in recipients:
        _send(subject, body, recipient)


def notify_architect_of_approval_of_account(architect) -> None:
    """Tell someone their account is live. Sent when a superuser approves."""
    _send(
        "Your account is ready",
        (
            f"Hello {architect.practice_name},\n\n"
            "Your account has been approved. You can sign in now:\n"
            f"{settings.PUBLIC_BASE_URL}/login\n"
        ),
        architect.email,
    )


def notify_client_of_upload(version) -> None:
    drawing_set = version.drawing_set
    project = drawing_set.project
    architect = project.architect
    subject = f"{drawing_set.title} - new drawing from {architect.practice_name}"
    body = (
        f"Dear {project.client_name},\n\n"
        f"{architect.practice_name} has uploaded "
        f"{drawing_set.title} (revision {version.version_number}) "
        f"for {project.name}.\n\n"
    )
    if version.notes:
        body += f"Note from the architect:\n{version.notes}\n\n"
    body += (
        f"You can view it and approve it here:\n{project.client_url}\n\n"
        "No login is needed. Keep this link private.\n"
    )
    _send(subject, body, project.client_email)


def notify_architect_of_approval(approval) -> None:
    version = approval.drawing_version
    drawing_set = version.drawing_set
    project = drawing_set.project
    subject = f"Approved: {drawing_set.title} - {project.name}"
    body = (
        f"{approval.approved_by_name} approved {drawing_set.title} "
        f"(revision {version.version_number}) for {project.name}.\n\n"
        f"Approved at: {approval.approved_at:%d %B %Y, %H:%M}\n"
    )
    _send(subject, body, project.architect.email)


def notify_of_comment(comment) -> None:
    """Tell the other side that something was said."""
    version = comment.drawing_version
    drawing_set = version.drawing_set
    project = drawing_set.project
    if comment.author_type == "client":
        to = project.architect.email
        where = f"{drawing_set.title} (revision {version.version_number})"
        body = (
            f"{comment.author_name} commented on {where} for {project.name}:\n\n"
            f"{comment.body}\n"
        )
    else:
        to = project.client_email
        where = f"{drawing_set.title} (revision {version.version_number})"
        body = (
            f"{comment.author_name} commented on {where}:\n\n"
            f"{comment.body}\n\n"
            f"Reply here:\n{project.client_url}\n"
        )
    _send(f"Comment on {drawing_set.title} - {project.name}", body, to)
