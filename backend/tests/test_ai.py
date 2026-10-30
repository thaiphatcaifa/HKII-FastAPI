"""Test cho AI hỗ trợ giáo viên: cảnh báo rủi ro (luật + gợi ý AI) và nhận xét học viên (nháp -> duyệt -> công bố).

Không bao giờ gọi Gemini thật: GEMINI_API_KEY để trống nên mặc định dùng bộ soạn theo luật,
còn nhánh Gemini được thử bằng cách thay hàm gọi mạng bằng hàm giả.
"""
import datetime as dt

import httpx

from app.config import settings
from app.models import AttendanceStatus
from app.services import gemini
from app.services.insights import absent_streak, evaluate
from app.services.stats import attendance_rate
from tests.conftest import login, user_id

P, L, A, E = (
    AttendanceStatus.present,
    AttendanceStatus.late,
    AttendanceStatus.absent,
    AttendanceStatus.excused,
)


# ---------- Hàm dựng dữ liệu ----------
def make_class(client, admin, teacher_username="gv.lan", students=("hv01", "hv02", "hv03")):
    """Tạo lớp mới (không có dữ liệu mẫu ngẫu nhiên) để số liệu test chính xác."""
    teacher_id = user_id(client, admin, teacher_username)
    created = client.post(
        "/classes", json={"code": "AI-T1", "name": "Lớp thử AI", "teacher_id": teacher_id}, headers=admin
    )
    assert created.status_code == 201, created.text
    class_id = created.json()["id"]
    ids = {}
    for username in students:
        ids[username] = user_id(client, admin, username)
        r = client.post(f"/classes/{class_id}/students", json={"student_id": ids[username]}, headers=admin)
        assert r.status_code == 201, r.text
    return class_id, ids


def mark(client, headers, class_id, student_id, statuses, start="2031-06-01"):
    first = dt.date.fromisoformat(start)
    for i, status in enumerate(statuses):
        body = {
            "class_id": class_id,
            "date": (first + dt.timedelta(days=i)).isoformat(),
            "records": [{"student_id": student_id, "status": status}],
        }
        r = client.post("/attendance/batch", json=body, headers=headers)
        assert r.status_code == 200, r.text


def add_scores(client, headers, class_id, student_id, values):
    for value in values:
        body = {"class_id": class_id, "student_id": student_id, "kind": "quiz", "value": value, "max_value": 10}
        r = client.post("/scores", json=body, headers=headers)
        assert r.status_code == 201, r.text


def scenario(client, admin, teacher):
    """hv01: rủi ro cao. hv02: học tốt. hv03: chưa có dữ liệu."""
    class_id, ids = make_class(client, admin)
    mark(client, teacher, class_id, ids["hv01"], ["present", "present", "absent", "absent", "absent"])
    add_scores(client, teacher, class_id, ids["hv01"], [4, 5, 3])
    mark(client, teacher, class_id, ids["hv02"], ["present"] * 5)
    add_scores(client, teacher, class_id, ids["hv02"], [8, 9, 9.5])
    return class_id, ids


# ---------- Luật (hàm thuần, không cần CSDL) ----------
def test_shared_attendance_rate():
    assert attendance_rate(2, 1, 1, 5) == 0.75  # (2+1)/(5-1)
    assert attendance_rate(0, 0, 3, 3) is None  # toàn vắng có phép: không tính được


def test_absent_streak_skips_excused():
    assert absent_streak([A, E, A]) == 2
    assert absent_streak([A, P, A]) == 1
    assert absent_streak([P, A, A, A]) == 3
    assert absent_streak([]) == 0


def test_evaluate_levels():
    high = evaluate(1, "A", [P, P, A, A, A], [4, 5, 3])
    assert high.level == "high" and high.points == 100 and len(high.factors) == 4

    medium = evaluate(2, "B", [P, P, P, A], [6.0])  # chuyên cần 75% (+20), điểm TB 6.0 (+20)
    assert medium.level == "medium" and medium.points == 40
    assert {f.code for f in medium.factors} == {"attendance_low", "score_low"}

    fine = evaluate(3, "C", [P, P, P, L, P], [8, 9, 9.5])
    assert fine.level == "low" and fine.factors == [] and fine.enough_data

    empty = evaluate(4, "D", [], [])
    assert not empty.enough_data and empty.level == "low" and empty.factors == []


# ---------- Cảnh báo rủi ro ----------
def test_risk_ranking_and_reasons(client, admin, teacher):
    class_id, ids = scenario(client, admin, teacher)
    r = client.get(f"/ai/risk?class_id={class_id}", headers=teacher)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert [row["student_id"] for row in rows] == [ids["hv01"], ids["hv02"], ids["hv03"]]  # rủi ro cao đứng đầu

    risky, good, empty = rows
    assert risky["level"] == "high" and risky["points"] == 100 and len(risky["reasons"]) == 4
    assert "Vắng liên tiếp 3 buổi gần nhất" in risky["reasons"]
    assert risky["attendance_rate"] == 0.4 and risky["absent_streak"] == 3 and risky["score_count"] == 3
    assert good["level"] == "low" and good["reasons"] == [] and good["attendance_rate"] == 1.0
    assert good["average_10"] == 8.83
    assert empty["enough_data"] is False and empty["level"] == "low"

    only = client.get(f"/ai/risk?class_id={class_id}&only_at_risk=true", headers=teacher).json()
    assert [row["student_id"] for row in only] == [ids["hv01"]]


