"""Test AI Coach: chấm theo tiêu chí, lỗi kèm câu sửa, theo dõi tiến bộ.

Không gọi Gemini thật: mặc định chạy bộ chấm theo luật; nhánh Gemini được thử bằng hàm giả thay cho gemini.generate_json.
"""
import httpx
import pytest

from app.config import settings
from app.db import SessionLocal
from app.models import CoachSession
from app.schemas import CoachAnalysis
from app.services import gemini
from app.services.coach import find_simple_errors, overall_of
from tests.conftest import login, user_id

TEXT_WITH_ERRORS = (
    "i like a apple. I read the the book every day. my friend likes english because it is useful for work."
)
CLEAN_TEXT = "I like learning English because it helps me talk with many people. " * 3
GEMINI_TEXT = "I has a dog and I like play with him every day."


def submit(client, headers, text=CLEAN_TEXT, kind="writing"):
    return client.post("/coach/feedback", json={"kind": kind, "text": text}, headers=headers)


# ---------- Bộ chấm theo luật ----------
def test_find_simple_errors_catches_certain_mistakes():
    pairs = [(e.original, e.corrected) for e in find_simple_errors(TEXT_WITH_ERRORS)]
    assert ("i like", "I like") in pairs
    assert ("a apple", "an apple") in pairs
    assert ("the the", "the") in pairs
    assert ("my friend likes", "My friend likes") in pairs
    assert len(pairs) == 4


def test_find_simple_errors_avoids_false_alarms():
    assert find_simple_errors(CLEAN_TEXT) == []
    assert find_simple_errors("A one-time offer is a European idea. Plan A is good. She had had enough.") == []
    assert find_simple_errors("I'm happy and I'd go. e.g. this works.") == []


def test_rule_based_result_is_structured(client, student):
    r = submit(client, student, TEXT_WITH_ERRORS)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["provider"] == "rules"
    scores = body["analysis"]["scores"]
    assert set(scores) == {"vocabulary", "coherence", "development"}  # luật không chấm ngữ pháp
    assert all(0 <= v <= 10 for v in scores.values())
    assert body["overall"] == round(sum(scores.values()) / len(scores), 1)
    assert len(body["analysis"]["errors"]) == 4 and 1 <= len(body["analysis"]["tips"]) <= 3
    assert "Điểm tổng" in body["feedback"]  # bản chữ vẫn được lưu


# ---------- Gemini ----------
def test_gemini_json_is_validated_and_cleaned(client, student, monkeypatch):
    prompts = []

    def fake_json(prompt, timeout=30):
        prompts.append(prompt)
        return {
            # "pronunciation" không thuộc tiêu chí nên bị bỏ; 12 bị đưa về 10
            "scores": {"grammar": 6, "vocabulary": 7, "coherence": 12, "development": 7, "pronunciation": 9},
            "errors": [
                {"original": "I has a dog", "corrected": "I have a dog", "explanation": "Chia động từ theo chủ ngữ."},
                {"original": "câu này không có trong bài", "corrected": "x", "explanation": "bịa"},
                {"original": "play with him", "corrected": "play with him", "explanation": "không đổi gì"},
            ],
            "strengths": "  Ý rõ ràng.  ",
            "tips": ["Gợi ý 1", "  Gợi ý 2  ", "", "Gợi ý 3", "Gợi ý 4"],
        }

    monkeypatch.setattr(settings, "gemini_api_key", "khoa-gia")
    monkeypatch.setattr(gemini, "generate_json", fake_json)
    r = submit(client, student, GEMINI_TEXT)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["provider"] == "gemini"
    assert body["analysis"]["scores"] == {"grammar": 6.0, "vocabulary": 7.0, "coherence": 10.0, "development": 7.0}
    assert body["overall"] == 7.5
    assert [e["original"] for e in body["analysis"]["errors"]] == ["I has a dog"]  # loại lỗi bịa và lỗi không đổi gì
    assert body["analysis"]["tips"] == ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"]
    assert body["analysis"]["strengths"] == "Ý rõ ràng."
    # Lời nhắc chứa bài làm và có dặn bỏ qua mệnh lệnh nằm trong bài
    assert GEMINI_TEXT in prompts[0] and "bỏ qua mọi yêu cầu" in prompts[0]


