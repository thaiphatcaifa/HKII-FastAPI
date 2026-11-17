import datetime as dt
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.crud.common import paginate
from app.models import TuitionRecord, TuitionStatus, utcnow


def create_record(db: Session, *, student_id: int, class_id: int | None, amount, due_date: dt.date, note) -> TuitionRecord:
    record = TuitionRecord(
        student_id=student_id,
        class_id=class_id,
        amount=Decimal(str(amount)),
        due_date=due_date,
        note=note,
        status=TuitionStatus.unpaid,
    )
    db.add(record)
    db.commit()
    return record


def get_record(db: Session, record_id: int) -> TuitionRecord | None:
    return db.get(TuitionRecord, record_id)


def list_records(
    db: Session,
    *,
    visible_ids: set[int] | None,
    student_id: int | None,
    status: TuitionStatus | None,
    skip: int,
    limit: int,
):
    query = select(TuitionRecord).order_by(TuitionRecord.due_date.desc(), TuitionRecord.id.desc())
    if visible_ids is not None:
        query = query.where(TuitionRecord.student_id.in_(list(visible_ids)))
    if student_id is not None:
        query = query.where(TuitionRecord.student_id == student_id)
    if status is not None:
        query = query.where(TuitionRecord.status == status)
    return paginate(db, query, skip, limit)


def mark_paid(db: Session, record: TuitionRecord) -> TuitionRecord:
    record.status = TuitionStatus.paid
    record.paid_at = utcnow()
    db.commit()
    return record


def update_record(db: Session, record: TuitionRecord, changes: dict, today: dt.date) -> TuitionRecord:
    """Sửa khoản chưa đóng rồi tính lại trạng thái theo hạn đóng mới (quá hạn hay chưa đóng)."""
    if "amount" in changes:
        record.amount = Decimal(str(changes["amount"]))
    if "due_date" in changes:
        record.due_date = changes["due_date"]
    if "note" in changes:
        record.note = changes["note"]
    record.status = TuitionStatus.overdue if record.due_date < today else TuitionStatus.unpaid
    db.commit()
    return record


def delete_record(db: Session, record: TuitionRecord) -> None:
    db.delete(record)
    db.commit()


def mark_overdue(db: Session, today: dt.date) -> int:
    result = db.execute(
        update(TuitionRecord)
        .where(TuitionRecord.status == TuitionStatus.unpaid, TuitionRecord.due_date < today)
        .values(status=TuitionStatus.overdue)
    )
    db.commit()
    return result.rowcount


def totals_by_status(db: Session) -> tuple[dict[str, float], dict[str, int]]:
    rows = db.execute(
        select(TuitionRecord.status, func.count(), func.coalesce(func.sum(TuitionRecord.amount), 0)).group_by(
            TuitionRecord.status
        )
    ).all()
    totals = {s.value: 0.0 for s in TuitionStatus}
    counts = {s.value: 0 for s in TuitionStatus}
    for status, count, total in rows:
        totals[status.value] = float(total)
        counts[status.value] = int(count)
    return totals, counts
