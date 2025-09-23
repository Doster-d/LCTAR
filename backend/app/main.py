import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes import auth, inference, logs, videos
from app.core.config import settings
from app.i18n.translator import translator
from app.services.inference.pipeline import load_models_global


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lazy load ML models if enabled
    if settings.ENABLE_INFERENCE:
        load_models_global()
    # Startup diagnostics: log GPU/Vulkan/binaries info to help debugging in container logs
    try:
        probes = {
            'nvidia-smi': [
                'nvidia-smi',
                '--query-gpu=index,name,driver_version,memory.total',
                '--format=csv,noheader',
            ],
            'ldconfig_vulkan': [
                'sh',
                '-c',
                'ldconfig -p | grep -i vulkan || true',
            ],
            'realesrgan_help': [
                'sh',
                '-c',
                'realesrgan-ncnn-vulkan -h 2>&1 | sed -n "1,80p" || true',
            ],
            'ffmpeg_version': ['ffmpeg', '-version'],
        }
        for k, cmd in probes.items():
            try:
                out = subprocess.check_output(  # noqa: S603
                    cmd, stderr=subprocess.STDOUT, text=True
                )
            except Exception as e:
                out = f'probe failed: {e}'
            print(f'PROBE {k}:\n{out}\n')
    except Exception as e:
        print(f'PROBE startup diagnostics failed: {e}')
    yield


app = FastAPI(title='LCT AR Backend', lifespan=lifespan)

# Routers
app.include_router(auth.router, prefix='/auth', tags=['auth'])
app.include_router(logs.router, prefix='/logs', tags=['logs'])
app.include_router(videos.router, prefix='/videos', tags=['videos'])
app.include_router(inference.router, prefix='/inference', tags=['inference'])


@app.middleware('http')
async def add_locale_header(request: Request, call_next):
    locale = request.headers.get('X-Locale', settings.DEFAULT_LOCALE)
    request.state.locale = locale
    response = await call_next(request)
    response.headers['Content-Language'] = locale
    return response


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Minimal generic handler; can be expanded.
    locale = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    msg = translator.t('errors.internal', locale=locale)
    msg = msg.format(error=str(exc))
    return JSONResponse(status_code=500, content={'detail': msg})


@app.get('/health', tags=['meta'])
async def health():
    return {'status': 'ok'}
