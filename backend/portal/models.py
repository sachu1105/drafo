"""
Ten models, one app.

The whole product rests on one of them: Approval. A DrawingVersion is
immutable and an Approval is append-only, because the thing being sold is a
record the architect can point at months later: you approved this, on this
date. Anything that lets either be edited destroys the product.
"""

from __future__ import annotations

import secrets
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from .storage import media_storage

TOKEN_BYTES = 32  # secrets.token_urlsafe(TOKEN_BYTES) -> 43 URL-safe characters

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

    # --- billing: who the practice is on an invoice ---
    # Separate from `location` and `phone` above, which are the contact
    # details on a profile card. A registered address on a tax invoice is a
    # legal statement and is often not the studio people visit, so asking one
    # field to be both would put the wrong one on the document.
    gstin = models.CharField("GSTIN", max_length=20, blank=True)
    billing_address = models.TextField(blank=True)
    # Four lines in whatever shape the bank uses. Parsing it buys nothing --
    # nobody sorts invoices by IFSC -- and every attempt gets some bank wrong.
    bank_details = models.TextField(blank=True)
    # What a new invoice starts at. Per practice because GST applicability is
    # a fact about the business, not about this install.
    default_tax_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    invoice_terms = models.TextField(blank=True)

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
    # Pictures live in MaterialPhoto below, not here: a material is rarely one
    # photograph, and a single field made the architect choose which one the
    # client would see.
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

class MaterialPhoto(models.Model):
    """One picture of a material. A selection almost always needs several.

    A tile is a colour, a finish, an edge, and how it reads laid out over a
    whole floor -- and one photograph answers about one of those. The single
    `photo` field this replaced forced the architect to pick which of the four
    the client would get to see, and the client to decide from it.

    Ordered explicitly rather than by upload time, because the first one is
    the one that ends up as the thumbnail in the list, and which picture
    represents a material is a decision worth being able to make.
    """

    material = models.ForeignKey(
        Material, on_delete=models.CASCADE, related_name="photos"
    )
    image = models.ImageField(upload_to="materials/%Y/%m/", storage=media_storage)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("order", "id")

    def __str__(self) -> str:
        return f"{self.material.name} ({self.order + 1})"

class Unit(models.Model):
    """How a material's price is quoted: per sq ft, per bag, lump sum.

    A row in a table rather than TextChoices in the code, because this trade
    has a long tail of local units -- per running foot, per brass, per truck
    -- and a list fixed in Python means a deploy every time somebody needs one
    of them. These are editable in the admin.

    `Material.unit` is still free text and is not a foreign key to this. The
    list is a set of suggestions, not a constraint: an architect typing a unit
    nobody anticipated must never be stopped, and deactivating a unit here
    must never rewrite what is already recorded against a material.
    """

    label = models.CharField(max_length=40, unique=True)
    order = models.PositiveIntegerField(
        default=0, help_text="Lower numbers come first in the list."
    )
    # Retired rather than deleted: a unit that stops being offered should not
    # vanish from the materials already priced in it.
    is_active = models.BooleanField(
        default=True, help_text="Untick to stop offering this without losing it."
    )

    class Meta:
        ordering = ("order", "label")

    def __str__(self) -> str:
        return self.label



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


class TaxRate(models.Model):
    """A rate an invoice line can be charged at. Editable in the admin.

    A table rather than a constant, for the same reason Unit is one: GST slabs
    move, a practice may need a rate nobody anticipated, and a number fixed in
    Python means a deploy to change it.

    The rate is never a foreign key from a line. `InvoiceLine.tax_percent`
    stores the number, so an invoice raised at 18% still says 18% after the
    slab changes. An invoice is a record of what was charged, not a live view
    of the current rate card.
    """

    label = models.CharField(max_length=40, help_text="Shown in the dropdown, e.g. GST 18%.")
    percent = models.DecimalField(max_digits=5, decimal_places=2)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(
        default=True, help_text="Untick to stop offering this without losing it."
    )

    class Meta:
        ordering = ("order", "percent")

    def __str__(self) -> str:
        return self.label


