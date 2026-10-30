"""Gọi Gemini qua REST (httpx), dùng chung cho AI Coach, nhận xét học viên và gợi ý hành động.

Nguyên tắc: AI chỉ là lớp hỗ trợ. Không có khóa API hoặc gọi lỗi thì dùng bộ soạn theo luật để hệ thống vẫn chạy.
"""
import logging
from typing import Callable

import httpx

from app.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Các lỗi có thể xảy ra khi gọi Gemini hoặc đọc kết quả trả về
GEMINI_ERRORS = (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError)


def generate_text(prompt: str, timeout: float = 30) -> str:
    response = httpx.post(
        GEMINI_URL.format(model=settings.gemini_model),
        headers={"x-goog-api-key": settings.gemini_api_key or ""},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


def generate_with_fallback(prompt: str, fallback: Callable[[], str], log: logging.Logger) -> tuple[str, str]:
    """Trả về (nội dung, provider). Thử Gemini trước; thiếu khóa/lỗi/rỗng thì dùng `fallback()`."""
    if settings.gemini_api_key:
        try:
            text = generate_text(prompt)
            if text:
                return text, "gemini"
        except GEMINI_ERRORS as exc:
            # Chỉ ghi loại lỗi, không ghi nội dung prompt hay khóa API
            log.warning("Gemini lỗi (%s), chuyển sang bộ soạn theo luật", type(exc).__name__)
    return fallback(), "rules"
