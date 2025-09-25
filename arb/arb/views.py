from django.conf import settings
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

FIRST_VIEW_POINTS = 10


def health_check(_request):
    return HttpResponse(
        settings.HEALTH_MESSAGE,
        content_type="text/plain",
    )


def _compute_session_viewed_count(session: Session) -> int:
    return (
        SessionItemProgress.objects.filter(session=session, times_viewed__gt=0)
        .only("id")
        .count()
    )


def _compute_user_total_score(user: User) -> int:
    unique_viewed_assets = (
        SessionItemProgress.objects.filter(session__user=user, times_viewed__gt=0)
        .values_list("asset_id", flat=True)
        .distinct()
        .count()
    )
    return unique_viewed_assets * FIRST_VIEW_POINTS


def _issue_promocode_if_completed(session: Session, return_existing: bool = True):
    total_assets = Asset.objects.count()
    if total_assets == 0:
        return None
    viewed = _compute_session_viewed_count(session)
    if viewed < total_assets:
        return None
    existing = session.promo_codes.filter(used_at__isnull=True).first()
    if existing:
        return existing.code if return_existing else None
    code = f"PROMO-{session.id.hex[:8].upper()}-{timezone.now().strftime('%H%M%S')}"
    promo = PromoCode.objects.create(
        code=code,
        session=session,
        user=session.user if session.user_id else None,
        email=(session.user.email if session.user_id else session.pending_email),
        issued_at=timezone.now(),
    )
    return promo.code


@api_view(["POST"])
def session_start(request):  # noqa: ARG001
    session = Session.objects.create(last_seen=timezone.now(), is_active=True)
    return Response({"session_id": str(session.id)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def view_event(request):
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
    user.total_score = _compute_user_total_score(user)
    user.save(update_fields=["total_score"])
    promo_code = _issue_promocode_if_completed(session)
    if promo_code:
        PromoCode.objects.filter(code=promo_code).update(user=user, email=email)
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
    session_id = request.query_params.get("session_id")
    user_id = request.query_params.get("user_id")
    if not session_id and not user_id:
        return Response({"detail": "session_id or user_id is required"}, status=400)
    total_assets = Asset.objects.count()
    if session_id:
        session = get_object_or_404(Session, id=session_id)
        viewed_assets = _compute_session_viewed_count(session)
        return Response(
            {
                "total_assets": total_assets,
                "viewed_assets": viewed_assets,
                "remaining_assets": max(total_assets - viewed_assets, 0),
                "total_score": session.score,
            }
        )
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
        return Response({"promo_code": existing_promo.code})

    if not session:
        session = Session.objects.filter(user=user).order_by("-last_seen").first()

    if session:
        code = _issue_promocode_if_completed(session, return_existing=True)
        if code:
            return Response({"promo_code": code})

    return Response({"detail": "not_completed"}, status=404)
