from fastapi import APIRouter, File, UploadFile, Depends, Request, HTTPException
from pydantic import BaseModel
from ...core.config import settings
from ...i18n import translator
from ...services.inference.pipeline import run_inference

router = APIRouter()

class InferenceResponse(BaseModel):
    detected: bool
    bbox: dict | None
    depth_m: float | None
    height_m: float | None
    models: dict

@router.post("/frame", response_model=InferenceResponse)
async def inference_frame(
    request: Request,
    file: UploadFile = File(...),
    focal_length: float | None = None,
    character_id: int | None = None,
):
    locale = getattr(request.state, "locale", settings.DEFAULT_LOCALE)
    if not settings.ENABLE_INFERENCE:
        raise HTTPException(status_code=503, detail=translator.t("errors.inference_disabled", locale=locale))
    if focal_length is None:
        raise HTTPException(status_code=422, detail=translator.t("errors.focal_missing", locale=locale))
    image_bytes = await file.read()
    result = run_inference(image_bytes, focal_length=focal_length)
    if character_id is not None:
        result["character_id"] = character_id
    return result
