import datetime as dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import AiNoteStatus, AttendanceStatus, Role, TuitionStatus


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


class TuitionUpdate(BaseModel):
    """Sửa khoản học phí CHƯA đóng: chỉ đổi số tiền, hạn đóng, ghi chú (gửi trường nào sửa trường đó)."""

    model_config = ConfigDict(json_schema_extra={"examples": [{"amount": 1800000, "due_date": "2026-12-15", "note": "Giảm 10%"}]})

    amount: float | None = Field(default=None, gt=0)
    due_date: dt.date | None = None
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


COACH_CRITERIA = ("grammar", "vocabulary", "coherence", "development")  # tiêu chí chấm, thang 0-10


class CoachErrorItem(BaseModel):
    original: str  # đoạn trích nguyên văn trong bài
    corrected: str
    explanation: str = ""


class CoachAnalysis(BaseModel):
    """Kết quả chấm có cấu trúc. Dùng chung để kiểm tra dữ liệu Gemini trả về và để trả ra API."""

    scores: dict[str, float]
    errors: list[CoachErrorItem] = Field(default_factory=list)
    strengths: str = ""
    tips: list[str] = Field(default_factory=list)

    @field_validator("scores")
    @classmethod
    def _clean_scores(cls, value: dict[str, float]) -> dict[str, float]:
        cleaned = {k: round(min(max(v, 0.0), 10.0), 1) for k, v in value.items() if k in COACH_CRITERIA}
        if not cleaned:
            raise ValueError("Không có điểm tiêu chí hợp lệ.")
        return cleaned

    @field_validator("errors")
    @classmethod
    def _cap_errors(cls, value: list[CoachErrorItem]) -> list[CoachErrorItem]:
        return value[:8]

    @field_validator("tips")
    @classmethod
    def _clean_tips(cls, value: list[str]) -> list[str]:
        return [t.strip() for t in value if t and t.strip()][:3]


class CoachOut(ORM):
    id: int
    kind: str
    feedback: str  # bản chữ của nhận xét (giữ cho các lượt cũ chưa có analysis)
    provider: str
    overall: float | None = None
    analysis: CoachAnalysis | None = None
    created_at: dt.datetime


class CoachPoint(BaseModel):
    id: int
    kind: str
    provider: str
    overall: float
    scores: dict[str, float]
    created_at: dt.datetime


class CoachProgressOut(BaseModel):
    points: list[CoachPoint]  # cũ -> mới, chỉ gồm các lượt có điểm
    average: float | None
    best: float | None


# ---------- AI: cảnh báo rủi ro + nhận xét học viên ----------
class RiskOut(BaseModel):
    student_id: int
    full_name: str
    level: Literal["high", "medium", "low"]
    points: int  # tổng điểm rủi ro (0-100), càng cao càng đáng lo
    enough_data: bool  # False: chưa đủ buổi/điểm để kết luận
    reasons: list[str]
    sessions: int
    attendance_rate: float | None
    absent_streak: int
    score_count: int
    average_10: float | None


class AdviceIn(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"class_id": 1, "student_id": 4}]})

    class_id: int = Field(ge=1)
    student_id: int = Field(ge=1)


class AdviceOut(ORM):
    id: int
    class_id: int
    student_id: int
    content: str
    provider: str
    created_at: dt.datetime


class ReviewCreateIn(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"class_id": 1, "student_id": 4}]})

    class_id: int = Field(ge=1)
    student_id: int = Field(ge=1)


class ReviewUpdateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(min_length=10, max_length=3000)


class ReviewOut(ORM):
    id: int
    class_id: int
    student_id: int
    content: str
    provider: str
    status: AiNoteStatus
    created_at: dt.datetime
    updated_at: dt.datetime
    published_at: dt.datetime | None


# ---------- Nhập người dùng từ CSV ----------
class ImportRowError(BaseModel):
    line: int
    username: str | None = None
    reason: str


class ImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[ImportRowError]
