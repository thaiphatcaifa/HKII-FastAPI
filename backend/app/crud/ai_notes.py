import datetime as dt
from typing import Callable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud.common import paginate
from app.models import AiNote, AiNoteKind, AiNoteStatus, utcnow


def get_note(db: Session, note_id: int, kind: AiNoteKind | None = None) -> AiNote | None:
    note = db.get(AiNote, note_id)
    if note is not None and kind is not None and note.kind != kind:
        return None
    return note


def count_since(db: Session, author_id: int, since: dt.datetime) -> int:
    """Số lượt AI người này đã dùng kể từ mốc `since` (tính cả nhận xét lẫn gợi ý)."""
    return (
        db.scalar(
            select(func.count()).select_from(AiNote).where(AiNote.author_id == author_id, AiNote.created_at >= since)
        )
        or 0
    )


def create_note(
    db: Session,
    *,
    kind: AiNoteKind,
    class_id: int,
    student_id: int,
    author_id: int,
    content: str,
    provider: str,
) -> AiNote:
    note = AiNote(
        kind=kind,
        class_id=class_id,
        student_id=student_id,
        author_id=author_id,
        content=content,
        provider=provider,
        status=AiNoteStatus.draft,
    )
    db.add(note)
    db.commit()
    return note


def list_reviews(
    db: Session,
    *,
    scope: Callable | None,
    class_id: int | None,
    student_id: int | None,
    status: AiNoteStatus | None,
    skip: int,
    limit: int,
):
    """Chỉ trả nhận xét (review); gợi ý hành động (advice) không bao giờ xuất hiện ở đây."""
    query = select(AiNote).where(AiNote.kind == AiNoteKind.review).order_by(AiNote.created_at.desc(), AiNote.id.desc())
    if scope is not None:
        query = scope(query)
    if class_id is not None:
        query = query.where(AiNote.class_id == class_id)
    if student_id is not None:
        query = query.where(AiNote.student_id == student_id)
    if status is not None:
        query = query.where(AiNote.status == status)
    return paginate(db, query, skip, limit)


def update_content(db: Session, note: AiNote, content: str) -> AiNote:
    note.content = content
    note.updated_at = utcnow()
    db.commit()
    return note


def set_status(db: Session, note: AiNote, status: AiNoteStatus) -> AiNote:
    note.status = status
    note.published_at = utcnow() if status == AiNoteStatus.published else None
    note.updated_at = utcnow()
    db.commit()
    return note


def delete_note(db: Session, note: AiNote) -> None:
    db.delete(note)
    db.commit()
