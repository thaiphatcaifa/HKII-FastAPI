"""Gọi Gemini qua REST (httpx), dùng chung cho AI Coach, nhận xét học viên và gợi ý hành động.

Nguyên tắc: AI chỉ là lớp hỗ trợ. Không có khóa API hoặc gọi lỗi thì dùng bộ soạn theo luật để hệ thống vẫn chạy.

Có hai bản: bản đồng bộ cho endpoint `def` (FastAPI tự chạy trong threadpool) và bản `*_async` dùng
httpx.AsyncClient cho endpoint `async def`, nhường event loop trong lúc chờ Gemini trả lời.
"""
import json
import logging
from typing import Callable

import httpx

from app.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Các lỗi có thể xảy ra khi gọi Gemini hoặc đọc kết quả trả về.
# json.JSONDecodeError và pydantic.ValidationError đều là con của ValueError.
GEMINI_ERRORS = (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError)


def _request_args(prompt: str, generation_config: dict | None) -> dict:
    body: dict = {"contents": [{"parts": [{"text": prompt}]}]}
    if generation_config:
        body["generationConfig"] = generation_config
    return {
        "url": GEMINI_URL.format(model=settings.gemini_model),
        "headers": {"x-goog-api-key": settings.gemini_api_key or ""},
        "json": body,
    }


def _read_text(response: httpx.Response) -> str:
    response.raise_for_status()
    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


def _post(prompt: str, generation_config: dict | None, timeout: float) -> str:
    return _read_text(httpx.post(**_request_args(prompt, generation_config), timeout=timeout))


def generate_text(prompt: str, timeout: float = 30) -> str:
    return _post(prompt, None, timeout)


async def generate_text_async(prompt: str, timeout: float = 30) -> str:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(**_request_args(prompt, None))
    return _read_text(response)


def generate_json(prompt: str, timeout: float = 30):
    """Yêu cầu Gemini trả JSON (responseMimeType). Nơi gọi phải kiểm tra lại cấu trúc bằng Pydantic."""
    text = _post(prompt, {"responseMimeType": "application/json", "temperature": 0.3}, timeout)
    if text.startswith("```"):  # phòng khi mô hình vẫn bọc trong khối mã
        text = text.strip("`").removeprefix("json").strip()
    return json.loads(text)


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


async def generate_with_fallback_async(prompt: str, fallback: Callable[[], str], log: logging.Logger) -> tuple[str, str]:
    """Bản async của generate_with_fallback, cùng quy tắc dự phòng."""
    if settings.gemini_api_key:
        try:
            text = await generate_text_async(prompt)
            if text:
                return text, "gemini"
        except GEMINI_ERRORS as exc:
            # Chỉ ghi loại lỗi, không ghi nội dung prompt hay khóa API
            log.warning("Gemini lỗi (%s), chuyển sang bộ soạn theo luật", type(exc).__name__)
    return fallback(), "rules"
