import datetime as dt

from tests.conftest import login, user_id


# ---------- Auth ----------
def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_login_wrong_password_is_generic(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "sai-mat-khau"})
    assert r.status_code == 401
    r2 = client.post("/auth/login", json={"username": "khong-ton-tai", "password": "x"})
    assert r2.status_code == 401
    assert r.json()["detail"] == r2.json()["detail"]  # không lộ tài khoản có tồn tại


def test_account_locks_after_repeated_failures(client):
    for _ in range(5):
        client.post("/auth/login", json={"username": "hv02", "password": "sai"})
    r = client.post("/auth/login", json={"username": "hv02", "password": "Hkii@12345"})
    assert r.status_code == 423


def test_requires_token(client):
    assert client.get("/classes").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer rac"}).status_code == 401


# ---------- Phân quyền ----------
def test_student_cannot_create_class_or_user(client, student):
    assert client.post("/classes", json={"code": "X", "name": "X"}, headers=student).status_code == 403
    body = {"username": "abcd", "full_name": "A", "password": "12345678", "role": "student"}
    assert client.post("/users", json=body, headers=student).status_code == 403


def test_parent_sees_only_own_child(client, parent, admin):
    students = client.get("/students", headers=parent).json()
    assert [s["username"] for s in students] == ["hv01"]
    other_id = user_id(client, admin, "hv02")
    assert client.get(f"/attendance/summary/{other_id}", headers=parent).status_code == 403
    own_id = user_id(client, admin, "hv01")
    assert client.get(f"/attendance/summary/{own_id}", headers=parent).status_code == 200


def test_teacher_cannot_manage_other_teachers_class(client, teacher, admin):
    classes = client.get("/classes", headers=admin).json()
    other = next(c for c in classes if c["code"] == "GIAOTIEP-1")  # của gv.minh
    r = client.post(
        "/attendance/batch",
        json={"class_id": other["id"], "date": "2026-01-05", "records": [{"student_id": 1, "status": "present"}]},
        headers=teacher,
    )
    assert r.status_code == 403


def test_teacher_cannot_see_tuition(client, teacher):
    assert client.get("/tuition", headers=teacher).status_code == 403


# ---------- Điểm danh / điểm ----------
def test_attendance_batch_is_upsert(client, teacher, admin):
    cls = next(c for c in client.get("/classes", headers=teacher).json() if c["code"] == "IELTS-A1")
    students = client.get(f"/classes/{cls['id']}/students", headers=teacher).json()
    day = "2030-03-01"
    first = [{"student_id": s["id"], "status": "present"} for s in students]
    r1 = client.post("/attendance/batch", json={"class_id": cls["id"], "date": day, "records": first}, headers=teacher)
    assert r1.status_code == 200
    second = [{"student_id": students[0]["id"], "status": "absent", "note": "ốm"}]
    r2 = client.post("/attendance/batch", json={"class_id": cls["id"], "date": day, "records": second}, headers=teacher)
    assert r2.status_code == 200
    rows = client.get(f"/attendance?class_id={cls['id']}&date_from={day}&date_to={day}", headers=teacher).json()
    assert len(rows) == len(students)  # không tạo trùng
    assert next(x for x in rows if x["student_id"] == students[0]["id"])["status"] == "absent"


def test_attendance_rejects_student_not_in_class(client, teacher, admin):
    cls = next(c for c in client.get("/classes", headers=teacher).json() if c["code"] == "IELTS-A1")
    outsider = user_id(client, admin, "hv08")  # hv08 không thuộc IELTS-A1
    r = client.post(
        "/attendance/batch",
        json={"class_id": cls["id"], "date": "2030-03-02", "records": [{"student_id": outsider, "status": "present"}]},
        headers=teacher,
    )
    assert r.status_code == 400


def test_score_validation_and_summary(client, teacher, admin):
    cls = next(c for c in client.get("/classes", headers=teacher).json() if c["code"] == "IELTS-A1")
    sid = user_id(client, admin, "hv01")
    base = {"class_id": cls["id"], "student_id": sid, "kind": "final"}
    assert client.post("/scores", json={**base, "value": 11, "max_value": 10}, headers=teacher).status_code == 400
    ok = client.post("/scores", json={**base, "value": 8, "max_value": 10}, headers=teacher)
    assert ok.status_code == 201
    summary = client.get(f"/scores/student/{sid}/summary", headers=teacher).json()
    assert any(row["class_id"] == cls["id"] and row["count"] >= 1 for row in summary)


