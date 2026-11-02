import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.db import get_db
from app.deps import require_roles
from app.errors import TooManyRequestsError
from app.models import Role, User, utcnow
from app.schemas import CoachIn, CoachOut, CoachPoint, CoachProgressOut
from app.services.coach import generate_feedback

router = APIRouter(prefix="/coach", tags=["coach"])
allowed = require_roles(Role.student, Role.teacher, Role.admin)
logger = logging.getLogger("hkii.coach")


@router.post("/feedback", response_model=CoachOut, status_code=201)
def create_feedback(data: CoachIn, db: Session = Depends(get_db), user: User = Depends(allowed)):
    """Chấm bài theo 4 tiêu chí (thang 10), chỉ ra lỗi kèm câu sửa và gợi ý. Kết quả được lưu để theo dõi tiến bộ."""
    start_of_day = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used = crud.coach.count_since(db, user.id, start_of_day)
    if used >= settings.coach_daily_limit:
        logger.warning("%s đã hết %d lượt AI Coach hôm nay", user.username, settings.coach_daily_limit)
        raise TooManyRequestsError(f"Đã dùng hết {settings.coach_daily_limit} lượt AI Coach hôm nay.")

    result = generate_feedback(data.kind, data.text)
    session = crud.coach.create_session(
        db,
        user_id=user.id,
        kind=data.kind,
        input_text=data.text,
        feedback=result.feedback,
        provider=result.provider,
        analysis=result.analysis.model_dump(),
        overall=result.overall,
    )
    logger.info("AI Coach (%s) chấm bài %s của %s: %.1f/10", result.provider, data.kind, user.username, result.overall)
    return session


@router.get("/history", response_model=list[CoachOut])
def history(
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(allowed),
):
    return crud.coach.history(db, user.id, max(1, min(limit, 100)))


@router.get("/progress", response_model=CoachProgressOut)
def progress(
    limit: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(allowed),
):
    """Điểm tổng của các lượt gần đây (cũ -> mới) để vẽ biểu đồ tiến bộ. Chỉ gồm lượt của chính người dùng."""
    sessions = crud.coach.scored_history(db, user.id, max(1, min(limit, 100)))
    points = [
        CoachPoint(
            id=s.id,
            kind=s.kind,
            provider=s.provider,
            overall=s.overall,
            scores=(s.analysis or {}).get("scores", {}),
            created_at=s.created_at,
        )
        for s in sessions
    ]
    overalls = [p.overall for p in points]
    return CoachProgressOut(
        points=points,
        average=round(sum(overalls) / len(overalls), 1) if overalls else None,
        best=max(overalls) if overalls else None,
    )
