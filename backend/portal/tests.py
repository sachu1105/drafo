"""
Tests.

Narrow on purpose. They cover the three things that would end the business if
they broke: one architect reading another architect's project, a bad token
telling the caller that a project exists, and an approval that does not stick.
"""

from __future__ import annotations

import io
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.test import TestCase, override_settings

from .models import Approval, DrawingSet, DrawingVersion, Project

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


PNG = png_bytes()
PDF = pdf_bytes()


MEDIA_SANDBOX = tempfile.mkdtemp(prefix="atelier-tests-")


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
    """Self-registration is a request for access, not a door."""

    URL = "/api/auth/register/"

    def payload(self, **overrides):
        data = {
            "email": "new@studio.example",
            "practice_name": "New Studio",
            "phone": "+91 98470 33333",
            "password": "a-long-enough-password",
        }
        data.update(overrides)
        return data

    def test_registration_creates_an_inactive_account(self):
        response = self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.json()["pending"])

        architect = Architect.objects.get(email="new@studio.example")
        self.assertFalse(architect.is_active)

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

    def test_pending_account_cannot_sign_in(self):
        self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        response = self.client.post(
            "/api/auth/login/",
            data={"email": "new@studio.example", "password": "a-long-enough-password"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.json()["pending"])

    def test_pending_account_with_wrong_password_learns_nothing(self):
        self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        response = self.client.post(
            "/api/auth/login/",
            data={"email": "new@studio.example", "password": "not-the-password"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("pending", response.json())

    def test_account_works_once_approved(self):
        self.client.post(
            self.URL, data=self.payload(), content_type="application/json"
        )
        architect = Architect.objects.get(email="new@studio.example")
        architect.is_active = True
        architect.save(update_fields=["is_active"])

        response = self.client.post(
            "/api/auth/login/",
            data={"email": "new@studio.example", "password": "a-long-enough-password"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["is_staff"])

    def test_duplicate_email_is_rejected(self):
        make_architect("taken@example.com", "Taken")
        response = self.client.post(
            self.URL,
            data=self.payload(email="taken@example.com"),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_weak_password_is_rejected(self):
        response = self.client.post(
            self.URL,
            data=self.payload(password="12345678"),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Architect.objects.filter(email="new@studio.example").exists())


class ProfileTests(MediaSandbox):
    def setUp(self):
        self.architect = make_architect("a@example.com", "Studio A")
        self.client.force_login(self.architect)

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
                "photo": SimpleUploadedFile("tile.png", PNG, content_type="image/png"),
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        photo_url = response.json()["photo_url"]
        served = self.client.get(photo_url)
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
