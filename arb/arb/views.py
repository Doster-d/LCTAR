"""
@file views.py
@brief Публичные API-обработчики и бизнес-логика MVP.

Содержит представления (DRF function-based views) для старта сессии,
регистрации событий просмотра, привязки email, получения прогресса,
выдачи промокодов и сводных статистик. Вспомогательные функции
инкапсулируют вычисление очков и условий выдачи промокода.
"""

import logging

from django.conf import settings
from django.db.models import Count, OuterRef, Subquery
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import (
    Asset,
    PromoCode,
    Session,
    SessionItemProgress,
    User,
    ViewEvent,
)
from .tasks import send_promocode_email

logger = logging.getLogger(__name__)

FIRST_VIEW_POINTS = 10


def health_check(_request):
    """
    @brief Простой health-check.

    @param _request: HTTP-запрос
    @return Текстовое сообщение из конфигурации `HEALTH_MESSAGE`.
    """
    return HttpResponse(
        settings.HEALTH_MESSAGE,
        content_type="text/plain",
    )


def _compute_session_viewed_count(session: Session) -> int:
    """
    @brief Количество просмотренных (хотя бы один раз) активов в сессии.

    @param session: Объект `Session`
    @return Число уникальных активов с `times_viewed > 0`.
    """
    return (
        SessionItemProgress.objects.filter(session=session, times_viewed__gt=0)
        .only("id")
        .count()
    )


def _compute_user_total_score(user: User) -> int:
    """
    @brief Пересчёт общего балла пользователя.

    @details Суммирует уникальные активы, просмотренные в любых сессиях
    пользователя, и умножает на константу `FIRST_VIEW_POINTS`.

    @param user: Объект `User`
    @return Число очков.
    """
    unique_viewed_assets = (
        SessionItemProgress.objects.filter(session__user=user, times_viewed__gt=0)
        .values_list("asset_id", flat=True)
        .distinct()
        .count()
    )
    return unique_viewed_assets * FIRST_VIEW_POINTS


def _issue_promocode_if_completed(session: Session, return_existing: bool = True):
    """
    @brief Выдаёт промокод, если сессия просмотрела все активы.

    @param session: Объект `Session`
    @param return_existing: Возвращать ли ранее неиспользованный промокод
    @return Код промо или None.
    """
    total_assets = Asset.objects.count()
    if total_assets == 0:
        return None
    viewed = _compute_session_viewed_count(session)
    if viewed < total_assets:
        return None
    existing = session.promo_codes.filter(used_at__isnull=True).first()
    if existing:
        if return_existing:
            ViewEvent.objects.create(
                session=session,
                asset=None,
                event_type="promo_issued",
                raw_payload={"code": existing.code, "existing": True},
            )
            return existing.code
        return None
    code = f"PROMO-{session.id.hex[:8].upper()}-{timezone.now().strftime('%H%M%S')}"
    promo = PromoCode.objects.create(
        code=code,
        session=session,
        user=session.user if session.user_id else None,
        email=(session.user.email if session.user_id else session.pending_email),
        issued_at=timezone.now(),
    )
    ViewEvent.objects.create(
        session=session,
        asset=None,
        event_type="promo_issued",
        raw_payload={"code": promo.code, "existing": False},
    )
    return promo.code


