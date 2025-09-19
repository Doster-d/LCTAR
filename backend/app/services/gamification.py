from sqlalchemy.orm import Session
from ..core.config import settings
from ..models.video import Video
from ..models.user import User

def award_for_video(db: Session, user: User, first_bonus: int) -> tuple[int, bool]:
    video_count = db.query(Video).filter(Video.user_id == user.id).count()
    added = settings.POINTS_PER_VIDEO
    bonus_applied = False
    if video_count == 1 and first_bonus > 0:
        added += first_bonus
        bonus_applied = True
    user.score += added
    db.add(user)
    db.commit()
    db.refresh(user)
    return added, bonus_applied
