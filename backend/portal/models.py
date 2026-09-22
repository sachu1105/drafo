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

from .storage import media_storage

TOKEN_BYTES = 32  # secrets.token_urlsafe(32) -> 43 URL-safe characters


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
    practice_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, blank=True)
    logo = models.ImageField(
        upload_to="logos/", storage=media_storage, null=True, blank=True
    )
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