def test_risk_permissions(client, admin, teacher, student, parent):
    class_id, _ = scenario(client, admin, teacher)
    url = f"/ai/risk?class_id={class_id}"
    assert client.get(url, headers=student).status_code == 403
    assert client.get(url, headers=parent).status_code == 403
    assert client.get(url).status_code == 401
    assert client.get(url, headers=login(client, "gv.minh")).status_code == 403  # không phụ trách lớp
    assert client.get(url, headers=admin).status_code == 200
    assert client.get("/ai/risk?class_id=999999", headers=admin).status_code == 404
    assert client.get("/ai/risk?class_id=0", headers=admin).status_code == 422


# ---------- Gợi ý hành động cho giáo viên ----------
def test_advice_rules(client, admin, teacher, student):
    class_id, ids = scenario(client, admin, teacher)
    body = {"class_id": class_id, "student_id": ids["hv01"]}

    ok = client.post("/ai/risk/advice", json=body, headers=teacher)
    assert ok.status_code == 201, ok.text
    advice = ok.json()
    assert advice["provider"] == "rules"
    lines = advice["content"].splitlines()
    assert len(lines) == 3 and all(line.startswith("- ") for line in lines)

    # Học viên không có dấu hiệu rủi ro thì không cần gợi ý
    fine = client.post("/ai/risk/advice", json={**body, "student_id": ids["hv02"]}, headers=teacher)
    assert fine.status_code == 400
    # Học viên không thuộc lớp
    outsider = client.post("/ai/risk/advice", json={**body, "student_id": user_id(client, admin, "hv05")}, headers=teacher)
    assert outsider.status_code == 404
    # Học viên không được xin gợi ý
    assert client.post("/ai/risk/advice", json=body, headers=student).status_code == 403
    # Gợi ý không bao giờ xuất hiện trong danh sách nhận xét
    assert client.get(f"/ai/reviews?class_id={class_id}", headers=teacher).json() == []


# ---------- Nhận xét học viên: nháp -> sửa -> công bố ----------
def test_review_workflow(client, admin, teacher, student, parent):
    class_id, ids = scenario(client, admin, teacher)
    created = client.post("/ai/reviews", json={"class_id": class_id, "student_id": ids["hv01"]}, headers=teacher)
    assert created.status_code == 201, created.text
    note = created.json()
    assert note["status"] == "draft" and note["provider"] == "rules" and note["published_at"] is None
    note_id = note["id"]

    # Nháp: chỉ giáo viên thấy
    assert client.get("/ai/reviews", headers=student).json() == []
    assert client.get("/ai/reviews", headers=parent).json() == []
    assert len(client.get(f"/ai/reviews?class_id={class_id}", headers=teacher).json()) == 1

    # Giáo viên sửa rồi công bố
    edited = client.patch(f"/ai/reviews/{note_id}", json={"content": "Em tiến bộ, cần đi học đều hơn nhé."}, headers=teacher)
    assert edited.status_code == 200 and edited.json()["content"].startswith("Em tiến bộ")
    published = client.post(f"/ai/reviews/{note_id}/publish", headers=teacher)
    assert published.status_code == 200
    assert published.json()["status"] == "published" and published.json()["published_at"] is not None

    # Học viên và phụ huynh của em đó đọc được; người khác thì không
    for who in (student, parent):
        seen = client.get("/ai/reviews", headers=who)
        assert seen.status_code == 200
        assert [n["id"] for n in seen.json()] == [note_id]
        assert int(seen.headers["X-Total-Count"]) == 1
    assert client.get("/ai/reviews", headers=login(client, "hv02")).json() == []
    assert client.get("/ai/reviews", headers=login(client, "ph.ha")).json() == []
    # Học viên cố xem nháp bằng tham số status vẫn chỉ thấy bản đã công bố
    assert len(client.get("/ai/reviews?status=draft", headers=student).json()) == 1

    # Thu hồi về nháp -> biến mất khỏi phía học viên
    back = client.post(f"/ai/reviews/{note_id}/unpublish", headers=teacher)
    assert back.json()["status"] == "draft" and back.json()["published_at"] is None
    assert client.get("/ai/reviews", headers=student).json() == []

    # Xóa
    assert client.delete(f"/ai/reviews/{note_id}", headers=teacher).status_code == 204
    assert client.get(f"/ai/reviews?class_id={class_id}", headers=teacher).json() == []


