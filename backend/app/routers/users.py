import csv
import io
import logging

from fastapi import APIRouter, Depends, Query, Response, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.deps import current_user, require_roles, visible_student_ids
from app.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError, PayloadTooLargeError
from app.models import Role, User
from app.params import IdPath
from app.pagination import Page, page_params, set_total
from app.schemas import ChildLinkIn, ImportResult, ImportRowError, UserCreate, UserOut, UserUpdate
from app.security import hash_password

router = APIRouter(tags=["users"])
admin_only = require_roles(Role.admin)
logger = logging.getLogger("hkii.users")

MAX_IMPORT_BYTES = 1_000_000
MAX_IMPORT_ROWS = 100  # băm bcrypt mỗi mật khẩu mất ~0,25 giây nên giới hạn số dòng mỗi lần
IMPORT_COLUMNS = ("username", "full_name", "password", "role")
IMPORT_ROLES = {Role.student, Role.teacher, Role.parent}  # không tạo admin hàng loạt


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


@router.get("/users/import/template", summary="Tải file CSV mẫu để nhập người dùng")
def import_template(_: User = Depends(admin_only)):
    content = "\ufeff" + ",".join(IMPORT_COLUMNS) + "\r\nhv20,Nguyễn Văn An,MatKhau@123,student\r\n"
    return Response(
        content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="mau-nhap-nguoi-dung.csv"'},
    )


@router.post("/users/import", response_model=ImportResult, summary="Nhập nhiều tài khoản từ file CSV")
def import_users(file: UploadFile, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """Cột bắt buộc: username, full_name, password, role (student | teacher | parent).

    Dòng hợp lệ được tạo; dòng lỗi hoặc trùng được bỏ qua và liệt kê trong `errors`.
    """
    if not (file.filename or "").lower().endswith(".csv"):
        raise BadRequestError("Chỉ nhận file .csv.")
    raw = file.file.read(MAX_IMPORT_BYTES + 1)
    if len(raw) > MAX_IMPORT_BYTES:
        raise PayloadTooLargeError("File quá lớn (tối đa 1 MB).")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise BadRequestError("File phải mã hóa UTF-8.")

    reader = csv.DictReader(io.StringIO(text))
    reader.fieldnames = [(name or "").strip().lower() for name in (reader.fieldnames or [])]
    missing = [c for c in IMPORT_COLUMNS if c not in reader.fieldnames]
    if missing:
        raise BadRequestError(f"File thiếu cột: {', '.join(missing)}.")
    rows = list(reader)
    if not rows:
        raise BadRequestError("File không có dòng dữ liệu nào.")
    if len(rows) > MAX_IMPORT_ROWS:
        raise BadRequestError(f"Tối đa {MAX_IMPORT_ROWS} dòng mỗi lần nhập.")

    errors: list[ImportRowError] = []
    to_create: list[dict] = []
    seen: set[str] = set()
    for line, row in enumerate(rows, start=2):  # dòng 1 là tiêu đề
        username = (row.get("username") or "").strip()
        try:
            data = UserCreate(
                username=username,
                full_name=(row.get("full_name") or "").strip(),
                password=row.get("password") or "",
                role=(row.get("role") or "").strip().lower(),
            )
        except ValidationError as exc:
            field = ".".join(str(p) for p in exc.errors()[0]["loc"])
            errors.append(ImportRowError(line=line, username=username or None, reason=f"Trường '{field}' không hợp lệ."))
            continue
        if data.role not in IMPORT_ROLES:
            errors.append(ImportRowError(line=line, username=username, reason="Không được tạo tài khoản admin bằng CSV."))
        elif data.username in seen or crud.users.username_exists(db, data.username):
            errors.append(ImportRowError(line=line, username=username, reason="Tên đăng nhập đã tồn tại."))
        else:
            seen.add(data.username)
            to_create.append(
                {
                    "username": data.username,
                    "full_name": data.full_name,
                    "password_hash": hash_password(data.password),
                    "role": data.role,
                }
            )

    created = crud.users.create_users(db, to_create) if to_create else 0
    logger.info("Admin %s nhập CSV: tạo %d, bỏ qua %d", admin.username, created, len(errors))
    return ImportResult(created=created, skipped=len(errors), errors=errors)


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: IdPath, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    user = crud.users.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("Không tìm thấy người dùng.")
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: IdPath,
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
def list_children(parent_id: IdPath, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role != Role.admin and user.id != parent_id:
        raise ForbiddenError("Không đủ quyền.")
    return crud.users.list_children(db, parent_id)


@router.post("/users/{parent_id}/children", status_code=201)
def link_child(
    parent_id: IdPath,
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
