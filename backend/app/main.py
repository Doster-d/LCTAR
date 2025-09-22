from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.routes import auth, logs, videos, inference
from app.i18n import translator

@asynccontextmanager
def lifespan(app: FastAPI):
    # Lazy load ML models if enabled
    if settings.ENABLE_INFERENCE:
        from .services.inference.pipeline import load_models_global
        load_models_global()
    yield

app = FastAPI(title="LCT AR Backend", lifespan=lifespan)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(logs.router, prefix="/logs", tags=["logs"])
app.include_router(videos.router, prefix="/videos", tags=["videos"])
app.include_router(inference.router, prefix="/inference", tags=["inference"])

@app.middleware("http")
async def add_locale_header(request: Request, call_next):
    locale = request.headers.get("X-Locale", settings.DEFAULT_LOCALE)
    request.state.locale = locale
    response = await call_next(request)
    response.headers["Content-Language"] = locale
    return response

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Minimal generic handler; can be expanded.
    locale = getattr(request.state, "locale", settings.DEFAULT_LOCALE)
    msg = translator.t("errors.internal", locale=locale)
    return JSONResponse(status_code=500, content={"detail": msg})

@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
