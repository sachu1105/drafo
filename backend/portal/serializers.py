"""
Serializers.

Two audiences read the same models, so two shapes exist for most of them: the
architect sees ids and edit affordances, the client sees only what belongs on
their screen. Neither shape ever contains a raw media URL -- files are always
addressed through a view that re-checks who is asking.
"""

from __future__ import annotations

import zlib

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

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

PDF_MAGIC = b"%PDF-"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


def _file_urls(version: DrawingVersion, context: dict) -> tuple[str, str | None]:
    """Return (file_url, preview_url) for whoever is asking.

    A `token` in the serializer context means the client is asking, and the
    URLs are namespaced under their token. Otherwise it is the architect, on
    a session.

    These are paths, never absolute URLs: the frontend proxies /api to Django,
    so a path works unchanged in the browser, and nothing here has to guess at
    the public hostname.
    """
    token = context.get("token")
    if token:
        base = f"/api/p/{token}/files/{version.pk}/"
    else:
        base = f"/api/drawing-versions/{version.pk}/file/"
    preview = f"{base}preview/" if version.preview else None
    return base, preview


# --------------------------------------------------------------------------
# architect identity
# --------------------------------------------------------------------------


MAX_LOGO_MB = 2


def _logo_version(architect) -> str:
    """A stable cache-buster so a replaced logo actually appears.

    The logo URL never changes, and files are served with a long private
    cache, so without this the architect uploads a new mark and keeps seeing
    the old one. crc32 rather than hash(): hash() is salted per process and
    would change on every restart.
    """
    return str(zlib.crc32(architect.logo.name.encode()) & 0xFFFFFFFF)


class ArchitectSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Architect
        fields = (
            "id",
            "email",
            "practice_name",
            "phone",
            "logo_url",
            "is_staff",
        )
        read_only_fields = ("id", "email", "is_staff")

    def get_logo_url(self, obj) -> str | None:
        if not obj.logo:
            return None
        return f"/api/practice/{obj.pk}/logo/?v={_logo_version(obj)}"


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """What an architect may change about their own account.

    Deliberately short. Email is the login and is not editable here, and
    nothing on this serializer can touch is_staff, is_active or is_superuser --
    a self-registered account must never be able to promote itself.
    """

    class Meta:
        model = Architect
        fields = ("practice_name", "phone", "logo")

    def validate_practice_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Your practice needs a name.")
        return value

    def validate_logo(self, upload):
        if upload is None:
            return upload
        if upload.size > MAX_LOGO_MB * 1024 * 1024:
            raise serializers.ValidationError(
                f"That logo is {upload.size / 1048576:.1f} MB. "
                f"The limit is {MAX_LOGO_MB} MB."
            )
        name = (upload.name or "").lower()
        if not name.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
            raise serializers.ValidationError("Use a PNG, JPG, WEBP or SVG.")
        return upload


class RegistrationSerializer(serializers.ModelSerializer):
    """Self-registration for a practice.

    The account is created inactive: it exists, but cannot sign in until a
    superuser approves it. That keeps a public form from becoming an open door
    while still letting people ask for access without emailing anyone.
    """

    password = serializers.CharField(
        write_only=True, style={"input_type": "password"}, min_length=8
    )

    class Meta:
        model = Architect
        fields = ("email", "practice_name", "phone", "password")

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if Architect.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "There is already an account with that email."
            )
        return value

    def validate_practice_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Your practice needs a name.")
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return Architect.objects.create_user(
            password=password,
            is_active=False,  # pending approval; create_user already denies staff
            **validated_data,
        )


class PracticeSerializer(serializers.ModelSerializer):
    """What the client is allowed to know about the practice: its letterhead."""

    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Architect
        fields = ("practice_name", "phone", "logo_url")

    def get_logo_url(self, obj) -> str | None:
        token = self.context.get("token")
        if not obj.logo or not token:
            return None
        return f"/api/p/{token}/logo/?v={_logo_version(obj)}"


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(style={"input_type": "password"})


