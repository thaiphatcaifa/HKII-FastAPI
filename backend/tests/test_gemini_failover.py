"""Dự phòng khóa và model của services/gemini.py.

Không có request nào ra mạng thật: httpx.post và httpx.AsyncClient được thay bằng bản có transport giả.
"""
import asyncio
import json
import logging

import httpx
import pytest

from app.config import settings
from app.services import gemini

OK = {"candidates": [{"content": {"parts": [{"text": " xin chào \n"}]}}]}


@pytest.fixture(autouse=True)
def fresh_db():
    """Ghi đè fixture cùng tên trong conftest: các test này không đụng tới CSDL nên khỏi tạo lại và nạp dữ liệu mẫu."""
    yield


def configure(monkeypatch, keys, models):
    monkeypatch.setattr(settings, "gemini_api_key", keys)
    monkeypatch.setattr(settings, "gemini_model", models)


def install(monkeypatch, handler):
    """Giả lập Gemini. `handler(khóa, model, request)` trả về Response (hoặc ném lỗi httpx).

    Trả về danh sách các lần gọi, mỗi phần tử là (khóa, model, thời gian chờ đọc).
    """
    calls = []
    real_client, real_async = httpx.Client, httpx.AsyncClient

    def respond(request: httpx.Request) -> httpx.Response:
        key = request.headers["x-goog-api-key"]
        model = request.url.path.split("/models/")[1].split(":")[0]
        calls.append((key, model, request.extensions["timeout"]["read"]))
        return handler(key, model, request)

    def fake_post(**kwargs):
        with real_client(transport=httpx.MockTransport(respond)) as client:
            return client.post(**kwargs)

    monkeypatch.setattr(gemini.httpx, "post", fake_post)
    monkeypatch.setattr(
        gemini.httpx, "AsyncClient", lambda **kwargs: real_async(transport=httpx.MockTransport(respond), **kwargs)
    )
    return calls


def pairs(calls):
    return [(key, model) for key, model, _ in calls]


def ok():
    return httpx.Response(200, json=OK)


def test_single_key_and_model_make_one_request_only(monkeypatch):
    configure(monkeypatch, "k1", "m1")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(503))
    with pytest.raises(httpx.HTTPStatusError):
        gemini.generate_text("hi")
    assert pairs(calls) == [("k1", "m1")]
    assert calls[0][2] == pytest.approx(30, abs=0.5)  # không có dự phòng nên được dùng đủ thời gian


@pytest.mark.parametrize("status", [400, 401, 403, 429])
def test_backup_key_is_used_when_first_key_fails(monkeypatch, status):
    configure(monkeypatch, "k1,k2", "m1")
    calls = install(monkeypatch, lambda key, model, request: ok() if key == "k2" else httpx.Response(status))
    assert gemini.generate_text("hi") == "xin chào"
    assert pairs(calls) == [("k1", "m1"), ("k2", "m1")]


@pytest.mark.parametrize("status", [404, 500, 503, 504])
def test_model_problem_moves_to_next_model_not_next_key(monkeypatch, status):
    configure(monkeypatch, "k1,k2", "m1,m2")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(status) if model == "m1" else ok())
    assert gemini.generate_text("hi") == "xin chào"
    assert pairs(calls) == [("k1", "m1"), ("k1", "m2")]


def test_timeout_moves_to_next_model(monkeypatch):
    configure(monkeypatch, "k1", "m1,m2")

    def handler(key, model, request):
        if model == "m1":
            raise httpx.ReadTimeout("hết thời gian chờ")
        return ok()

    calls = install(monkeypatch, handler)
    assert gemini.generate_text("hi") == "xin chào"
    assert pairs(calls) == [("k1", "m1"), ("k1", "m2")]


def test_rejected_key_is_not_retried_on_next_model(monkeypatch):
    configure(monkeypatch, "k1,k2", "m1,m2")

    def handler(key, model, request):
        if key == "k1":
            return httpx.Response(403)
        return httpx.Response(503) if model == "m1" else ok()

    calls = install(monkeypatch, handler)
    assert gemini.generate_text("hi") == "xin chào"
    assert pairs(calls) == [("k1", "m1"), ("k2", "m1"), ("k2", "m2")]


def test_rate_limit_is_per_model_so_keys_are_retried_on_next_model(monkeypatch):
    configure(monkeypatch, "k1,k2", "m1,m2")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(429) if model == "m1" else ok())
    assert gemini.generate_text("hi") == "xin chào"
    assert pairs(calls) == [("k1", "m1"), ("k2", "m1"), ("k1", "m2")]


