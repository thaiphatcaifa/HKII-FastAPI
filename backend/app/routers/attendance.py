import datetime as dt
import logging

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
from app.errors import BadRequestError
from app.models import Attendance, AttendanceStatus, Role, User
from app.params import IdPath
from app.pagination import Page, page_params, set_total
from app.schemas import AttendanceBatchIn, AttendanceOut, AttendanceSummary
from app.services.stats import attendance_rate

router = APIRouter(prefix="/attendance", tags=["attendance"])
logger = logging.getLogger("hkii.attendance")


def compute_summary(student_id: int, statuses: list[AttendanceStatus]) -> AttendanceSummary:
    counts = {s: 0 for s in AttendanceStatus}
    for status in statuses:
        counts[status] += 1
    total = len(statuses)
    rate = attendance_rate(
        counts[AttendanceStatus.present], counts[AttendanceStatus.late], counts[AttendanceStatus.excused], total
    )
    return AttendanceSummary(
        student_id=student_id,
        total=total,
        present=counts[AttendanceStatus.present],
        late=counts[AttendanceStatus.late],
        absent=counts[AttendanceStatus.absent],
        excused=counts[AttendanceStatus.excused],
        attendance_rate=rate,
    )


@router.post("/batch", response_model=list[AttendanceOut])
def save_attendance(
    data: AttendanceBatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.teacher)),
):
    """Điểm danh cả lớp một ngày. Gọi lại cho cùng ngày sẽ cập nhật (upsert)."""
    classroom = get_class_or_404(db, data.class_id)
    ensure_can_manage_class(user, classroom)

    enrolled = crud.classes.enrolled_student_ids(db, data.class_id)
    unknown = {r.student_id for r in data.records} - enrolled
    if unknown:
        raise BadRequestError(f"Học viên không thuộc lớp: {sorted(unknown)}")

    saved = crud.attendance.save_day(db, data.class_id, data.date, data.records, user.id)
    logger.info("%s điểm danh lớp %s ngày %s (%d học viên)", user.username, classroom.code, data.date, len(saved))
    return saved


@router.get("", response_model=list[AttendanceOut])
def list_attendance(
    response: Response,
    class_id: int | None = None,
    student_id: int | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    items, total = crud.attendance.list_attendance(
        db,
        scope=lambda q: scope_class_student_query(db, user, q, Attendance),
        class_id=class_id,
        student_id=student_id,
        date_from=date_from,
        date_to=date_to,
        skip=page.skip,
        limit=page.limit,
    )
    set_total(response, total)
    return items


@router.get("/summary/{student_id}", response_model=AttendanceSummary)
def attendance_summary(
    student_id: IdPath,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    ensure_can_view_student(db, user, student_id)
    teacher_id = user.id if user.role == Role.teacher else None
    statuses = crud.attendance.statuses_of_student(db, student_id, teacher_id)
    return compute_summary(student_id, statuses)