class Invoice(models.Model):
    """A bill, or an estimate of one, for a project.

    One model for both, because they are the same document: the same lines,
    the same totals, the same client. What differs is the heading, the number
    series and whether anybody owes anything yet. An accepted estimate becomes
    an invoice by `convert()`, which keeps its lines and gives it a number in
    the other series -- retyping an accepted quotation is how figures drift.

    Nearly every field here is a copy of something that lives elsewhere: the
    practice name, its address and GSTIN, the client's details. That is on
    purpose and is the whole point of the model. An invoice is a record of
    what was sent on a particular day. If it rendered from the live profile,
    then changing a billing address next year would silently rewrite every
    invoice ever issued -- including the ones a client has already paid and
    filed. So the details are stamped in at issue and never move again.
    """

    class Kind(models.TextChoices):
        ESTIMATE = "estimate", "Estimate"
        INVOICE = "invoice", "Invoice"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        PAID = "paid", "Paid"
        CANCELLED = "cancelled", "Cancelled"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="invoices"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.INVOICE)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.DRAFT
    )
    # Its own credential, not the project's. An architect sending one bill
    # should not have to hand over the drawings to do it.
    access_token = models.CharField(max_length=64, unique=True, db_index=True)
    number = models.CharField(max_length=30)

    issued_on = models.DateField()
    due_on = models.DateField(null=True, blank=True)

    # --- who is billing: stamped from the practice at issue ---
    from_name = models.CharField(max_length=120)
    from_address = models.TextField(blank=True)
    from_gstin = models.CharField(max_length=20, blank=True)
    from_phone = models.CharField(max_length=20, blank=True)
    from_email = models.EmailField(blank=True)
    # Where the money goes. Free text because a bank block is four lines in
    # whatever shape the bank uses, and parsing it buys nothing.
    from_bank = models.TextField(blank=True)

    # --- who is billed: stamped from the project at issue ---
    to_name = models.CharField(max_length=120)
    to_address = models.TextField(blank=True)
    to_phone = models.CharField(max_length=20, blank=True)
    to_email = models.EmailField(blank=True)
    to_gstin = models.CharField(max_length=20, blank=True)

    notes = models.TextField(blank=True)
    terms = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-issued_on", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("project", "kind", "number"), name="unique_number_per_series"
            )
        ]

    def __str__(self) -> str:
        return f"{self.number} ({self.get_kind_display()})"

    def save(self, *args, **kwargs):
        if not self.access_token:
            self.access_token = secrets.token_urlsafe(32)
        if not self.number:
            self.number = self.next_number(self.project.architect, self.kind)
        super().save(*args, **kwargs)

    @staticmethod
    def next_number(architect, kind: str) -> str:
        """The next number in this practice's series for this kind.

        Per practice, not per project: a client asking "which invoice is this"
        must get an answer unique across the whole business, and a series that
        restarts at 001 for every project is not one.
        """
        prefix = "EST" if kind == Invoice.Kind.ESTIMATE else "INV"
        taken = Invoice.objects.filter(
            project__architect=architect, kind=kind, number__startswith=f"{prefix}-"
        ).values_list("number", flat=True)
        highest = 0
        for number in taken:
            tail = number.rsplit("-", 1)[-1]
            if tail.isdigit():
                highest = max(highest, int(tail))
        return f"{prefix}-{highest + 1:04d}"

    # --- money -----------------------------------------------------------
    #
    # Summed from the lines every time rather than stored. A stored total that
    # disagrees with its own lines is the worst thing an invoice can do, and
    # the only way to guarantee it cannot happen is to have nowhere to store
    # the disagreement.

    @property
    def subtotal(self) -> Decimal:
        return sum((line.amount for line in self.lines.all()), Decimal("0.00"))

    @property
    def tax_total(self) -> Decimal:
        return sum((line.tax_amount for line in self.lines.all()), Decimal("0.00"))

    @property
    def total(self) -> Decimal:
        return self.subtotal + self.tax_total

    @property
    def client_url(self) -> str:
        return f"{settings.PUBLIC_BASE_URL}/i/{self.access_token}"

    def convert_to_invoice(self) -> "Invoice":
        """Turn an accepted estimate into the bill for it.

        A new document rather than a change of kind on this one: the client
        was sent an estimate at a URL, and that URL has to keep showing the
        estimate they agreed to. The two are linked only by their lines being
        the same words and figures.
        """
        if self.kind != Invoice.Kind.ESTIMATE:
            raise ValueError("Only an estimate can be converted.")

        lines = list(self.lines.all())
        self.pk = None
        self.id = None
        self.kind = Invoice.Kind.INVOICE
        self.status = Invoice.Status.DRAFT
        self.number = ""
        self.access_token = ""
        self.issued_on = timezone.localdate()
        self.save()

        InvoiceLine.objects.bulk_create(
            [
                InvoiceLine(
                    invoice=self,
                    description=line.description,
                    quantity=line.quantity,
                    unit=line.unit,
                    rate=line.rate,
                    tax_percent=line.tax_percent,
                    order=line.order,
                    milestone=line.milestone,
                    material=line.material,
                )
                for line in lines
            ]
        )
        return self


class InvoiceLine(models.Model):
    """One row of an invoice.

    The description, quantity and rate are the invoice's own words, not a
    window onto the milestone or material they were taken from. `milestone`
    and `material` record where a line came from -- enough to warn that a
    stage has already been billed -- but correcting a figure on an invoice
    must never reach back and rewrite the project it was drawn from.
    """

    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name="lines"
    )
    description = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1"))
    unit = models.CharField(max_length=40, blank=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    tax_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0")
    )
    order = models.PositiveIntegerField(default=0)

    # Where this line came from, if it came from anywhere. SET_NULL because
    # deleting a milestone must not delete the invoice that billed for it.
    milestone = models.ForeignKey(
        "Milestone", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    material = models.ForeignKey(
        "Material", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.description

    @property
    def amount(self) -> Decimal:
        return (self.quantity * self.rate).quantize(Decimal("0.01"))

    @property
    def tax_amount(self) -> Decimal:
        return (self.amount * self.tax_percent / Decimal("100")).quantize(
            Decimal("0.01")
        )

    @property
    def total(self) -> Decimal:
        return self.amount + self.tax_amount
