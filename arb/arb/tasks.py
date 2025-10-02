"""
@file tasks.py
@brief Асинхронные задачи Celery для уведомлений и событий.

Содержит задачу отправки промокода на email. При успешной отправке
дополнительно логируется событие `promo_sent` в `ViewEvent`.
"""

from __future__ import annotations

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import PromoCode, Session, ViewEvent


@shared_task(
    name="arb.send_promocode_email",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=5,
)
def send_promocode_email(promo_code: str) -> bool:
    """
    @brief Отправляет промокод на email получателя.

    @param promo_code: Строковый код промо
    @return True, если письмо отправлено; иначе False.
    """
    promo = PromoCode.objects.filter(code=promo_code).first()
    if not promo or not promo.email:
        return False

    subject = "Ваш промокод"
    body = (
        "Поздравляем! Вы просмотрели все экспонаты в нашем виртуальном музее и получили промокод.\n\n"
        f"Ваш промокод: {promo.code}\n\n"
        "Покажите в кассе и получите скидку на билеты или мерч."
    )

    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [promo.email],
        fail_silently=False,
    )

    promo.sent_at = timezone.now()
    promo.save(update_fields=["sent_at"])
    if promo.session_id:
        session = Session.objects.get(id=promo.session_id)
        ViewEvent.objects.create(
            session=session,
            asset=None,
            event_type="promo_sent",
            raw_payload={"code": promo.code, "email": promo.email},
        )
    return True
