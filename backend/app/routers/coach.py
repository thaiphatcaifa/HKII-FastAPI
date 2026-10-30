import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.db import get_db
from app.deps import require_roles
from app.errors import TooManyRequestsError
from app.models import Role, User, utcnow
from app.schemas import CoachIn, CoachOut
from app.services.coach import generate_feedback

router = APIRouter(prefix="/coach", tags=["coach"])
allowed = require_roles(Role.student, Role.teacher, Role.admin)
logger = logging.getLogger("hkii.coach")


@router.post("/feedback", response_model=CoachOut, status_code=201)
def create_feedback(data: CoachIn, db: Session = Depends(get_db), user: User = Depends(allowed)):
    start_of_day = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used = crud.coach.count_since(db, user.id, start_of_day)
    if used >= settings.coach_daily_limit:
        logger.warning("%s đã hết %d lượt AI Coach hôm nay", user.username, settings.coach_daily_limit)
        raise TooManyRequestsError(f"Đã dùng hết {settings.coach_daily_limit} lượt AI Coach hôm nay.")

    feedback, provider = generate_feedback(data.kind, data.text)
    session = crud.coach.create_session(
        db, user_id=user.id, kind=data.kind, input_text=data.text, feedback=feedback, provider=provider
    )
    logger.info("AI Coach (%s) nhận xét bài %s của %s", provider, data.kind, user.username)
    return session


@router.get("/history", response_model=list[CoachOut])
def history(
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(allowed),
):
    return crud.coach.history(db, user.id, max(1, min(limit, 100)))