def test_all_options_fail_then_rules_are_used(monkeypatch):
    configure(monkeypatch, "k1,k2", "m1,m2")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(503))
    result = gemini.generate_with_fallback("hi", lambda: "dự phòng", logging.getLogger("test"))
    assert result == ("dự phòng", "rules")
    assert pairs(calls) == [("k1", "m1"), ("k1", "m2")]


def test_every_key_rejected_stops_without_switching_model(monkeypatch):
    configure(monkeypatch, "k1,k2", "m1,m2")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(401))
    with pytest.raises(httpx.HTTPStatusError):
        gemini.generate_text("hi")
    assert pairs(calls) == [("k1", "m1"), ("k2", "m1")]


def test_each_try_is_capped_when_backups_are_configured(monkeypatch):
    configure(monkeypatch, "k1", "m1,m2")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(503) if model == "m1" else ok())
    gemini.generate_text("hi")
    # kể cả lần cuối cũng bị giới hạn, để hai model cùng treo không bắt người dùng chờ trọn 30 giây
    assert calls[0][2] == pytest.approx(30 * gemini.TRY_SHARE, abs=0.5)
    assert calls[1][2] == pytest.approx(30 * gemini.TRY_SHARE, abs=0.5)


def test_no_retry_when_not_enough_time_is_left(monkeypatch):
    configure(monkeypatch, "k1", "m1,m2")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(503))
    with pytest.raises(httpx.HTTPStatusError):
        gemini.generate_text("hi", timeout=1)
    assert len(calls) == 1


def test_malformed_answer_is_not_retried(monkeypatch):
    configure(monkeypatch, "k1,k2", "m1,m2")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(200, json={"khong": "dung cau truc"}))
    with pytest.raises(KeyError):
        gemini.generate_text("hi")
    assert len(calls) == 1


def test_json_request_keeps_its_settings_on_the_backup_model(monkeypatch):
    configure(monkeypatch, "k1", "m1,m2")
    bodies = []
    fenced = {"candidates": [{"content": {"parts": [{"text": '```json\n{"ok": true}\n```'}]}}]}

    def handler(key, model, request):
        bodies.append(json.loads(request.content))
        return httpx.Response(404) if model == "m1" else httpx.Response(200, json=fenced)

    install(monkeypatch, handler)
    assert gemini.generate_json("hi") == {"ok": True}
    assert len(bodies) == 2
    assert all(b["generationConfig"]["responseMimeType"] == "application/json" for b in bodies)


def test_async_version_fails_over_the_same_way(monkeypatch):
    configure(monkeypatch, "k1,k2", "m1,m2")

    def handler(key, model, request):
        if key == "k1":
            return httpx.Response(403)
        return httpx.Response(503) if model == "m1" else ok()

    calls = install(monkeypatch, handler)
    assert asyncio.run(gemini.generate_text_async("hi")) == "xin chào"
    assert pairs(calls) == [("k1", "m1"), ("k2", "m1"), ("k2", "m2")]


def test_async_version_raises_when_nothing_is_left(monkeypatch):
    configure(monkeypatch, "k1", "m1")
    calls = install(monkeypatch, lambda key, model, request: httpx.Response(503))
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(gemini.generate_text_async("hi"))
    assert len(calls) == 1


def test_failover_is_logged_without_keys(monkeypatch, caplog):
    configure(monkeypatch, "khoa-bi-mat-1,khoa-bi-mat-2", "m1,m2")

    def handler(key, model, request):
        if key == "khoa-bi-mat-1":
            return httpx.Response(403)
        return httpx.Response(503) if model == "m1" else ok()

    install(monkeypatch, handler)
    caplog.set_level(logging.WARNING, logger="hkii")
    gemini.generate_text("hi")
    assert "HTTP 403" in caplog.text and "khóa 2/2" in caplog.text and "model m2" in caplog.text
    assert "khoa-bi-mat" not in caplog.text


@pytest.mark.parametrize("keys, models", [(",", "m1"), ("k1", " , "), ("", "m1"), (None, "m1")])
def test_empty_lists_count_as_not_configured(monkeypatch, keys, models):
    configure(monkeypatch, keys, models)
    calls = install(monkeypatch, lambda key, model, request: ok())
    with pytest.raises(ValueError):
        gemini.generate_text("hi")
    assert gemini.generate_with_fallback("hi", lambda: "dự phòng", logging.getLogger("test")) == ("dự phòng", "rules")
    assert calls == []
