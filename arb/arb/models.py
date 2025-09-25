import uuid

from django.db import models
from django.utils import timezone


class User(models.Model):
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


class EmailVerificationToken(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="email_tokens"
    )
    token = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["user"], name="evt_user_idx"),
            models.Index(fields=["token"], name="evt_token_idx"),
            models.Index(fields=["created_at"], name="evt_created_idx"),
            models.Index(fields=["expires_at"], name="evt_expires_idx"),
        ]
