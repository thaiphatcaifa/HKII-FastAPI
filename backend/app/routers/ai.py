"""AI hỗ trợ giáo viên: cảnh báo học viên có rủi ro + soạn nhận xét học viên.

Nguyên tắc: AI chỉ đề xuất, giáo viên quyết định.
- Cảnh báo rủi ro: phát hiện bằng LUẬT (minh bạch), AI chỉ gợi ý hành động.
- Nhận xét: AI soạn bản NHÁP -> giáo viên sửa -> công bố -> học viên/phụ huynh mới thấy.
"""
import logging

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.db import get_db
from app.deps import (
    current_user,
    ensure_can_manage_class,
    get_class_or_404,
    require_roles,
    scope_class_student_query,
)
from app.errors import BadRequestError, NotFoundError, TooManyRequestsError
from app.models import AiNote, AiNoteKind, AiNoteStatus, Role, User, utcnow
from app.pagination import Page, page_params, set_total
from app.params import IdPath
from app.schemas import (
    AdviceIn,
    AdviceOut,
    ReviewCreateIn,
    ReviewOut,
    ReviewUpdateIn,
    RiskOut,
)
from app.services import insights, insights_ai

router = APIRouter(prefix="/ai", tags=["ai"])
staff = require_roles(Role.admin, Role.teacher)
logger = logging.getLogger("hkii.ai")


def _to_risk(item: insights.StudentInsight) -> RiskOut:
    return RiskOut(
        student_id=item.student_id,
        full_name=item.full_name,
        level=item.level,
        points=item.points,
        enough_data=item.enough_data,
        reasons=[f.text for f in item.factors],
        sessions=item.sessions,
        attendance_rate=item.attendance_rate,
        absent_streak=item.absent_streak,
        score_count=item.score_count,
        average_10=item.average_10,
    )


def _insight_for(db: Session, user: User, class_id: int, student_id: int) -> insights.StudentInsight:
    """Kiểm tra quyền + học viên có trong lớp, rồi tính số liệu của học viên đó."""
    classroom = get_class_or_404(db, class_id)
    ensure_can_manage_class(user, classroom)
    if crud.classes.get_enrollment(db, class_id, student_id) is None:
        raise NotFoundError("Học viên không thuộc lớp này.")
    student = crud.users.get_by_id(db, student_id)
    return insights.assess_student(db, class_id, student_id, student.full_name)


def _check_quota(db: Session, user: User) -> None:
    start_of_day = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used = crud.ai_notes.count_since(db, user.id, start_of_day)
    if used >= settings.ai_daily_limit:
        logger.warning("%s đã hết %d lượt AI hôm nay", user.username, settings.ai_daily_limit)
        raise TooManyRequestsError(f"Đã dùng hết {settings.ai_daily_limit} lượt AI hôm nay.")


def _review_for_staff(db: Session, user: User, note_id: int) -> AiNote:
    note = crud.ai_notes.get_note(db, note_id, AiNoteKind.review)
    if note is None:
        raise NotFoundError("Không tìm thấy nhận xét.")
    ensure_can_manage_class(user, get_class_or_404(db, note.class_id))
    return note


