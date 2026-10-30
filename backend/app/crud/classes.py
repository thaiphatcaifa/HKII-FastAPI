from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.common import paginate
from app.models import Classroom, Enrollment, User


def get_class(db: Session, class_id: int) -> Classroom | None:
    return db.get(Classroom, class_id)


def code_exists(db: Session, code: str) -> bool:
    return db.scalar(select(Classroom.id).where(Classroom.code == code)) is not None


def list_classes(
    db: Session,
    *,
    teacher_id: int | None = None,
    student_ids: set[int] | None = None,
    skip: int,
    limit: int,
):
    """teacher_id: chỉ lớp của giáo viên đó. student_ids: chỉ lớp có các học viên đó học."""
    query = select(Classroom).order_by(Classroom.code)
    if teacher_id is not None:
        query = query.where(Classroom.teacher_id == teacher_id)
    elif student_ids is not None:
        enrolled = select(Enrollment.class_id).where(Enrollment.student_id.in_(list(student_ids)))
        query = query.where(Classroom.id.in_(enrolled))
    return paginate(db, query, skip, limit)


def create_class(db: Session, values: dict) -> Classroom:
    classroom = Classroom(**values)
    db.add(classroom)
    db.commit()
    return classroom


def update_class(db: Session, classroom: Classroom, changes: dict) -> Classroom:
    for field, value in changes.items():
        setattr(classroom, field, value)
    db.commit()
    return classroom


# ---------- Ghi danh ----------
def any_enrolled(db: Session, class_id: int, student_ids: set[int]) -> bool:
    """Có học viên nào trong student_ids thuộc lớp này không."""
    found = db.scalar(
        select(Enrollment.id).where(
            Enrollment.class_id == class_id, Enrollment.student_id.in_(list(student_ids))
        )
    )
    return found is not None


def get_enrollment(db: Session, class_id: int, student_id: int) -> Enrollment | None:
    return db.scalar(
        select(Enrollment).where(Enrollment.class_id == class_id, Enrollment.student_id == student_id)
    )


def enrolled_student_ids(db: Session, class_id: int) -> set[int]:
    return set(db.scalars(select(Enrollment.student_id).where(Enrollment.class_id == class_id)))


def list_class_students(db: Session, class_id: int) -> list[User]:
    ids = select(Enrollment.student_id).where(Enrollment.class_id == class_id)
    return list(db.scalars(select(User).where(User.id.in_(ids)).order_by(User.full_name)).all())


def enroll(db: Session, class_id: int, student_id: int) -> None:
    db.add(Enrollment(class_id=class_id, student_id=student_id))
    db.commit()


def unenroll(db: Session, enrollment: Enrollment) -> None:
    db.delete(enrollment)
    db.commit()


# ---------- Phạm vi dữ liệu theo giáo viên (dùng cho phân quyền) ----------
def teacher_class_ids_select(teacher_id: int):
    """Truy vấn con: id các lớp do giáo viên phụ trách."""
    return select(Classroom.id).where(Classroom.teacher_id == teacher_id)


def student_ids_of_teacher(db: Session, teacher_id: int) -> set[int]:
    own = teacher_class_ids_select(teacher_id)
    return set(db.scalars(select(Enrollment.student_id).where(Enrollment.class_id.in_(own))))
