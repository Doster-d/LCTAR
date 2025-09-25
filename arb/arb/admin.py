from django.contrib import admin

from .models import Asset, PromoCode, Session, SessionItemProgress, User, ViewEvent


class SessionItemProgressInline(admin.TabularInline):
    model = SessionItemProgress
    extra = 0
    readonly_fields = ("asset", "viewed_at", "times_viewed")
    can_delete = False
    show_change_link = True


class ViewEventInline(admin.TabularInline):
    model = ViewEvent
    extra = 0
    readonly_fields = ("asset", "event_type", "timestamp", "raw_payload")
    can_delete = False
    show_change_link = True


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "is_verified", "created_at", "total_score")
    search_fields = ("email",)
    list_filter = ("is_verified",)
    readonly_fields = ("created_at", "total_score")


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at", "last_seen", "score", "is_active")
    search_fields = ("id", "user__email")
    list_filter = ("is_active",)
    readonly_fields = ("created_at", "last_seen", "score")
    inlines = [SessionItemProgressInline, ViewEventInline]
    raw_id_fields = ("user",)


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "type", "campaign")
    search_fields = ("slug", "name", "campaign")
    list_filter = ("type", "campaign")


@admin.register(SessionItemProgress)
class SessionItemProgressAdmin(admin.ModelAdmin):
    list_display = ("session", "asset", "viewed_at", "times_viewed")
    search_fields = ("session__id", "asset__slug")
    list_filter = ("asset__type",)
    readonly_fields = ("viewed_at",)


@admin.register(ViewEvent)
class ViewEventAdmin(admin.ModelAdmin):
    list_display = ("session", "asset", "event_type", "timestamp")
    search_fields = ("session__id", "asset__slug", "event_type")
    list_filter = ("event_type",)
    readonly_fields = ("timestamp", "raw_payload")


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "session", "user", "issued_at", "sent_at", "used_at")
    search_fields = ("code", "session__id", "user__email")
    list_filter = ("issued_at", "sent_at", "used_at")
    readonly_fields = ("issued_at", "sent_at", "used_at")
    raw_id_fields = ("session", "user")
