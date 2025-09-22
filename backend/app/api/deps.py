from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.security import decode_token
from app.core.database import get_db
from app.models.user import User
from app.i18n import translator
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    locale = getattr(request.state, "locale", settings.DEFAULT_LOCALE)
    sub = decode_token(token)
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=translator.t("errors.auth", locale=locale))
    user = db.query(User).filter(User.email == sub).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=translator.t("errors.auth", locale=locale))
    return user

def get_current_admin(user: User = Depends(get_current_user), request: Request = None):  # type: ignore
    locale = getattr(request.state, "locale", settings.DEFAULT_LOCALE) if request else settings.DEFAULT_LOCALE
    if not user.is_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail=translator.t("errors.forbidden", locale=locale))
    return user