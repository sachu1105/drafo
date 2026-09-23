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
    Invoice,
    InvoiceLine,
    Material,
    MaterialPhoto,
    Milestone,
    Project,
    TaxRate,
    Unit,
)

PDF_MAGIC = b"%PDF-"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

MAX_INVOICE_MB = 10


def extension_of(upload) -> str:
    name = (upload.name or "").lower()
    return name[name.rfind(".") :] if "." in name else ""


def check_real_type(upload, extension: str) -> bool:
    """Trust the bytes, not the extension.

    The accept= attribute on the input is a courtesy to the file picker; this
    is the actual gate. Shared by drawing uploads and material invoices so
    that the second one cannot quietly be the laxer of the two.
    """
    upload.seek(0)
    head = upload.read(8)
    upload.seek(0)
    if extension == ".pdf":
        return head.startswith(PDF_MAGIC)
    if extension == ".png":
        return head.startswith(PNG_MAGIC)
    return head.startswith(JPEG_MAGIC)

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
    email_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = Architect
        fields = (
            "id",
            "email",
            "email_verified",
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
            # billing
            "gstin",
            "billing_address",
            "bank_details",
            "default_tax_percent",
            "invoice_terms",
            "is_staff",
        )
        read_only_fields = (
            "id",
            "email",
            "email_verified",
            "is_staff",
            "card_slug",
            "display_name",
        )

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
            # billing: what goes at the top of an invoice
            "gstin",
            "billing_address",
            "bank_details",
            "default_tax_percent",
            "invoice_terms",
            "remove_logo",
            "remove_avatar",
            "remove_cover",
        )

    # Multipart has no null. An architect clearing the default rate box means
    # "we charge none", and a DecimalField refuses "".
    def to_internal_value(self, data):
        if hasattr(data, "getlist") and data.get("default_tax_percent", None) == "":
            data = data.copy()
            data["default_tax_percent"] = None
        return super().to_internal_value(data)

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

    The account is live the moment it is created. Approval-gated signup does
    not scale past the first handful of accounts -- somebody has to be awake
    to let each person in -- and it buys nothing here: a new account is empty,
    owns no projects, and can reach nothing but its own.

    Only the four fields needed to have an account at all are asked for.
    Everything else is on the profile screen, where it can be filled in by
    someone who has already seen what it is for.
    """

    password = serializers.CharField(
        write_only=True, style={"input_type": "password"}, min_length=8
    )

    class Meta:
        model = Architect
        fields = ("email", "full_name", "practice_name", "password")

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
        # create_user already refuses is_staff/is_superuser, which is the only
        # thing a public form must never be able to grant itself.
        return Architect.objects.create_user(password=password, **validated_data)


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
        if upload.size > settings.MAX_UPLOAD_MB * 1024 * 1024:
            raise serializers.ValidationError(
                _too_big("file", upload.size, settings.MAX_UPLOAD_MB)
            )
        extension = extension_of(upload)
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Upload a PDF, PNG or JPG.")
        if not check_real_type(upload, extension):
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


MAX_MATERIAL_PHOTO_MB = 8
MATERIAL_PHOTO_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
# Enough for a tile from four angles and the room it went into. The cap is
# here so that a phone's "select all" in the gallery cannot put ninety
# pictures behind one line in a client's list.
MAX_MATERIAL_PHOTOS = 8


class MaterialPhotoSerializer(serializers.ModelSerializer):
    """One picture, as a URL the caller is allowed to fetch.

    The stored path is never exposed. Like every other file in this product
    the bytes come back through a view that has already checked the token or
    the session, so a copied URL is worthless on its own.
    """

    url = serializers.SerializerMethodField()

    class Meta:
        model = MaterialPhoto
        fields = ("id", "url")

    def get_url(self, obj) -> str:
        token = self.context.get("token")
        version = _file_version(obj.image)
        if token:
            return (
                f"/api/p/{token}/materials/{obj.material_id}"
                f"/photos/{obj.pk}/?v={version}"
            )
        return f"/api/materials/{obj.material_id}/photos/{obj.pk}/?v={version}"


class MaterialSerializer(serializers.ModelSerializer):
    photos = MaterialPhotoSerializer(many=True, read_only=True)
    invoice_url = serializers.SerializerMethodField()
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
            "photos",
            "invoice",
            "invoice_url",
            "invoice_name",
            "price",
            "unit",
            "notes",
            "selected_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "photos",
            "invoice_url",
            "invoice_name",
            "category_label",
        )
        extra_kwargs = {
            "invoice": {"write_only": True, "required": False},
        }

    # Fields a multipart form has no way to send as null. An edit that clears
    # the price box means "no price", but multipart can only send "", which a
    # DecimalField refuses. Emptying a box has to be able to empty the field,
    # or a price typed by mistake is permanent.
    NULLABLE_ON_EMPTY = ("price", "selected_at")

    def to_internal_value(self, data):
        if hasattr(data, "getlist"):
            blanked = {
                field: None
                for field in self.NULLABLE_ON_EMPTY
                if data.get(field, None) == ""
            }
            if blanked:
                # copy(), not dict(): dict() collapses a repeated key to its
                # last value, and `photos` arrives as a repeated key.
                data = data.copy()
                for field, value in blanked.items():
                    data[field] = value
        return super().to_internal_value(data)

    def get_invoice_url(self, obj) -> str | None:
        if not obj.invoice:
            return None
        token = self.context.get("token")
        if token:
            return f"/api/p/{token}/materials/{obj.pk}/invoice/"
        return f"/api/materials/{obj.pk}/invoice/"

    def validate_invoice(self, upload):
        if upload is None:
            return upload
        if upload.size > MAX_INVOICE_MB * 1024 * 1024:
            raise serializers.ValidationError(
                _too_big("invoice", upload.size, MAX_INVOICE_MB)
            )
        extension = extension_of(upload)
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Upload a PDF, PNG or JPG.")
        if not check_real_type(upload, extension):
            raise serializers.ValidationError(
                "That file is not the type its name claims to be."
            )
        return upload

    # --- the gallery -----------------------------------------------------
    #
    # Several files arrive under one repeated `photos` key, which a
    # ModelSerializer field cannot read: a QueryDict hands back only the last
    # value unless asked for the list. So the uploads are pulled off the
    # request, validated as a group, and written as rows once the material
    # itself exists.

    def _incoming_photos(self) -> list:
        request = self.context.get("request")
        if request is None or not hasattr(request, "FILES"):
            return []
        return request.FILES.getlist("photos")

    def validate(self, attrs):
        uploads = self._incoming_photos()
        if not uploads:
            return attrs

        already = self.instance.photos.count() if self.instance else 0
        if already + len(uploads) > MAX_MATERIAL_PHOTOS:
            raise serializers.ValidationError(
                {
                    "photos": (
                        f"That is more than {MAX_MATERIAL_PHOTOS} pictures for one "
                        "material. Pick the ones that show it best."
                    )
                }
            )
        for upload in uploads:
            _check_image(
                upload,
                label="picture",
                max_mb=MAX_MATERIAL_PHOTO_MB,
                extensions=MATERIAL_PHOTO_EXTENSIONS,
            )
        return attrs

    def _save_photos(self, material) -> None:
        uploads = self._incoming_photos()
        if not uploads:
            return
        # Appending, not replacing: an update that sends two more pictures
        # means two more pictures.
        start = material.photos.count()
        # One create() each rather than bulk_create: writing the bytes to
        # storage is FileField's business during save, and eight rows is not
        # a number worth being clever about.
        for index, upload in enumerate(uploads):
            MaterialPhoto.objects.create(
                material=material, image=upload, order=start + index
            )

    def create(self, validated_data):
        upload = validated_data.get("invoice")
        if upload is not None:
            validated_data["invoice_name"] = (upload.name or "invoice")[:255]
        material = super().create(validated_data)
        self._save_photos(material)
        return material

    def update(self, instance, validated_data):
        upload = validated_data.get("invoice")
        if upload is not None:
            validated_data["invoice_name"] = (upload.name or "invoice")[:255]
        material = super().update(instance, validated_data)
        self._save_photos(material)
        return material


class UnitSerializer(serializers.ModelSerializer):
    """The suggestion list behind the unit box. Read-only over the API.

    Units are managed in the Django admin, not by architects: the list is
    shared by every practice on the install, and a box that quietly added
    whatever anyone typed would be a list of typos within a month.
    """

    class Meta:
        model = Unit
        fields = ("id", "label")


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
    status_label = serializers.CharField(source="get_status_display", read_only=True)
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
            "status_label",
            "access_token",
            "client_url",
            "drawing_set_count",
            "material_count",
            "milestone_count",
            "awaiting_approval_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "access_token",
            "client_url",
            "status_label",
            "created_at",
            "updated_at",
        )

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


# --------------------------------------------------------------------------
# invoices
# --------------------------------------------------------------------------


class TaxRateSerializer(serializers.ModelSerializer):
    """The rate card behind the tax dropdown. Managed in the Django admin."""

    class Meta:
        model = TaxRate
        fields = ("id", "label", "percent")


class InvoiceLineSerializer(serializers.ModelSerializer):
    """One row. The money is computed here and never accepted from outside.

    `amount`, `tax_amount` and `total` are read-only on purpose. A client that
    could post its own total could post one that disagrees with its own
    figures, and an invoice whose arithmetic does not add up is worse than no
    invoice at all.
    """

    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    tax_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceLine
        fields = (
            "id",
            "description",
            "quantity",
            "unit",
            "rate",
            "tax_percent",
            "order",
            "milestone",
            "material",
            "amount",
            "tax_amount",
            "total",
        )

    def validate_description(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Every line needs a description.")
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    """An invoice and all of its lines, written in one request.

    Nested writes rather than a line endpoint. An invoice is edited as a whole
    -- add a row, change a rate, drop a row, save -- and a per-line API would
    turn one save into five requests with no transaction around them, leaving
    a half-edited bill on screen the moment one of them failed.
    """

    lines = InvoiceLineSerializer(many=True)
    subtotal = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    tax_total = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    client_url = serializers.CharField(read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "kind",
            "kind_label",
            "status",
            "status_label",
            "number",
            "issued_on",
            "due_on",
            "from_name",
            "from_address",
            "from_gstin",
            "from_phone",
            "from_email",
            "from_bank",
            "to_name",
            "to_address",
            "to_phone",
            "to_email",
            "to_gstin",
            "notes",
            "terms",
            "lines",
            "subtotal",
            "tax_total",
            "total",
            "client_url",
            "project_name",
            "created_at",
        )
        read_only_fields = ("id", "number", "created_at", "client_url")
        # The practice's own details and the issue date are stamped on by the
        # view after validation, from the profile and the project. The form
        # does not send them, so the serializer must not insist on them --
        # while still accepting them when a particular bill needs a different
        # client address from the one on the project.
        extra_kwargs = {
            field: {"required": False}
            for field in ("from_name", "to_name", "issued_on")
        }

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("An invoice needs at least one line.")
        return value

    def _write_lines(self, invoice, lines) -> None:
        # Replaced wholesale rather than diffed. The form sends the invoice as
        # it should now read, and matching rows up by id to work out which
        # three changed is a lot of machinery for a document with six lines.
        invoice.lines.all().delete()
        InvoiceLine.objects.bulk_create(
            [
                InvoiceLine(invoice=invoice, **{**line, "order": index})
                for index, line in enumerate(lines)
            ]
        )

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        invoice = Invoice.objects.create(**validated_data)
        self._write_lines(invoice, lines)
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        invoice = super().update(instance, validated_data)
        if lines is not None:
            self._write_lines(invoice, lines)
        return invoice


class InvoiceListSerializer(serializers.ModelSerializer):
    """The invoice as a row in a list: enough to find it, not enough to print."""

    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    client_url = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "kind",
            "kind_label",
            "status",
            "status_label",
            "number",
            "issued_on",
            "due_on",
            "to_name",
            "total",
            "client_url",
        )


class ClientInvoiceSerializer(serializers.ModelSerializer):
    """The invoice as the person paying it reads it.

    Narrower than the architect's view on purpose: no status, no id, and
    nothing that would let it be edited from the outside. What is left is the
    document.
    """

    lines = InvoiceLineSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    tax_total = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = (
            "kind",
            "kind_label",
            "number",
            "issued_on",
            "due_on",
            "from_name",
            "from_address",
            "from_gstin",
            "from_phone",
            "from_email",
            "from_bank",
            "to_name",
            "to_address",
            "to_phone",
            "to_email",
            "to_gstin",
            "notes",
            "terms",
            "lines",
            "subtotal",
            "tax_total",
            "total",
            "project_name",
            "logo_url",
        )

    def get_logo_url(self, obj) -> str | None:
        architect = obj.project.architect
        if not architect.logo:
            return None
        return f"/api/i/{obj.access_token}/logo/?v={_logo_version(architect)}"
