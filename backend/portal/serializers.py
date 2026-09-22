"""
Serializers.

Two audiences read the same models, so two shapes exist for most of them: the
architect sees ids and edit affordances, the client sees only what belongs on
their screen. Neither shape ever contains a raw media URL -- files are always
addressed through a view that re-checks who is asking.
"""

from __future__ import annotations

import re
import zlib

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from .models import (
    RESERVED_SLUGS,
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

# A card slug is a public URL segment, so it is checked here rather than left
# to SlugField, which also accepts underscores and capitals.
SLUG_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


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
MAX_AVATAR_MB = 4
MAX_COVER_MB = 6  # a photograph across the full width of a card

LOGO_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".svg")
# No SVG for the avatar or the cover: both are rendered large on a page anyone
# can open, and an SVG is a document that can carry script, not just a picture.
AVATAR_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
COVER_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


def _file_version(fieldfile) -> str:
    """A stable cache-buster so a replaced image actually appears.

    These URLs never change, and files are served with a long private cache,
    so without this the architect uploads a new mark and keeps seeing the old
    one. crc32 rather than hash(): hash() is salted per process and would
    change on every restart.
    """
    return str(zlib.crc32(fieldfile.name.encode()) & 0xFFFFFFFF)


def _logo_version(architect) -> str:
    return _file_version(architect.logo)


def _too_big(label: str, size: int, max_mb: int) -> str:
    """Say why the file was refused without appearing to contradict itself.

    A file a kilobyte over a 2 MB limit is "2.0 MB" at one decimal place, and
    "that logo is 2.0 MB, the limit is 2 MB" reads as a broken check rather
    than a rule. Under a tenth of a megabyte over, say so in kilobytes.
    """
    over = size - max_mb * 1024 * 1024
    if over < 1024 * 100:
        return (
            f"That {label} is just over the {max_mb} MB limit, by "
            f"{max(over // 1024, 1)} KB. Try a smaller file."
        )
    return (
        f"That {label} is {size / 1048576:.1f} MB and the limit is {max_mb} MB. "
        f"Try a smaller file."
    )


def _check_image(upload, *, label: str, max_mb: int, extensions: tuple[str, ...]):
    if upload is None:
        return upload
    if upload.size > max_mb * 1024 * 1024:
        raise serializers.ValidationError(_too_big(label, upload.size, max_mb))
    name = (upload.name or "").lower()
    if not name.endswith(extensions):
        readable = ", ".join(e[1:].upper() for e in extensions[:-1])
        raise serializers.ValidationError(
            f"Use a {readable} or {extensions[-1][1:].upper()}."
        )
    return upload


class ArchitectSerializer(serializers.ModelSerializer):
    """The architect's whole account, as their own settings screen reads it."""

    logo_url = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    card_url = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Architect
        fields = (
            "id",
            "email",
            # the person
            "full_name",
            "profession",
            "bio",
            "avatar_url",
            "display_name",
            # the practice
            "practice_name",
            "logo_url",
            # contact
            "phone",
            "location",
            "website",
            # the shareable card
            "cover_url",
            "card_slug",
            "card_url",
            "card_is_public",
            "is_staff",
        )
        read_only_fields = ("id", "email", "is_staff", "card_slug", "display_name")

    def get_logo_url(self, obj) -> str | None:
        if not obj.logo:
            return None
        return f"/api/practice/{obj.pk}/logo/?v={_file_version(obj.logo)}"

    def get_avatar_url(self, obj) -> str | None:
        if not obj.avatar:
            return None
        return f"/api/practice/{obj.pk}/avatar/?v={_file_version(obj.avatar)}"

    def get_cover_url(self, obj) -> str | None:
        if not obj.cover:
            return None
        return f"/api/practice/{obj.pk}/cover/?v={_file_version(obj.cover)}"

    def get_card_url(self, obj) -> str | None:
        return obj.card_url


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """What an architect may change about their own account.

    Email is the login and is not editable here, and nothing on this
    serializer can touch is_staff, is_active or is_superuser -- a
    self-registered account must never be able to promote itself.

    The two remove_* flags exist because a multipart PATCH has no way to send
    null: clearing a picture has to be its own field.
    """

    remove_logo = serializers.BooleanField(write_only=True, required=False)
    remove_avatar = serializers.BooleanField(write_only=True, required=False)
    remove_cover = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Architect
        fields = (
            "full_name",
            "profession",
            "bio",
            "avatar",
            "practice_name",
            "logo",
            "phone",
            "location",
            "website",
            "cover",
            "card_slug",
            "card_is_public",
            "remove_logo",
            "remove_avatar",
            "remove_cover",
        )

    def validate_practice_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Your practice needs a name.")
        return value

    def validate_card_slug(self, value: str) -> str:
        value = (value or "").strip().lower()
        if not value:
            raise serializers.ValidationError("Your card needs a link.")
        if len(value) < 3:
            raise serializers.ValidationError(
                "Use at least three characters."
            )
        if not SLUG_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                "Use lowercase letters, numbers and hyphens only."
            )
        if value in RESERVED_SLUGS:
            raise serializers.ValidationError("That link is reserved. Try another.")
        taken = Architect.objects.filter(card_slug=value)
        if self.instance is not None:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError("Someone already has that link.")
        return value

    def validate_logo(self, upload):
        return _check_image(
            upload, label="logo", max_mb=MAX_LOGO_MB, extensions=LOGO_EXTENSIONS
        )

    def validate_avatar(self, upload):
        return _check_image(
            upload, label="photo", max_mb=MAX_AVATAR_MB, extensions=AVATAR_EXTENSIONS
        )

    def validate_cover(self, upload):
        return _check_image(
            upload, label="cover", max_mb=MAX_COVER_MB, extensions=COVER_EXTENSIONS
        )

    def update(self, instance, validated_data):
        # An upload in the same request wins over the remove flag; the form
        # only ever sends one of the two.
        for field in ("logo", "avatar", "cover"):
            dropped = validated_data.pop(f"remove_{field}", False)
            if dropped and field not in validated_data:
                validated_data[field] = None
        return super().update(instance, validated_data)


class ProfileCardSerializer(serializers.ModelSerializer):
    """The card, as anyone holding the link reads it.

    Every field on it was typed by the architect for exactly this purpose.
    The email is the one thing that is not: it is their sign-in, so it is
    published only through the card's own address, never as the login.
    """

    name = serializers.CharField(source="display_name", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()

    class Meta:
        model = Architect
        fields = (
            "name",
            "profession",
            "practice_name",
            "bio",
            "phone",
            "email",
            "location",
            "website",
            "avatar_url",
            "logo_url",
            "cover_url",
            "card_slug",
        )
        read_only_fields = fields

    def get_avatar_url(self, obj) -> str | None:
        if not obj.avatar:
            return None
        return f"/api/card/{obj.card_slug}/avatar/?v={_file_version(obj.avatar)}"

    def get_logo_url(self, obj) -> str | None:
        if not obj.logo:
            return None
        return f"/api/card/{obj.card_slug}/logo/?v={_file_version(obj.logo)}"

    def get_cover_url(self, obj) -> str | None:
        if not obj.cover:
            return None
        return f"/api/card/{obj.card_slug}/cover/?v={_file_version(obj.cover)}"


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
        fields = ("email", "full_name", "practice_name", "phone", "password")

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