# ---------- Học phí ----------
def test_tuition_overdue_and_pay(client, admin):
    past = (dt.date.today() - dt.timedelta(days=3)).isoformat()
    sid = user_id(client, admin, "hv01")
    created = client.post(
        "/tuition", json={"student_id": sid, "amount": 1000000, "due_date": past}, headers=admin
    )
    assert created.status_code == 201
    record_id = created.json()["id"]
    assert client.post("/tuition/mark-overdue", headers=admin).json()["updated"] >= 1
    rows = client.get("/tuition?status=overdue", headers=admin).json()
    assert any(r["id"] == record_id for r in rows)
    paid = client.post(f"/tuition/{record_id}/pay", headers=admin)
    assert paid.status_code == 200 and paid.json()["status"] == "paid"
    assert client.post(f"/tuition/{record_id}/pay", headers=admin).status_code == 409


# ---------- Báo cáo ----------
def test_class_report_and_excel(client, teacher):
    cls = next(c for c in client.get("/classes", headers=teacher).json() if c["code"] == "IELTS-A1")
    summary = client.get(f"/reports/class/{cls['id']}/summary", headers=teacher).json()
    assert summary["student_count"] == 4
    assert summary["average_score_10"] is not None
    xlsx = client.get(f"/reports/class/{cls['id']}/export.xlsx", headers=teacher)
    assert xlsx.status_code == 200
    assert xlsx.content[:2] == b"PK"  # file xlsx là zip


# ---------- AI Coach ----------
def test_coach_uses_rule_based_fallback(client, student):
    text = "I like learning English because it helps me talk with many people. " * 3
    r = client.post("/coach/feedback", json={"kind": "writing", "text": text}, headers=student)
    assert r.status_code == 201
    assert r.json()["provider"] == "rules"
    hist = client.get("/coach/history", headers=student).json()
    assert len(hist) == 1


def test_parent_cannot_use_coach(client, parent):
    r = client.post("/coach/feedback", json={"kind": "writing", "text": "x" * 40}, headers=parent)
    assert r.status_code == 403


# ---------- Ghi danh vào lớp ----------
def _class_by_code(client, headers, code):
    return next(c for c in client.get("/classes", headers=headers).json() if c["code"] == code)


def _class_usernames(client, headers, class_id):
    return [s["username"] for s in client.get(f"/classes/{class_id}/students", headers=headers).json()]


def test_enroll_duplicate_and_remove_student(client, admin):
    class_id = _class_by_code(client, admin, "IELTS-A1")["id"]
    sid = user_id(client, admin, "hv08")  # hv08 chưa thuộc IELTS-A1
    assert "hv08" not in _class_usernames(client, admin, class_id)

    added = client.post(f"/classes/{class_id}/students", json={"student_id": sid}, headers=admin)
    assert added.status_code == 201, added.text
    assert added.json() == {"class_id": class_id, "student_id": sid}
    assert "hv08" in _class_usernames(client, admin, class_id)

    # Ghi danh trùng bị từ chối và không tạo thêm dòng
    before = len(_class_usernames(client, admin, class_id))
    again = client.post(f"/classes/{class_id}/students", json={"student_id": sid}, headers=admin)
    assert again.status_code == 409
    assert len(_class_usernames(client, admin, class_id)) == before

    # Xóa khỏi lớp; xóa lần hai báo không còn trong lớp
    assert client.delete(f"/classes/{class_id}/students/{sid}", headers=admin).status_code == 204
    assert "hv08" not in _class_usernames(client, admin, class_id)
    assert client.delete(f"/classes/{class_id}/students/{sid}", headers=admin).status_code == 404


def test_enroll_rejects_non_student_and_unknown_ids(client, admin):
    class_id = _class_by_code(client, admin, "IELTS-A1")["id"]
    url = f"/classes/{class_id}/students"
    teacher_id = user_id(client, admin, "gv.lan")
    assert client.post(url, json={"student_id": teacher_id}, headers=admin).status_code == 404  # không phải học viên
    assert client.post(url, json={"student_id": 999999}, headers=admin).status_code == 404
    sid = user_id(client, admin, "hv08")
    assert client.post("/classes/999999/students", json={"student_id": sid}, headers=admin).status_code == 404


def test_enroll_permissions(client, admin, teacher, student, parent):
    own = _class_by_code(client, admin, "IELTS-A1")["id"]  # của gv.lan
    other = _class_by_code(client, admin, "GIAOTIEP-1")["id"]  # của gv.minh
    sid = user_id(client, admin, "hv08")
    existing = user_id(client, admin, "hv01")  # hv01 thuộc cả hai lớp

    # Giáo viên chỉ quản lý được lớp mình phụ trách
    assert client.post(f"/classes/{own}/students", json={"student_id": sid}, headers=teacher).status_code == 201
    assert client.delete(f"/classes/{own}/students/{sid}", headers=teacher).status_code == 204
    assert client.post(f"/classes/{other}/students", json={"student_id": sid}, headers=teacher).status_code == 403
    assert client.delete(f"/classes/{other}/students/{existing}", headers=teacher).status_code == 403

    # Học viên, phụ huynh không được ghi danh hay xóa
    for who in (student, parent):
        assert client.post(f"/classes/{own}/students", json={"student_id": sid}, headers=who).status_code == 403
        assert client.delete(f"/classes/{own}/students/{existing}", headers=who).status_code == 403
    assert client.post(f"/classes/{own}/students", json={"student_id": sid}).status_code == 401


