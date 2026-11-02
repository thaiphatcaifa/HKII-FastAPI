"""Công thức thống kê dùng chung (báo cáo lớp, tóm tắt chuyên cần, phân tích rủi ro)."""


def attendance_rate(present: int, late: int, excused: int, total: int) -> float | None:
    """Tỷ lệ chuyên cần = (có mặt + đi trễ) / (tổng buổi - vắng có phép). None nếu chưa có buổi tính được."""
    denominator = total - excused
    if denominator <= 0:
        return None
    return round((present + late) / denominator, 4)
