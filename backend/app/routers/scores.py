import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.deps import (
    current_user,
    ensure_can_manage_class,
    ensure_can_view_student,
    get_class_or_404,
    require_roles,
    scope_class_student_query,
)
from app.errors import BadRequestError, NotFoundError
from app.models import Role, Score, User
from app.pagination import Page, page_params, set_total
from app.schemas import ScoreClassSummary, ScoreCreate, ScoreOut, ScoreUpdate

router = APIRouter(prefix="/scores", tags=["scores"])
staff = require_roles(Role.admin, Role.teacher)
logger = logging.getLogger("hkii.scores")


def _load_score(db: Session, score_id: int, user: User) -> Score:
    score = crud.scores.get_score(db, score_id)
    if score is None:
        raise NotFoundError("Không tìm thấy điểm.")
    ensure_can_manage_class(user, get_class_or_404(db, score.class_id))
    return score


@router.post("", response_model=ScoreOut, status_code=201)
def create_score(data: ScoreCreate, db: Session = Depends(get_db), user: User = Depends(staff)):
    ensure_can_manage_class(user, get_class_or_404(db, data.class_id))
    if data.value > data.max_value:
        raise BadRequestError("Điểm không được lớn hơn điểm tối đa.")
    if not crud.classes.get_enrollment(db, data.class_id, data.student_id):
        raise BadRequestError("Học viên không thuộc lớp này.")
    score = crud.scores.create_score(
        db,
        class_id=data.class_id,
        student_id=data.student_id,
        kind=data.kind,
        value=data.value,
        max_value=data.max_value,
        note=data.note,
        recorded_by=user.id,
    )
    logger.info("%s nhập điểm %s cho học viên id=%d (lớp id=%d)", user.username, data.kind, data.student_id, data.class_id)
    return score


@router.get("", response_model=list[ScoreOut])
def list_scores(
    response: Response,
    class_id: int | None = None,
    student_id: int | None = None,
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    items, total = crud.scores.list_scores(
        db,
        scope=lambda q: scope_class_student_query(db, user, q, Score),
        class_id=class_id,
        student_id=student_id,
        skip=page.skip,
        limit=page.limit,
    )
    set_total(response, total)
    return items


@router.patch("/{score_id}", response_model=ScoreOut)
def update_score(
    score_id: int,
    data: ScoreUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    score = _load_score(db, score_id, user)
    if data.value is not None and Decimal(str(data.value)) > score.max_value:
        raise BadRequestError("Điểm không được lớn hơn điểm tối đa.")
    return crud.scores.update_score(db, score, value=data.value, note=data.note)


@router.delete("/{score_id}", status_code=204)
def delete_score(score_id: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    score = _load_score(db, score_id, user)
    crud.scores.delete_score(db, score)
    logger.info("%s xóa điểm id=%d", user.username, score_id)


@router.get("/student/{student_id}/summary", response_model=list[ScoreClassSummary])
def student_summary(
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Điểm trung bình (thang 10) của học viên theo từng lớp."""
    ensure_can_view_student(db, user, student_id)
    teacher_id = user.id if user.role == Role.teacher else None
    return [
        ScoreClassSummary(class_id=cid, count=count, average_10=avg)
        for cid, count, avg in crud.scores.average_by_class(db, student_id, teacher_id)
    ]
