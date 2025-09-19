import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Request, Form
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.config import settings
from ...api.deps import get_current_user
from ...models.video import Video
from ...models.character import Character
from ...schemas.video import UploadResult, VideoOut
from ...i18n import translator
from ...services.gamification import award_for_video

MEDIA_DIR = Path('media/videos')
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()

@router.post('/upload', response_model=UploadResult)
async def upload_video(
    request: Request,
    file: UploadFile = File(...),
    character_id: int | None = Form(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    locale = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    if file.content_type != settings.ALLOWED_VIDEO_MIME:
        raise HTTPException(status_code=415, detail=translator.t('errors.bad_mime', locale=locale))
    data = await file.read()
    size_mb = len(data) / (1024*1024)
    if size_mb > settings.MAX_VIDEO_MB:
        raise HTTPException(status_code=413, detail=translator.t('errors.file_too_large', locale=locale))
    character = None
    if character_id is not None:
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail=translator.t('characters.not_found', locale=locale))
    filename = f"{uuid.uuid4()}.mp4"
    path = MEDIA_DIR / filename
    path.write_bytes(data)
    video = Video(user_id=user.id, path=str(path), size_bytes=len(data), character_id=character.id if character else None)
    db.add(video)
    db.commit()
    db.refresh(video)
    added, bonus = award_for_video(db, user, first_bonus=settings.FIRST_UPLOAD_BONUS)
    return UploadResult(video=VideoOut.model_validate(video), added_score=added, bonus_applied=bonus)
