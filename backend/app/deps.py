"""Xác thực + phân quyền. Thay cho database.rules.json của Firebase."""
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.errors import ForbiddenError, NotFoundError, UnauthorizedError
from app.models import Classroom, Role, User
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise UnauthorizedError()
    try:
        payload = decode_access_token(creds.credentials)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise UnauthorizedError()
    user = crud.users.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError()
    return user


def require_roles(*roles: Role):
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise ForbiddenError("Không đủ quyền thực hiện thao tác này.")
        return user

    return dependency


# ---------- Phạm vi dữ liệu theo vai trò ----------
def visible_student_ids(db: Session, user: User) -> set[int] | None:
    """None = thấy tất cả (admin). Ngược lại là tập id học viên được phép xem."""
    if user.role == Role.admin:
        return None
    if user.role == Role.student:
        return {user.id}
    if user.role == Role.parent:
        return crud.users.child_ids(db, user.id)
    return crud.classes.student_ids_of_teacher(db, user.id)


def ensure_can_view_student(db: Session, user: User, student_id: int) -> None:
    ids = visible_student_ids(db, user)
    if ids is not None and student_id not in ids:
        raise ForbiddenError("Bạn không có quyền xem dữ liệu của học viên này.")


def get_class_or_404(db: Session, class_id: int) -> Classroom:
    classroom = crud.classes.get_class(db, class_id)
    if classroom is None:
        raise NotFoundError("Không tìm thấy lớp học.")
    return classroom


def ensure_can_manage_class(user: User, classroom: Classroom) -> None:
    if user.role == Role.admin:
        return
    if user.role == Role.teacher and classroom.teacher_id == user.id:
        return
    raise ForbiddenError("Bạn không phụ trách lớp này.")


def scope_class_student_query(db: Session, user: User, query, model):
    """Giới hạn truy vấn của bảng có cột class_id + student_id theo vai trò."""
    if user.role == Role.admin:
        return query
    if user.role == Role.teacher:
        return query.where(model.class_id.in_(crud.classes.teacher_class_ids_select(user.id)))
    ids = visible_student_ids(db, user) or set()
    return query.where(model.student_id.in_(list(ids)))