@api_view(["POST"])
def session_start(request):  # noqa: ARG001
    """
    @brief Создаёт новую сессию и логирует событие старта.

    @param request: HTTP-запрос без тела
    @return Идентификатор созданной сессии.
    """
    session = Session.objects.create(last_seen=timezone.now(), is_active=True)
    ViewEvent.objects.create(
        session=session,
        asset=None,
        event_type="session_started",
        raw_payload={"event": "session_started"},
    )
    return Response({"session_id": str(session.id)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def view_event(request):
    """
    @brief Регистрирует просмотр актива и начисляет очки за первый просмотр.

    @param request: JSON с полями `session_id`, `asset_slug` и доп. payload
    @return Информация о начисленных очках и текущем счёте сессии.
    """
    session_id = request.data.get("session_id")
    asset_slug = request.data.get("asset_slug")
    if not session_id or not asset_slug:
        return Response(
            {"detail": "session_id and asset_slug are required"}, status=400
        )
    session = get_object_or_404(Session, id=session_id)
    asset = get_object_or_404(Asset, slug=asset_slug)
    ViewEvent.objects.create(
        session=session,
        asset=asset,
        raw_payload=request.data,
    )
    sip, created = SessionItemProgress.objects.get_or_create(
        session=session, asset=asset
    )
    awarded_points = 0
    if sip.times_viewed == 0:
        sip.viewed_at = timezone.now()
        awarded_points = FIRST_VIEW_POINTS
        session.score = session.score + FIRST_VIEW_POINTS
        ViewEvent.objects.create(
            session=session,
            asset=asset,
            event_type="first_view_awarded",
            raw_payload={
                "asset_slug": asset.slug,
                "awarded_points": FIRST_VIEW_POINTS,
            },
        )
    sip.times_viewed = sip.times_viewed + 1
    sip.save()
    session.last_seen = timezone.now()
    session.save(update_fields=["score", "last_seen"])
    promo_code = _issue_promocode_if_completed(session, return_existing=False)
    payload = {
        "session_id": str(session.id),
        "asset_slug": asset.slug,
        "awarded_points": awarded_points,
        "session_score": session.score,
    }
    if promo_code:
        payload["promo_code"] = promo_code
    return Response(payload, status=status.HTTP_200_OK)


@api_view(["POST"])
def user_email(request):
    """
    @brief Привязывает email к сессии и пользователю, пересчитывает баллы.

    @param request: JSON с полями `session_id`, `email`
    @return Данные пользователя и его суммарный балл.
    """
    session_id = request.data.get("session_id")
    email = request.data.get("email")
    if not session_id or not email:
        return Response({"detail": "session_id and email are required"}, status=400)
    session = get_object_or_404(Session, id=session_id)
    user, _ = User.objects.get_or_create(email=email)
    session.user = user
    session.pending_email = email
    session.last_seen = timezone.now()
    session.save(update_fields=["user", "pending_email", "last_seen"])
    ViewEvent.objects.create(
        session=session,
        asset=None,
        event_type="email_submitted",
        raw_payload={"email": email},
    )
    user.total_score = _compute_user_total_score(user)
    user.save(update_fields=["total_score"])
    promo_code = _issue_promocode_if_completed(session)
    if promo_code:
        PromoCode.objects.filter(code=promo_code).update(user=user, email=email)
        try:
            send_promocode_email.delay(promo_code)
        except Exception:  # noqa: BLE001
            logger.exception("Как оно вообще тут упало? Увольте бэкэндера")
    return Response(
        {
            "session_id": str(session.id),
            "user_id": str(user.id),
            "email": user.email,
            "user_total_score": user.total_score,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
def progress(request):
    """
    @brief Возвращает прогресс по сессии или пользователю.

    @param request: Query `session_id` или `user_id`
    @return Общее число активов, просмотренные и оставшиеся, и очки.
    """
    session_id = request.query_params.get("session_id")
    user_id = request.query_params.get("user_id")
    if not session_id and not user_id:
        return Response({"detail": "session_id or user_id is required"}, status=400)
    total_assets = Asset.objects.count()
    if session_id:
        session = get_object_or_404(Session, id=session_id)
        viewed_assets = _compute_session_viewed_count(session)
        payload = {
            "total_assets": total_assets,
            "viewed_assets": viewed_assets,
            "remaining_assets": max(total_assets - viewed_assets, 0),
            "total_score": session.score,
        }
        ViewEvent.objects.create(
            session=session,
            asset=None,
            event_type="progress_viewed",
            raw_payload=payload,
        )
        return Response(payload)
    user = get_object_or_404(User, id=user_id)
    user_score = _compute_user_total_score(user)
    if user.total_score != user_score:
        user.total_score = user_score
        user.save(update_fields=["total_score"])
    viewed_assets = (
        SessionItemProgress.objects.filter(session__user=user, times_viewed__gt=0)
        .values_list("asset_id", flat=True)
        .distinct()
        .count()
    )
    return Response(
        {
            "total_assets": total_assets,
            "viewed_assets": viewed_assets,
            "remaining_assets": max(total_assets - viewed_assets, 0),
            "total_score": user.total_score,
        }
    )


@api_view(["GET"])
def promo(request):
    """
    @brief Возвращает активный промокод для пользователя/сессии, если он есть.

    @param request: Query `session_id` или `user_id` или `email`
    @return JSON с `promo_code` либо 404, если условия не выполнены.
    """
    session_id = request.query_params.get("session_id")
    user_id = request.query_params.get("user_id")
    email = request.query_params.get("email")

    if not any([session_id, user_id, email]):
        return Response(
            {"detail": "session_id or user_id or email is required"}, status=400
        )

    user = None
    session = None

    if session_id:
        session = get_object_or_404(Session, id=session_id)
        user = session.user
    elif user_id:
        user = get_object_or_404(User, id=user_id)
    elif email:
        user = User.objects.filter(email=email).first()
        if not user:
            return Response({"detail": "not_found"}, status=404)

    existing_promo = PromoCode.objects.filter(user=user, used_at__isnull=True).first()
    if existing_promo:
        if session:
            result = "issued" if existing_promo.session_id == session.id else "exists"
            ViewEvent.objects.create(
                session=session,
                asset=None,
                event_type="promo_checked",
                raw_payload={"result": result, "code": existing_promo.code},
            )
        return Response({"promo_code": existing_promo.code})

    if not session:
        session = Session.objects.filter(user=user).order_by("-last_seen").first()

    if session:
        code = _issue_promocode_if_completed(session, return_existing=True)
        if code:
            ViewEvent.objects.create(
                session=session,
                asset=None,
                event_type="promo_checked",
                raw_payload={"result": "issued", "code": code},
            )
            return Response({"promo_code": code})

    if session:
        ViewEvent.objects.create(
            session=session,
            asset=None,
            event_type="promo_checked",
            raw_payload={"result": "not_completed"},
        )
    return Response({"detail": "not_completed"}, status=404)


@api_view(["GET"])
def stats(_request):
    """
    @brief Сводная статистика просмотров и «лучший» актив за сегодня.

    @details Находит актив по комбинированному скорингу из долей:
    сегодняшние просмотры, «первым в сессии», и суммарные просмотры.

    @param _request: HTTP-запрос
    @return JSON с `best_asset`, `views_today`, `views_all_time`.
    """
    today = timezone.localdate()
    base_filter = {"event_type": "viewed_asset", "asset__isnull": False}
    views_all_time = ViewEvent.objects.filter(**base_filter).count()
    views_today_qs = ViewEvent.objects.filter(timestamp__date=today, **base_filter)
    views_today = views_today_qs.count()

    best_asset_payload = None
    if views_today == 0:
        all_counts_qs = (
            ViewEvent.objects.filter(**base_filter)
            .values("asset_id")
            .annotate(cnt=Count("id"))
            .order_by("-cnt")
        )
        if all_counts_qs.exists():
            best_asset_id = all_counts_qs.first()["asset_id"]
            asset = Asset.objects.get(id=best_asset_id)
            best_asset_payload = {"slug": asset.slug, "name": asset.name}
    else:
        today_counts_qs = views_today_qs.values("asset_id").annotate(cnt=Count("id"))
        today_counts = {row["asset_id"]: row["cnt"] for row in today_counts_qs}

        all_counts_qs = (
            ViewEvent.objects.filter(**base_filter)
            .values("asset_id")
            .annotate(cnt=Count("id"))
        )
        all_counts = {row["asset_id"]: row["cnt"] for row in all_counts_qs}

        first_asset_sub = (
            ViewEvent.objects.filter(session=OuterRef("pk"), **base_filter)
            .order_by("timestamp")
            .values("asset_id")[:1]
        )
        firsts_qs = (
            Session.objects.annotate(first_asset_id=Subquery(first_asset_sub))
            .values("first_asset_id")
            .exclude(first_asset_id=None)
            .annotate(cnt=Count("id"))
        )
        first_counts = {row["first_asset_id"]: row["cnt"] for row in firsts_qs}

        max_today = max(today_counts.values()) if today_counts else 0
        max_first = max(first_counts.values()) if first_counts else 0
        max_all = max(all_counts.values()) if all_counts else 0

        candidate_asset_ids = (
            set(today_counts.keys()) | set(all_counts.keys()) | set(first_counts.keys())
        )

        best_asset_id = None
        best_score = -1.0
        best_tiebreak = (-1,)

        for aid in candidate_asset_ids:
            t = today_counts.get(aid, 0)
            f = first_counts.get(aid, 0)
            a = all_counts.get(aid, 0)

            score = 0.0
            if max_today:
                score += 0.6 * (t / max_today)
            if max_first:
                score += 0.25 * (f / max_first)
            if max_all:
                score += 0.15 * (a / max_all)

            tiebreak = (t, a, -aid if isinstance(aid, int) else 0)
            if score > best_score or (
                abs(score - best_score) < 1e-9 and tiebreak > best_tiebreak
            ):
                best_score = score
                best_asset_id = aid
                best_tiebreak = tiebreak

        if best_asset_id is not None:
            asset = Asset.objects.get(id=best_asset_id)
            best_asset_payload = {"slug": asset.slug, "name": asset.name}

    return Response(
        {
            "best_asset": best_asset_payload,
            "views_today": views_today,
            "views_all_time": views_all_time,
        }
    )
