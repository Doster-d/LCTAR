from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./dev.db"
    JWT_SECRET: str = "dev"
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ENABLE_INFERENCE: bool = False
    POINTS_PER_VIDEO: int = 10
    FIRST_UPLOAD_BONUS: int = 50
    MAX_VIDEO_MB: int = 50
    DEFAULT_LOCALE: str = "en"
    ALLOWED_VIDEO_MIME: str = "video/mp4"

    model_config = ConfigDict(env_file = ".env")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
