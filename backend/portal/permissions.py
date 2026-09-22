"""
Two authentication paths that never meet.

The architect has a session. The client has nothing at all -- no account, no
cookie, no signup -- only a long unguessable token sitting in the URL they were
sent on WhatsApp. Resolving that token is the entire client-side auth system.

A token that does not resolve gets a 404, never a 403: a wrong token must not
confirm that a project exists.
"""

from __future__ import annotations

from django.http import Http404
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Project

MIN_TOKEN_LENGTH = 32


class HasProjectToken(BasePermission):
    """Resolve `token` from the URL onto `request.project`.

    Attaches the project to both the request and the view so downstream code
    never has to look the token up a second time, and never has to log it.
    """

    def has_permission(self, request, view) -> bool:
        token = view.kwargs.get("token") or ""
        if len(token) < MIN_TOKEN_LENGTH:
            raise Http404
        project = (
            Project.objects.select_related("architect")
            .filter(access_token=token)
            .first()
        )
        if project is None:
            raise Http404
        request.project = project
        view.project = project
        return True


class IsProjectArchitect(BasePermission):
    """Object-level guard for architect endpoints.

    Querysets are already filtered by `request.user`; this is the second lock
    on the same door, for the case where a future view forgets the first.
    """

    def has_object_permission(self, request, view, obj) -> bool:
        architect = getattr(obj, "architect", None)
        if architect is None:
            project = getattr(obj, "project", None)
            architect = getattr(project, "architect", None)
        return bool(architect and architect == request.user)


class ReadOnly(BasePermission):
    def has_permission(self, request, view) -> bool:
        return request.method in SAFE_METHODS
