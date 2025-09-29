"""
@file __init__.py
@brief Экспорт Celery-приложения для автозагрузки Django.
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
