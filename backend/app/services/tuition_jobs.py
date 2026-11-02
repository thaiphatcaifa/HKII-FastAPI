"""Việc chạy nền: tự động đánh dấu học phí quá hạn (thay cho tuitionAutoOverdue của Firebase).

Được gọi bằng BackgroundTasks của FastAPI sau các request xem học phí, và một lần khi khởi động.
Có giới hạn tần suất (overdue_refresh_seconds) để không quét CSDL ở mỗi request.
"""
import datetime as dt
import logging
import threading
import time

from app import crud
from app.config import settings
from app.db import SessionLocal

logger = logging.getLogger("hkii.jobs")

_lock = threading.Lock()
_last_run: float | None = None


def reset_throttle() -> None:
    """Dùng trong test: cho phép chạy lại ngay."""
    global _last_run
    with _lock:
        _last_run = None


def refresh_overdue(force: bool = False) -> int | None:
    """Đánh dấu quá hạn các khoản chưa đóng có hạn trước hôm nay.

    Trả về số khoản đã cập nhật, hoặc None nếu bị bỏ qua (tắt tính năng / vừa chạy gần đây / lỗi).
    """
    global _last_run
    if not settings.auto_overdue_enabled and not force:
        return None
    with _lock:
        now = time.monotonic()
        if not force and _last_run is not None and now - _last_run < settings.overdue_refresh_seconds:
            return None
        _last_run = now
    try:
        with SessionLocal() as db:
            updated = crud.tuition.mark_overdue(db, dt.date.today())
    except Exception:  # việc nền không được làm hỏng request chính
        logger.exception("Không tự đánh dấu quá hạn được")
        return None
    if updated:
        logger.info("Tự động đánh dấu quá hạn %d khoản học phí", updated)
    return updated
