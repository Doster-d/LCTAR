from django.http import HttpResponse
from django.conf import settings


def health_check(request):
    return HttpResponse(
        settings.HEALTH_MESSAGE,
        content_type='text/plain',
    )