# --------------------------------------------------------------------------
# comments and approvals
# --------------------------------------------------------------------------


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ("id", "author_type", "author_name", "body", "created_at")
        # The architect's name comes from their account, the client's from the
        # box they typed it in; neither is ever taken from the request body.
        read_only_fields = ("id", "author_type", "author_name", "created_at")


class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Approval
        fields = ("id", "approved_by_name", "approved_at")
        read_only_fields = fields


class ApprovalCreateSerializer(serializers.Serializer):
    approved_by_name = serializers.CharField(max_length=120)

    def validate_approved_by_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Please enter your name.")
        return value


class ClientCommentCreateSerializer(serializers.Serializer):
    author_name = serializers.CharField(max_length=120)
    body = serializers.CharField()

    def validate_author_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Please enter your name.")
        return value

    def validate_body(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Write something first.")
        return value


# --------------------------------------------------------------------------
# drawings
# --------------------------------------------------------------------------


class DrawingVersionSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    is_pdf = serializers.BooleanField(read_only=True)
    approval = ApprovalSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = DrawingVersion
        fields = (
            "id",
            "version_number",
            "file_name",
            "file_size",
            "notes",
            "uploaded_at",
            "is_pdf",
            "file_url",
            "preview_url",
            "approval",
            "comments",
            "comment_count",
        )
        read_only_fields = fields

    def get_file_url(self, obj) -> str:
        return _file_urls(obj, self.context)[0]

    def get_preview_url(self, obj) -> str | None:
        return _file_urls(obj, self.context)[1]

    def get_comment_count(self, obj) -> int:
        return obj.comments.count()


class DrawingVersionSummarySerializer(DrawingVersionSerializer):
    """The same version without its comment thread, for list screens."""

    class Meta(DrawingVersionSerializer.Meta):
        fields = tuple(
            f for f in DrawingVersionSerializer.Meta.fields if f != "comments"
        )
        read_only_fields = fields


class DrawingVersionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrawingVersion
        fields = ("id", "file", "notes")

    def validate_file(self, upload):
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if upload.size > max_bytes:
            raise serializers.ValidationError(
                f"That file is {upload.size / 1048576:.1f} MB. "
                f"The limit is {settings.MAX_UPLOAD_MB} MB."
            )
        name = (upload.name or "").lower()
        extension = name[name.rfind(".") :] if "." in name else ""
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Upload a PDF, PNG or JPG.")

        # Trust the bytes, not the extension: the browser check is a courtesy,
        # this one is the actual gate.
        upload.seek(0)
        head = upload.read(8)
        upload.seek(0)
        if extension == ".pdf":
            ok = head.startswith(PDF_MAGIC)
        elif extension == ".png":
            ok = head.startswith(PNG_MAGIC)
        else:
            ok = head.startswith(JPEG_MAGIC)
        if not ok:
            raise serializers.ValidationError(
                "That file is not the type its name claims to be."
            )
        return upload

    @transaction.atomic
    def create(self, validated_data):
        from .previews import build_preview

        drawing_set = self.context["drawing_set"]
        # Lock the set so two simultaneous uploads cannot claim the same
        # version number.
        locked = DrawingSet.objects.select_for_update().get(pk=drawing_set.pk)
        last = locked.versions.aggregate(highest=Max("version_number"))["highest"]

        upload = validated_data["file"]
        content_type = "application/pdf" if upload.name.lower().endswith(".pdf") else ""
        version = DrawingVersion(
            drawing_set=locked,
            version_number=(last or 0) + 1,
            file=upload,
            file_name=upload.name[:255],
            file_size=upload.size,
            notes=validated_data.get("notes", ""),
        )
        preview = build_preview(upload, content_type=content_type)
        if preview is not None:
            version.preview.save(
                f"{drawing_set.pk}-v{version.version_number}.jpg", preview, save=False
            )
        version.save()
        return version


class DrawingSetSerializer(serializers.ModelSerializer):
    current_version = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()
    is_approved = serializers.SerializerMethodField()

    class Meta:
        model = DrawingSet
        fields = (
            "id",
            "title",
            "order",
            "created_at",
            "version_count",
            "current_version",
            "is_approved",
        )
        read_only_fields = ("id", "created_at", "version_count", "current_version")

    def get_current_version(self, obj):
        version = obj.current_version
        if version is None:
            return None
        return DrawingVersionSummarySerializer(version, context=self.context).data

    def get_version_count(self, obj) -> int:
        return obj.versions.count()

    def get_is_approved(self, obj) -> bool:
        version = obj.current_version
        return bool(version and version.approvals.exists())


class DrawingSetDetailSerializer(DrawingSetSerializer):
    versions = DrawingVersionSerializer(many=True, read_only=True)

    class Meta(DrawingSetSerializer.Meta):
        fields = DrawingSetSerializer.Meta.fields + ("versions",)


# --------------------------------------------------------------------------
# materials and milestones
# --------------------------------------------------------------------------


class MaterialSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    category_label = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Material
        fields = (
            "id",
            "category",
            "category_label",
            "name",
            "brand",
            "photo",
            "photo_url",
            "price",
            "unit",
            "notes",
            "selected_at",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "photo_url", "category_label")
        extra_kwargs = {"photo": {"write_only": True, "required": False}}

    def get_photo_url(self, obj) -> str | None:
        if not obj.photo:
            return None
        token = self.context.get("token")
        if token:
            return f"/api/p/{token}/materials/{obj.pk}/photo/"
        return f"/api/materials/{obj.pk}/photo/"


class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = (
            "id",
            "title",
            "amount",
            "order",
            "is_paid",
            "paid_on",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


# --------------------------------------------------------------------------
# projects
# --------------------------------------------------------------------------


class ProjectSerializer(serializers.ModelSerializer):
    client_url = serializers.CharField(read_only=True)
    drawing_set_count = serializers.SerializerMethodField()
    material_count = serializers.SerializerMethodField()
    milestone_count = serializers.SerializerMethodField()
    awaiting_approval_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "client_name",
            "client_phone",
            "client_email",
            "address",
            "status",
            "access_token",
            "client_url",
            "drawing_set_count",
            "material_count",
            "milestone_count",
            "awaiting_approval_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "access_token", "client_url", "created_at", "updated_at")

    def get_drawing_set_count(self, obj) -> int:
        return obj.drawing_sets.count()

    def get_material_count(self, obj) -> int:
        return obj.materials.count()

    def get_milestone_count(self, obj) -> int:
        return obj.milestones.count()

    def get_awaiting_approval_count(self, obj) -> int:
        """Drawing sets whose newest version nobody has approved yet."""
        waiting = 0
        for drawing_set in obj.drawing_sets.all():
            version = drawing_set.current_version
            if version and not version.approvals.exists():
                waiting += 1
        return waiting


class ClientProjectSerializer(serializers.ModelSerializer):
    """The client's view of their own project. No ids of ours, no token echo."""

    practice = serializers.SerializerMethodField()
    drawing_sets = serializers.SerializerMethodField()
    materials = serializers.SerializerMethodField()
    milestones = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "name",
            "client_name",
            "address",
            "status",
            "updated_at",
            "practice",
            "drawing_sets",
            "materials",
            "milestones",
        )

    def get_practice(self, obj):
        return PracticeSerializer(obj.architect, context=self.context).data

    def get_drawing_sets(self, obj):
        return DrawingSetSerializer(
            obj.drawing_sets.all(), many=True, context=self.context
        ).data

    def get_materials(self, obj):
        return MaterialSerializer(
            obj.materials.all(), many=True, context=self.context
        ).data

    def get_milestones(self, obj):
        return MilestoneSerializer(
            obj.milestones.all(), many=True, context=self.context
        ).data
