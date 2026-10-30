import datetime as dt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.common import paginate
from app.models import ParentStudent, Role, User, utcnow


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def username_exists(db: Session, username: str) -> bool:
    return db.scalar(select(User.id).where(User.username == username)) is not None


def list_users(db: Session, *, role: Role | None, q: str | None, skip: int, limit: int):
    query = select(User).order_by(User.id)
    if role:
        query = query.where(User.role == role)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(User.full_name.ilike(like) | User.username.ilike(like))
    return paginate(db, query, skip, limit)


def create_user(db: Session, *, username: str, full_name: str, password_hash: str, role: Role) -> User:
    user = User(username=username, full_name=full_name, password_hash=password_hash, role=role)
    db.add(user)
    db.commit()
    return user


def create_users(db: Session, items: list[dict]) -> int:
    """Tạo nhiều tài khoản, commit một lần. Mỗi item gồm username, full_name, password_hash, role."""
    db.add_all([User(**item) for item in items])
    db.commit()
    return len(items)


def update_user(
    db: Session,
    user: User,
    *,
    full_name: str | None = None,
    role: Role | None = None,
    is_active: bool | None = None,
    password_hash: str | None = None,
) -> User:
    if full_name is not None:
        user.full_name = full_name
    if role is not None:
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    if password_hash is not None:
        user.password_hash = password_hash
        user.failed_attempts = 0
        user.locked_until = None
    db.commit()
    return user


def set_password(db: Session, user: User, password_hash: str) -> None:
    user.password_hash = password_hash
    db.commit()


def record_failed_login(db: Session, user: User, max_attempts: int, lock_minutes: int) -> bool:
    """Tăng số lần sai; đủ ngưỡng thì khóa tạm. Trả về True nếu vừa bị khóa."""
    user.failed_attempts += 1
    locked = user.failed_attempts >= max_attempts
    if locked:
        user.locked_until = utcnow() + dt.timedelta(minutes=lock_minutes)
        user.failed_attempts = 0
    db.commit()
    return locked


def reset_login_state(db: Session, user: User) -> None:
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()


def list_students(db: Session, visible_ids: set[int] | None, *, skip: int, limit: int):
    """Học viên đang hoạt động. visible_ids=None nghĩa là thấy tất cả (admin)."""
    query = select(User).where(User.role == Role.student, User.is_active.is_(True)).order_by(User.full_name)
    if visible_ids is not None:
        query = query.where(User.id.in_(list(visible_ids)))
    return paginate(db, query, skip, limit)


def child_ids(db: Session, parent_id: int) -> set[int]:
    return set(db.scalars(select(ParentStudent.student_id).where(ParentStudent.parent_id == parent_id)))


def list_children(db: Session, parent_id: int) -> list[User]:
    ids = select(ParentStudent.student_id).where(ParentStudent.parent_id == parent_id)
    return list(db.scalars(select(User).where(User.id.in_(ids)).order_by(User.full_name)).all())


def get_parent_link(db: Session, parent_id: int, student_id: int) -> ParentStudent | None:
    return db.get(ParentStudent, (parent_id, student_id))


def link_parent_student(db: Session, parent_id: int, student_id: int) -> None:
    db.add(ParentStudent(parent_id=parent_id, student_id=student_id))
    db.commit()
