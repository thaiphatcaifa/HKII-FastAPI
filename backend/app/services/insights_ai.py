"""AI soạn NHÁP nhận xét học viên và GỢI Ý hành động cho giáo viên.

Quyền riêng tư: lời nhắc gửi cho Gemini chỉ chứa CON SỐ (chuyên cần, điểm), tuyệt đối không có tên học viên
hay ghi chú tự do. AI chỉ đề xuất; giáo viên sửa và duyệt trước khi công bố. Gemini lỗi/không có khóa thì
dùng bộ soạn theo luật nên tính năng vẫn chạy khi demo.
"""
import logging

from app.services.gemini import generate_with_fallback, generate_with_fallback_async
from app.services.insights import StudentInsight

logger = logging.getLogger("hkii.ai")

LEVEL_TEXT = {"high": "cao", "medium": "trung bình", "low": "thấp"}

_REVIEW_PROMPT = (
    "Bạn là giáo viên tiếng Anh đang viết nhận xét ngắn gửi phụ huynh. Chỉ dựa vào số liệu bên dưới "
    "(đã ẩn danh), hãy viết MỘT đoạn văn tiếng Việt khoảng 80-120 từ, xưng hô \"em\", giọng khích lệ nhưng trung thực, "
    "gồm: điều em làm tốt, điều cần cải thiện, và một lời khuyên cụ thể cho tuần tới. "
    "Không bịa thêm thông tin ngoài số liệu, không dùng tiêu đề hay gạch đầu dòng.\n\nSố liệu:\n{facts}"
)

_ADVICE_PROMPT = (
    "Bạn là trợ lý học vụ của một trung tâm tiếng Anh. Dưới đây là số liệu (đã ẩn danh) của một học viên "
    "có nguy cơ tụt lại ở mức {level}. Hãy đề xuất đúng 3 hành động cụ thể mà giáo viên có thể làm trong 1-2 tuần tới "
    "(ví dụ liên hệ phụ huynh, bố trí buổi phụ đạo, giao bài bổ trợ). Mỗi hành động một dòng bắt đầu bằng \"- \", "
    "tối đa 25 từ, tiếng Việt. Chỉ dựa vào số liệu, không suy đoán nguyên nhân.\n\n"
    "Số liệu:\n{facts}\n\nDấu hiệu hệ thống đã phát hiện:\n{reasons}"
)


def _percent(value: float | None) -> str:
    return "chưa có" if value is None else f"{value:.0%}"


def _trend(change: float | None) -> str | None:
    if change is None:
        return None
    if change <= -1:
        return "đang giảm"
    if change >= 1:
        return "đang tăng"
    return "ổn định"


def facts_text(i: StudentInsight) -> str:
    """Các con số gửi cho AI. KHÔNG chứa tên hay bất kỳ văn bản tự do nào."""
    lines = [
        f"- Số buổi đã điểm danh: {i.sessions} (có mặt {i.present}, đi trễ {i.late}, vắng {i.absent}, vắng có phép {i.excused})",
        f"- Tỷ lệ chuyên cần: {_percent(i.attendance_rate)}",
        f"- Số buổi vắng liên tiếp gần nhất: {i.absent_streak}",
    ]
    if i.average_10 is None:
        lines.append("- Điểm số: chưa có")
    else:
        lines.append(f"- Điểm trung bình: {i.average_10}/10 ({i.score_count} đầu điểm), điểm gần nhất {i.latest_10}/10")
        trend = _trend(i.score_change)
        if trend:
            lines.append(f"- Xu hướng điểm: {trend}")
    return "\n".join(lines)


