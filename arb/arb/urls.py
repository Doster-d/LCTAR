"""
@file urls.py
@brief Маршруты HTTP API для проекта.

Сопоставляет URL-пути с обработчиками из `views`.
"""

from django.contrib import admin
from django.urls import path

from . import views

urlpatterns = [
    path("api/admin/", admin.site.urls),
    path("api/health/", views.health_check, name="health_check"),
    path("api/session/start/", views.session_start, name="session_start"),
    path("api/view/", views.view_event, name="view_event"),
    path("api/user/email/", views.user_email, name="user_email"),
    path("api/progress/", views.progress, name="progress"),
    path("api/promo/", views.promo, name="promo"),
    path("api/stats/", views.stats, name="stats"),
]
