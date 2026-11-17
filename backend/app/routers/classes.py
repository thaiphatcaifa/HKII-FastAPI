import logging

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.deps import (
    current_user,
    ensure_can_manage_class,
    get_class_or_404,
    require_roles,
    visible_student_ids,
)
from app.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.models import Role, User
from app.params import IdPath
from app.pagination import Page, page_params, set_total
from app.schemas import ClassCreate, ClassOut, ClassReplace, ClassUpdate, EnrollIn, UserOut

router = APIRouter(prefix="/classes", tags=["classes"])
admin_only = require_roles(Role.admin)
logger = logging.getLogger("hkii.classes")


def _check_teacher(db: Session, teacher_id: int | None) -> None:
    if teacher_id is None:
        return
    teacher = crud.users.get_by_id(db, teacher_id)
    if not teacher or teacher.role != Role.teacher:
        raise BadRequestError("teacher_id phải là một giáo viên hợp lệ.")


@router.get("", response_model=list[ClassOut])
def list_classes(
    response: Response,
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    teacher_id = user.id if user.role == Role.teacher else None
    student_ids = None
    if user.role in (Role.student, Role.parent):
        student_ids = visible_student_ids(db, user) or set()
    items, total = crud.classes.list_classes(
        db, teacher_id=teacher_id, student_ids=student_ids, skip=page.skip, limit=page.limit
    )
    set_total(response, total)
    return items


@router.post("", response_model=ClassOut, status_code=201)
def create_class(data: ClassCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if crud.classes.code_exists(db, data.code):
        raise ConflictError("Mã lớp đã tồn tại.")
    _check_teacher(db, data.teacher_id)
    classroom = crud.classes.create_class(db, data.model_dump())
    logger.info("Admin %s tạo lớp %s", admin.username, classroom.code)
    return classroom


@router.get("/{class_id}", response_model=ClassOut)
def get_class(class_id: IdPath, db: Session = Depends(get_db), user: User = Depends(current_user)):
    classroom = get_class_or_404(db, class_id)
    if user.role == Role.admin:
        return classroom
    if user.role == Role.teacher:
        ensure_can_manage_class(user, classroom)
        return classroom
    ids = visible_student_ids(db, user) or set()
    if not crud.classes.any_enrolled(db, class_id, ids):
        raise ForbiddenError("Bạn không thuộc lớp này.")
    return classroom


@router.put("/{class_id}", response_model=ClassOut)
def replace_class(
    class_id: IdPath,
    data: ClassReplace,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    """PUT: thay THẾ toàn bộ thông tin lớp (trường tùy chọn không gửi sẽ về rỗng). Muốn sửa một phần thì dùng PATCH."""
    classroom = get_class_or_404(db, class_id)
    if data.code != classroom.code and crud.classes.code_exists(db, data.code):
        raise ConflictError("Mã lớp đã tồn tại.")
    _check_teacher(db, data.teacher_id)
    updated = crud.classes.update_class(db, classroom, data.model_dump())
    logger.info("Admin %s thay thế thông tin lớp %s", admin.username, updated.code)
    return updated


@router.patch("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: IdPath,
    data: ClassUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    classroom = get_class_or_404(db, class_id)
    changes = data.model_dump(exclude_unset=True)
    if "teacher_id" in changes:
        _check_teacher(db, changes["teacher_id"])
    return crud.classes.update_class(db, classroom, changes)


# Nhãn tiếng Việt cho từng loại dữ liệu còn gắn với lớp (dùng trong thông báo 409)
_DEPENDENT_LABELS = {
    "enrollments": "học viên ghi danh",
    "attendance": "bản ghi điểm danh",
    "scores": "điểm số",
    "tuition": "khoản học phí",
    "ai_notes": "nhận xét AI",
}


@router.delete("/{class_id}", status_code=204)
def delete_class(class_id: IdPath, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """Xóa lớp (chỉ admin). Lớp còn dữ liệu gắn kèm thì trả 409 kèm lý do, không xóa dây chuyền."""
    classroom = get_class_or_404(db, class_id)
    counts = crud.classes.dependent_counts(db, class_id)
    remaining = [f"{n} {_DEPENDENT_LABELS[key]}" for key, n in counts.items() if n]
    if remaining:
        raise ConflictError(
            f"Không thể xóa lớp {classroom.code} vì lớp còn " + ", ".join(remaining) + ". Hãy chuyển hoặc xóa các dữ liệu này trước."
        )
    code = classroom.code
    crud.classes.delete_class(db, classroom)
    logger.info("Admin %s xóa lớp %s", admin.username, code)


@router.get("/{class_id}/students", response_model=list[UserOut])
def list_class_students(
    class_id: IdPath,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.teacher)),
):
    classroom = get_class_or_404(db, class_id)
    ensure_can_manage_class(user, classroom)
    return crud.classes.list_class_students(db, class_id)


@router.post("/{class_id}/students", status_code=201)
def enroll_student(
    class_id: IdPath,
    data: EnrollIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.teacher)),
):
    classroom = get_class_or_404(db, class_id)
    ensure_can_manage_class(user, classroom)
    student = crud.users.get_by_id(db, data.student_id)
    if not student or student.role != Role.student:
        raise NotFoundError("Không tìm thấy học viên.")
    if crud.classes.get_enrollment(db, class_id, data.student_id):
        raise ConflictError("Học viên đã có trong lớp.")
    crud.classes.enroll(db, class_id, data.student_id)
    logger.info("%s ghi danh học viên %s vào lớp %s", user.username, student.username, classroom.code)
    return {"class_id": class_id, "student_id": data.student_id}


@router.delete("/{class_id}/students/{student_id}", status_code=204)
def remove_student(
    class_id: IdPath,
    student_id: IdPath,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.teacher)),
):
    classroom = get_class_or_404(db, class_id)
    ensure_can_manage_class(user, classroom)
    enrollment = crud.classes.get_enrollment(db, class_id, student_id)
    if not enrollment:
        raise NotFoundError("Học viên không có trong lớp.")
    crud.classes.unenroll(db, enrollment)
    logger.info("%s xóa học viên id=%d khỏi lớp %s", user.username, student_id, classroom.code)
