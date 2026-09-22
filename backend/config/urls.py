from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # Mounted at /django-admin/ rather than /admin/ so it matches the path the
    # frontend proxies it under. Django builds its own links from this mount
    # point, so if the two disagree the index page loads and every link on it
    # 404s.
    path("django-admin/", admin.site.urls),
    path("api/", include("portal.urls")),
]

admin.site.site_header = "Atelier"
admin.site.site_title = "Atelier"
admin.site.index_title = "Support console"
