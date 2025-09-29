"""
@file models.py
@brief Модели данных для бэкенда MVP.

Описывает основные сущности: пользователя, сессию, актив (контент),
прогресс просмотра, событийный лог и промокод. Для ключевых полей заданы
индексы для эффективных выборок в основных сценариях.
"""

import uuid

from django.db import models
from django.utils import timezone


class User(models.Model):
    """
    @brief Пользователь платформы.

    @details Хранит адрес электронной почты, признаки верификации и
    агрегированную метрику «общий балл» на основе уникальных просмотров.

    @ivar id: UUID первичный ключ
    @ivar email: Электронная почта (уникальная)
    @ivar is_verified: Признак верификации пользователя
    @ivar verified_at: Время подтверждения почты (если подтверждена)
    @ivar created_at: Время создания записи
    @ivar total_score: Суммарный балл пользователя
    @ivar metadata: Произвольные метаданные в формате JSON
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    total_score = models.IntegerField(default=0)
    metadata = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=["email"], name="user_email_idx"),
            models.Index(
                fields=["is_verified", "created_at"], name="user_verified_created_idx"
            ),
        ]


class Session(models.Model):
    """
    @brief Сессия взаимодействия.

    @details Отражает анонимное или связанное с пользователем посещение.
    Накопительный балл сессии используется для мотивационных механик.

    @ivar id: UUID первичный ключ
    @ivar user: Ссылка на `User` (может отсутствовать)
    @ivar created_at: Время создания сессии
    @ivar last_seen: Последняя активность в сессии
    @ivar score: Накопленные очки в рамках сессии
    @ivar pending_email: Почта, привязанная позже, до связывания с пользователем
    @ivar is_active: Признак активности сессии
    @ivar metadata: Произвольные метаданные в формате JSON
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="sessions"
    )
    created_at = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now)
    score = models.IntegerField(default=0)
    pending_email = models.EmailField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=["user"], name="session_user_idx"),
            models.Index(
                fields=["is_active", "last_seen"], name="session_active_lastseen_idx"
            ),
            models.Index(fields=["created_at"], name="session_created_idx"),
        ]


class Asset(models.Model):
    """
    @brief Описатель единицы контента (актива).

    @ivar id: Целочисленный первичный ключ
    @ivar slug: Уникальный идентификатор актива (slug)
    @ivar name: Человекочитаемое название
    @ivar type: Тип актива (категория)
    @ivar campaign: Кампания/пул, к которому относится актив
    @ivar meta: Произвольные метаданные в формате JSON
    """

    id = models.AutoField(primary_key=True)
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50)
    campaign = models.CharField(max_length=100, default="default")
    meta = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=["slug"], name="asset_slug_idx"),
            models.Index(fields=["campaign", "type"], name="asset_campaign_type_idx"),
        ]


class SessionItemProgress(models.Model):
    """
    @brief Прогресс просмотра конкретного актива в рамках сессии.

    @ivar id: Целочисленный первичный ключ
    @ivar session: Ссылка на `Session`
    @ivar asset: Ссылка на `Asset`
    @ivar viewed_at: Время первого просмотра
    @ivar times_viewed: Количество просмотров данного актива
    """

    id = models.AutoField(primary_key=True)
    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name="item_progress"
    )
    asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, related_name="session_progress"
    )
    viewed_at = models.DateTimeField(null=True, blank=True)
    times_viewed = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["session", "asset"], name="u_session_asset_progress"
            ),
        ]
        indexes = [
            models.Index(fields=["session"], name="sip_session_idx"),
            models.Index(fields=["asset"], name="sip_asset_idx"),
        ]


class ViewEvent(models.Model):
    """
    @brief Событие взаимодействия пользователя с системой.

    @details Хранит тип события, временную метку и «сырой» полезный груз
    (payload) для последующей аналитики.

    @ivar id: Целочисленный первичный ключ
    @ivar session: Ссылка на `Session`
    @ivar asset: Ссылка на `Asset` (может отсутствовать для общих событий)
    @ivar event_type: Тип события (например, viewed_asset)
    @ivar timestamp: Время возникновения события
    @ivar raw_payload: Оригинальные данные события (JSON)
    @ivar processed: Флаг обработки события downstream-процессом
    """

    id = models.AutoField(primary_key=True)
    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name="events"
    )
    asset = models.ForeignKey(
        Asset, null=True, blank=True, on_delete=models.SET_NULL, related_name="events"
    )
    event_type = models.CharField(max_length=50, default="viewed_asset")
    timestamp = models.DateTimeField(default=timezone.now)
    raw_payload = models.JSONField()
    processed = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["session", "timestamp"], name="ve_session_ts_idx"),
            models.Index(fields=["asset"], name="ve_asset_idx"),
            models.Index(fields=["event_type"], name="ve_event_type_idx"),
        ]


class PromoCode(models.Model):
    """
    @brief Промокод, выдаваемый за завершение сценария.

    @details Может быть привязан к сессии и/или пользователю; хранит
    статус выдачи, отправки и использования.

    @ivar id: Целочисленный первичный ключ
    @ivar code: Уникальный код промо
    @ivar session: Ссылка на `Session` (может отсутствовать)
    @ivar user: Ссылка на `User` (может отсутствовать)
    @ivar email: Электронная почта получателя
    @ivar issued_at: Время генерации промокода
    @ivar sent_at: Время отправки промокода по email
    @ivar used_at: Время использования промокода
    @ivar meta: Дополнительные данные в формате JSON
    """

    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=128, unique=True)
    session = models.ForeignKey(
        Session,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="promo_codes",
    )
    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="promo_codes",
    )
    email = models.EmailField(null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    meta = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=["code"], name="promocode_code_idx"),
            models.Index(fields=["email"], name="promocode_email_idx"),
            models.Index(fields=["issued_at"], name="promocode_issued_idx"),
            models.Index(fields=["used_at"], name="promocode_used_idx"),
        ]
