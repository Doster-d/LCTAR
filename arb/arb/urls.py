"""
@file urls.py
@brief Маршруты HTTP API для проекта.

Сопоставляет URL-пути с обработчиками из `views`.
"""

from django.contrib import admin
from django.urls import path

from . import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", views.health_check, name="health_check"),
    path("session/start/", views.session_start, name="session_start"),
    path("view/", views.view_event, name="view_event"),
    path("user/email/", views.user_email, name="user_email"),
    path("progress/", views.progress, name="progress"),
    path("promo/", views.promo, name="promo"),
    path("stats/", views.stats, name="stats"),
]
