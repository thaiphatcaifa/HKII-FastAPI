import datetime as dt

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CoachSession


def count_since(db: Session, user_id: int, since: dt.datetime) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(CoachSession).where(
                CoachSession.user_id == user_id, CoachSession.created_at >= since
            )
        )
        or 0
    )


def create_session(
    db: Session,
    *,
    user_id: int,
    kind: str,
    input_text: str,
    feedback: str,
    provider: str,
    analysis: dict | None = None,
    overall: float | None = None,
) -> CoachSession:
    session = CoachSession(
        user_id=user_id,
        kind=kind,
        input_text=input_text,
        feedback=feedback,
        provider=provider,
        analysis=analysis,
        overall=overall,
    )
    db.add(session)
    db.commit()
    return session


def scored_history(db: Session, user_id: int, limit: int) -> list[CoachSession]:
    """Các lượt có điểm gần nhất (tối đa `limit`), xếp từ cũ đến mới để vẽ biểu đồ."""
    query = (
        select(CoachSession)
        .where(CoachSession.user_id == user_id, CoachSession.overall.is_not(None))
        .order_by(CoachSession.created_at.desc(), CoachSession.id.desc())
        .limit(limit)
    )
    return list(reversed(db.scalars(query).all()))


def history(db: Session, user_id: int, limit: int) -> list[CoachSession]:
    query = (
        select(CoachSession)
        .where(CoachSession.user_id == user_id)
        .order_by(CoachSession.created_at.desc(), CoachSession.id.desc())
        .limit(limit)
    )
    return list(db.scalars(query).all())
