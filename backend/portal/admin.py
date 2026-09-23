"""
Admin.

This is the support tool for the first six months, not an afterthought. When
an architect phones to say "the link stopped working" or "did she actually
approve it", the answer is found here.

Nobody is let in from here: accounts are live the moment they are created.
Suspending one is the only switch, and it is for abuse, not for a queue.

Approval is registered view-only. Nobody -- not the architect, not support --
edits the record the product exists to defend.
"""

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.db.models import Count

from .models import (
    Approval,
    Architect,
    Comment,
    DrawingSet,
    DrawingVersion,
    Material,
    Milestone,
    Invoice,
    InvoiceLine,
    Project,
    TaxRate,
    Unit,
)


@admin.action(description="Suspend selected accounts (blocks sign-in)")
def suspend_accounts(modeladmin, request, queryset):
    # Never suspend yourself: locking the only superuser out of the admin is
    # not recoverable without a shell on the server.
    count = queryset.exclude(pk=request.user.pk).update(is_active=False)
    messages.warning(request, f"Suspended {count} account(s).")


@admin.register(Architect)
class ArchitectAdmin(UserAdmin):
    """The superadmin view of everyone who has signed up.

    Newest first: the only question this list is usually asked is "who
    signed up, and are they using it".
    """

    ordering = ("-created_at",)
    list_display = (
        "practice_name",
        "email",
        "phone",
        "account_status",
        "email_confirmed",
        "project_count",
        "last_login",
        "created_at",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "card_is_public")
    search_fields = ("practice_name", "full_name", "email", "phone", "card_slug")
    readonly_fields = ("created_at", "last_login", "date_joined", "email_verified_at")
    actions = [suspend_accounts]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_projects=Count("projects"))

    @admin.display(description="Status", ordering="is_active")
    def account_status(self, obj):
        if not obj.is_active:
            return "SUSPENDED"
        return "Superuser" if obj.is_superuser else "Active"

    @admin.display(description="Email", boolean=True, ordering="email_verified_at")
    def email_confirmed(self, obj):
        """Never a gate -- only the answer to "are they getting our mail"."""
        return obj.email_verified

    @admin.display(description="Projects", ordering="_projects")
    def project_count(self, obj):
        return obj._projects

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Person", {"fields": ("full_name", "profession", "bio", "avatar")}),
        ("Practice", {"fields": ("practice_name", "logo")}),
        ("Contact", {"fields": ("phone", "location", "website")}),
        ("Profile card", {"fields": ("cover", "card_slug", "card_is_public")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Dates", {"fields": ("last_login", "date_joined", "created_at", "email_verified_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "practice_name", "password1", "password2"),
            },
        ),
    )


class DrawingSetInline(admin.TabularInline):
    model = DrawingSet
    extra = 0
    fields = ("title", "order")
    show_change_link = True


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 0
    fields = ("order", "title", "amount", "is_paid", "paid_on")


@admin.action(description="Rotate access token (kills the old client link)")
def rotate_access_token(modeladmin, request, queryset):
    for project in queryset:
        project.rotate_token()
    messages.warning(
        request,
        f"{queryset.count()} link(s) rotated. The previous links now 404 - "
        "send the new one to the client.",
    )


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "architect", "client_name", "status", "created_at")
    list_filter = ("status", "architect")
    list_select_related = ("architect",)
    search_fields = ("name", "client_name", "client_email", "address")
    readonly_fields = ("access_token", "client_url", "created_at", "updated_at")
    actions = [rotate_access_token]
    inlines = [DrawingSetInline, MilestoneInline]

    fieldsets = (
        (None, {"fields": ("architect", "name", "status")}),
        ("Client", {"fields": ("client_name", "client_phone", "client_email", "address")}),
        ("Access", {"fields": ("access_token", "client_url")}),
        ("Dates", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="Client link")
    def client_url(self, obj):
        return obj.client_url if obj.pk else "-"


class DrawingVersionInline(admin.TabularInline):
    model = DrawingVersion
    extra = 0
    fields = ("version_number", "file", "file_name", "file_size", "notes", "uploaded_at")
    readonly_fields = ("version_number", "file_name", "file_size", "uploaded_at")
    show_change_link = True

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DrawingSet)
class DrawingSetAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "order", "created_at")
    list_select_related = ("project", "project__architect")
    list_filter = ("project__architect",)
    search_fields = ("title", "project__name", "project__client_name")
    inlines = [DrawingVersionInline]


