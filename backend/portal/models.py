"""
Seven models, one app.

The whole product rests on one of them: Approval. A DrawingVersion is
immutable and an Approval is append-only, because the thing being sold is a
record the architect can point at months later: you approved this, on this
date. Anything that lets either be edited destroys the product.
"""

from __future__ import annotations

import secrets

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.text import slugify

from .storage import media_storage

TOKEN_BYTES = 32  # secrets.token_urlsafe(32) -> 43 URL-safe characters

# A card slug becomes a top-level path, /c/<slug>, so it must never be able to
# collide with a route the frontend already owns.
RESERVED_SLUGS = frozenset(
    {
        "admin",
        "api",
        "c",
        "card",
        "django-admin",
        "login",
        "logout",
        "me",
        "new",
        "p",
        "privacy",
        "profile",
        "projects",
        "register",
        "settings",
        "static",
        "support",
        "terms",
        "_next",
    }
)


class ArchitectManager(BaseUserManager):
    """Email is the login; there is no username."""

    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra.get("is_staff") is not True or extra.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_staff and is_superuser set.")
        return self._create(email, password, **extra)


class Architect(AbstractUser):
    username = None
    first_name = None
    last_name = None

    email = models.EmailField("email address", unique=True)

    # --- the practice: the letterhead above every page a client opens ---
    practice_name = models.CharField(max_length=120)
    logo = models.ImageField(
        upload_to="logos/", storage=media_storage, null=True, blank=True
    )

    # --- the person: who the client is actually dealing with ---
    # Separate from practice_name on purpose. A one-person studio types the
    # same words into both, but a practice with three architects does not, and
    # the client needs a human name to put against a drawing.
    full_name = models.CharField(max_length=120, blank=True)
    profession = models.CharField(max_length=120, blank=True)
    bio = models.TextField(max_length=600, blank=True)
    avatar = models.ImageField(
        upload_to="avatars/", storage=media_storage, null=True, blank=True
    )
    # The band across the top of the card. Deliberately not the logo: a logo
    # is a mark that has to stay legible small and on its own, a cover is a
    # photograph that gets cropped to a strip. Asking one file to be both is
    # what makes a wordmark come out as a smear.
    cover = models.ImageField(
        upload_to="covers/", storage=media_storage, null=True, blank=True
    )

    # --- contact ---
    phone = models.CharField(max_length=20, blank=True)
    location = models.CharField(max_length=120, blank=True)
    website = models.URLField(max_length=200, blank=True)

    # --- the shareable card ---
    # Off until asked for. Everything else in this product is reachable only
    # by an unguessable token, so a page anyone can open is an explicit,
    # deliberate act, never a default.
    card_slug = models.SlugField(max_length=40, unique=True, null=True, blank=True)
    card_is_public = models.BooleanField(default=False)

    # Set the moment they click the link we email them. Nothing in the
    # product is gated on it: an unverified account works exactly like a
    # verified one. It exists so that a typo'd address is discoverable
    # before it matters -- every notification this product sends goes to
    # this address, and an architect who never receives one has no way of
    # knowing the address was wrong.
    email_verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["practice_name"]

    objects = ArchitectManager()

    class Meta:
        verbose_name = "architect"
        verbose_name_plural = "architects"
        ordering = ("practice_name", "email")

    def __str__(self) -> str:
        return self.practice_name or self.email

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def display_name(self) -> str:
        """The human to put against a drawing, falling back to the practice."""
        return self.full_name or self.practice_name

    @property
    def card_url(self) -> str | None:
        if not self.card_slug:
            return None
        return f"{settings.PUBLIC_BASE_URL}/c/{self.card_slug}"

    def assign_card_slug(self) -> str:
        """Give this account a card slug, derived from whatever name it has.

        Only ever called when there is none: the slug is a published URL the
        moment the card goes public, and silently rewriting it as the name
        changes would break every card already handed out.
        """
        base = slugify(self.full_name or self.practice_name)[:32].strip("-")
        if not base or base in RESERVED_SLUGS:
            base = f"{base or 'studio'}-studio"[:32].strip("-")

        candidate = base
        suffix = 2
        model = type(self)
        while (
            candidate in RESERVED_SLUGS
            or model.objects.filter(card_slug=candidate).exclude(pk=self.pk).exists()
        ):
            tail = f"-{suffix}"
            candidate = f"{base[: 32 - len(tail)]}{tail}"
            suffix += 1
        self.card_slug = candidate
        return candidate

    def save(self, *args, **kwargs):
        if not self.card_slug:
            self.assign_card_slug()
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = list(update_fields) + ["card_slug"]
        super().save(*args, **kwargs)


