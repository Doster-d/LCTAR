from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...models.log import ClientLog
from ...schemas.logs import ClientLogIn, ClientLogOut
from ...api.deps import get_current_user, get_current_admin
from ...i18n import translator
from ...core.config import settings

router = APIRouter()

@router.post('/', response_model=ClientLogOut)
def submit_log(data: ClientLogIn, request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
    locale = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    log = ClientLog(user_id=user.id, level=data.level.upper(), message=data.message, context=data.context)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

@router.get('/', response_model=list[ClientLogOut])
def list_logs(request: Request, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    _ = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    logs = db.query(ClientLog).order_by(ClientLog.id.desc()).limit(200).all()
    return logs
