"""Cấu hình logging (Buổi 7): mọi logger của ứng dụng nằm dưới tên "hkii"."""
import logging
import sys

from app.config import settings

_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"


def setup_logging() -> None:
    root_app = logging.getLogger("hkii")
    root_app.setLevel(settings.log_level.upper())
    if not root_app.handlers:  # tránh thêm handler lặp khi import nhiều lần
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(_FORMAT))
        root_app.addHandler(handler)
