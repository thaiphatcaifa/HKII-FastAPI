"""Gọi Gemini qua REST (httpx), dùng chung cho AI Coach, nhận xét học viên và gợi ý hành động.

Nguyên tắc: AI chỉ là lớp hỗ trợ. Không có khóa API hoặc gọi lỗi thì dùng bộ soạn theo luật để hệ thống vẫn chạy.

Có hai bản: bản đồng bộ cho endpoint `def` (FastAPI tự chạy trong threadpool) và bản `*_async` dùng
httpx.AsyncClient cho endpoint `async def`, nhường event loop trong lúc chờ Gemini trả lời.

Dự phòng: GEMINI_API_KEY và GEMINI_MODEL đều nhận danh sách cách nhau bằng dấu phẩy, ví dụ
`khoa_chinh,khoa_phu` và `gemini-3.5-flash-lite,gemini-3.5-flash`. Khóa bị từ chối hoặc hết hạn mức thì thử khóa
kế tiếp; model quá tải, hết thời gian hay không còn dùng được thì thử model kế tiếp. Hết phương án mới dùng bộ soạn
theo luật. Cấu hình một khóa, một model chạy đúng như trước.
"""
import json
import logging
import time
from typing import Callable

import httpx

from app.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

logger = logging.getLogger("hkii.gemini")

# Các lỗi có thể xảy ra khi gọi Gemini hoặc đọc kết quả trả về.
# json.JSONDecodeError và pydantic.ValidationError đều là con của ValueError.
GEMINI_ERRORS = (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError)

# Lỗi HTTP cho thấy vấn đề nằm ở khóa: 401/403 là khóa sai hoặc bị thu hồi (bỏ hẳn khóa đó),
# 400 có thể là khóa sai hoặc yêu cầu lỗi, 429 là hết hạn mức của model đang gọi.
REJECTED_KEY_STATUS = {401, 403}
KEY_STATUS = {400, 401, 403, 429}
# Khi có nhiều khóa hoặc nhiều model, mỗi lần thử chỉ được chờ tối đa phần này của tổng thời gian,
# để một lần treo không ăn hết thời gian của các lần sau (một khóa, một model thì vẫn được chờ đủ).
TRY_SHARE = 0.5
MIN_TRY_SECONDS = 2.0


def _split(value: str | None) -> list[str]:
    """Tách danh sách cách nhau bằng dấu phẩy (khóa hoặc tên model), bỏ phần trống."""
    return [item.strip() for item in (value or "").split(",") if item.strip()]


class _Plan:
    """Thứ tự thử các cặp (khóa, model) cho một lần gọi; tổng thời gian không vượt `total` giây.

    Lỗi do khóa (xem KEY_STATUS) thì sang khóa kế tiếp của cùng model; lỗi khác (quá tải, hết thời gian,
    model không còn dùng được) thì sang model kế tiếp và quay lại khóa còn dùng được đầu tiên.
    Số lần thử tối đa bằng số khóa nhân số model.
    """

    def __init__(self, total: float):
        self.keys = _split(settings.gemini_api_key)
        self.models = _split(settings.gemini_model)
        if not self.keys or not self.models:
            raise ValueError("Chưa cấu hình khóa hoặc model Gemini")
        self.total = total
        self.deadline = time.monotonic() + total
        self.key_i = 0
        self.model_i = 0
        self.rejected: set[int] = set()  # khóa bị từ chối (401/403), không thử lại ở các model sau

    @property
    def current(self) -> tuple[str, str]:
        return self.keys[self.key_i], self.models[self.model_i]

    def _key_after_current(self) -> int | None:
        return next((i for i in range(self.key_i + 1, len(self.keys)) if i not in self.rejected), None)

    def _first_usable_key(self) -> int | None:
        return next((i for i in range(len(self.keys)) if i not in self.rejected), None)

    def attempt_timeout(self) -> float:
        """Thời gian chờ cho lần thử sắp tới: có dự phòng thì mỗi lần chỉ chờ tối đa TRY_SHARE tổng thời gian."""
        remaining = max(self.deadline - time.monotonic(), 0.1)
        if len(self.keys) > 1 or len(self.models) > 1:
            return min(remaining, max(MIN_TRY_SECONDS, self.total * TRY_SHARE))
        return remaining

    def advance(self, exc: Exception) -> bool:
        """Chọn phương án kế tiếp sau lỗi `exc`. Trả về False khi hết phương án hoặc không còn đủ thời gian."""
        if self.deadline - time.monotonic() < MIN_TRY_SECONDS:
            return False
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        if status in REJECTED_KEY_STATUS:
            self.rejected.add(self.key_i)
        if status in KEY_STATUS:
            next_key = self._key_after_current()
            if next_key is not None:
                self.key_i = next_key
                self._log(exc, f"khóa {next_key + 1}/{len(self.keys)}")
                return True
        first_key = self._first_usable_key()
        if first_key is not None and self.model_i + 1 < len(self.models):
            self.model_i += 1
            self.key_i = first_key
            self._log(exc, f"model {self.models[self.model_i]}")
            return True
        return False

    @staticmethod
    def _log(exc: Exception, target: str) -> None:
        # Chỉ ghi mã lỗi hoặc loại lỗi và tên phương án kế tiếp, không ghi khóa API hay nội dung phản hồi
        reason = f"HTTP {exc.response.status_code}" if isinstance(exc, httpx.HTTPStatusError) else type(exc).__name__
        logger.warning("Gemini lỗi (%s), thử %s", reason, target)


def _request_args(prompt: str, generation_config: dict | None, key: str, model: str) -> dict:
    body: dict = {"contents": [{"parts": [{"text": prompt}]}]}
    if generation_config:
        body["generationConfig"] = generation_config
    return {
        "url": GEMINI_URL.format(model=model),
        "headers": {"x-goog-api-key": key},
        "json": body,
    }


def _read_text(response: httpx.Response) -> str:
    response.raise_for_status()
    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


def _post(prompt: str, generation_config: dict | None, timeout: float) -> str:
    plan = _Plan(timeout)
    while True:
        key, model = plan.current
        try:
            response = httpx.post(**_request_args(prompt, generation_config, key, model), timeout=plan.attempt_timeout())
            return _read_text(response)
        except httpx.HTTPError as exc:
            if not plan.advance(exc):
                raise


def generate_text(prompt: str, timeout: float = 30) -> str:
    return _post(prompt, None, timeout)


async def generate_text_async(prompt: str, timeout: float = 30) -> str:
    plan = _Plan(timeout)
    async with httpx.AsyncClient() as client:
        while True:
            key, model = plan.current
            try:
                response = await client.post(**_request_args(prompt, None, key, model), timeout=plan.attempt_timeout())
                return _read_text(response)
            except httpx.HTTPError as exc:
                if not plan.advance(exc):
                    raise


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
