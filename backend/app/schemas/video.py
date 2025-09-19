from pydantic import BaseModel, ConfigDict
from typing import Optional

class VideoOut(BaseModel):
    id: int
    path: str
    size_bytes: int
    character_id: int | None

    model_config = ConfigDict(from_attributes=True)

class UploadResult(BaseModel):
    video: VideoOut
    added_score: int
    bonus_applied: bool
