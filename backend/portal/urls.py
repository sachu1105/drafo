"""
URLs.

Two namespaces, deliberately not sharing a prefix:

    /api/...       architect, session required
    /api/p/<token> client, token is the credential

Reading this file should make it obvious which side any request is on.
"""

from django.urls import path

from . import views

urlpatterns = [
    # --- architect: auth ---
    path("auth/csrf/", views.CsrfView.as_view(), name="csrf"),
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    # --- architect: projects ---
    path("projects/", views.ProjectListCreateView.as_view(), name="project-list"),
    path(
        "projects/<int:project_id>/",
        views.ProjectDetailView.as_view(),
        name="project-detail",
    ),
    path(
        "projects/<int:project_id>/rotate-token/",
        views.RotateTokenView.as_view(),
        name="project-rotate-token",
    ),
    # --- architect: drawings ---
    path(
        "projects/<int:project_id>/drawing-sets/",
        views.DrawingSetListCreateView.as_view(),
        name="drawing-set-list",
    ),
    path(
        "drawing-sets/<int:set_id>/versions/",
        views.DrawingVersionListCreateView.as_view(),
        name="drawing-version-list",
    ),
    path(
        "drawing-versions/<int:version_id>/comments/",
        views.ArchitectCommentCreateView.as_view(),
        name="architect-comment-create",
    ),
    path(
        "drawing-versions/<int:version_id>/file/",
        views.ArchitectVersionFileView.as_view(),
        name="architect-version-file",
    ),
    path(
        "drawing-versions/<int:version_id>/file/preview/",
        views.ArchitectVersionPreviewView.as_view(),
        name="architect-version-preview",
    ),
    # --- architect: materials ---
    path(
        "projects/<int:project_id>/materials/",
        views.MaterialListCreateView.as_view(),
        name="material-list",
    ),
    path(
        "materials/<int:material_id>/",
        views.MaterialDetailView.as_view(),
        name="material-detail",
    ),
    path(
        "materials/<int:material_id>/photo/",
        views.ArchitectMaterialPhotoView.as_view(),
        name="material-photo",
    ),
    # --- architect: milestones ---
    path(
        "projects/<int:project_id>/milestones/",
        views.MilestoneListCreateView.as_view(),
        name="milestone-list",
    ),
    path(
        "milestones/<int:milestone_id>/",
        views.MilestoneDetailView.as_view(),
        name="milestone-detail",
    ),
    path(
        "practice/<int:architect_id>/logo/",
        views.PracticeLogoView.as_view(),
        name="practice-logo",
    ),
    # --- client: everything below is reachable with the token alone ---
    path("p/<str:token>/", views.ClientProjectView.as_view(), name="client-project"),
    path(
        "p/<str:token>/drawing-sets/<int:set_id>/",
        views.ClientDrawingSetView.as_view(),
        name="client-drawing-set",
    ),
    path(
        "p/<str:token>/versions/<int:version_id>/approve/",
        views.ClientApproveView.as_view(),
        name="client-approve",
    ),
    path(
        "p/<str:token>/versions/<int:version_id>/comments/",
        views.ClientCommentView.as_view(),
        name="client-comment",
    ),
    path(
        "p/<str:token>/materials/",
        views.ClientMaterialsView.as_view(),
        name="client-materials",
    ),
    path(
        "p/<str:token>/materials/<int:material_id>/photo/",
        views.ClientMaterialPhotoView.as_view(),
        name="client-material-photo",
    ),
    path(
        "p/<str:token>/milestones/",
        views.ClientMilestonesView.as_view(),
        name="client-milestones",
    ),
    path(
        "p/<str:token>/files/<int:version_id>/",
        views.ClientFileView.as_view(),
        name="client-file",
    ),
    path(
        "p/<str:token>/files/<int:version_id>/preview/",
        views.ClientFilePreviewView.as_view(),
        name="client-file-preview",
    ),
    path("p/<str:token>/logo/", views.ClientLogoView.as_view(), name="client-logo"),
]
