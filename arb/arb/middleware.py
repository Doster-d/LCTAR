"""
@file middleware.py
@brief Набор пользовательских Django middleware.

Содержит лёгкую CORS-мидлварь, позволяющую фронтенду на localhost
обращаться к API во время разработки без отдельного пакета.
"""

from __future__ import annotations

from django.conf import settings
from django.http import HttpResponse


class SimpleCorsMiddleware:
    """Минимальная поддержка CORS для локальной разработки."""

    def __init__(self, get_response):
        self.get_response = get_response
        origins = getattr(settings, "CORS_ALLOWED_ORIGINS", ())
        self.allowed_origins = {origin.strip() for origin in origins if origin}
        self.allow_credentials = bool(
            getattr(settings, "CORS_ALLOW_CREDENTIALS", False)
        )

    def __call__(self, request):
        origin = request.headers.get("Origin")
        allow_origin = origin in self.allowed_origins if origin else False

        if request.method == "OPTIONS" and allow_origin:
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        if allow_origin:
            response["Access-Control-Allow-Origin"] = origin
            existing_vary = response.get("Vary")
            if existing_vary:
                if "Origin" not in {part.strip() for part in existing_vary.split(",")}:
                    response["Vary"] = f"{existing_vary}, Origin"
            else:
                response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            allow_headers = request.headers.get(
                "Access-Control-Request-Headers", "Authorization, Content-Type"
            )
            response["Access-Control-Allow-Headers"] = allow_headers
            response["Access-Control-Max-Age"] = "86400"
            if self.allow_credentials:
                response["Access-Control-Allow-Credentials"] = "true"

        return response
