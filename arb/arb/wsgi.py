"""
@file wsgi.py
@brief Точка входа WSGI для проекта.

Провайдер `application` для WSGI-серверов (gunicorn, uWSGI).
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "arb.settings")

application = get_wsgi_application()