# ---------- Nhận xét học viên ----------
def review_fallback(i: StudentInsight) -> str:
    if not i.enough_data:
        return (
            "Em mới bắt đầu nên giáo viên chưa có đủ dữ liệu điểm danh và điểm số để nhận xét. "
            "Giáo viên sẽ cập nhật nhận xét sau vài buổi học."
        )
    parts: list[str] = []
    rate = i.attendance_rate
    if rate is not None:
        if rate >= 0.9:
            parts.append(f"Em đi học rất đều (chuyên cần {rate:.0%}).")
        elif rate >= 0.8:
            parts.append(f"Em đi học khá đều (chuyên cần {rate:.0%}), cố gắng hạn chế vắng thêm nhé.")
        else:
            parts.append(f"Chuyên cần của em còn thấp ({rate:.0%}), em cần đi học đều hơn để theo kịp bài.")
    if i.absent_streak >= 2:
        parts.append(f"Gần đây em đã vắng {i.absent_streak} buổi liên tiếp.")
    if i.average_10 is not None:
        if i.average_10 >= 8:
            parts.append(f"Kết quả học tập tốt với điểm trung bình {i.average_10}/10.")
        elif i.average_10 >= 6.5:
            parts.append(f"Kết quả học tập ở mức khá với điểm trung bình {i.average_10}/10.")
        else:
            parts.append(f"Điểm trung bình hiện là {i.average_10}/10, em cần ôn tập thêm.")
        if i.score_change is not None and i.score_change <= -1.5:
            parts.append("Điểm gần nhất thấp hơn các bài trước, em nên xem lại phần kiến thức đã làm sai.")
        elif i.score_change is not None and i.score_change >= 1.5:
            parts.append("Điểm gần đây tiến bộ rõ rệt, em hãy tiếp tục phát huy.")
    if i.level == "low":
        parts.append("Tuần tới em hãy duy trì phong độ và thử thêm một bài luyện tập nâng cao.")
    else:
        parts.append("Tuần tới em hãy ưu tiên đi học đủ buổi và làm lại các bài đã sai.")
    return " ".join(parts)


def generate_review(i: StudentInsight) -> tuple[str, str]:
    """Trả về (nội dung nháp, provider)."""
    return generate_with_fallback(_REVIEW_PROMPT.format(facts=facts_text(i)), lambda: review_fallback(i), logger)


# ---------- Gợi ý hành động cho giáo viên ----------
_ACTIONS = {
    "attendance_very_low": "Trao đổi với học viên và phụ huynh để tìm hiểu lý do vắng, thống nhất lại lịch đi học.",
    "attendance_low": "Nhắc học viên đi học đều và hỏi xem lịch học hiện tại có gây khó khăn gì không.",
    "absent_streak": "Gọi điện hỏi thăm ngay trong tuần này vì học viên vắng liên tiếp, tránh bỏ học giữa chừng.",
    "often_late": "Trao đổi với học viên về việc đến muộn và nhắc đến sớm khoảng 10 phút.",
    "score_very_low": "Bố trí buổi phụ đạo ngắn và giao bài ôn đúng phần kiến thức còn yếu.",
    "score_low": "Giao thêm bài luyện tập nhỏ mỗi tuần và kiểm tra lại sau 2 tuần.",
    "score_drop": "Xem lại bài kiểm tra gần nhất cùng học viên để tìm phần kiến thức bị hổng.",
}
# Thêm vào khi học viên có ít dấu hiệu, để luôn đủ 3 gợi ý như đã hứa với giáo viên
_GENERAL_ACTIONS = (
    "Theo dõi lại số liệu sau 2 tuần để xem biện pháp có hiệu quả không.",
    "Trao đổi ngắn với học viên để hiểu khó khăn hiện tại và thống nhất mục tiêu cho 2 tuần tới.",
)


def advice_fallback(i: StudentInsight) -> str:
    actions: list[str] = []
    for factor in sorted(i.factors, key=lambda f: -f.points):
        action = _ACTIONS.get(factor.code)
        if action and action not in actions:
            actions.append(action)
    if not actions:
        return "- Học viên đang ổn định, tiếp tục theo dõi định kỳ."
    return "\n".join(f"- {a}" for a in [*actions, *_GENERAL_ACTIONS][:3])


async def generate_advice(i: StudentInsight) -> tuple[str, str]:
    prompt = _ADVICE_PROMPT.format(
        level=LEVEL_TEXT.get(i.level, i.level),
        facts=facts_text(i),
        reasons="\n".join(f"- {f.text}" for f in i.factors) or "- (không có)",
    )
    return await generate_with_fallback_async(prompt, lambda: advice_fallback(i), logger)
