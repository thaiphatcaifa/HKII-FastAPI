import logging

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.deps import current_user, require_roles, visible_student_ids
from app.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.models import Role, User
from app.pagination import Page, page_params, set_total
from app.schemas import ChildLinkIn, UserCreate, UserOut, UserUpdate
from app.security import hash_password

router = APIRouter(tags=["users"])
admin_only = require_roles(Role.admin)
logger = logging.getLogger("hkii.users")


@router.get("/users", response_model=list[UserOut])
def list_users(
    response: Response,
    role: Role | None = None,
    q: str | None = Query(default=None, max_length=64),
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    items, total = crud.users.list_users(db, role=role, q=q, skip=page.skip, limit=page.limit)
    set_total(response, total)
    return items


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if crud.users.username_exists(db, data.username):
        raise ConflictError("Tên đăng nhập đã tồn tại.")
    user = crud.users.create_user(
        db,
        username=data.username,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    logger.info("Admin %s tạo tài khoản %s (%s)", admin.username, user.username, user.role.value)
    return user


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    user = crud.users.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("Không tìm thấy người dùng.")
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = crud.users.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("Không tìm thấy người dùng.")
    if user.id == admin.id and (data.is_active is False or (data.role and data.role != Role.admin)):
        raise BadRequestError("Không thể tự khóa hoặc hạ quyền chính mình.")
    updated = crud.users.update_user(
        db,
        user,
        full_name=data.full_name,
        role=data.role,
        is_active=data.is_active,
        password_hash=hash_password(data.password) if data.password is not None else None,
    )
    logger.info("Admin %s cập nhật tài khoản %s", admin.username, updated.username)
    return updated


@router.get("/students", response_model=list[UserOut])
def list_visible_students(
    response: Response,
    page: Page = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Danh sách học viên mà người đang đăng nhập được phép xem."""
    items, total = crud.users.list_students(db, visible_student_ids(db, user), skip=page.skip, limit=page.limit)
    set_total(response, total)
    return items


@router.get("/users/{parent_id}/children", response_model=list[UserOut])
def list_children(parent_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role != Role.admin and user.id != parent_id:
        raise ForbiddenError("Không đủ quyền.")
    return crud.users.list_children(db, parent_id)


@router.post("/users/{parent_id}/children", status_code=201)
def link_child(
    parent_id: int,
    data: ChildLinkIn,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    parent = crud.users.get_by_id(db, parent_id)
    student = crud.users.get_by_id(db, data.student_id)
    if not parent or parent.role != Role.parent:
        raise NotFoundError("Không tìm thấy phụ huynh.")
    if not student or student.role != Role.student:
        raise NotFoundError("Không tìm thấy học viên.")
    if crud.users.get_parent_link(db, parent_id, data.student_id):
        raise ConflictError("Đã liên kết trước đó.")
    crud.users.link_parent_student(db, parent_id, data.student_id)
    return {"parent_id": parent_id, "student_id": data.student_id}
