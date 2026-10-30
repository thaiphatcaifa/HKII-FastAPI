import datetime as dt
import logging

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.deps import current_user, require_roles, visible_student_ids
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import Role, TuitionStatus, User
from app.pagination import Page, page_params, set_total
from app.schemas import TuitionCreate, TuitionOut, TuitionSummary

router = APIRouter(prefix="/tuition", tags=["tuition"])
admin_only = require_roles(Role.admin)
logger = logging.getLogger("hkii.tuition")


@router.post("", response_model=TuitionOut, status_code=201)
def create_record(data: TuitionCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    student = crud.users.get_by_id(db, data.student_id)
    if not student or student.role != Role.student:
        raise NotFoundError("Không tìm thấy học viên.")
    record = crud.tuition.create_record(
        db,
        student_id=data.student_id,
        class_id=data.class_id,
        amount=data.amount,
        due_date=data.due_date,
        note=data.note,
    )
    logger.info("Admin %s tạo khoản học phí id=%d cho học viên id=%d", admin.username, record.id, data.student_id)
    return record


@router.get("", response_model=list[TuitionOut])
def list_records(
    response: Response,
    student_id: int | None = None,
    status: TuitionStatus | None = None,
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.role == Role.teacher:
        raise ForbiddenError("Giáo viên không xem học phí.")
    items, total = crud.tuition.list_records(
        db,
        visible_ids=visible_student_ids(db, user),
        student_id=student_id,
        status=status,
        skip=page.skip,
        limit=page.limit,
    )
    set_total(response, total)
    return items


@router.post("/{record_id}/pay", response_model=TuitionOut)
def mark_paid(record_id: int, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    record = crud.tuition.get_record(db, record_id)
    if record is None:
        raise NotFoundError("Không tìm thấy khoản học phí.")
    if record.status == TuitionStatus.paid:
        raise ConflictError("Khoản này đã được thanh toán.")
    paid = crud.tuition.mark_paid(db, record)
    logger.info("Admin %s ghi nhận thanh toán khoản học phí id=%d", admin.username, record_id)
    return paid


@router.post("/mark-overdue")
def mark_overdue(db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """Đánh dấu quá hạn các khoản chưa đóng có hạn trước hôm nay (tương đương tuitionAutoOverdue)."""
    updated = crud.tuition.mark_overdue(db, dt.date.today())
    logger.info("Admin %s đánh dấu quá hạn %d khoản học phí", admin.username, updated)
    return {"updated": updated}


@router.get("/summary", response_model=TuitionSummary)
def summary(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    totals, counts = crud.tuition.totals_by_status(db)
    return TuitionSummary(
        unpaid=totals["unpaid"], paid=totals["paid"], overdue=totals["overdue"], count_by_status=counts
    )
