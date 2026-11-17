import datetime as dt
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Response
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.deps import current_user, require_roles, visible_student_ids
from app.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.models import Role, TuitionStatus, User
from app.params import IdPath
from app.pagination import Page, page_params, set_total
from app.schemas import TuitionCreate, TuitionOut, TuitionSummary, TuitionUpdate
from app.services.tuition_jobs import refresh_overdue

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
    background_tasks: BackgroundTasks,
    student_id: int | None = None,
    status: TuitionStatus | None = None,
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.role == Role.teacher:
        raise ForbiddenError("Giáo viên không xem học phí.")
    # Việc nền: sau khi trả kết quả, tự đánh dấu quá hạn để lần xem sau luôn mới
    background_tasks.add_task(refresh_overdue)
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
def mark_paid(record_id: IdPath, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    record = crud.tuition.get_record(db, record_id)
    if record is None:
        raise NotFoundError("Không tìm thấy khoản học phí.")
    if record.status == TuitionStatus.paid:
        raise ConflictError("Khoản này đã được thanh toán.")
    paid = crud.tuition.mark_paid(db, record)
    logger.info("Admin %s ghi nhận thanh toán khoản học phí id=%d", admin.username, record_id)
    return paid


def _unpaid_record_or_error(db: Session, record_id: int):
    record = crud.tuition.get_record(db, record_id)
    if record is None:
        raise NotFoundError("Không tìm thấy khoản học phí.")
    if record.status == TuitionStatus.paid:
        raise ConflictError("Khoản này đã thanh toán nên không sửa hoặc xóa được.")
    return record


@router.patch("/{record_id}", response_model=TuitionOut)
def update_record(
    record_id: IdPath,
    data: TuitionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    """Sửa số tiền, hạn đóng, ghi chú của khoản CHƯA đóng. Trạng thái tự tính lại theo hạn đóng mới."""
    record = _unpaid_record_or_error(db, record_id)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise BadRequestError("Không có thông tin nào để sửa.")
    if any(changes[key] is None for key in ("amount", "due_date") if key in changes):
        raise BadRequestError("Số tiền và hạn đóng không được để trống.")
    updated = crud.tuition.update_record(db, record, changes, dt.date.today())
    logger.info("Admin %s sửa khoản học phí id=%d (%s)", admin.username, record_id, ", ".join(sorted(changes)))
    return updated


@router.delete("/{record_id}", status_code=204)
def delete_record(record_id: IdPath, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """Xóa khoản học phí CHƯA đóng (tạo nhầm). Khoản đã đóng là chứng từ nên không xóa được (409)."""
    record = _unpaid_record_or_error(db, record_id)
    crud.tuition.delete_record(db, record)
    logger.info("Admin %s xóa khoản học phí id=%d", admin.username, record_id)


@router.post("/mark-overdue")
def mark_overdue(db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """Đánh dấu quá hạn các khoản chưa đóng có hạn trước hôm nay (tương đương tuitionAutoOverdue)."""
    updated = crud.tuition.mark_overdue(db, dt.date.today())
    logger.info("Admin %s đánh dấu quá hạn %d khoản học phí", admin.username, updated)
    return {"updated": updated}


@router.get("/summary", response_model=TuitionSummary)
def summary(background_tasks: BackgroundTasks, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    background_tasks.add_task(refresh_overdue)
    totals, counts = crud.tuition.totals_by_status(db)
    return TuitionSummary(
        unpaid=totals["unpaid"], paid=totals["paid"], overdue=totals["overdue"], count_by_status=counts
    )
