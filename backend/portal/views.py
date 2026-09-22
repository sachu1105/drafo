"""
Views.

Split down the middle. Everything under `Architect...` requires a session and
is filtered by `request.user` at the queryset level -- an architect must never
be able to reach another architect's project by guessing an id.

Everything under `Client...` has no authentication at all: the access token in
the URL is the whole credential. Those views are read-only except for creating
an Approval and creating a Comment.
"""

from __future__ import annotations

from pathlib import PurePosixPath

from django.contrib.auth import authenticate, login, logout
from django.db.models import Prefetch
from django.http import Http404, HttpResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import emails
from .models import (
    Approval,
    Architect,
    Comment,
    DrawingSet,
    DrawingVersion,
    Material,
    Milestone,
    Project,
)
from .permissions import HasProjectToken, IsProjectArchitect
from .serializers import (
    ApprovalCreateSerializer,
    ApprovalSerializer,
    ArchitectSerializer,
    ClientCommentCreateSerializer,
    ClientProjectSerializer,
    CommentSerializer,
    DrawingSetDetailSerializer,
    DrawingSetSerializer,
    DrawingVersionCreateSerializer,
    DrawingVersionSerializer,
    LoginSerializer,
    MaterialSerializer,
    MilestoneSerializer,
    ProfileCardSerializer,
    ProfileUpdateSerializer,
    ProjectSerializer,
    RegistrationSerializer,
)
from .storage import stream


