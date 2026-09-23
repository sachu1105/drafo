"""
Every email this product sends, all plain text.

None of them is allowed to fail loudly: a mail server outage must never lose
an upload, an approval or a sign-up.
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


def send_email_verification(architect, link: str) -> None:
    """Send the link that proves the address is real.

    Sent only when the architect asks for it from their profile. Nothing is
    blocked until they do, so this mail is an offer, not a gate.
    """
    _send(
        "Confirm your email address",
        (
            f"Hello {architect.display_name},\n\n"
            "Confirm this is your address so we can reach you about your "
            f"projects:\n{link}\n\n"
            "The link works for 24 hours. If you did not ask for this, "
            "ignore it -- nothing changes.\n"
        ),
        architect.email,
    )


def welcome(architect) -> None:
    """First thing they get. Proves the address works and where to sign in."""
    _send(
        "Welcome to Drafo",
        (
            f"Hello {architect.display_name},\n\n"
            "Your account is ready. You are already signed in; you can come "
            f"back any time at:\n{settings.PUBLIC_BASE_URL}/login\n"
        ),
        architect.email,
    )


def send_invoice(invoice) -> None:
    """Send the client the link to a bill or an estimate.

    Silent when the project has no client email: plenty of architects send the
    link on WhatsApp instead, and that is a normal way to work here, not an
    error worth shouting about.
    """
    heading = invoice.get_kind_display().lower()
    body = (
        f"Dear {invoice.to_name},\n\n"
        f"{invoice.from_name} has sent you {heading} {invoice.number} "
        f"for {invoice.project.name}.\n\n"
        f"Amount: {invoice.total}\n"
    )
    if invoice.due_on:
        body += f"Due: {invoice.due_on:%d %B %Y}\n"
    body += (
        f"\nYou can read it, print it or save it as a PDF here:\n"
        f"{invoice.client_url}\n\n"
        "No login is needed. Keep this link private.\n"
    )
    _send(
        f"{invoice.get_kind_display()} {invoice.number} from {invoice.from_name}",
        body,
        invoice.to_email,
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
