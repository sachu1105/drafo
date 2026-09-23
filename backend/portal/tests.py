"""
Tests.

Narrow on purpose. They cover the three things that would end the business if
they broke: one architect reading another architect's project, a bad token
telling the caller that a project exists, and an approval that does not stick.
"""

from __future__ import annotations

import io
import json
import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal
from unittest import mock, skipUnless

from django.contrib.auth import get_user_model
from django.db import connection
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.test import TestCase, override_settings

from .models import (
    Approval,
    DrawingSet,
    DrawingVersion,
    Material,
    Invoice,
    MaterialPhoto,
    Milestone,
    Project,
    TaxRate,
    Unit,
)

Architect = get_user_model()

def png_bytes(width: int = 1200, height: int = 850) -> bytes:
    """A real raster, so the preview pipeline is genuinely exercised."""
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (250, 250, 248)).save(buffer, format="PNG")
    return buffer.getvalue()


def pdf_bytes() -> bytes:
    """A minimal but structurally valid one-page PDF."""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>",
    ]
    stream = b"1 0 0 RG 4 w 50 50 742 495 re S"
    objects.append(
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"
    )

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for index, body in enumerate(objects, 1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n" % index + body + b"\nendobj\n")
    xref = out.tell()
    out.write(b"xref\n0 %d\n" % (len(objects) + 1))
    out.write(b"0000000000 65535 f \n")
    for offset in offsets:
        out.write(b"%010d 00000 n \n" % offset)
    out.write(
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
        % (len(objects) + 1, xref)
    )
    return out.getvalue()


def png_of_size(total: int) -> bytes:
    """A genuine PNG padded to exactly `total` bytes.

    Django's ImageField opens and verifies the upload before any validation of
    ours runs, so a size test needs a real image. Bytes after IEND are ignored
    by the decoder, which lets the size be set to the byte.
    """
    base = png_bytes(8, 8)
    assert len(base) < total, "padding only grows a file"
    return base + b"\x00" * (total - len(base))


PNG = png_bytes()
PDF = pdf_bytes()


MEDIA_SANDBOX = tempfile.mkdtemp(prefix="drafo-tests-")


class MediaSandbox(TestCase):
    """Keep uploaded test files out of the real media directory."""

    @classmethod
    def setUpClass(cls):
        cls._media = override_settings(MEDIA_ROOT=MEDIA_SANDBOX)
        cls._media.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media.disable()
        shutil.rmtree(MEDIA_SANDBOX, ignore_errors=True)


def make_architect(email: str, practice: str) -> Architect:
    return Architect.objects.create_user(
        email=email, password="a-long-test-password", practice_name=practice
    )


def make_version(drawing_set: DrawingSet, number: int = 1) -> DrawingVersion:
    return DrawingVersion.objects.create(
        drawing_set=drawing_set,
        version_number=number,
        file=SimpleUploadedFile("plan.png", PNG, content_type="image/png"),
        file_name="plan.png",
        file_size=len(PNG),
    )


class TokenTests(MediaSandbox):
    def test_token_is_generated_and_long_enough(self):
        architect = make_architect("a@example.com", "Studio A")
        project = Project.objects.create(
            architect=architect, name="Thomas Residence", client_name="Mr Thomas"
        )
        self.assertGreaterEqual(len(project.access_token), 32)

    def test_rotate_token_kills_the_old_link(self):
        architect = make_architect("a@example.com", "Studio A")
        project = Project.objects.create(
            architect=architect, name="Thomas Residence", client_name="Mr Thomas"
        )
        old = project.access_token
        project.rotate_token()
        self.assertNotEqual(old, project.access_token)
        self.assertEqual(self.client.get(f"/api/p/{old}/").status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/p/{project.access_token}/").status_code, 200
        )

    def test_unknown_token_is_404_not_403(self):
        """A wrong token must not confirm that anything exists."""
        response = self.client.get(f"/api/p/{'x' * 43}/")
        self.assertEqual(response.status_code, 404)


class IsolationTests(MediaSandbox):
    """Architect A must never reach architect B's project by guessing an id."""

    def setUp(self):
        self.a = make_architect("a@example.com", "Studio A")
        self.b = make_architect("b@example.com", "Studio B")
        self.b_project = Project.objects.create(
            architect=self.b, name="B Residence", client_name="Client B"
        )
        self.b_set = DrawingSet.objects.create(
            project=self.b_project, title="Ground Floor Plan"
        )
        self.b_version = make_version(self.b_set)
        self.client.force_login(self.a)

    def test_cannot_read_another_architects_project(self):
        response = self.client.get(f"/api/projects/{self.b_project.pk}/")
        self.assertEqual(response.status_code, 404)

    def test_cannot_list_another_architects_projects(self):
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_cannot_patch_another_architects_project(self):
        response = self.client.patch(
            f"/api/projects/{self.b_project.pk}/",
            data={"name": "hijacked"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)
        self.b_project.refresh_from_db()
        self.assertEqual(self.b_project.name, "B Residence")

    def test_cannot_rotate_another_architects_token(self):
        old = self.b_project.access_token
        response = self.client.post(
            f"/api/projects/{self.b_project.pk}/rotate-token/"
        )
        self.assertEqual(response.status_code, 404)
        self.b_project.refresh_from_db()
        self.assertEqual(self.b_project.access_token, old)

    def test_cannot_list_another_architects_drawing_sets(self):
        response = self.client.get(
            f"/api/projects/{self.b_project.pk}/drawing-sets/"
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_upload_into_another_architects_drawing_set(self):
        response = self.client.post(
            f"/api/drawing-sets/{self.b_set.pk}/versions/",
            data={
                "file": SimpleUploadedFile("x.png", PNG, content_type="image/png")
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_download_another_architects_drawing(self):
        response = self.client.get(
            f"/api/drawing-versions/{self.b_version.pk}/file/"
        )
        self.assertEqual(response.status_code, 404)

    def test_anonymous_cannot_reach_architect_endpoints(self):
        self.client.logout()
        self.assertIn(self.client.get("/api/projects/").status_code, (401, 403))


class ClientPortalTests(MediaSandbox):
    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.project = Project.objects.create(
            architect=self.architect,
            name="Thomas Residence",
            client_name="Mr Thomas",
            client_email="thomas@example.com",
        )
        self.drawing_set = DrawingSet.objects.create(
            project=self.project, title="Ground Floor Plan"
        )
        self.v1 = make_version(self.drawing_set, 1)
        self.token = self.project.access_token

    def test_overview_needs_no_account(self):
        response = self.client.get(f"/api/p/{self.token}/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["name"], "Thomas Residence")
        self.assertEqual(body["practice"]["practice_name"], "Studio A")
        self.assertEqual(len(body["drawing_sets"]), 1)

    def test_overview_never_echoes_the_token_back(self):
        body = self.client.get(f"/api/p/{self.token}/").json()
        self.assertNotIn("access_token", body)

    def test_approve_records_name_and_time(self):
        response = self.client.post(
            f"/api/p/{self.token}/versions/{self.v1.pk}/approve/",
            data={"approved_by_name": "  Mr Thomas  "},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        approval = Approval.objects.get()
        self.assertEqual(approval.approved_by_name, "Mr Thomas")
        self.assertIsNotNone(approval.approved_at)
        self.assertIsNotNone(approval.ip_address)

    def test_double_tap_does_not_create_two_approvals(self):
        url = f"/api/p/{self.token}/versions/{self.v1.pk}/approve/"
        body = {"approved_by_name": "Mr Thomas"}
        self.client.post(url, data=body, content_type="application/json")
        second = self.client.post(url, data=body, content_type="application/json")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Approval.objects.count(), 1)

    def test_approval_survives_a_new_revision(self):
        """v1 keeps its approval; v2 becomes current and is unapproved."""
        self.client.post(
            f"/api/p/{self.token}/versions/{self.v1.pk}/approve/",
            data={"approved_by_name": "Mr Thomas"},
            content_type="application/json",
        )
        v2 = make_version(self.drawing_set, 2)
        self.assertEqual(self.drawing_set.current_version, v2)
        self.assertTrue(self.v1.approvals.exists())
        self.assertFalse(v2.approvals.exists())

    def test_client_cannot_approve_another_projects_drawing(self):
        other = Project.objects.create(
            architect=self.architect, name="Other", client_name="Other"
        )
        other_set = DrawingSet.objects.create(project=other, title="Elevation")
        other_version = make_version(other_set)
        response = self.client.post(
            f"/api/p/{self.token}/versions/{other_version.pk}/approve/",
            data={"approved_by_name": "Mr Thomas"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_client_can_comment(self):
        response = self.client.post(
            f"/api/p/{self.token}/versions/{self.v1.pk}/comments/",
            data={"author_name": "Mr Thomas", "body": "Can the window move?"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["author_type"], "client")

    def test_client_cannot_write_anything_else(self):
        for url in (
            f"/api/p/{self.token}/",
            f"/api/p/{self.token}/materials/",
            f"/api/p/{self.token}/milestones/",
        ):
            self.assertEqual(self.client.post(url, {}).status_code, 405)

    def test_file_is_served_through_the_token_not_a_media_url(self):
        body = self.client.get(f"/api/p/{self.token}/").json()
        file_url = body["drawing_sets"][0]["current_version"]["file_url"]
        self.assertIn(f"/api/p/{self.token}/files/", file_url)
        self.assertEqual(self.client.get(file_url).status_code, 200)

    def test_file_url_is_worthless_under_a_different_token(self):
        other = Project.objects.create(
            architect=self.architect, name="Other", client_name="Other"
        )
        response = self.client.get(
            f"/api/p/{other.access_token}/files/{self.v1.pk}/"
        )
        self.assertEqual(response.status_code, 404)


class UploadTests(MediaSandbox):
    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.project = Project.objects.create(
            architect=self.architect, name="Thomas Residence", client_name="Mr Thomas"
        )
        self.drawing_set = DrawingSet.objects.create(
            project=self.project, title="Ground Floor Plan"
        )
        self.client.force_login(self.architect)
        self.url = f"/api/drawing-sets/{self.drawing_set.pk}/versions/"

    def test_versions_auto_increment(self):
        for expected in (1, 2, 3):
            response = self.client.post(
                self.url,
                data={
                    "file": SimpleUploadedFile(
                        "plan.png", PNG, content_type="image/png"
                    )
                },
            )
            self.assertEqual(response.status_code, 201, response.content)
            self.assertEqual(response.json()["version_number"], expected)

    def test_disguised_file_is_rejected_server_side(self):
        response = self.client.post(
            self.url,
            data={
                "file": SimpleUploadedFile(
                    "plan.pdf", b"MZ not a pdf at all", content_type="application/pdf"
                )
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_unsupported_type_is_rejected(self):
        response = self.client.post(
            self.url,
            data={
                "file": SimpleUploadedFile(
                    "plan.dwg", b"whatever", content_type="image/vnd.dwg"
                )
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_oversized_file_is_rejected(self):
        big = PNG + b"\x00" * (26 * 1024 * 1024)
        response = self.client.post(
            self.url,
            data={"file": SimpleUploadedFile("plan.png", big, content_type="image/png")},
        )
        self.assertEqual(response.status_code, 400)

    def test_pdf_upload_gets_a_raster_preview(self):
        """The client reads the preview on a phone; the PDF stays a tap away."""
        response = self.client.post(
            self.url,
            data={
                "file": SimpleUploadedFile(
                    "plan.pdf", PDF, content_type="application/pdf"
                )
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertTrue(body["is_pdf"])
        self.assertIsNotNone(body["preview_url"])
        self.assertTrue(DrawingVersion.objects.get().preview)

    def test_image_upload_gets_a_preview_too(self):
        response = self.client.post(
            self.url,
            data={"file": SimpleUploadedFile("plan.png", PNG, content_type="image/png")},
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIsNotNone(response.json()["preview_url"])

    def test_original_file_is_stored_untouched(self):
        self.client.post(
            self.url,
            data={
                "file": SimpleUploadedFile(
                    "plan.pdf", PDF, content_type="application/pdf"
                )
            },
        )
        version = DrawingVersion.objects.get()
        self.assertEqual(version.file_name, "plan.pdf")
        self.assertEqual(version.file_size, len(PDF))
        self.assertEqual(version.file.read(), PDF)


class RegistrationTests(MediaSandbox):
    """Signing up is a door, not a request. It opens straight away."""

    URL = "/api/auth/register/"

    def payload(self, **overrides):
        data = {
            "email": "new@studio.example",
            "practice_name": "New Studio",
            "password": "a-long-enough-password",
        }
        data.update(overrides)
        return data

    def test_registration_creates_a_live_account(self):
        response = self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["email"], "new@studio.example")

        architect = Architect.objects.get(email="new@studio.example")
        self.assertTrue(architect.is_active)

    def test_registration_signs_them_in(self):
        """No second trip through the login form to see their own account."""
        self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "new@studio.example")

    def test_a_new_account_is_not_email_verified(self):
        """Unverified, and none the worse for it: nothing is gated on it."""
        self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        self.assertFalse(self.client.get("/api/auth/me/").json()["email_verified"])

    def test_a_self_registered_account_is_never_staff(self):
        """The whole risk of a public form: someone signing themselves into
        the Django admin."""
        self.client.post(
            self.URL,
            data=self.payload(is_staff=True, is_superuser=True),
            content_type="application/json",
        )
        architect = Architect.objects.get(email="new@studio.example")
        self.assertFalse(architect.is_staff)
        self.assertFalse(architect.is_superuser)

    def test_the_new_account_can_sign_in_again(self):
        self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        self.client.logout()
        response = self.client.post(
            "/api/auth/login/",
            data={"email": "new@studio.example", "password": "a-long-enough-password"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["is_staff"])

    def test_a_suspended_account_cannot_sign_in(self):
        """Suspension is the one switch left, and it says nothing extra."""
        self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        Architect.objects.filter(email="new@studio.example").update(is_active=False)
        self.client.logout()
        response = self.client.post(
            "/api/auth/login/",
            data={"email": "new@studio.example", "password": "a-long-enough-password"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("pending", response.json())

    def test_duplicate_email_is_rejected(self):
        make_architect("taken@example.com", "Taken")
        response = self.client.post(
            self.URL,
            data=self.payload(email="taken@example.com"),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_a_name_can_be_given_at_registration(self):
        """The person, not only the studio -- and the slug follows the person."""
        response = self.client.post(
            self.URL,
            data=self.payload(full_name="Anna Mathew"),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        created = Architect.objects.get(email="new@studio.example")
        self.assertEqual(created.full_name, "Anna Mathew")
        self.assertEqual(created.display_name, "Anna Mathew")
        self.assertEqual(created.card_slug, "anna-mathew")
        self.assertFalse(created.card_is_public)

    def test_weak_password_is_rejected(self):
        response = self.client.post(
            self.URL,
            data=self.payload(password="12345678"),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Architect.objects.filter(email="new@studio.example").exists())


class EmailVerificationTests(MediaSandbox):
    """Confirming the address is an offer on the profile screen, never a gate."""

    SEND = "/api/auth/verify-email/send/"
    CONFIRM = "/api/auth/verify-email/confirm/"

    def setUp(self):
        super().setUp()
        self.architect = make_architect("anna@studio.example", "Anna Mathew Architects")
        self.client.force_login(self.architect)

    def token(self) -> str:
        self.assertEqual(self.client.post(self.SEND).status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        return body.split("verify-email?token=")[1].split()[0]

    def test_the_link_confirms_the_address(self):
        token = self.token()
        self.client.logout()  # the mail app opens it in another browser

        response = self.client.post(
            self.CONFIRM, data={"token": token}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200, response.content)

        self.architect.refresh_from_db()
        self.assertTrue(self.architect.email_verified)

    def test_the_mail_goes_to_the_address_being_confirmed(self):
        self.token()
        self.assertEqual(mail.outbox[0].to, ["anna@studio.example"])

    def test_a_forged_token_confirms_nothing(self):
        response = self.client.post(
            self.CONFIRM,
            data={"token": f"{self.architect.pk}:anna@studio.example:not-a-signature"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.architect.refresh_from_db()
        self.assertFalse(self.architect.email_verified)

    def test_an_expired_token_confirms_nothing(self):
        token = self.token()
        later = timezone.now() + timedelta(days=2)
        with mock.patch("django.core.signing.time.time", return_value=later.timestamp()):
            response = self.client.post(
                self.CONFIRM, data={"token": token}, content_type="application/json"
            )
        self.assertEqual(response.status_code, 400)
        self.architect.refresh_from_db()
        self.assertFalse(self.architect.email_verified)

    def test_sending_needs_a_session(self):
        self.client.logout()
        self.assertIn(self.client.post(self.SEND).status_code, (401, 403))
        self.assertEqual(mail.outbox, [])

    def test_asking_twice_is_harmless(self):
        self.client.post(
            self.CONFIRM, data={"token": self.token()}, content_type="application/json"
        )
        self.architect.refresh_from_db()
        first = self.architect.email_verified_at

        response = self.client.post(self.SEND)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)  # nothing new sent

        self.architect.refresh_from_db()
        self.assertEqual(self.architect.email_verified_at, first)


class ProfileTests(MediaSandbox):
    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.client.force_login(self.architect)

    def test_the_person_and_the_practice_are_stored_apart(self):
        response = self.client.patch(
            "/api/auth/me/",
            data={
                "full_name": "Anna Mathew",
                "profession": "Principal Architect",
                "practice_name": "Studio A",
                "location": "Kochi",
                "website": "https://studio-a.example",
                "bio": "Small houses.",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.architect.refresh_from_db()
        self.assertEqual(self.architect.full_name, "Anna Mathew")
        self.assertEqual(self.architect.practice_name, "Studio A")
        self.assertEqual(self.architect.display_name, "Anna Mathew")
        self.assertEqual(response.json()["display_name"], "Anna Mathew")

    def test_display_name_falls_back_to_the_practice(self):
        self.assertEqual(self.architect.display_name, "Studio A")

    def test_can_update_practice_details(self):
        response = self.client.patch(
            "/api/auth/me/",
            data={"practice_name": "  Anna Mathew Architects  ", "phone": "+91 1"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.architect.refresh_from_db()
        self.assertEqual(self.architect.practice_name, "Anna Mathew Architects")

    def test_cannot_promote_self_through_the_profile(self):
        """PATCH /auth/me/ must not be a privilege escalation route."""
        self.client.patch(
            "/api/auth/me/",
            data={
                "practice_name": "Studio A",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
            content_type="application/json",
        )
        self.architect.refresh_from_db()
        self.assertFalse(self.architect.is_staff)
        self.assertFalse(self.architect.is_superuser)

    def test_cannot_change_own_email(self):
        self.client.patch(
            "/api/auth/me/",
            data={"email": "someone-else@example.com"},
            content_type="application/json",
        )
        self.architect.refresh_from_db()
        self.assertEqual(self.architect.email, "a@example.com")

    def test_logo_upload_and_cache_busting(self):
        response = self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {"logo": SimpleUploadedFile("logo.png", PNG, content_type="image/png")},
            ),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(response.status_code, 200, response.content)
        logo_url = response.json()["logo_url"]
        self.assertIn("/api/practice/", logo_url)
        self.assertIn("?v=", logo_url)
        self.assertEqual(self.client.get(logo_url).status_code, 200)

    def test_anonymous_cannot_read_or_change_a_profile(self):
        self.client.logout()
        self.assertIn(self.client.get("/api/auth/me/").status_code, (401, 403))
        self.assertIn(
            self.client.patch(
                "/api/auth/me/",
                data={"practice_name": "Hijacked"},
                content_type="application/json",
            ).status_code,
            (401, 403),
        )


class ProfileCardTests(MediaSandbox):
    """The card is the only page here with no token in its URL.

    So the tests that matter are about the switch: a card that was never
    published, or belongs to a suspended account, must be indistinguishable
    from one that never existed.
    """

    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.client.force_login(self.architect)

    def publish(self, **extra):
        payload = {"card_is_public": True, "full_name": "Anna Mathew"}
        payload.update(extra)
        response = self.client.patch(
            "/api/auth/me/", data=payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.architect.refresh_from_db()
        return response.json()

    def test_a_slug_is_assigned_on_creation(self):
        self.assertEqual(self.architect.card_slug, "studio-a")

    def test_slugs_do_not_collide(self):
        other = make_architect("b@example.com", "Studio A")
        self.assertNotEqual(other.card_slug, self.architect.card_slug)
        self.assertEqual(other.card_slug, "studio-a-2")

    def test_a_card_is_private_until_it_is_published(self):
        self.client.logout()
        self.assertEqual(
            self.client.get(f"/api/card/{self.architect.card_slug}/").status_code, 404
        )

    def test_a_published_card_is_readable_by_anyone(self):
        self.publish(profession="Principal Architect", location="Kochi")
        self.client.logout()

        response = self.client.get(f"/api/card/{self.architect.card_slug}/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["name"], "Anna Mathew")
        self.assertEqual(body["profession"], "Principal Architect")
        self.assertEqual(body["practice_name"], "Studio A")
        self.assertEqual(body["location"], "Kochi")

    def test_a_card_carries_nothing_about_any_project(self):
        project = Project.objects.create(
            architect=self.architect, name="Villa", client_name="Mr K"
        )
        self.publish()
        self.client.logout()

        body = self.client.get(f"/api/card/{self.architect.card_slug}/").content
        self.assertNotIn(b"Villa", body)
        self.assertNotIn(b"Mr K", body)
        self.assertNotIn(project.access_token.encode(), body)

    def test_a_suspended_account_has_no_card(self):
        self.publish()
        self.architect.is_active = False
        self.architect.save(update_fields=["is_active"])
        self.client.logout()
        self.assertEqual(
            self.client.get(f"/api/card/{self.architect.card_slug}/").status_code, 404
        )

    def test_unpublishing_takes_the_card_down(self):
        self.publish()
        self.client.patch(
            "/api/auth/me/",
            data={"card_is_public": False},
            content_type="application/json",
        )
        self.client.logout()
        self.assertEqual(
            self.client.get(f"/api/card/{self.architect.card_slug}/").status_code, 404
        )

    def test_the_name_falls_back_to_the_practice(self):
        self.client.patch(
            "/api/auth/me/",
            data={"card_is_public": True},
            content_type="application/json",
        )
        self.client.logout()
        body = self.client.get(f"/api/card/{self.architect.card_slug}/").json()
        self.assertEqual(body["name"], "Studio A")

    # --- choosing the link -------------------------------------------------

    def test_a_slug_can_be_changed(self):
        body = self.publish(card_slug="anna-mathew")
        self.assertEqual(body["card_slug"], "anna-mathew")
        self.assertTrue(body["card_url"].endswith("/c/anna-mathew"))
        self.client.logout()
        self.assertEqual(self.client.get("/api/card/anna-mathew/").status_code, 200)

    def test_a_reserved_slug_is_refused(self):
        response = self.client.patch(
            "/api/auth/me/",
            data={"card_slug": "projects"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_a_taken_slug_is_refused(self):
        make_architect("b@example.com", "Studio B")
        response = self.client.patch(
            "/api/auth/me/",
            data={"card_slug": "studio-b"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_a_malformed_slug_is_refused(self):
        for bad in ("Studio A", "studio_a", "studio a", "ab", "-studio", "studio--a"):
            with self.subTest(slug=bad):
                response = self.client.patch(
                    "/api/auth/me/",
                    data={"card_slug": bad},
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400, bad)

    # --- pictures ----------------------------------------------------------

    def test_avatar_upload_and_removal(self):
        response = self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {
                    "avatar": SimpleUploadedFile(
                        "me.png", PNG, content_type="image/png"
                    )
                },
            ),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(response.status_code, 200, response.content)
        avatar_url = response.json()["avatar_url"]
        self.assertIn(f"/api/practice/{self.architect.pk}/avatar/", avatar_url)
        self.assertEqual(self.client.get(avatar_url).status_code, 200)

        cleared = self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(BOUNDARY, {"remove_avatar": "true"}),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(cleared.status_code, 200, cleared.content)
        self.assertIsNone(cleared.json()["avatar_url"])

    def test_a_file_a_hair_over_the_limit_says_so_in_kilobytes(self):
        """"That logo is 2.0 MB. The limit is 2 MB." reads as a broken check."""
        just_over = png_of_size(2 * 1024 * 1024 + 1024)  # 1 KB over
        response = self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {
                    "logo": SimpleUploadedFile(
                        "big.png", just_over, content_type="image/png"
                    )
                },
            ),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(response.status_code, 400)
        message = response.json()["logo"][0]
        self.assertIn("just over the 2 MB limit, by 1 KB", message)
        self.assertNotIn("is 2.0 MB", message)

    def test_a_clearly_oversized_file_says_so_in_megabytes(self):
        much_bigger = png_of_size(5 * 1024 * 1024)
        response = self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {
                    "logo": SimpleUploadedFile(
                        "huge.png", much_bigger, content_type="image/png"
                    )
                },
            ),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("5.0 MB", response.json()["logo"][0])

    def test_an_svg_is_refused_as_an_avatar(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        response = self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {
                    "avatar": SimpleUploadedFile(
                        "me.svg", svg, content_type="image/svg+xml"
                    )
                },
            ),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(response.status_code, 400)

    def test_a_card_serves_its_own_pictures(self):
        self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {
                    "avatar": SimpleUploadedFile(
                        "me.png", PNG, content_type="image/png"
                    ),
                    "logo": SimpleUploadedFile(
                        "mark.png", PNG, content_type="image/png"
                    ),
                },
            ),
            content_type=MULTIPART_CONTENT,
        )
        self.publish()
        self.client.logout()

        body = self.client.get(f"/api/card/{self.architect.card_slug}/").json()
        for url in (body["avatar_url"], body["logo_url"]):
            served = self.client.get(url)
            self.assertEqual(served.status_code, 200)
            self.assertEqual(served["Content-Type"], "image/png")

    def test_the_architects_own_avatar_url_is_not_public(self):
        self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {
                    "avatar": SimpleUploadedFile(
                        "me.png", PNG, content_type="image/png"
                    )
                },
            ),
            content_type=MULTIPART_CONTENT,
        )
        self.publish()
        self.client.logout()
        self.assertIn(
            self.client.get(f"/api/practice/{self.architect.pk}/avatar/").status_code,
            (401, 403),
        )

    # --- the cover band ----------------------------------------------------

    def upload_cover(self, name="dubai.png", blob=None):
        return self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {
                    "cover": SimpleUploadedFile(
                        name, blob if blob is not None else PNG, content_type="image/png"
                    )
                },
            ),
            content_type=MULTIPART_CONTENT,
        )

    def test_cover_upload_and_removal(self):
        response = self.upload_cover()
        self.assertEqual(response.status_code, 200, response.content)
        cover_url = response.json()["cover_url"]
        self.assertIn(f"/api/practice/{self.architect.pk}/cover/", cover_url)
        self.assertEqual(self.client.get(cover_url).status_code, 200)

        cleared = self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(BOUNDARY, {"remove_cover": "true"}),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(cleared.status_code, 200, cleared.content)
        self.assertIsNone(cleared.json()["cover_url"])

    def test_the_cover_is_not_the_logo(self):
        """Two files, two fields. Setting one must never disturb the other."""
        self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {"logo": SimpleUploadedFile("mark.png", PNG, content_type="image/png")},
            ),
            content_type=MULTIPART_CONTENT,
        )
        body = self.upload_cover().json()
        self.assertIsNotNone(body["logo_url"])
        self.assertIsNotNone(body["cover_url"])
        self.assertNotEqual(body["logo_url"], body["cover_url"])

        self.architect.refresh_from_db()
        self.assertNotEqual(self.architect.logo.name, self.architect.cover.name)

    def test_a_published_card_serves_its_cover(self):
        self.upload_cover()
        self.publish()
        self.client.logout()

        body = self.client.get(f"/api/card/{self.architect.card_slug}/").json()
        self.assertIn(f"/api/card/{self.architect.card_slug}/cover/", body["cover_url"])
        served = self.client.get(body["cover_url"])
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served["Content-Type"], "image/png")

    def test_a_cover_is_private_until_the_card_is_published(self):
        self.upload_cover()
        self.client.logout()
        self.assertEqual(
            self.client.get(
                f"/api/card/{self.architect.card_slug}/cover/"
            ).status_code,
            404,
        )
        self.assertIn(
            self.client.get(f"/api/practice/{self.architect.pk}/cover/").status_code,
            (401, 403),
        )

    def test_an_svg_is_refused_as_a_cover(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        response = self.upload_cover(name="skyline.svg", blob=svg)
        self.assertEqual(response.status_code, 400)

    # --- save to contacts --------------------------------------------------

    def test_vcard_carries_the_details(self):
        self.publish(
            profession="Principal Architect",
            phone="+91 70267 00024",
            location="Kochi, Kerala",
        )
        self.client.logout()

        response = self.client.get(f"/api/card/{self.architect.card_slug}/vcard/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("text/vcard"))
        body = response.content.decode()
        self.assertIn("FN:Anna Mathew", body)
        self.assertIn("N:Mathew;Anna;;;", body)
        self.assertIn("ORG:Studio A", body)
        self.assertIn("TITLE:Principal Architect", body)
        self.assertIn("TEL;TYPE=CELL:+91 70267 00024", body)
        self.assertIn("EMAIL;TYPE=WORK:a@example.com", body)
        self.assertIn("\r\n", body)

    def test_vcard_escapes_separators(self):
        self.publish(location="Kochi, Kerala", bio="Houses; not towers")
        self.client.logout()
        body = self.client.get(
            f"/api/card/{self.architect.card_slug}/vcard/"
        ).content.decode()
        self.assertIn("Kochi\\, Kerala", body)
        self.assertIn("Houses\\; not towers", body)

    def test_an_unpublished_card_has_no_vcard(self):
        self.client.logout()
        self.assertEqual(
            self.client.get(
                f"/api/card/{self.architect.card_slug}/vcard/"
            ).status_code,
            404,
        )


class MaterialInvoiceTests(MediaSandbox):
    """The bill behind a selection.

    It is a PDF, it belongs to one project, and the client is meant to be able
    to open it -- but only through their own token.
    """

    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.client.force_login(self.architect)
        self.project = Project.objects.create(
            architect=self.architect, name="Villa", client_name="Mr K"
        )

    def add_material(self, **files):
        data = {"category": "flooring", "name": "Vitrified tile"}
        data.update(files)
        return self.client.post(
            f"/api/projects/{self.project.pk}/materials/", data=data
        )

    def test_a_pdf_invoice_can_be_attached_and_opened(self):
        response = self.add_material(
            invoice=SimpleUploadedFile("bill.pdf", PDF, content_type="application/pdf")
        )
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["invoice_name"], "bill.pdf")
        self.assertIn(f"/api/materials/{body['id']}/invoice/", body["invoice_url"])

        served = self.client.get(body["invoice_url"])
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served["Content-Type"], "application/pdf")

    def test_a_material_without_one_reports_none(self):
        body = self.add_material().json()
        self.assertIsNone(body["invoice_url"])
        self.assertEqual(body["invoice_name"], "")
        self.assertEqual(
            self.client.get(f"/api/materials/{body['id']}/invoice/").status_code, 404
        )

    def test_photos_and_invoice_are_different_files(self):
        body = self.add_material(
            photos=SimpleUploadedFile("tile.png", PNG, content_type="image/png"),
            invoice=SimpleUploadedFile("bill.pdf", PDF, content_type="application/pdf"),
        ).json()
        self.assertEqual(len(body["photos"]), 1)
        self.assertIsNotNone(body["invoice_url"])
        photo_url = body["photos"][0]["url"]
        self.assertNotEqual(photo_url, body["invoice_url"])
        self.assertEqual(self.client.get(photo_url)["Content-Type"], "image/png")
        self.assertEqual(
            self.client.get(body["invoice_url"])["Content-Type"], "application/pdf"
        )

    def test_the_client_can_open_it_through_their_token(self):
        self.add_material(
            invoice=SimpleUploadedFile("bill.pdf", PDF, content_type="application/pdf")
        )
        self.client.logout()

        body = self.client.get(f"/api/p/{self.project.access_token}/").json()
        url = body["materials"][0]["invoice_url"]
        self.assertIn(f"/api/p/{self.project.access_token}/", url)
        served = self.client.get(url)
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served["Content-Type"], "application/pdf")

    def test_a_wrong_token_cannot_open_it(self):
        material = self.add_material(
            invoice=SimpleUploadedFile("bill.pdf", PDF, content_type="application/pdf")
        ).json()
        self.client.logout()
        self.assertEqual(
            self.client.get(
                f"/api/p/{'x' * 43}/materials/{material['id']}/invoice/"
            ).status_code,
            404,
        )

    def test_another_architects_invoice_is_not_reachable(self):
        material = self.add_material(
            invoice=SimpleUploadedFile("bill.pdf", PDF, content_type="application/pdf")
        ).json()
        intruder = make_architect("b@example.com", "Studio B")
        self.client.force_login(intruder)
        self.assertEqual(
            self.client.get(f"/api/materials/{material['id']}/invoice/").status_code,
            404,
        )

    def test_an_invoice_that_is_not_what_it_claims_is_refused(self):
        response = self.add_material(
            invoice=SimpleUploadedFile(
                "bill.pdf", b"not a pdf at all", content_type="application/pdf"
            )
        )
        self.assertEqual(response.status_code, 400)

    def test_an_executable_is_refused(self):
        response = self.add_material(
            invoice=SimpleUploadedFile("bill.exe", b"MZ\x90\x00", content_type="application/pdf")
        )
        self.assertEqual(response.status_code, 400)


class ArchitectNotesTests(MediaSandbox):
    """A note the architect writes has to come back when the page reloads.

    It was being saved and emailed and shown to the client, and never shown
    again to the person who wrote it -- so these assert the round trip, not
    just the write.
    """

    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.architect.full_name = "Anna Mathew"
        self.architect.save(update_fields=["full_name"])
        self.client.force_login(self.architect)
        self.project = Project.objects.create(
            architect=self.architect, name="Villa", client_name="Mr K"
        )
        self.set = DrawingSet.objects.create(project=self.project, title="Plan")
        self.version = make_version(self.set)

    def post_note(self, body="Moved the kitchen window 300mm."):
        return self.client.post(
            f"/api/drawing-versions/{self.version.pk}/comments/",
            data={"body": body},
            content_type="application/json",
        )

    def test_a_note_comes_back_on_the_versions_endpoint(self):
        self.assertEqual(self.post_note().status_code, 201)

        response = self.client.get(f"/api/drawing-sets/{self.set.pk}/versions/")
        self.assertEqual(response.status_code, 200)
        versions = response.json()
        self.assertEqual(len(versions), 1)
        notes = versions[0]["comments"]
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["body"], "Moved the kitchen window 300mm.")
        self.assertEqual(notes[0]["author_type"], "architect")
        self.assertEqual(versions[0]["comment_count"], 1)

    def test_a_note_is_signed_with_the_person_not_the_practice(self):
        self.post_note()
        note = self.client.get(
            f"/api/drawing-sets/{self.set.pk}/versions/"
        ).json()[0]["comments"][0]
        self.assertEqual(note["author_name"], "Anna Mathew")

    def test_a_note_falls_back_to_the_practice_name(self):
        self.architect.full_name = ""
        self.architect.save(update_fields=["full_name"])
        self.post_note()
        note = self.client.get(
            f"/api/drawing-sets/{self.set.pk}/versions/"
        ).json()[0]["comments"][0]
        self.assertEqual(note["author_name"], "Studio A")

    def test_notes_come_back_in_the_order_they_were_written(self):
        for body in ("First.", "Second.", "Third."):
            self.post_note(body)
        notes = self.client.get(
            f"/api/drawing-sets/{self.set.pk}/versions/"
        ).json()[0]["comments"]
        self.assertEqual([n["body"] for n in notes], ["First.", "Second.", "Third."])

    def test_the_client_sees_the_architects_note(self):
        self.post_note()
        self.client.logout()
        body = self.client.get(
            f"/api/p/{self.project.access_token}/drawing-sets/{self.set.pk}/"
        ).json()
        self.assertEqual(body["versions"][0]["comments"][0]["body"],
                         "Moved the kitchen window 300mm.")

    def test_an_empty_note_is_refused(self):
        self.assertEqual(self.post_note("   ").status_code, 400)


class ContentTypeTests(MediaSandbox):
    """We send nosniff, so a wrong Content-Type means the browser refuses to
    render the image at all. Every file must go out under its real name."""

    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.client.force_login(self.architect)

    def test_logo_is_served_as_an_image(self):
        self.client.patch(
            "/api/auth/me/",
            data=encode_multipart(
                BOUNDARY,
                {"logo": SimpleUploadedFile("mark.png", PNG, content_type="image/png")},
            ),
            content_type=MULTIPART_CONTENT,
        )
        response = self.client.get(f"/api/practice/{self.architect.pk}/logo/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")

    def test_material_photo_is_served_as_an_image(self):
        project = Project.objects.create(
            architect=self.architect, name="P", client_name="C"
        )
        response = self.client.post(
            f"/api/projects/{project.pk}/materials/",
            data={
                "category": "flooring",
                "name": "Tile",
                "photos": SimpleUploadedFile("tile.png", PNG, content_type="image/png"),
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        served = self.client.get(response.json()["photos"][0]["url"])
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served["Content-Type"], "image/png")

    def test_pdf_drawing_is_served_as_a_pdf(self):
        project = Project.objects.create(
            architect=self.architect, name="P", client_name="C"
        )
        drawing_set = DrawingSet.objects.create(project=project, title="Plan")
        created = self.client.post(
            f"/api/drawing-sets/{drawing_set.pk}/versions/",
            data={"file": SimpleUploadedFile("plan.pdf", PDF, content_type="application/pdf")},
        )
        self.assertEqual(created.status_code, 201, created.content)
        body = created.json()
        self.assertEqual(
            self.client.get(body["file_url"])["Content-Type"], "application/pdf"
        )
        self.assertEqual(
            self.client.get(body["preview_url"])["Content-Type"], "image/jpeg"
        )


class ReferrerPolicyTests(MediaSandbox):
    """no-referrer must be applied narrowly.

    Set globally it looks like extra safety, but a document with that policy
    sends `Origin: null` on POST, and Django's CSRF check then rejects every
    admin form. It belongs on the client's pages and on streamed files only.
    """

    def test_django_html_does_not_send_no_referrer(self):
        response = self.client.get("/django-admin/login/")
        self.assertNotEqual(response.get("Referrer-Policy"), "no-referrer")

    def test_streamed_files_still_send_no_referrer(self):
        architect = make_architect("a@example.com", "Studio A")
        project = Project.objects.create(
            architect=architect, name="P", client_name="C"
        )
        drawing_set = DrawingSet.objects.create(project=project, title="Plan")
        version = make_version(drawing_set)
        response = self.client.get(
            f"/api/p/{project.access_token}/files/{version.pk}/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Referrer-Policy"], "no-referrer")

    def test_admin_login_form_posts_are_accepted(self):
        """The exact request that was failing: an admin form POST."""
        architect = make_architect("admin@example.com", "Studio A")
        architect.is_staff = True
        architect.is_superuser = True
        architect.save()

        page = self.client.get("/django-admin/login/")
        token = page.cookies["csrftoken"].value
        response = self.client.post(
            "/django-admin/login/",
            data={
                "username": "admin@example.com",
                "password": "a-long-test-password",
                "csrfmiddlewaretoken": token,
                "next": "/django-admin/",
            },
            HTTP_ORIGIN="http://testserver",
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/django-admin/")


class MaterialGalleryTests(MediaSandbox):
    """A material is several pictures, and the client can see all of them."""

    def setUp(self):
        super().setUp()
        self.architect = make_architect("anna@studio.example", "Anna Mathew Architects")
        self.client.force_login(self.architect)
        self.project = Project.objects.create(
            architect=self.architect, name="Villa", client_name="Mr K"
        )

    def picture(self, name="tile.png"):
        return SimpleUploadedFile(name, PNG, content_type="image/png")

    def add(self, count=3, **extra):
        data = {"category": "flooring", "name": "Vitrified tile"}
        data.update(extra)
        if count:
            data["photos"] = [self.picture(f"tile{n}.png") for n in range(count)]
        return self.client.post(
            f"/api/projects/{self.project.pk}/materials/", data=data
        )

    def test_several_pictures_arrive_in_one_post(self):
        response = self.add(count=3)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(len(response.json()["photos"]), 3)

    def test_they_keep_the_order_they_were_sent_in(self):
        """The first one becomes the thumbnail, so the order is a decision."""
        body = self.add(count=3).json()
        material = Material.objects.get(pk=body["id"])
        self.assertEqual(
            list(material.photos.values_list("order", flat=True)), [0, 1, 2]
        )

    def test_every_picture_is_served(self):
        for photo in self.add(count=3).json()["photos"]:
            served = self.client.get(photo["url"])
            self.assertEqual(served.status_code, 200)
            self.assertEqual(served["Content-Type"], "image/png")

    def test_a_material_can_have_none(self):
        self.assertEqual(self.add(count=0).json()["photos"], [])

    def test_more_pictures_are_appended_not_replaced(self):
        body = self.add(count=2).json()
        self.client.patch(
            f"/api/materials/{body['id']}/",
            data=encode_multipart(BOUNDARY, {"photos": [self.picture()]}),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(Material.objects.get(pk=body["id"]).photos.count(), 3)

    def test_too_many_is_refused_and_nothing_is_written(self):
        response = self.add(count=9)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Material.objects.count(), 0)

    def test_a_picture_can_be_removed_on_its_own(self):
        body = self.add(count=3).json()
        gone = body["photos"][1]["url"].split("?")[0]
        self.assertEqual(self.client.delete(gone).status_code, 204)
        self.assertEqual(Material.objects.get(pk=body["id"]).photos.count(), 2)

    def test_another_architect_cannot_open_or_delete_one(self):
        url = self.add(count=1).json()["photos"][0]["url"].split("?")[0]
        self.client.logout()
        self.client.force_login(make_architect("other@studio.example", "Other"))
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)

    def test_the_client_sees_every_picture_through_their_token(self):
        self.add(count=3)
        self.client.logout()

        token = self.project.access_token
        materials = self.client.get(f"/api/p/{token}/materials/").json()
        self.assertEqual(len(materials[0]["photos"]), 3)

        for photo in materials[0]["photos"]:
            self.assertIn(f"/api/p/{token}/", photo["url"])
            self.assertEqual(self.client.get(photo["url"]).status_code, 200)

    def test_a_photo_url_from_another_project_is_a_404(self):
        """The token in the URL is the credential, and it is checked."""
        self.add(count=1)
        other = Project.objects.create(
            architect=self.architect, name="Other", client_name="Mrs B"
        )
        photo = Material.objects.get().photos.get()
        self.client.logout()
        self.assertEqual(
            self.client.get(
                f"/api/p/{other.access_token}/materials/"
                f"{photo.material_id}/photos/{photo.pk}/"
            ).status_code,
            404,
        )

    def test_deleting_the_material_takes_its_pictures_with_it(self):
        body = self.add(count=3).json()
        self.client.delete(f"/api/materials/{body['id']}/")
        self.assertEqual(MaterialPhoto.objects.count(), 0)

    def test_editing_keeps_the_pictures_that_were_not_touched(self):
        body = self.add(count=2).json()
        self.client.patch(
            f"/api/materials/{body['id']}/",
            data=encode_multipart(BOUNDARY, {"name": "Renamed"}),
            content_type=MULTIPART_CONTENT,
        )
        material = Material.objects.get(pk=body["id"])
        self.assertEqual(material.name, "Renamed")
        self.assertEqual(material.photos.count(), 2)

    def test_clearing_the_price_box_clears_the_price(self):
        """Multipart cannot send null, so "" has to mean it."""
        body = self.add(count=0, price="2000").json()
        self.assertEqual(body["price"], "2000.00")

        response = self.client.patch(
            f"/api/materials/{body['id']}/",
            data=encode_multipart(BOUNDARY, {"price": ""}),
            content_type=MULTIPART_CONTENT,
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNone(Material.objects.get(pk=body["id"]).price)

    def test_a_blank_price_on_a_new_material_is_still_fine(self):
        self.assertEqual(self.add(count=0, price="").status_code, 201)


class UnitTests(MediaSandbox):
    """The unit list is a suggestion, never a constraint."""

    def setUp(self):
        super().setUp()
        self.architect = make_architect("anna@studio.example", "Anna Mathew Architects")
        self.client.force_login(self.architect)
        self.project = Project.objects.create(
            architect=self.architect, name="Villa", client_name="Mr K"
        )

    def test_the_defaults_are_seeded(self):
        labels = [unit["label"] for unit in self.client.get("/api/units/").json()]
        self.assertIn("per sq ft", labels)
        self.assertIn("lump sum", labels)

    def test_they_come_back_in_the_order_set_in_the_admin(self):
        response = self.client.get("/api/units/").json()
        self.assertEqual(response[0]["label"], "per sq ft")

    def test_a_retired_unit_is_no_longer_offered(self):
        Unit.objects.filter(label="per roll").update(is_active=False)
        labels = [unit["label"] for unit in self.client.get("/api/units/").json()]
        self.assertNotIn("per roll", labels)

    def test_a_retired_unit_does_not_change_what_was_recorded(self):
        """Materials keep the words they were saved with, whatever the admin
        does to the list afterwards."""
        material = Material.objects.create(
            project=self.project, category="flooring", name="Tile", unit="per roll"
        )
        Unit.objects.filter(label="per roll").delete()
        material.refresh_from_db()
        self.assertEqual(material.unit, "per roll")

    def test_a_unit_that_is_not_on_the_list_is_still_accepted(self):
        response = self.client.post(
            f"/api/projects/{self.project.pk}/materials/",
            data={"category": "flooring", "name": "Sand", "unit": "per brass"},
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["unit"], "per brass")

    def test_the_list_needs_a_session(self):
        self.client.logout()
        self.assertIn(self.client.get("/api/units/").status_code, (401, 403))


class InvoiceTests(MediaSandbox):
    """A bill is a record of what was sent, not a view onto today's profile."""

    def setUp(self):
        super().setUp()
        self.architect = make_architect("anna@studio.example", "Anna Mathew Architects")
        self.architect.gstin = "32AAAAA0000A1Z5"
        self.architect.billing_address = "12 Marine Drive, Kochi"
        self.architect.bank_details = "Bank: HDFC\nA/c: 123456"
        self.architect.invoice_terms = "Payable within 14 days."
        self.architect.save()
        self.client.force_login(self.architect)
        self.project = Project.objects.create(
            architect=self.architect,
            name="Villa",
            client_name="Mr K",
            client_email="mrk@example.com",
            address="9 Hill Road",
        )

    def body(self, **extra):
        data = {
            "kind": "invoice",
            "lines": [
                {"description": "Design fee", "quantity": "1", "rate": "50000", "tax_percent": "18"},
                {"description": "Site visits", "quantity": "3", "rate": "2000", "tax_percent": "18"},
            ],
        }
        data.update(extra)
        return data

    def create(self, **extra):
        return self.client.post(
            f"/api/projects/{self.project.pk}/invoices/",
            data=json.dumps(self.body(**extra)),
            content_type="application/json",
        )

    # --- the arithmetic ---------------------------------------------------

    def test_the_totals_are_worked_out_from_the_lines(self):
        body = self.create().json()
        self.assertEqual(body["subtotal"], "56000.00")
        self.assertEqual(body["tax_total"], "10080.00")
        self.assertEqual(body["total"], "66080.00")

    def test_a_posted_total_is_ignored(self):
        """Nothing outside gets to say what an invoice adds up to."""
        body = self.create(total="1.00", subtotal="1.00").json()
        self.assertEqual(body["total"], "66080.00")

    def test_lines_can_be_taxed_at_different_rates(self):
        body = self.create(
            lines=[
                {"description": "Fee", "quantity": "1", "rate": "1000", "tax_percent": "18"},
                {"description": "Reimbursement", "quantity": "1", "rate": "1000", "tax_percent": "0"},
            ]
        ).json()
        self.assertEqual(body["tax_total"], "180.00")
        self.assertEqual(body["total"], "2180.00")

    def test_an_invoice_needs_at_least_one_line(self):
        self.assertEqual(self.create(lines=[]).status_code, 400)

    # --- the stamp --------------------------------------------------------

    def test_the_practice_and_client_details_are_stamped_in(self):
        body = self.create().json()
        self.assertEqual(body["from_name"], "Anna Mathew Architects")
        self.assertEqual(body["from_gstin"], "32AAAAA0000A1Z5")
        self.assertEqual(body["from_bank"], "Bank: HDFC\nA/c: 123456")
        self.assertEqual(body["to_name"], "Mr K")
        self.assertEqual(body["to_address"], "9 Hill Road")
        self.assertEqual(body["terms"], "Payable within 14 days.")

    def test_changing_the_profile_does_not_restate_an_old_invoice(self):
        """The whole reason the details are copied rather than looked up."""
        invoice_id = self.create().json()["id"]

        self.architect.billing_address = "Somewhere else entirely"
        self.architect.gstin = "29BBBBB1111B2Z6"
        self.architect.save()

        body = self.client.get(f"/api/invoices/{invoice_id}/").json()
        self.assertEqual(body["from_address"], "12 Marine Drive, Kochi")
        self.assertEqual(body["from_gstin"], "32AAAAA0000A1Z5")

    def test_details_sent_with_the_form_win_over_the_stamp(self):
        body = self.create(to_name="Mrs K", to_gstin="32CCCCC2222C3Z7").json()
        self.assertEqual(body["to_name"], "Mrs K")
        self.assertEqual(body["to_gstin"], "32CCCCC2222C3Z7")

    # --- numbering --------------------------------------------------------

    def test_numbers_run_in_a_series_per_practice(self):
        self.assertEqual(self.create().json()["number"], "INV-0001")
        self.assertEqual(self.create().json()["number"], "INV-0002")

    def test_the_series_continues_across_projects(self):
        """A client asking which invoice this is needs an answer unique to the
        whole practice, not to one job."""
        self.create()
        other = Project.objects.create(
            architect=self.architect, name="Flat", client_name="Mrs B"
        )
        response = self.client.post(
            f"/api/projects/{other.pk}/invoices/",
            data=json.dumps(self.body()),
            content_type="application/json",
        )
        self.assertEqual(response.json()["number"], "INV-0002")

    def test_estimates_have_their_own_series(self):
        self.assertEqual(self.create(kind="estimate").json()["number"], "EST-0001")
        self.assertEqual(self.create().json()["number"], "INV-0001")

    def test_another_practice_starts_at_one(self):
        self.create()
        other = make_architect("other@studio.example", "Other")
        project = Project.objects.create(
            architect=other, name="Shop", client_name="Mr T"
        )
        self.client.logout()
        self.client.force_login(other)
        response = self.client.post(
            f"/api/projects/{project.pk}/invoices/",
            data=json.dumps(self.body()),
            content_type="application/json",
        )
        self.assertEqual(response.json()["number"], "INV-0001")

    # --- estimates --------------------------------------------------------

    def test_an_estimate_converts_into_an_invoice(self):
        estimate = self.create(kind="estimate").json()
        response = self.client.post(f"/api/invoices/{estimate['id']}/convert/")
        self.assertEqual(response.status_code, 201, response.content)

        invoice = response.json()
        self.assertEqual(invoice["kind"], "invoice")
        self.assertEqual(invoice["number"], "INV-0001")
        self.assertEqual(invoice["total"], estimate["total"])
        self.assertEqual(len(invoice["lines"]), 2)

    def test_the_estimate_survives_its_own_conversion(self):
        """The client was sent a URL showing an estimate. It has to keep
        showing the estimate they agreed to."""
        estimate = self.create(kind="estimate").json()
        self.client.post(f"/api/invoices/{estimate['id']}/convert/")

        still_there = self.client.get(f"/api/invoices/{estimate['id']}/").json()
        self.assertEqual(still_there["kind"], "estimate")
        self.assertEqual(still_there["number"], "EST-0001")

    def test_an_invoice_cannot_be_converted(self):
        invoice = self.create().json()
        response = self.client.post(f"/api/invoices/{invoice['id']}/convert/")
        self.assertEqual(response.status_code, 400)

    # --- editing ----------------------------------------------------------

    def test_editing_replaces_the_lines(self):
        invoice = self.create().json()
        response = self.client.patch(
            f"/api/invoices/{invoice['id']}/",
            data=json.dumps(
                {"lines": [{"description": "Agreed fee", "quantity": "1", "rate": "40000"}]}
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(response.json()["lines"]), 1)
        self.assertEqual(response.json()["total"], "40000.00")

    def test_a_line_from_a_milestone_does_not_edit_the_milestone(self):
        """Correcting a figure on a bill must never rewrite the project."""
        milestone = Milestone.objects.create(
            project=self.project, title="Stage 1", amount=Decimal("20000")
        )
        self.create(
            lines=[
                {
                    "description": "Stage 1",
                    "quantity": "1",
                    "rate": "18000",
                    "milestone": milestone.pk,
                }
            ]
        )
        milestone.refresh_from_db()
        self.assertEqual(milestone.amount, Decimal("20000"))

    def test_deleting_a_milestone_leaves_the_invoice_standing(self):
        milestone = Milestone.objects.create(
            project=self.project, title="Stage 1", amount=Decimal("20000")
        )
        invoice = self.create(
            lines=[
                {
                    "description": "Stage 1",
                    "quantity": "1",
                    "rate": "20000",
                    "milestone": milestone.pk,
                }
            ]
        ).json()
        milestone.delete()

        body = self.client.get(f"/api/invoices/{invoice['id']}/").json()
        self.assertEqual(body["total"], "20000.00")
        self.assertIsNone(body["lines"][0]["milestone"])

    # --- who can see it ---------------------------------------------------

    def test_another_architect_cannot_open_it(self):
        invoice = self.create().json()
        self.client.logout()
        self.client.force_login(make_architect("other@studio.example", "Other"))
        self.assertEqual(
            self.client.get(f"/api/invoices/{invoice['id']}/").status_code, 404
        )

    def test_a_draft_is_not_readable_on_its_link(self):
        """An unsent bill is a working document, not a published one."""
        invoice = Invoice.objects.get(pk=self.create().json()["id"])
        self.client.logout()
        self.assertEqual(
            self.client.get(f"/api/i/{invoice.access_token}/").status_code, 404
        )

    def test_the_client_reads_it_once_it_is_sent(self):
        invoice = Invoice.objects.get(pk=self.create().json()["id"])
        self.client.post(f"/api/invoices/{invoice.pk}/send/")
        self.client.logout()

        body = self.client.get(f"/api/i/{invoice.access_token}/").json()
        self.assertEqual(body["number"], "INV-0001")
        self.assertEqual(body["total"], "66080.00")
        self.assertEqual(len(body["lines"]), 2)

    def test_the_invoice_link_opens_nothing_else(self):
        """Sending a bill must not hand over the drawings."""
        invoice = Invoice.objects.get(pk=self.create().json()["id"])
        self.client.post(f"/api/invoices/{invoice.pk}/send/")
        self.client.logout()

        token = invoice.access_token
        self.assertEqual(self.client.get(f"/api/p/{token}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/p/{token}/materials/").status_code, 404)

    def test_the_project_link_does_not_open_the_invoice(self):
        invoice = Invoice.objects.get(pk=self.create().json()["id"])
        self.client.post(f"/api/invoices/{invoice.pk}/send/")
        self.client.logout()
        self.assertEqual(
            self.client.get(f"/api/i/{self.project.access_token}/").status_code, 404
        )

    def test_the_client_view_gives_away_no_handles(self):
        invoice = Invoice.objects.get(pk=self.create().json()["id"])
        self.client.post(f"/api/invoices/{invoice.pk}/send/")
        self.client.logout()

        body = self.client.get(f"/api/i/{invoice.access_token}/").json()
        for field in ("id", "status", "access_token"):
            self.assertNotIn(field, body)

    # --- sending ----------------------------------------------------------

    def test_sending_marks_it_sent_and_emails_the_link(self):
        invoice = Invoice.objects.get(pk=self.create().json()["id"])
        self.assertEqual(invoice.status, "draft")

        self.client.post(f"/api/invoices/{invoice.pk}/send/")

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "sent")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["mrk@example.com"])
        self.assertIn(invoice.access_token, mail.outbox[0].body)

    def test_sending_without_a_client_email_is_not_an_error(self):
        """Plenty of architects send the link on WhatsApp. That is normal."""
        self.project.client_email = ""
        self.project.save()
        invoice = Invoice.objects.get(pk=self.create().json()["id"])

        response = self.client.post(f"/api/invoices/{invoice.pk}/send/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(mail.outbox, [])
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "sent")


class TaxRateTests(MediaSandbox):
    def setUp(self):
        super().setUp()
        self.architect = make_architect("anna@studio.example", "Anna Mathew Architects")
        self.client.force_login(self.architect)

    def test_the_slabs_are_seeded(self):
        labels = [rate["label"] for rate in self.client.get("/api/tax-rates/").json()]
        self.assertIn("No tax", labels)
        self.assertIn("GST 18%", labels)

    def test_a_retired_rate_is_no_longer_offered(self):
        TaxRate.objects.filter(label="GST 28%").update(is_active=False)
        labels = [rate["label"] for rate in self.client.get("/api/tax-rates/").json()]
        self.assertNotIn("GST 28%", labels)

    def test_changing_a_slab_does_not_restate_an_invoice(self):
        """A line stores the percentage charged, not a pointer to the table."""
        project = Project.objects.create(
            architect=self.architect, name="Villa", client_name="Mr K"
        )
        invoice = self.client.post(
            f"/api/projects/{project.pk}/invoices/",
            data=json.dumps(
                {"lines": [{"description": "Fee", "quantity": "1", "rate": "1000", "tax_percent": "18"}]}
            ),
            content_type="application/json",
        ).json()

        TaxRate.objects.filter(label="GST 18%").update(percent=Decimal("20"))

        body = self.client.get(f"/api/invoices/{invoice['id']}/").json()
        self.assertEqual(body["tax_total"], "180.00")


class ProjectEditingTests(MediaSandbox):
    """Details set once at creation have to be correctable afterwards."""

    def setUp(self):
        super().setUp()
        self.architect = make_architect("anna@studio.example", "Anna Mathew Architects")
        self.client.force_login(self.architect)
        self.project = Project.objects.create(
            architect=self.architect,
            name="Villa",
            client_name="Mr K",
            client_phone="+91 98470 1234",
        )

    def patch(self, **body):
        return self.client.patch(
            f"/api/projects/{self.project.pk}/",
            data=json.dumps(body),
            content_type="application/json",
        )

    def test_the_details_can_be_corrected(self):
        """A phone number with a digit missing is why a link never arrives."""
        response = self.patch(client_phone="+91 98470 12345", client_name="Mrs K")
        self.assertEqual(response.status_code, 200, response.content)

        self.project.refresh_from_db()
        self.assertEqual(self.project.client_phone, "+91 98470 12345")
        self.assertEqual(self.project.client_name, "Mrs K")

    def test_a_project_starts_in_progress(self):
        self.assertEqual(self.project.status, "active")
        body = self.client.get(f"/api/projects/{self.project.pk}/").json()
        self.assertEqual(body["status_label"], "In progress")

    def test_every_status_is_accepted(self):
        for value, label in (
            ("on_hold", "On hold"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
            ("active", "In progress"),
        ):
            response = self.patch(status=value)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response.json()["status_label"], label)

    def test_a_status_nobody_defined_is_refused(self):
        self.assertEqual(self.patch(status="paused").status_code, 400)

    def test_the_label_cannot_be_written(self):
        """It is the server's word for the status, not a field."""
        self.patch(status_label="Whatever I like")
        self.assertEqual(
            self.client.get(f"/api/projects/{self.project.pk}/").json()["status_label"],
            "In progress",
        )

    def test_the_token_cannot_be_rewritten_by_an_edit(self):
        before = self.project.access_token
        self.patch(access_token="something-i-chose", name="Renamed")
        self.project.refresh_from_db()
        self.assertEqual(self.project.access_token, before)

    def test_another_architect_cannot_edit_it(self):
        self.client.logout()
        self.client.force_login(make_architect("other@studio.example", "Other"))
        self.assertEqual(self.patch(name="Mine now").status_code, 404)

    def test_a_closed_project_still_serves_its_client_link(self):
        """Completing a job does not take the record away from the client."""
        self.patch(status="completed")
        self.client.logout()
        self.assertEqual(
            self.client.get(f"/api/p/{self.project.access_token}/").status_code, 200
        )


class ProjectSearchTests(MediaSandbox):
    """Finding a job in your own list.

    Written to pass on both backends. The behaviour they share -- scoping,
    substring matching, the status filter -- is asserted unconditionally; the
    parts only Postgres can do are asserted only where Postgres is running,
    because the development database is SQLite and a test suite that fails on
    a laptop is a test suite nobody runs.
    """

    def setUp(self):
        super().setUp()
        self.architect = make_architect("anna@studio.example", "Anna Mathew Architects")
        self.client.force_login(self.architect)

        self.villa = Project.objects.create(
            architect=self.architect,
            name="Villa at Kakkanad",
            client_name="Mr Thomas",
        )
        self.flat = Project.objects.create(
            architect=self.architect,
            name="Flat interior, Panampilly",
            client_name="Mrs Beena",
            status="on_hold",
        )
        self.shop = Project.objects.create(
            architect=self.architect,
            name="Shop fitout",
            client_name="Mr Kurian",
            status="completed",
        )

    def names(self, **params):
        response = self.client.get("/api/projects/", params)
        self.assertEqual(response.status_code, 200, response.content)
        return [project["name"] for project in response.json()]

    # --- searching --------------------------------------------------------

    def test_a_project_is_found_by_its_name(self):
        self.assertEqual(self.names(q="Kakkanad"), ["Villa at Kakkanad"])

    def test_a_project_is_found_by_its_client(self):
        """Half of what an architect remembers about a job is whose it is."""
        self.assertEqual(self.names(q="Beena"), ["Flat interior, Panampilly"])

    def test_a_partly_typed_word_matches(self):
        """Full text matches whole words, so the prefix case needs its own arm
        or the box stays empty until the last keystroke."""
        self.assertEqual(self.names(q="Kakka"), ["Villa at Kakkanad"])

    def test_case_does_not_matter(self):
        self.assertEqual(self.names(q="kakkanad"), ["Villa at Kakkanad"])

    def test_nothing_matching_returns_nothing(self):
        self.assertEqual(self.names(q="warehouse"), [])

    def test_an_empty_search_returns_everything(self):
        self.assertEqual(len(self.names(q="")), 3)
        self.assertEqual(len(self.names(q="   ")), 3)

    def test_search_never_reaches_another_practice(self):
        """The search filters a list that is already scoped. It must not be
        able to widen it."""
        other = make_architect("other@studio.example", "Other")
        Project.objects.create(
            architect=other, name="Villa at Kakkanad", client_name="Someone else"
        )
        self.assertEqual(self.names(q="Kakkanad"), ["Villa at Kakkanad"])
        self.assertEqual(len(self.names(q="Villa")), 1)

    def test_a_search_term_with_punctuation_does_not_break(self):
        """websearch parsing gives quotes and minus signs meaning, so the box
        has to survive somebody typing them."""
        for term in ('"villa"', "villa -flat", "a & b", "'", "%%%"):
            self.client.get("/api/projects/", {"q": term})

    # --- the status filter ------------------------------------------------

    def test_filtering_by_status(self):
        self.assertEqual(self.names(status="on_hold"), ["Flat interior, Panampilly"])
        self.assertEqual(self.names(status="completed"), ["Shop fitout"])
        self.assertEqual(self.names(status="active"), ["Villa at Kakkanad"])

    def test_no_status_means_every_status(self):
        self.assertEqual(len(self.names()), 3)

    def test_an_unknown_status_is_ignored_not_refused(self):
        """A stale bookmark should show the projects, not an error page."""
        self.assertEqual(len(self.names(status="paused")), 3)

    def test_the_two_filters_combine(self):
        self.assertEqual(self.names(q="Mr", status="completed"), ["Shop fitout"])
        self.assertEqual(self.names(q="Kakkanad", status="completed"), [])

    # --- what only Postgres can do ----------------------------------------

    @skipUnless(connection.vendor == "postgresql", "needs Postgres")
    def test_a_misspelling_still_finds_it(self):
        """Trigram similarity. The reason pg_trgm is switched on at all."""
        self.assertEqual(self.names(q="Kakanad"), ["Villa at Kakkanad"])

    @skipUnless(connection.vendor == "postgresql", "needs Postgres")
    def test_a_word_is_found_in_any_of_its_forms(self):
        Project.objects.create(
            architect=self.architect,
            name="Kitchen drawings",
            client_name="Mr Paul",
        )
        self.assertEqual(self.names(q="drawing"), ["Kitchen drawings"])

    @skipUnless(connection.vendor == "postgresql", "needs Postgres")
    def test_the_best_match_comes_first(self):
        """Ranking is the thing icontains cannot do at all."""
        Project.objects.create(
            architect=self.architect, name="Thomas Residence", client_name="Mr Paul"
        )
        found = self.names(q="Thomas")
        # The project actually called Thomas outranks the one merely owned by
        # a Mr Thomas: name is weighted above client name.
        self.assertEqual(found[0], "Thomas Residence")
        self.assertIn("Villa at Kakkanad", found)