@admin.register(DrawingVersion)
class DrawingVersionAdmin(admin.ModelAdmin):
    list_display = ("__str__", "version_number", "file_name", "file_size", "uploaded_at")
    list_select_related = ("drawing_set", "drawing_set__project")
    search_fields = ("file_name", "drawing_set__title", "drawing_set__project__name")
    readonly_fields = ("version_number", "file_name", "file_size", "uploaded_at", "preview")

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    """View only. The audit trail is not editable from anywhere, including here."""

    list_display = ("drawing_version", "approved_by_name", "approved_at", "ip_address")
    list_select_related = (
        "drawing_version",
        "drawing_version__drawing_set",
        "drawing_version__drawing_set__project",
    )
    search_fields = (
        "approved_by_name",
        "drawing_version__drawing_set__title",
        "drawing_version__drawing_set__project__name",
    )
    date_hierarchy = "approved_at"
    readonly_fields = (
        "drawing_version",
        "approved_by_name",
        "approved_at",
        "ip_address",
        "user_agent",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("drawing_version", "author_type", "author_name", "created_at")
    list_select_related = ("drawing_version", "drawing_version__drawing_set")
    list_filter = ("author_type",)
    search_fields = ("author_name", "body")


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "brand", "project", "price", "selected_at")
    list_select_related = ("project",)
    list_filter = ("category", "project__architect")
    search_fields = ("name", "brand", "project__name")


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "amount", "is_paid", "paid_on")
    list_select_related = ("project",)
    list_filter = ("is_paid", "project__architect")
    search_fields = ("title", "project__name")


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    """The unit list offered in the materials form.

    Editable here because the trade has a long tail -- per running foot, per
    bag, per brass -- and a list fixed in code means a deploy every time
    somebody needs one. Nothing here constrains what an architect can type:
    `Material.unit` is free text, so this is a set of suggestions.

    Retire a unit by unticking Active rather than deleting it. Deleting is
    allowed, but the materials already priced in that unit keep the words
    either way -- nothing is rewritten.
    """

    list_display = ("label", "order", "is_active")
    list_editable = ("order", "is_active")
    list_display_links = ("label",)
    ordering = ("order", "label")
    search_fields = ("label",)


@admin.register(TaxRate)
class TaxRateAdmin(admin.ModelAdmin):
    """The rates offered when an invoice line is priced.

    Shared by every practice on the install, because a GST slab is the same
    number for all of them. What is *not* shared, and lives on each practice's
    own profile, is their GSTIN and which rate they start at -- registration
    is a fact about a business, not about this server.

    Changing a rate here never restates an invoice already raised: a line
    stores the percentage it was charged at, not a pointer to this table.
    """

    list_display = ("label", "percent", "order", "is_active")
    list_editable = ("percent", "order", "is_active")
    list_display_links = ("label",)
    ordering = ("order", "percent")


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    fields = ("order", "description", "quantity", "unit", "rate", "tax_percent")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    """Support's view of a bill. Read the numbers, do not retype them.

    The billing details on an invoice are a stamp taken the day it was raised,
    not a window onto the practice's profile, so editing them here rewrites a
    document somebody may already have paid against. They are editable because
    a genuine mistake has to be fixable somewhere -- but that is the only
    reason, and it is not a routine thing to do.
    """

    list_display = ("number", "kind", "status", "to_name", "issued_on", "money")
    list_filter = ("kind", "status", "issued_on")
    search_fields = ("number", "to_name", "project__name", "from_name")
    date_hierarchy = "issued_on"
    readonly_fields = ("access_token", "created_at", "updated_at", "money")
    inlines = [InvoiceLineInline]

    @admin.display(description="Total")
    def money(self, obj):
        return obj.total