def stored_name(fieldfile) -> str:
    """The stored file's own basename.

    `stream` guesses Content-Type from this, and we send nosniff, so a made-up
    name like "logo" or a forced ".jpg" on a PNG gets the image blocked or
    mislabelled in the browser.
    """
    return PurePosixPath(fieldfile.name).name


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ==========================================================================
# auth -- architect only. The client never sees any of this.
# ==========================================================================


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    """Hand the SPA a CSRF token before it posts the login form."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(APIView):
    """Ask for an account. Nobody gets in until a superuser says so.

    The response is deliberately the same shape whether or not approval is
    instant, so the frontend has one path to render.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "register"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        form = RegistrationSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        architect = form.save()
        emails.notify_admins_of_registration(architect)
        return Response(
            {
                "detail": (
                    "Your account has been created and is waiting for approval. "
                    "You will be able to sign in once it is activated."
                ),
                "pending": True,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        form = LoginSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        email = form.validated_data["email"]
        password = form.validated_data["password"]

        user = authenticate(request, username=email, password=password)
        if user is None:
            # `authenticate` refuses inactive accounts without saying why, which
            # leaves someone awaiting approval staring at "wrong password".
            # Only tell them if they already proved they know the password.
            pending = Architect.objects.filter(
                email__iexact=email, is_active=False
            ).first()
            if pending is not None and pending.check_password(password):
                return Response(
                    {
                        "detail": (
                            "Your account is waiting for approval. "
                            "You will be able to sign in once it is activated."
                        ),
                        "pending": True,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"detail": "Those details do not match an account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user)
        return Response(ArchitectSerializer(user, context={"request": request}).data)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """The architect's own account. GET to read it, PATCH to edit it.

    Practice name and logo are not vanity fields: they sit at the top of every
    screen the client sees, so this is the one page that decides whether the
    portal looks like the architect's own stationery.
    """

    def get(self, request):
        return Response(
            ArchitectSerializer(request.user, context={"request": request}).data
        )

    def patch(self, request):
        form = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        form.is_valid(raise_exception=True)
        form.save()
        return Response(
            ArchitectSerializer(request.user, context={"request": request}).data
        )


# ==========================================================================
# architect -- session auth, queryset always filtered by request.user
# ==========================================================================


class ArchitectScopedMixin:
    permission_classes = [IsAuthenticated, IsProjectArchitect]

    def projects(self):
        return Project.objects.filter(architect=self.request.user)

    def get_project(self) -> Project:
        return get_object_or_404(self.projects(), pk=self.kwargs["project_id"])


class ProjectListCreateView(ArchitectScopedMixin, generics.ListCreateAPIView):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return self.projects().prefetch_related(
            "drawing_sets__versions__approvals", "materials", "milestones"
        )

    def perform_create(self, serializer):
        serializer.save(architect=self.request.user)


class ProjectDetailView(ArchitectScopedMixin, generics.RetrieveUpdateAPIView):
    serializer_class = ProjectSerializer
    lookup_url_kwarg = "project_id"

    def get_queryset(self):
        return self.projects().prefetch_related(
            "drawing_sets__versions__approvals", "materials", "milestones"
        )


class RotateTokenView(ArchitectScopedMixin, APIView):
    def post(self, request, project_id):
        project = get_object_or_404(self.projects(), pk=project_id)
        project.rotate_token()
        return Response(ProjectSerializer(project, context={"request": request}).data)


class DrawingSetListCreateView(ArchitectScopedMixin, generics.ListCreateAPIView):
    serializer_class = DrawingSetSerializer

    def get_queryset(self):
        return self.get_project().drawing_sets.prefetch_related("versions__approvals")

    def perform_create(self, serializer):
        project = self.get_project()
        last = project.drawing_sets.count()
        serializer.save(project=project, order=last)


class DrawingVersionListCreateView(ArchitectScopedMixin, generics.ListCreateAPIView):
    def get_drawing_set(self) -> DrawingSet:
        return get_object_or_404(
            DrawingSet.objects.filter(project__architect=self.request.user),
            pk=self.kwargs["set_id"],
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DrawingVersionCreateSerializer
        return DrawingVersionSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["drawing_set"] = self.get_drawing_set()
        return context

    def get_queryset(self):
        return self.get_drawing_set().versions.prefetch_related(
            "approvals", "comments"
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = serializer.save()
        emails.notify_client_of_upload(version)
        return Response(
            DrawingVersionSerializer(version, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ArchitectCommentCreateView(ArchitectScopedMixin, APIView):
    def post(self, request, version_id):
        version = get_object_or_404(
            DrawingVersion.objects.filter(
                drawing_set__project__architect=request.user
            ),
            pk=version_id,
        )
        form = CommentSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        comment = Comment.objects.create(
            drawing_version=version,
            author_type=Comment.AuthorType.ARCHITECT,
            # The person, not the letterhead: a note is written by a human
            # and the client is reading it as one.
            author_name=request.user.display_name or request.user.email,
            body=form.validated_data["body"],
        )
        emails.notify_of_comment(comment)
        return Response(
            CommentSerializer(comment).data, status=status.HTTP_201_CREATED
        )


class MaterialListCreateView(ArchitectScopedMixin, generics.ListCreateAPIView):
    serializer_class = MaterialSerializer

    def get_queryset(self):
        return self.get_project().materials.all()

    def perform_create(self, serializer):
        serializer.save(project=self.get_project())


class MaterialDetailView(ArchitectScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MaterialSerializer
    lookup_url_kwarg = "material_id"

    def get_queryset(self):
        return Material.objects.filter(project__architect=self.request.user)


class MilestoneListCreateView(ArchitectScopedMixin, generics.ListCreateAPIView):
    serializer_class = MilestoneSerializer

    def get_queryset(self):
        return self.get_project().milestones.all()

    def perform_create(self, serializer):
        project = self.get_project()
        serializer.save(project=project, order=project.milestones.count())


class MilestoneDetailView(ArchitectScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MilestoneSerializer
    lookup_url_kwarg = "milestone_id"

    def get_queryset(self):
        return Milestone.objects.filter(project__architect=self.request.user)


# --- architect file streaming (never a direct media URL, on either side) ---


class ArchitectVersionFileView(APIView):
    def get(self, request, version_id, preview=False):
        version = get_object_or_404(
            DrawingVersion.objects.filter(
                drawing_set__project__architect=request.user
            ),
            pk=version_id,
        )
        if preview:
            if not version.preview:
                raise Http404
            return stream(version.preview, download_name=f"{version.pk}-preview.jpg")
        return stream(version.file, download_name=version.file_name)


class ArchitectVersionPreviewView(ArchitectVersionFileView):
    def get(self, request, version_id):
        return super().get(request, version_id, preview=True)


class ArchitectMaterialPhotoView(APIView):
    def get(self, request, material_id):
        material = get_object_or_404(
            Material.objects.filter(project__architect=request.user), pk=material_id
        )
        if not material.photo:
            raise Http404
        return stream(material.photo, download_name=stored_name(material.photo))


class ArchitectMaterialInvoiceView(APIView):
    def get(self, request, material_id):
        material = get_object_or_404(
            Material.objects.filter(project__architect=request.user), pk=material_id
        )
        if not material.invoice:
            raise Http404
        return stream(material.invoice, download_name=stored_name(material.invoice))


class PracticeLogoView(APIView):
    def get(self, request, architect_id):
        if request.user.pk != architect_id or not request.user.logo:
            raise Http404
        return stream(request.user.logo, download_name=stored_name(request.user.logo))


class PracticeAvatarView(APIView):
    """The architect's own photo, for their own screens.

    The public card serves the same file from its own URL. Two doors to one
    picture, because only one of them should keep working if the card is
    switched off.
    """

    def get(self, request, architect_id):
        if request.user.pk != architect_id or not request.user.avatar:
            raise Http404
        return stream(
            request.user.avatar, download_name=stored_name(request.user.avatar)
        )


class PracticeCoverView(APIView):
    """The card's cover band, for the preview on the architect's own screen."""

    def get(self, request, architect_id):
        if request.user.pk != architect_id or not request.user.cover:
            raise Http404
        return stream(
            request.user.cover, download_name=stored_name(request.user.cover)
        )


# ==========================================================================
# the profile card -- the one page in this product anyone may open
# ==========================================================================


def vcard_escape(value: str) -> str:
    """Escape a value for a vCard line (RFC 6350 3.4)."""
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


class CardBaseView(APIView):
    """No session, no token: the slug is the address and nothing more.

    A card only resolves while its owner has it switched on, and an inactive
    or suspended account has no card at all.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def architect(self):
        return get_object_or_404(
            Architect,
            card_slug=self.kwargs["slug"],
            card_is_public=True,
            is_active=True,
        )


class CardView(CardBaseView):
    def get(self, request, slug):
        return Response(ProfileCardSerializer(self.architect()).data)


class CardAvatarView(CardBaseView):
    def get(self, request, slug):
        architect = self.architect()
        if not architect.avatar:
            raise Http404
        response = stream(
            architect.avatar, download_name=stored_name(architect.avatar)
        )
        # Unlike every other file in this product, this one is deliberately
        # public, so it may sit in a shared cache.
        response["Cache-Control"] = "public, max-age=3600"
        return response


class CardLogoView(CardBaseView):
    def get(self, request, slug):
        architect = self.architect()
        if not architect.logo:
            raise Http404
        response = stream(architect.logo, download_name=stored_name(architect.logo))
        response["Cache-Control"] = "public, max-age=3600"
        return response


class CardCoverView(CardBaseView):
    def get(self, request, slug):
        architect = self.architect()
        if not architect.cover:
            raise Http404
        response = stream(architect.cover, download_name=stored_name(architect.cover))
        response["Cache-Control"] = "public, max-age=3600"
        return response


class CardVCardView(CardBaseView):
    """Save to contacts.

    A paper card gets typed into a phone or lost. This is the whole reason to
    have a link rather than a picture of a card.
    """

    def get(self, request, slug):
        architect = self.architect()
        name = architect.display_name

        lines = ["BEGIN:VCARD", "VERSION:3.0", f"FN:{vcard_escape(name)}"]
        # N wants family;given, and we only ever asked for one name field.
        parts = name.split()
        if len(parts) > 1:
            lines.append(
                f"N:{vcard_escape(parts[-1])};{vcard_escape(' '.join(parts[:-1]))};;;"
            )
        else:
            lines.append(f"N:{vcard_escape(name)};;;;")
        if architect.practice_name:
            lines.append(f"ORG:{vcard_escape(architect.practice_name)}")
        if architect.profession:
            lines.append(f"TITLE:{vcard_escape(architect.profession)}")
        if architect.phone:
            lines.append(f"TEL;TYPE=CELL:{vcard_escape(architect.phone)}")
        lines.append(f"EMAIL;TYPE=WORK:{vcard_escape(architect.email)}")
        if architect.location:
            lines.append(f"ADR;TYPE=WORK:;;{vcard_escape(architect.location)};;;;")
        if architect.website:
            lines.append(f"URL:{vcard_escape(architect.website)}")
        if architect.card_url:
            lines.append(f"URL:{vcard_escape(architect.card_url)}")
        if architect.bio:
            lines.append(f"NOTE:{vcard_escape(architect.bio)}")
        lines.append("END:VCARD")

        body = "\r\n".join(lines) + "\r\n"
        response = HttpResponse(body, content_type="text/vcard; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="{architect.card_slug}.vcf"'
        )
        return response


# ==========================================================================
# client -- token in the URL, no session, no account, nothing to log in to
# ==========================================================================


class ClientBaseView(APIView):
    """No authentication classes at all: the token is the credential.

    Dropping SessionAuthentication also means an architect who happens to be
    logged in never gets CSRF-checked while viewing a client link.
    """

    permission_classes = [HasProjectToken]
    authentication_classes = []

    def client_context(self):
        return {"request": self.request, "token": self.kwargs["token"]}


class ClientProjectView(ClientBaseView):
    def get(self, request, token):
        project = (
            Project.objects.select_related("architect")
            .prefetch_related(
                "materials",
                "milestones",
                Prefetch(
                    "drawing_sets",
                    queryset=DrawingSet.objects.prefetch_related(
                        "versions__approvals", "versions__comments"
                    ),
                ),
            )
            .get(pk=request.project.pk)
        )
        return Response(
            ClientProjectSerializer(project, context=self.client_context()).data
        )


class ClientDrawingSetView(ClientBaseView):
    def get(self, request, token, set_id):
        drawing_set = get_object_or_404(
            request.project.drawing_sets.prefetch_related(
                "versions__approvals", "versions__comments"
            ),
            pk=set_id,
        )
        return Response(
            DrawingSetDetailSerializer(
                drawing_set, context=self.client_context()
            ).data
        )


class ClientApproveView(ClientBaseView):
    throttle_scope = "client_write"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, token, version_id):
        version = get_object_or_404(
            DrawingVersion.objects.filter(drawing_set__project=request.project),
            pk=version_id,
        )
        existing = version.approvals.first()
        if existing is not None:
            # Approvals are append-only and one per revision. A second tap --
            # usually a double tap on a slow connection -- returns the record
            # that already exists rather than creating a duplicate.
            return Response(ApprovalSerializer(existing).data)

        form = ApprovalCreateSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        approval = Approval.objects.create(
            drawing_version=version,
            approved_by_name=form.validated_data["approved_by_name"],
            ip_address=client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
        )
        emails.notify_architect_of_approval(approval)
        return Response(
            ApprovalSerializer(approval).data, status=status.HTTP_201_CREATED
        )


class ClientCommentView(ClientBaseView):
    throttle_scope = "client_write"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, token, version_id):
        version = get_object_or_404(
            DrawingVersion.objects.filter(drawing_set__project=request.project),
            pk=version_id,
        )
        form = ClientCommentCreateSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        comment = Comment.objects.create(
            drawing_version=version,
            author_type=Comment.AuthorType.CLIENT,
            author_name=form.validated_data["author_name"],
            body=form.validated_data["body"],
        )
        emails.notify_of_comment(comment)
        return Response(
            CommentSerializer(comment).data, status=status.HTTP_201_CREATED
        )


class ClientMaterialsView(ClientBaseView):
    def get(self, request, token):
        return Response(
            MaterialSerializer(
                request.project.materials.all(),
                many=True,
                context=self.client_context(),
            ).data
        )


class ClientMilestonesView(ClientBaseView):
    def get(self, request, token):
        return Response(
            MilestoneSerializer(
                request.project.milestones.all(),
                many=True,
                context=self.client_context(),
            ).data
        )


class ClientFileView(ClientBaseView):
    """Stream a drawing to the client after checking it belongs to their project.

    This is why no raw media URL is ever handed out: a copied file link is
    worthless without the token it was fetched under.
    """

    preview = False

    def get(self, request, token, version_id):
        version = get_object_or_404(
            DrawingVersion.objects.filter(drawing_set__project=request.project),
            pk=version_id,
        )
        if self.preview:
            if not version.preview:
                raise Http404
            return stream(version.preview, download_name=f"{version.pk}-preview.jpg")
        return stream(version.file, download_name=version.file_name)


class ClientFilePreviewView(ClientFileView):
    preview = True


class ClientMaterialPhotoView(ClientBaseView):
    def get(self, request, token, material_id):
        material = get_object_or_404(
            request.project.materials, pk=material_id
        )
        if not material.photo:
            raise Http404
        return stream(material.photo, download_name=stored_name(material.photo))


class ClientMaterialInvoiceView(ClientBaseView):
    """The bill behind a selection. Token-scoped like everything else here."""

    def get(self, request, token, material_id):
        material = get_object_or_404(request.project.materials, pk=material_id)
        if not material.invoice:
            raise Http404
        return stream(material.invoice, download_name=stored_name(material.invoice))


class ClientLogoView(ClientBaseView):
    def get(self, request, token):
        architect = request.project.architect
        if not architect.logo:
            raise Http404
        return stream(architect.logo, download_name=stored_name(architect.logo))
