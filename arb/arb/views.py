from django.conf import settings
from django.http import HttpResponse


def health_check(request):
    return HttpResponse(
        settings.HEALTH_MESSAGE,
        content_type='text/plain',
    )# Test comment