# ---------- Quản lý người dùng ----------
NEW_USER = {"username": "hv.moi", "full_name": "Học Viên Mới", "password": "MatKhau@123", "role": "student"}


def test_create_user_and_login(client, admin):
    r = client.post("/users", json=NEW_USER, headers=admin)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["username"] == "hv.moi" and body["role"] == "student" and body["is_active"] is True
    assert "password" not in body and "password_hash" not in body  # không trả mật khẩu về
    login(client, "hv.moi", "MatKhau@123")


def test_create_user_duplicate_username_and_validation(client, admin):
    assert client.post("/users", json=NEW_USER, headers=admin).status_code == 201
    dup = client.post("/users", json={**NEW_USER, "full_name": "Người Khác"}, headers=admin)
    assert dup.status_code == 409
    assert isinstance(dup.json()["detail"], str)
    assert client.post("/users", json={**NEW_USER, "username": "admin"}, headers=admin).status_code == 409
    # Tên đăng nhập có ký tự lạ, mật khẩu quá ngắn, vai trò không có thật
    assert client.post("/users", json={**NEW_USER, "username": "co dau cach"}, headers=admin).status_code == 422
    assert client.post("/users", json={**NEW_USER, "username": "hv.ngan", "password": "123"}, headers=admin).status_code == 422
    assert client.post("/users", json={**NEW_USER, "username": "hv.sai", "role": "boss"}, headers=admin).status_code == 422


def test_update_user_fields_and_password(client, admin):
    uid = client.post("/users", json=NEW_USER, headers=admin).json()["id"]

    renamed = client.patch(f"/users/{uid}", json={"full_name": "Tên Đã Sửa", "role": "parent"}, headers=admin)
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["full_name"] == "Tên Đã Sửa" and renamed.json()["role"] == "parent"

    # Chỉ gửi một trường thì các trường khác giữ nguyên
    same = client.patch(f"/users/{uid}", json={"password": "MatKhauMoi@456"}, headers=admin).json()
    assert same["full_name"] == "Tên Đã Sửa" and same["role"] == "parent"
    assert client.post("/auth/login", json={"username": "hv.moi", "password": "MatKhau@123"}).status_code == 401
    login(client, "hv.moi", "MatKhauMoi@456")

    assert client.patch("/users/999999", json={"full_name": "Không Có"}, headers=admin).status_code == 404


def test_admin_can_lock_other_user(client, admin):
    uid = client.post("/users", json=NEW_USER, headers=admin).json()["id"]
    token = login(client, "hv.moi", "MatKhau@123")

    locked = client.patch(f"/users/{uid}", json={"is_active": False}, headers=admin)
    assert locked.status_code == 200 and locked.json()["is_active"] is False
    assert client.get("/auth/me", headers=token).status_code == 401  # token cũ hết hiệu lực ngay
    assert client.post("/auth/login", json={"username": "hv.moi", "password": "MatKhau@123"}).status_code == 401

    assert client.patch(f"/users/{uid}", json={"is_active": True}, headers=admin).json()["is_active"] is True
    login(client, "hv.moi", "MatKhau@123")


def test_admin_cannot_lock_or_demote_self(client, admin):
    admin_id = user_id(client, admin, "admin")
    url = f"/users/{admin_id}"
    assert client.patch(url, json={"is_active": False}, headers=admin).status_code == 400
    assert client.patch(url, json={"role": "teacher"}, headers=admin).status_code == 400

    # Yêu cầu bị từ chối không làm thay đổi tài khoản
    me = client.get("/auth/me", headers=admin)
    assert me.status_code == 200
    assert me.json()["role"] == "admin" and me.json()["is_active"] is True

    # Admin vẫn tự sửa được tên của mình
    assert client.patch(url, json={"full_name": "Admin Mới", "role": "admin", "is_active": True}, headers=admin).status_code == 200


def test_non_admin_cannot_manage_users(client, admin, teacher, student, parent):
    uid = user_id(client, admin, "hv02")
    for who in (teacher, student, parent):
        assert client.post("/users", json=NEW_USER, headers=who).status_code == 403
        assert client.patch(f"/users/{uid}", json={"full_name": "Hack"}, headers=who).status_code == 403
        assert client.get("/users", headers=who).status_code == 403
