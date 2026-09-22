"""
Thin storage seam.

Every FileField in the app points at `media_storage`, and nothing else in the
codebase touches the filesystem. Moving drawings to Cloudflare R2 / S3 is then
a change to STORAGES in settings.py and nothing more: no view, model or
serializer needs editing.

Files are never linked to directly -- `stream` hands the bytes back through a
view that has already checked the caller's access token.
"""

from __future__ import annotations

import mimetypes
from typing import Any

from django.core.files.storage import storages
from django.http import FileResponse


def media_storage():
    """Callable storage, so migrations record the seam and not a backend."""
    return storages["default"]


def stream(fieldfile: Any, *, download_name: str, inline: bool = True) -> FileResponse:
    """Stream a stored file back to the caller.

    Works the same for local disk and for a remote bucket; when the backend is
    remote this is a proxy read rather than a redirect, which is the point --
    a leaked file URL must be worthless without the access token.
    """
    content_type, _ = mimetypes.guess_type(download_name)
    response = FileResponse(
        fieldfile.open("rb"),
        content_type=content_type or "application/octet-stream",
        as_attachment=not inline,
        filename=download_name,
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Referrer-Policy"] = "no-referrer"
    # Drawings are immutable once uploaded, so they cache hard -- but only in
    # the client's own browser, never in a shared proxy.
    response["Cache-Control"] = "private, max-age=86400"
    return response
