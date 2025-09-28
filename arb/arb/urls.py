"""
URL configuration for arb project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
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
