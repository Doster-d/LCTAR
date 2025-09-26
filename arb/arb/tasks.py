from __future__ import annotations

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import PromoCode


@shared_task(
    name="arb.send_promocode_email",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=5,
)
def send_promocode_email(promo_code: str) -> bool:
    promo = PromoCode.objects.filter(code=promo_code).first()
    if not promo or not promo.email:
        return False

    subject = "Ваш промокод"
    body = (
        "Поздравляем! Вы просмотрели всех чебурашек и получили промокод.\n\n"
        f"Ваш промокод: {promo.code}\n\n"
        "Продайте его и депните в казик."
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
    return True