class Project(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_HOLD = "on_hold", "On hold"
        COMPLETED = "completed", "Completed"

    architect = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=160)
    client_name = models.CharField(max_length=120)
    client_phone = models.CharField(max_length=20, blank=True)
    client_email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    access_token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.access_token:
            self.access_token = secrets.token_urlsafe(TOKEN_BYTES)
        super().save(*args, **kwargs)

    def rotate_token(self) -> str:
        """Kill a leaked link. The old URL 404s immediately afterwards."""
        self.access_token = secrets.token_urlsafe(TOKEN_BYTES)
        self.save(update_fields=["access_token", "updated_at"])
        return self.access_token

    @property
    def client_url(self) -> str:
        return f"{settings.PUBLIC_BASE_URL}/p/{self.access_token}"


class DrawingSet(models.Model):
    """One logical drawing, across all of its revisions."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="drawing_sets"
    )
    title = models.CharField(max_length=160)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("order", "created_at")

    def __str__(self) -> str:
        return self.title

    @property
    def current_version(self):
        return self.versions.first()  # ordering is ("-version_number",)


class DrawingVersion(models.Model):
    """Immutable. Never updated, never deleted. This is the audit trail."""

    drawing_set = models.ForeignKey(
        DrawingSet, on_delete=models.CASCADE, related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to="drawings/%Y/%m/", storage=media_storage)
    preview = models.ImageField(
        upload_to="previews/%Y/%m/", storage=media_storage, null=True, blank=True
    )
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    notes = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("drawing_set", "version_number"),)
        ordering = ("-version_number",)

    def __str__(self) -> str:
        return f"{self.drawing_set.title} v{self.version_number}"

    @property
    def is_pdf(self) -> bool:
        return self.file_name.lower().endswith(".pdf")

    @property
    def approval(self):
        return self.approvals.first()


class Approval(models.Model):
    """The single most important table in the product. Append-only, forever."""

    drawing_version = models.ForeignKey(
        DrawingVersion, on_delete=models.CASCADE, related_name="approvals"
    )
    approved_by_name = models.CharField(max_length=120)
    approved_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ("-approved_at",)

    def __str__(self) -> str:
        return f"{self.approved_by_name} approved {self.drawing_version}"


class Comment(models.Model):
    class AuthorType(models.TextChoices):
        ARCHITECT = "architect", "Architect"
        CLIENT = "client", "Client"

    drawing_version = models.ForeignKey(
        DrawingVersion, on_delete=models.CASCADE, related_name="comments"
    )
    author_type = models.CharField(max_length=16, choices=AuthorType.choices)
    author_name = models.CharField(max_length=120)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.author_name}: {self.body[:40]}"


class Material(models.Model):
    class Category(models.TextChoices):
        FLOORING = "flooring", "Flooring"
        SANITARY = "sanitary", "Sanitary"
        ELECTRICAL = "electrical", "Electrical"
        PAINT = "paint", "Paint"
        JOINERY = "joinery", "Joinery"
        HARDWARE = "hardware", "Hardware"
        FURNITURE = "furniture", "Furniture"
        OTHER = "other", "Other"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="materials"
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    name = models.CharField(max_length=200)
    brand = models.CharField(max_length=120, blank=True)
    photo = models.ImageField(
        upload_to="materials/%Y/%m/", storage=media_storage, null=True, blank=True
    )
    # The paperwork behind the price. Separate from the photo because they
    # answer different questions: the photo is what the tile looks like, the
    # invoice is what was actually paid for it, and a year later the second
    # one is the one being looked for.
    invoice = models.FileField(
        upload_to="invoices/%Y/%m/", storage=media_storage, null=True, blank=True
    )
    invoice_name = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    unit = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    selected_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("category", "name")

    def __str__(self) -> str:
        return self.name


class Milestone(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="milestones"
    )
    title = models.CharField(max_length=160)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    order = models.PositiveIntegerField(default=0)
    is_paid = models.BooleanField(default=False)
    paid_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("order", "created_at")

    def __str__(self) -> str:
        return self.title
