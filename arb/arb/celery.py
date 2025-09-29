"""
@file celery.py
@brief Инициализация Celery-приложения.

Создаёт экземпляр `Celery`, загружает конфигурацию из Django settings
по пространству имён `CELERY` и включает автопоиск задач.
"""

from __future__ import annotations

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "arb.settings")

app = Celery("arb")

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):  # pragma: no cover
    pass
