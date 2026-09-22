"""
Admin.

This is the support tool for the first six months, not an afterthought. When
an architect phones to say "the link stopped working" or "did she actually
approve it", the answer is found here.

Approval is registered view-only. Nobody -- not the architect, not support --
edits the record the product exists to defend.
"""

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.db.models import Count

from .emails import notify_architect_of_approval_of_account

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


@admin.action(description="Approve selected accounts (lets them sign in)")
def approve_accounts(modeladmin, request, queryset):
    pending = list(queryset.filter(is_active=False))
    for architect in pending:
        architect.is_active = True
        architect.save(update_fields=["is_active"])
        notify_architect_of_approval_of_account(architect)
    if pending:
        messages.success(
            request,
            f"Approved {len(pending)} account(s). They have been emailed and "
            "can sign in now.",
        )
    else:
        messages.info(request, "Those accounts were already active.")


@admin.action(description="Suspend selected accounts (blocks sign-in)")
def suspend_accounts(modeladmin, request, queryset):
    # Never suspend yourself: locking the only superuser out of the admin is
    # not recoverable without a shell on the server.
    count = queryset.exclude(pk=request.user.pk).update(is_active=False)
    messages.warning(request, f"Suspended {count} account(s).")


@admin.register(Architect)
class ArchitectAdmin(UserAdmin):
    """The superadmin view of everyone who has signed up.

    Self-registered accounts arrive inactive and appear at the top of this
    list until someone approves them.
    """

    ordering = ("is_active", "-created_at")
    list_display = (
        "practice_name",
        "email",
        "phone",
        "account_status",
        "project_count",
        "last_login",
        "created_at",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "card_is_public")
    search_fields = ("practice_name", "full_name", "email", "phone", "card_slug")
    readonly_fields = ("created_at", "last_login", "date_joined")
    actions = [approve_accounts, suspend_accounts]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_projects=Count("projects"))

    @admin.display(description="Status", ordering="is_active")
    def account_status(self, obj):
        if not obj.is_active:
            return "PENDING APPROVAL"
        return "Superuser" if obj.is_superuser else "Active"

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
        ("Dates", {"fields": ("last_login", "date_joined", "created_at")}),
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
