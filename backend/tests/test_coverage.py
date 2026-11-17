"""Test bổ sung các nhánh chưa chạm: điểm số (sửa, xóa, danh sách), tổng hợp học phí,
lớp học theo vai trò, quản lý người dùng, liên kết phụ huynh, đổi mật khẩu, xuất Excel học phí."""
import io

from openpyxl import load_workbook

from tests.conftest import login, user_id


def _class(client, headers, code):
    return next(c for c in client.get("/classes", headers=headers).json() if c["code"] == code)


def _new_score(client, headers, class_id, student_id, value=7, max_value=10):
    body = {"class_id": class_id, "student_id": student_id, "kind": "quiz-x", "value": value, "max_value": max_value}
    r = client.post("/scores", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ---------- Điểm số ----------
def test_score_create_rejects_value_above_max_and_outsider(client, teacher, admin):
    a1 = _class(client, teacher, "IELTS-A1")
    hv01 = user_id(client, admin, "hv01")
    body = {"class_id": a1["id"], "student_id": hv01, "kind": "quiz", "value": 11, "max_value": 10}
    assert client.post("/scores", json=body, headers=teacher).status_code == 400
    outsider = user_id(client, admin, "hv08")
    body = {"class_id": a1["id"], "student_id": outsider, "kind": "quiz", "value": 5}
    r = client.post("/scores", json=body, headers=teacher)
    assert r.status_code == 400 and "không thuộc lớp" in r.json()["detail"]


def test_score_list_scoped_by_role(client, admin, teacher, student, parent):
    a1 = _class(client, admin, "IELTS-A1")
    hv01 = user_id(client, admin, "hv01")
    r = client.get(f"/scores?class_id={a1['id']}&student_id={hv01}", headers=admin)
    assert r.status_code == 200 and int(r.headers["X-Total-Count"]) == 3
    assert all(s["class_id"] == a1["id"] and s["student_id"] == hv01 for s in r.json())
    # Giáo viên gv.lan chỉ thấy điểm các lớp mình dạy
    lan_classes = {c["id"] for c in client.get("/classes", headers=teacher).json()}
    assert {s["class_id"] for s in client.get("/scores?limit=200", headers=teacher).json()} <= lan_classes
    # Học viên và phụ huynh chỉ thấy điểm của hv01
    for headers in (student, parent):
        rows = client.get("/scores?limit=200", headers=headers).json()
        assert rows and {s["student_id"] for s in rows} == {hv01}


def test_score_update_and_delete(client, teacher, admin):
    a1 = _class(client, teacher, "IELTS-A1")
    hv02 = user_id(client, admin, "hv02")
    score = _new_score(client, teacher, a1["id"], hv02)
    r = client.patch(f"/scores/{score['id']}", json={"value": 9.5, "note": "Tiến bộ"}, headers=teacher)
    assert r.status_code == 200 and r.json()["value"] == 9.5 and r.json()["note"] == "Tiến bộ"
    # Không gửi value thì giữ điểm cũ, chỉ sửa ghi chú
    r = client.patch(f"/scores/{score['id']}", json={"note": "Chỉ sửa ghi chú"}, headers=teacher)
    assert r.json()["value"] == 9.5
    assert client.patch(f"/scores/{score['id']}", json={"value": 10.5}, headers=teacher).status_code == 400
    assert client.delete(f"/scores/{score['id']}", headers=teacher).status_code == 204
    assert client.patch(f"/scores/{score['id']}", json={"value": 1}, headers=teacher).status_code == 404
    assert client.delete(f"/scores/{score['id']}", headers=teacher).status_code == 404


def test_score_edit_forbidden_for_other_teacher_and_students(client, admin, student):
    gt = _class(client, admin, "GIAOTIEP-1")  # lớp của gv.minh
    hv06 = user_id(client, admin, "hv06")
    score = _new_score(client, admin, gt["id"], hv06)
    lan = login(client, "gv.lan")
    assert client.patch(f"/scores/{score['id']}", json={"value": 1}, headers=lan).status_code == 403
    assert client.delete(f"/scores/{score['id']}", headers=lan).status_code == 403
    assert client.delete(f"/scores/{score['id']}", headers=student).status_code == 403
    minh = login(client, "gv.minh")
    assert client.delete(f"/scores/{score['id']}", headers=minh).status_code == 204


def test_student_score_summary(client, admin, teacher, parent):
    hv01 = user_id(client, admin, "hv01")
    all_classes = client.get(f"/scores/student/{hv01}/summary", headers=admin).json()
    assert len(all_classes) == 2  # hv01 học IELTS-A1 và GIAOTIEP-1
    assert all(0 <= c["average_10"] <= 10 and c["count"] == 3 for c in all_classes)
    # gv.lan chỉ thấy phần điểm ở lớp mình dạy
    assert len(client.get(f"/scores/student/{hv01}/summary", headers=teacher).json()) == 1
    assert client.get(f"/scores/student/{hv01}/summary", headers=parent).status_code == 200
    hv02 = user_id(client, admin, "hv02")
    assert client.get(f"/scores/student/{hv02}/summary", headers=parent).status_code == 403


# ---------- Học phí: tổng hợp và xuất Excel ----------
def test_tuition_summary_matches_records(client, admin, student):
    rows = client.get("/tuition?limit=200", headers=admin).json()
    summary = client.get("/tuition/summary", headers=admin).json()
    for status in ("unpaid", "paid", "overdue"):
        picked = [t for t in rows if t["status"] == status]
        assert summary["count_by_status"][status] == len(picked)
        assert summary[status] == sum(t["amount"] for t in picked)
    assert client.get("/tuition/summary", headers=student).status_code == 403


def test_tuition_export_xlsx(client, admin, teacher):
    r = client.get("/reports/tuition/export.xlsx", headers=admin)
    assert r.status_code == 200
    sheet = load_workbook(io.BytesIO(r.content)).active
    assert [c.value for c in sheet[1]] == ["Mã khoản", "Học viên", "Số tiền", "Hạn đóng", "Trạng thái", "Ngày đóng"]
    assert sheet.max_row == 1 + len(client.get("/tuition?limit=200", headers=admin).json())
    assert client.get("/reports/tuition/export.xlsx", headers=teacher).status_code == 403


def test_tuition_create_and_pay_errors(client, admin):
    teacher_id = user_id(client, admin, "gv.lan")
    r = client.post("/tuition", json={"student_id": teacher_id, "amount": 1000, "due_date": "2030-01-01"}, headers=admin)
    assert r.status_code == 404  # chỉ tạo học phí cho học viên
    assert client.post("/tuition/99999/pay", headers=admin).status_code == 404


# ---------- Lớp học theo vai trò ----------
def test_class_list_and_detail_for_student_and_parent(client, admin, student, parent):
    for headers in (student, parent):
        codes = sorted(c["code"] for c in client.get("/classes", headers=headers).json())
        assert codes == ["GIAOTIEP-1", "IELTS-A1"]  # hv01 học 2 lớp
    a1 = _class(client, admin, "IELTS-A1")
    b2 = _class(client, admin, "IELTS-B2")
    assert client.get(f"/classes/{a1['id']}", headers=student).status_code == 200
    assert client.get(f"/classes/{b2['id']}", headers=parent).status_code == 403


def test_class_create_put_patch_validation(client, admin):
    assert client.post("/classes", json={"code": "IELTS-A1", "name": "Trùng"}, headers=admin).status_code == 409
    hv01 = user_id(client, admin, "hv01")
    assert client.post("/classes", json={"code": "MOI-1", "name": "Mới", "teacher_id": hv01}, headers=admin).status_code == 400
    b2 = _class(client, admin, "IELTS-B2")
    # PUT thay toàn bộ: không gửi schedule thì về rỗng
    r = client.put(f"/classes/{b2['id']}", json={"code": "IELTS-B2", "name": "IELTS B2 mới"}, headers=admin)
    assert r.status_code == 200 and r.json()["schedule"] is None
    assert client.put(f"/classes/{b2['id']}", json={"code": "IELTS-A1", "name": "X"}, headers=admin).status_code == 409
    minh = user_id(client, admin, "gv.minh")
    r = client.patch(f"/classes/{b2['id']}", json={"teacher_id": minh}, headers=admin)
    assert r.status_code == 200 and r.json()["teacher_id"] == minh
    assert client.patch(f"/classes/{b2['id']}", json={"teacher_id": hv01}, headers=admin).status_code == 400


# ---------- Người dùng ----------
def test_user_get_update_and_self_protection(client, admin):
    hv03 = user_id(client, admin, "hv03")
    assert client.get(f"/users/{hv03}", headers=admin).json()["username"] == "hv03"
    assert client.get("/users/99999", headers=admin).status_code == 404
    assert client.patch("/users/99999", json={"full_name": "X"}, headers=admin).status_code == 404
    r = client.patch(f"/users/{hv03}", json={"full_name": "Võ Minh Khôi (mới)", "password": "MatKhauMoi1"}, headers=admin)
    assert r.status_code == 200 and r.json()["full_name"] == "Võ Minh Khôi (mới)"
    assert client.post("/auth/login", json={"username": "hv03", "password": "MatKhauMoi1"}).status_code == 200
    me = user_id(client, admin, "admin")
    assert client.patch(f"/users/{me}", json={"is_active": False}, headers=admin).status_code == 400
    assert client.patch(f"/users/{me}", json={"role": "teacher"}, headers=admin).status_code == 400


def test_user_search_filters(client, admin):
    rows = client.get("/users?role=teacher", headers=admin).json()
    assert sorted(u["username"] for u in rows) == ["gv.lan", "gv.minh"]
    rows = client.get("/users?q=Lan", headers=admin).json()
    assert [u["username"] for u in rows] == ["gv.lan"]


def test_parent_children_and_link(client, admin, parent):
    ph_an = user_id(client, admin, "ph.an")
    ph_ha = user_id(client, admin, "ph.ha")
    assert [c["username"] for c in client.get(f"/users/{ph_an}/children", headers=parent).json()] == ["hv01"]
    assert client.get(f"/users/{ph_ha}/children", headers=parent).status_code == 403
    hv05 = user_id(client, admin, "hv05")
    assert client.post(f"/users/{ph_an}/children", json={"student_id": hv05}, headers=admin).status_code == 201
    assert client.post(f"/users/{ph_an}/children", json={"student_id": hv05}, headers=admin).status_code == 409
    assert client.post(f"/users/{hv05}/children", json={"student_id": hv05}, headers=admin).status_code == 404
    assert client.post(f"/users/{ph_an}/children", json={"student_id": ph_ha}, headers=admin).status_code == 404
    names = sorted(c["username"] for c in client.get(f"/users/{ph_an}/children", headers=admin).json())
    assert names == ["hv01", "hv05"]


def test_csv_import_rejects_bad_files(client, admin):
    def post(name, content):
        return client.post("/users/import", files={"file": (name, content, "text/csv")}, headers=admin)

    assert post("a.txt", b"x").status_code == 400
    assert post("a.csv", b"\xff\xfe\x00bad").status_code == 400  # không phải UTF-8
    assert post("a.csv", b"username,full_name\nabc,A\n").status_code == 400  # thiếu cột
    assert post("a.csv", b"username,full_name,password,role\n").status_code == 400  # không có dòng
    assert post("a.csv", b"x" * (1024 * 1024 + 10)).status_code == 413


def test_change_password(client, student):
    bad = client.post("/auth/change-password", json={"old_password": "sai", "new_password": "MatKhau@999"}, headers=student)
    assert bad.status_code == 400
    ok = client.post("/auth/change-password", json={"old_password": "Hkii@12345", "new_password": "MatKhau@999"}, headers=student)
    assert ok.status_code == 204
    assert client.post("/auth/login", json={"username": "hv01", "password": "MatKhau@999"}).status_code == 200


# ---------- Bộ soạn theo luật khi không có Gemini (services/insights_ai.py) ----------
def _insight(**over):
    from app.services.insights import StudentInsight

    base = dict(
        student_id=1, full_name="Học viên A", sessions=10, present=9, late=0, absent=1, excused=0,
        attendance_rate=0.95, absent_streak=0, score_count=3, average_10=8.5, latest_10=8.5,
        score_change=0.0, enough_data=True,
    )
    base.update(over)
    return StudentInsight(**base)


def test_facts_text_trend_and_missing_scores():
    from app.services.insights_ai import facts_text

    assert "Điểm số: chưa có" in facts_text(_insight(average_10=None, latest_10=None, score_count=0))
    assert "đang giảm" in facts_text(_insight(score_change=-2))
    assert "đang tăng" in facts_text(_insight(score_change=2))
    assert "ổn định" in facts_text(_insight(score_change=0.2))
    assert "Xu hướng" not in facts_text(_insight(score_change=None))
    assert "chưa có" in facts_text(_insight(attendance_rate=None))
    assert "Học viên A" not in facts_text(_insight())  # không gửi tên cho AI


def test_review_fallback_covers_every_band():
    from app.services.insights_ai import review_fallback

    assert "chưa có đủ dữ liệu" in review_fallback(_insight(enough_data=False))
    good = review_fallback(_insight(score_change=2))
    assert "rất đều" in good and "tốt" in good and "tiến bộ" in good and "nâng cao" in good
    mid = review_fallback(_insight(attendance_rate=0.85, average_10=7.0, level="medium"))
    assert "khá đều" in mid and "mức khá" in mid and "đi học đủ buổi" in mid
    low = review_fallback(_insight(attendance_rate=0.6, absent_streak=3, average_10=5.0, score_change=-2, level="high"))
    assert "còn thấp" in low and "3 buổi liên tiếp" in low and "ôn tập thêm" in low and "thấp hơn các bài trước" in low
    assert "Kết quả" not in review_fallback(_insight(average_10=None))


def test_advice_fallback_without_factors():
    from app.services.insights_ai import advice_fallback

    assert advice_fallback(_insight()) == "- Học viên đang ổn định, tiếp tục theo dõi định kỳ."
