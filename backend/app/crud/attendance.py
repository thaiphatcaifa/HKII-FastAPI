import datetime as dt
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.common import paginate
from app.crud.classes import teacher_class_ids_select
from app.models import Attendance, AttendanceStatus


def save_day(db: Session, class_id: int, day: dt.date, records, recorded_by: int) -> list[Attendance]:
    """Điểm danh cả lớp một ngày. Đã có bản ghi cùng ngày thì cập nhật (upsert)."""
    existing = {
        a.student_id: a
        for a in db.scalars(select(Attendance).where(Attendance.class_id == class_id, Attendance.date == day))
    }
    saved: list[Attendance] = []
    for record in records:
        row = existing.get(record.student_id)
        if row is None:
            row = Attendance(class_id=class_id, student_id=record.student_id, date=day)
            db.add(row)
        row.status = record.status
        row.note = record.note
        row.recorded_by = recorded_by
        saved.append(row)
    db.commit()
    return saved


def list_attendance(
    db: Session,
    *,
    scope: Callable | None,
    class_id: int | None,
    student_id: int | None,
    date_from: dt.date | None,
    date_to: dt.date | None,
    skip: int,
    limit: int,
):
    """scope: hàm nhận truy vấn và thu hẹp theo quyền của người đang đăng nhập."""
    query = select(Attendance).order_by(Attendance.date.desc(), Attendance.id)
    if scope is not None:
        query = scope(query)
    if class_id is not None:
        query = query.where(Attendance.class_id == class_id)
    if student_id is not None:
        query = query.where(Attendance.student_id == student_id)
    if date_from:
        query = query.where(Attendance.date >= date_from)
    if date_to:
        query = query.where(Attendance.date <= date_to)
    return paginate(db, query, skip, limit)


def statuses_by_student(
    db: Session, class_id: int, student_id: int | None = None
) -> dict[int, list[AttendanceStatus]]:
    """Trạng thái điểm danh của từng học viên trong lớp, theo thứ tự thời gian (cũ -> mới)."""
    query = (
        select(Attendance.student_id, Attendance.status)
        .where(Attendance.class_id == class_id)
        .order_by(Attendance.date, Attendance.id)
    )
    if student_id is not None:
        query = query.where(Attendance.student_id == student_id)
    result: dict[int, list[AttendanceStatus]] = {}
    for sid, status in db.execute(query):
        result.setdefault(sid, []).append(status)
    return result


def statuses_of_student(db: Session, student_id: int, teacher_id: int | None = None) -> list[AttendanceStatus]:
    query = select(Attendance.status).where(Attendance.student_id == student_id)
    if teacher_id is not None:
        query = query.where(Attendance.class_id.in_(teacher_class_ids_select(teacher_id)))
    return list(db.scalars(query))
