from collections import defaultdict
from decimal import Decimal
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.classes import teacher_class_ids_select
from app.crud.common import paginate
from app.models import Score


def get_score(db: Session, score_id: int) -> Score | None:
    return db.get(Score, score_id)


def create_score(db: Session, *, class_id: int, student_id: int, kind: str, value, max_value, note, recorded_by: int) -> Score:
    score = Score(
        class_id=class_id,
        student_id=student_id,
        kind=kind,
        value=Decimal(str(value)),
        max_value=Decimal(str(max_value)),
        note=note,
        recorded_by=recorded_by,
    )
    db.add(score)
    db.commit()
    return score


def update_score(db: Session, score: Score, *, value=None, note=None) -> Score:
    if value is not None:
        score.value = Decimal(str(value))
    if note is not None:
        score.note = note
    db.commit()
    return score


def delete_score(db: Session, score: Score) -> None:
    db.delete(score)
    db.commit()


def list_scores(
    db: Session,
    *,
    scope: Callable | None,
    class_id: int | None,
    student_id: int | None,
    skip: int,
    limit: int,
):
    query = select(Score).order_by(Score.recorded_at.desc(), Score.id.desc())
    if scope is not None:
        query = scope(query)
    if class_id is not None:
        query = query.where(Score.class_id == class_id)
    if student_id is not None:
        query = query.where(Score.student_id == student_id)
    return paginate(db, query, skip, limit)


def average_by_class(db: Session, student_id: int, teacher_id: int | None = None) -> list[tuple[int, int, float]]:
    """[(class_id, số đầu điểm, điểm TB quy về thang 10)] của một học viên."""
    query = select(Score).where(Score.student_id == student_id)
    if teacher_id is not None:
        query = query.where(Score.class_id.in_(teacher_class_ids_select(teacher_id)))
    per_class: dict[int, list[float]] = defaultdict(list)
    for s in db.scalars(query):
        per_class[s.class_id].append(float(s.value) / float(s.max_value) * 10)
    return [(cid, len(vals), round(sum(vals) / len(vals), 2)) for cid, vals in sorted(per_class.items())]
