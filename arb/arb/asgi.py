"""
@file asgi.py
@brief Точка входа ASGI для проекта.

Провайдер `application` для ASGI-серверов (Uvicorn, Daphne).
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "arb.settings")

application = get_asgi_application()