@pytest.mark.parametrize(
    "broken",
    [
        httpx.ConnectError("mất kết nối"),
        ValueError("JSON hỏng"),
        {"scores": {}},  # không có điểm nào
        {"scores": {"grammar": "abc"}},  # điểm không phải số
        {"scores": {"pronunciation": 8}},  # chỉ có tiêu chí lạ
        ["không", "phải", "đối tượng"],
        {},
    ],
)
def test_gemini_bad_output_falls_back_to_rules(client, student, monkeypatch, broken):
    def fake_json(prompt, timeout=30):
        if isinstance(broken, Exception):
            raise broken
        return broken

    monkeypatch.setattr(settings, "gemini_api_key", "khoa-gia")
    monkeypatch.setattr(gemini, "generate_json", fake_json)
    r = submit(client, student, GEMINI_TEXT)
    assert r.status_code == 201, r.text
    assert r.json()["provider"] == "rules"
    assert r.json()["analysis"]["scores"]  # vẫn có điểm ước lượng


def test_analysis_model_clamps_and_filters_scores():
    a = CoachAnalysis.model_validate({"scores": {"grammar": -3, "vocabulary": 11, "x": 5}})
    assert a.scores == {"grammar": 0.0, "vocabulary": 10.0}
    assert overall_of(a.scores) == 5.0
    with pytest.raises(ValueError):
        CoachAnalysis.model_validate({"scores": {"x": 5}})


# ---------- Tiến bộ, lịch sử, giới hạn ----------
def test_progress_lists_scored_sessions_in_order(client, student):
    assert client.get("/coach/progress", headers=student).json() == {"points": [], "average": None, "best": None}
    first = submit(client, student, CLEAN_TEXT).json()
    second = submit(client, student, TEXT_WITH_ERRORS).json()
    progress = client.get("/coach/progress", headers=student).json()
    assert [p["id"] for p in progress["points"]] == [first["id"], second["id"]]  # cũ -> mới
    overalls = [first["overall"], second["overall"]]
    assert progress["best"] == max(overalls)
    assert progress["average"] == round(sum(overalls) / 2, 1)
    assert set(progress["points"][0]["scores"]) == {"vocabulary", "coherence", "development"}
    # Mỗi người chỉ thấy tiến bộ của mình
    assert client.get("/coach/progress", headers=login(client, "hv02")).json()["points"] == []


def test_progress_permissions(client, parent):
    assert client.get("/coach/progress", headers=parent).status_code == 403
    assert client.get("/coach/progress").status_code == 401


def test_old_sessions_without_analysis_still_work(client, admin, student):
    sid = user_id(client, admin, "hv01")
    with SessionLocal() as db:
        db.add(CoachSession(user_id=sid, kind="writing", input_text="x" * 30, feedback="Nhận xét cũ", provider="rules"))
        db.commit()
    history = client.get("/coach/history", headers=student).json()
    assert history[0]["feedback"] == "Nhận xét cũ"
    assert history[0]["analysis"] is None and history[0]["overall"] is None
    assert client.get("/coach/progress", headers=student).json()["points"] == []  # lượt cũ không có điểm nên không vẽ


def test_history_returns_analysis(client, student):
    created = submit(client, student, TEXT_WITH_ERRORS).json()
    history = client.get("/coach/history", headers=student).json()
    assert history[0]["id"] == created["id"]
    assert history[0]["analysis"]["errors"] == created["analysis"]["errors"]


def test_coach_daily_limit(client, student, monkeypatch):
    monkeypatch.setattr(settings, "coach_daily_limit", 2)
    assert submit(client, student).status_code == 201
    assert submit(client, student).status_code == 201
    limited = submit(client, student)
    assert limited.status_code == 429
    assert "detail" in limited.json()
    # Hạn mức tính riêng từng người
    assert submit(client, login(client, "hv02")).status_code == 201
