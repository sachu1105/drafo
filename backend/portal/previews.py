"""
Preview generation.

The client opens drawings on a phone, often on a slow connection. A 12 MB PDF
in an iframe is unreadable there, so on upload we render a single wide raster
preview and serve that; the original file stays one tap away behind
"open full size".

pypdfium2 is used rather than PyMuPDF or poppler: permissive licence, ships
as a self-contained wheel, no system packages in the image.
"""

from __future__ import annotations

import io
import logging

from django.core.files.base import ContentFile
from PIL import Image

logger = logging.getLogger(__name__)

PREVIEW_WIDTH = 1600
PREVIEW_QUALITY = 82


def _encode(image: Image.Image) -> ContentFile:
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    if image.width > PREVIEW_WIDTH:
        height = round(image.height * PREVIEW_WIDTH / image.width)
        image = image.resize((PREVIEW_WIDTH, height), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=PREVIEW_QUALITY, optimize=True)
    return ContentFile(buffer.getvalue())


def _from_pdf(fileobj) -> ContentFile | None:
    import pypdfium2 as pdfium

    fileobj.seek(0)
    document = pdfium.PdfDocument(fileobj.read())
    try:
        if len(document) == 0:
            return None
        page = document[0]
        scale = max(1.0, min(4.0, PREVIEW_WIDTH / max(page.get_width(), 1)))
        bitmap = page.render(scale=scale)
        return _encode(bitmap.to_pil())
    finally:
        document.close()


def _from_image(fileobj) -> ContentFile | None:
    fileobj.seek(0)
    with Image.open(fileobj) as image:
        image.load()
        return _encode(image)


def build_preview(fileobj, *, content_type: str) -> ContentFile | None:
    """Return a JPEG preview of the uploaded file, or None if we cannot make one.

    A failed preview is never fatal: the drawing still uploads and the client
    falls back to the original file.
    """
    try:
        if content_type == "application/pdf":
            return _from_pdf(fileobj)
        return _from_image(fileobj)
    except Exception:  # pragma: no cover - defensive, previews are optional
        logger.exception("Preview generation failed")
        return None
    finally:
        try:
            fileobj.seek(0)
        except Exception:
            pass
