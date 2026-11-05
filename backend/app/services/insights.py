"""Phát hiện học viên có nguy cơ tụt lại, bằng LUẬT (không dùng AI).

Chỉ dùng điểm danh và điểm số. Cố ý không đọc học phí để giáo viên không phải thấy dữ liệu tài chính.
Mỗi luật cho một số điểm rủi ro; cộng lại rồi chia mức: high >= 50, medium >= 25, còn lại low.
"""
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app import crud
from app.models import AttendanceStatus
from app.services.stats import attendance_rate

MIN_SESSIONS = 3  # ít hơn 3 buổi thì chưa đủ dữ liệu để kết luận về chuyên cần
HIGH_POINTS = 50
MEDIUM_POINTS = 25


@dataclass
class Factor:
    code: str
    points: int
    text: str


@dataclass
class StudentInsight:
    student_id: int
    full_name: str
    sessions: int
    present: int
    late: int
    absent: int
    excused: int
    attendance_rate: float | None
    absent_streak: int
    score_count: int
    average_10: float | None
    latest_10: float | None
    score_change: float | None  # điểm gần nhất trừ trung bình các điểm trước đó (âm = đang giảm)
    enough_data: bool
    points: int = 0
    level: str = "low"
    factors: list[Factor] = field(default_factory=list)


def absent_streak(statuses: list[AttendanceStatus]) -> int:
    """Số buổi vắng (không phép) liên tiếp tính từ buổi gần nhất; bỏ qua buổi vắng có phép."""
    streak = 0
    for status in reversed(statuses):
        if status == AttendanceStatus.excused:
            continue
        if status != AttendanceStatus.absent:
            break
        streak += 1
    return streak


def evaluate(student_id: int, full_name: str, statuses: list[AttendanceStatus], scores: list[float]) -> StudentInsight:
    """statuses và scores đều theo thứ tự thời gian (cũ -> mới); scores đã quy về thang 10."""
    counts = Counter(statuses)
    total = len(statuses)
    present, late = counts[AttendanceStatus.present], counts[AttendanceStatus.late]
    absent, excused = counts[AttendanceStatus.absent], counts[AttendanceStatus.excused]
    rate = attendance_rate(present, late, excused, total)
    streak = absent_streak(statuses)

    n_scores = len(scores)
    average = round(sum(scores) / n_scores, 2) if n_scores else None
    latest = round(scores[-1], 2) if n_scores else None
    change = None
    if n_scores >= 3:
        earlier = scores[:-1]
        change = round(scores[-1] - sum(earlier) / len(earlier), 2)

    insight = StudentInsight(
        student_id=student_id,
        full_name=full_name,
        sessions=total,
        present=present,
        late=late,
        absent=absent,
        excused=excused,
        attendance_rate=rate,
        absent_streak=streak,
        score_count=n_scores,
        average_10=average,
        latest_10=latest,
        score_change=change,
        enough_data=total >= MIN_SESSIONS or n_scores >= 1,
    )

    factors: list[Factor] = []
    if total >= MIN_SESSIONS and rate is not None:
        if rate < 0.6:
            factors.append(Factor("attendance_very_low", 40, f"Chuyên cần rất thấp ({rate:.0%})"))
        elif rate < 0.8:
            factors.append(Factor("attendance_low", 25, f"Chuyên cần thấp ({rate:.0%})"))
    if streak >= 3:
        factors.append(Factor("absent_streak", 30, f"Vắng liên tiếp {streak} buổi gần nhất"))
    elif streak == 2:
        factors.append(Factor("absent_streak", 15, "Vắng 2 buổi liên tiếp gần nhất"))
    if total >= 5 and late / total >= 0.3:
        factors.append(Factor("often_late", 10, f"Hay đi trễ ({late}/{total} buổi)"))
    if average is not None:
        if average < 5:
            factors.append(Factor("score_very_low", 40, f"Điểm trung bình rất thấp ({average}/10)"))
        elif average < 6.5:
            factors.append(Factor("score_low", 20, f"Điểm trung bình thấp ({average}/10)"))
    if change is not None and change <= -1.5:
        factors.append(Factor("score_drop", 15, f"Điểm gần nhất thấp hơn các bài trước {abs(change):.1f} điểm"))

    insight.factors = factors
    insight.points = min(sum(f.points for f in factors), 100)
    if insight.points >= HIGH_POINTS:
        insight.level = "high"
    elif insight.points >= MEDIUM_POINTS:
        insight.level = "medium"
    return insight


def assess_class(db: Session, class_id: int) -> list[StudentInsight]:
    """Đánh giá toàn bộ học viên của lớp; rủi ro cao xếp trước."""
    students = crud.classes.list_class_students(db, class_id)
    statuses = crud.attendance.statuses_by_student(db, class_id)
    scores = crud.scores.scaled_scores_by_student(db, class_id)
    items = [evaluate(s.id, s.full_name, statuses.get(s.id, []), scores.get(s.id, [])) for s in students]
    items.sort(key=lambda i: (-i.points, i.full_name))
    return items


def assess_student(db: Session, class_id: int, student_id: int, full_name: str) -> StudentInsight:
    statuses = crud.attendance.statuses_by_student(db, class_id, student_id).get(student_id, [])
    scores = crud.scores.scaled_scores_by_student(db, class_id, student_id).get(student_id, [])
    return evaluate(student_id, full_name, statuses, scores)
