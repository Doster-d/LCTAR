from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import hash_password, verify_password, create_access_token
from ...models.user import User
from ...schemas.auth import UserCreate, Token, UserOut
from ...api.deps import get_current_user
from ...i18n import translator
from ...core.config import settings

router = APIRouter()

@router.post('/register', response_model=UserOut)
def register(request: Request, data: UserCreate, db: Session = Depends(get_db)):
    locale = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail=translator.t('auth.exists', locale=locale))
    user = User(email=data.email, hashed_password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post('/login', response_model=Token)
def login(request: Request, data: UserCreate, db: Session = Depends(get_db)):
    locale = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail=translator.t('errors.auth', locale=locale))
    token = create_access_token(user.email)
    return Token(access_token=token)

@router.get('/me', response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user

@router.post('/promote/{user_id}')
def promote_user(user_id: int, request: Request, user=Depends(get_current_user)):
    """Stub endpoint for manual admin promotion (not yet implemented).

    Returns 501 to signal future implementation phase.
    """
    locale = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    # Intentionally not performing any privilege checks beyond authentication yet;
    # full admin-only enforcement and business logic will be added in a later iteration.
    raise HTTPException(status_code=501, detail=translator.t('admin.not_implemented', locale=locale))