# ---------- Cảnh báo rủi ro ----------
@router.get("/risk", response_model=list[RiskOut])
def class_risk(
    class_id: int = Query(ge=1, description="Mã lớp cần phân tích"),
    only_at_risk: bool = Query(default=False, description="Chỉ trả học viên mức trung bình/cao"),
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    """Danh sách học viên của lớp kèm mức rủi ro (cao -> thấp) và lý do, tính bằng luật."""
    classroom = get_class_or_404(db, class_id)
    ensure_can_manage_class(user, classroom)
    items = insights.assess_class(db, class_id)
    if only_at_risk:
        items = [i for i in items if i.level != "low"]
    return [_to_risk(i) for i in items]


@router.post("/risk/advice", response_model=AdviceOut, status_code=201)
def risk_advice(data: AdviceIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    """AI gợi ý 3 hành động cho giáo viên với một học viên đang có dấu hiệu rủi ro (không hiện với học viên/phụ huynh)."""
    item = _insight_for(db, user, data.class_id, data.student_id)
    if not item.factors:
        raise BadRequestError("Học viên chưa có dấu hiệu rủi ro nên không cần gợi ý hành động.")
    _check_quota(db, user)
    content, provider = insights_ai.generate_advice(item)
    note = crud.ai_notes.create_note(
        db,
        kind=AiNoteKind.advice,
        class_id=data.class_id,
        student_id=data.student_id,
        author_id=user.id,
        content=content,
        provider=provider,
    )
    logger.info("%s xin gợi ý hành động (%s) cho học viên id=%d", user.username, provider, data.student_id)
    return note


# ---------- Nhận xét học viên ----------
@router.post("/reviews", response_model=ReviewOut, status_code=201)
def create_review(data: ReviewCreateIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    """AI soạn bản NHÁP nhận xét. Chưa ai ngoài giáo viên thấy cho đến khi bấm công bố."""
    item = _insight_for(db, user, data.class_id, data.student_id)
    _check_quota(db, user)
    content, provider = insights_ai.generate_review(item)
    note = crud.ai_notes.create_note(
        db,
        kind=AiNoteKind.review,
        class_id=data.class_id,
        student_id=data.student_id,
        author_id=user.id,
        content=content,
        provider=provider,
    )
    logger.info("%s tạo nháp nhận xét (%s) cho học viên id=%d", user.username, provider, data.student_id)
    return note


@router.get("/reviews", response_model=list[ReviewOut])
def list_reviews(
    response: Response,
    class_id: int | None = None,
    student_id: int | None = None,
    status: AiNoteStatus | None = None,
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Giáo viên/admin xem cả nháp và bản đã công bố. Học viên/phụ huynh chỉ thấy bản ĐÃ CÔNG BỐ của con mình."""
    if user.role in (Role.student, Role.parent):
        status = AiNoteStatus.published
    items, total = crud.ai_notes.list_reviews(
        db,
        scope=lambda q: scope_class_student_query(db, user, q, AiNote),
        class_id=class_id,
        student_id=student_id,
        status=status,
        skip=page.skip,
        limit=page.limit,
    )
    set_total(response, total)
    return items


@router.patch("/reviews/{note_id}", response_model=ReviewOut)
def edit_review(note_id: IdPath, data: ReviewUpdateIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Giáo viên sửa lại nội dung AI soạn (cả nháp lẫn bản đã công bố)."""
    note = _review_for_staff(db, user, note_id)
    return crud.ai_notes.update_content(db, note, data.content)


@router.post("/reviews/{note_id}/publish", response_model=ReviewOut)
def publish_review(note_id: IdPath, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Duyệt và công bố: từ lúc này học viên và phụ huynh của em đó mới đọc được."""
    note = _review_for_staff(db, user, note_id)
    updated = crud.ai_notes.set_status(db, note, AiNoteStatus.published)
    logger.info("%s công bố nhận xét id=%d", user.username, note_id)
    return updated


@router.post("/reviews/{note_id}/unpublish", response_model=ReviewOut)
def unpublish_review(note_id: IdPath, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Thu hồi về nháp (học viên/phụ huynh không còn thấy)."""
    note = _review_for_staff(db, user, note_id)
    return crud.ai_notes.set_status(db, note, AiNoteStatus.draft)


@router.delete("/reviews/{note_id}", status_code=204)
def delete_review(note_id: IdPath, db: Session = Depends(get_db), user: User = Depends(staff)):
    note = _review_for_staff(db, user, note_id)
    crud.ai_notes.delete_note(db, note)
    logger.info("%s xóa nhận xét id=%d", user.username, note_id)
