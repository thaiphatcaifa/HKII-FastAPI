import datetime as dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import AttendanceStatus, Role, TuitionStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / User ----------
class LoginIn(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"username": "admin", "password": "Hkii@12345"}]})

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool


class OAuth2Token(BaseModel):
    """Dạng trả về chuẩn của OAuth2 (dùng cho nút Authorize trên Swagger)."""

    access_token: str
    token_type: str = "bearer"


class TokenOut(OAuth2Token):
    user: UserOut


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"username": "hv09", "full_name": "Nguyễn Văn An", "password": "MatKhau@123", "role": "student"}]
        }
    )

    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Role


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class ChildLinkIn(BaseModel):
    student_id: int


# ---------- Class ----------
class ClassCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"code": "IELTS-C1", "name": "IELTS Advanced C1", "schedule": "T2-T4 18:00", "teacher_id": 2}]}
    )

    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    schedule: str | None = Field(default=None, max_length=200)
    teacher_id: int | None = None


class ClassReplace(BaseModel):
    """Dùng cho PUT: thay thế toàn bộ thông tin lớp."""

    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    schedule: str | None = Field(default=None, max_length=200)
    teacher_id: int | None = None


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    schedule: str | None = Field(default=None, max_length=200)
    teacher_id: int | None = None


class ClassOut(ORM):
    id: int
    code: str
    name: str
    schedule: str | None
    teacher_id: int | None


class EnrollIn(BaseModel):
    student_id: int


# ---------- Attendance ----------
class AttendanceRecordIn(BaseModel):
    student_id: int
    status: AttendanceStatus
    note: str | None = Field(default=None, max_length=300)


class AttendanceBatchIn(BaseModel):
    class_id: int
    date: dt.date
    records: list[AttendanceRecordIn] = Field(min_length=1)


class AttendanceOut(ORM):
    id: int
    class_id: int
    student_id: int
    date: dt.date
    status: AttendanceStatus
    note: str | None


class AttendanceSummary(BaseModel):
    student_id: int
    total: int
    present: int
    late: int
    absent: int
    excused: int
    attendance_rate: float | None  # (present+late)/(total-excused), None nếu chưa có buổi nào


# ---------- Score ----------
class ScoreCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"class_id": 1, "student_id": 4, "kind": "midterm", "value": 8.5, "max_value": 10}]}
    )

    class_id: int
    student_id: int
    kind: str = Field(min_length=1, max_length=40)
    value: float = Field(ge=0)
    max_value: float = Field(default=10, gt=0)
    note: str | None = Field(default=None, max_length=300)


class ScoreUpdate(BaseModel):
    value: float | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=300)


class ScoreOut(ORM):
    id: int
    class_id: int
    student_id: int
    kind: str
    value: float
    max_value: float
    note: str | None


class ScoreClassSummary(BaseModel):
    class_id: int
    count: int
    average_10: float  # quy về thang 10


# ---------- Tuition ----------
class TuitionCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"student_id": 4, "class_id": 1, "amount": 1500000, "due_date": "2026-12-31"}]}
    )

    student_id: int
    class_id: int | None = None
    amount: float = Field(gt=0)
    due_date: dt.date
    note: str | None = Field(default=None, max_length=300)


class TuitionOut(ORM):
    id: int
    student_id: int
    class_id: int | None
    amount: float
    due_date: dt.date
    status: TuitionStatus
    paid_at: dt.datetime | None
    note: str | None


class TuitionSummary(BaseModel):
    unpaid: float
    paid: float
    overdue: float
    count_by_status: dict[str, int]


# ---------- Coach ----------
class CoachIn(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"kind": "writing", "text": "I like learning English because it helps me talk with many people."}]
        }
    )

    kind: Literal["writing", "speaking"]
    text: str = Field(min_length=20, max_length=4000)


class CoachOut(ORM):
    id: int
    kind: str
    feedback: str
    provider: str
    created_at: dt.datetime


# ---------- Nhập người dùng từ CSV ----------
class ImportRowError(BaseModel):
    line: int
    username: str | None = None
    reason: str


class ImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[ImportRowError]