def test_review_permissions_and_validation(client, admin, teacher, student, parent):
    class_id, ids = scenario(client, admin, teacher)
    body = {"class_id": class_id, "student_id": ids["hv01"]}
    note_id = client.post("/ai/reviews", json=body, headers=teacher).json()["id"]

    other_teacher = login(client, "gv.minh")
    for method, url, payload in (
        ("patch", f"/ai/reviews/{note_id}", {"content": "Nội dung đủ dài để hợp lệ"}),
        ("post", f"/ai/reviews/{note_id}/publish", None),
        ("delete", f"/ai/reviews/{note_id}", None),
    ):
        assert getattr(client, method)(url, headers=other_teacher, **({"json": payload} if payload else {})).status_code == 403
        assert getattr(client, method)(url, headers=student, **({"json": payload} if payload else {})).status_code == 403
        assert getattr(client, method)(url, headers=parent, **({"json": payload} if payload else {})).status_code == 403

    assert client.post("/ai/reviews", json=body, headers=other_teacher).status_code == 403
    assert client.post("/ai/reviews", json=body, headers=student).status_code == 403
    assert client.patch(f"/ai/reviews/{note_id}", json={"content": "ngắn"}, headers=teacher).status_code == 422
    assert client.patch("/ai/reviews/999999", json={"content": "Nội dung đủ dài để hợp lệ"}, headers=teacher).status_code == 404
    assert client.post("/ai/reviews/0/publish", headers=teacher).status_code == 422
    outsider = {"class_id": class_id, "student_id": user_id(client, admin, "hv05")}
    assert client.post("/ai/reviews", json=outsider, headers=teacher).status_code == 404

    # Một gợi ý hành động không thể bị sửa/công bố như nhận xét
    advice_id = client.post("/ai/risk/advice", json=body, headers=teacher).json()["id"]
    assert client.post(f"/ai/reviews/{advice_id}/publish", headers=teacher).status_code == 404
    assert client.patch(f"/ai/reviews/{advice_id}", json={"content": "Nội dung đủ dài để hợp lệ"}, headers=teacher).status_code == 404


def test_ai_daily_limit(client, admin, teacher, monkeypatch):
    monkeypatch.setattr(settings, "ai_daily_limit", 2)
    class_id, ids = scenario(client, admin, teacher)
    body = {"class_id": class_id, "student_id": ids["hv01"]}
    assert client.post("/ai/reviews", json=body, headers=teacher).status_code == 201
    assert client.post("/ai/risk/advice", json=body, headers=teacher).status_code == 201  # tính chung với nhận xét
    limited = client.post("/ai/reviews", json=body, headers=teacher)
    assert limited.status_code == 429
    assert "detail" in limited.json()


# ---------- Gemini: quyền riêng tư + dự phòng ----------
def test_gemini_prompt_has_no_personal_data(client, admin, teacher, monkeypatch):
    prompts = []

    def fake_generate(prompt, timeout=30):
        prompts.append(prompt)
        return "Em học chăm chỉ, hãy giữ vững phong độ nhé."

    monkeypatch.setattr(settings, "gemini_api_key", "khoa-gia")
    monkeypatch.setattr(gemini, "generate_text", fake_generate)
    class_id, ids = scenario(client, admin, teacher)
    body = {"class_id": class_id, "student_id": ids["hv01"]}

    review = client.post("/ai/reviews", json=body, headers=teacher).json()
    assert review["provider"] == "gemini" and review["content"].startswith("Em học chăm chỉ")
    advice = client.post("/ai/risk/advice", json=body, headers=teacher).json()
    assert advice["provider"] == "gemini"

    assert len(prompts) == 2
    for prompt in prompts:
        assert "Tỷ lệ chuyên cần" in prompt  # có số liệu
        for private in ("Lê Hoàng An", "Hoàng", "hv01"):
            assert private not in prompt  # nhưng không có tên/tài khoản


def test_gemini_error_falls_back_to_rules(client, admin, teacher, monkeypatch):
    def broken(prompt, timeout=30):
        raise httpx.ConnectError("mất kết nối")

    monkeypatch.setattr(settings, "gemini_api_key", "khoa-gia")
    monkeypatch.setattr(gemini, "generate_text", broken)
    class_id, ids = scenario(client, admin, teacher)
    body = {"class_id": class_id, "student_id": ids["hv01"]}
    r = client.post("/ai/reviews", json=body, headers=teacher)
    assert r.status_code == 201 and r.json()["provider"] == "rules"

    monkeypatch.setattr(gemini, "generate_text", lambda prompt, timeout=30: "")  # Gemini trả rỗng
    assert client.post("/ai/risk/advice", json=body, headers=teacher).json()["provider"] == "rules"


def test_coach_uses_shared_gemini_client(client, student, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "khoa-gia")
    monkeypatch.setattr(gemini, "generate_text", lambda prompt, timeout=30: "Bài viết rõ ràng, cần thêm ví dụ.")
    r = client.post(
        "/coach/feedback",
        json={"kind": "writing", "text": "I like learning English because it helps me talk with many people."},
        headers=student,
    )
    assert r.status_code == 201, r.text
    assert r.json()["provider"] == "gemini"
