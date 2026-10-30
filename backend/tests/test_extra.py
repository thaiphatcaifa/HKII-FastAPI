"""Test cho phần bổ sung theo tài liệu môn học: phân trang, PUT, exception handler, logging."""
import logging

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import user_id


# ---------- Phân trang (Buổi 5) ----------
def test_users_pagination_and_total_header(client, admin):
    r = client.get("/users?limit=3", headers=admin)
    assert r.status_code == 200
    assert len(r.json()) == 3
    assert int(r.headers["X-Total-Count"]) == 13  # 1 admin + 2 giáo viên + 8 học viên + 2 phụ huynh
    last = client.get("/users?skip=12&limit=5", headers=admin)
    assert len(last.json()) == 1


def test_pagination_rejects_bad_params(client, admin):
    assert client.get("/users?limit=0", headers=admin).status_code == 422
    assert client.get("/users?limit=501", headers=admin).status_code == 422
    assert client.get("/users?skip=-1", headers=admin).status_code == 422


def test_students_endpoint_reports_total_for_parent(client, parent):
    r = client.get("/students", headers=parent)
    assert r.status_code == 200
    assert int(r.headers["X-Total-Count"]) == 1


def test_attendance_pagination(client, teacher):
    cls = next(c for c in client.get("/classes", headers=teacher).json() if c["code"] == "IELTS-A1")
    students = client.get(f"/classes/{cls['id']}/students", headers=teacher).json()
    for day in ("2031-05-01", "2031-05-02"):
        records = [{"student_id": s["id"], "status": "present"} for s in students]
        ok = client.post("/attendance/batch", json={"class_id": cls["id"], "date": day, "records": records}, headers=teacher)
        assert ok.status_code == 200
    base = f"/attendance?class_id={cls['id']}&date_from=2031-05-01&date_to=2031-05-02"
    everything = client.get(base + "&limit=500", headers=teacher)
    total = int(everything.headers["X-Total-Count"])
    assert total == len(students) * 2 == len(everything.json())
    small = client.get(base + "&limit=2", headers=teacher)
    assert len(small.json()) == 2
    assert int(small.headers["X-Total-Count"]) == total


# ---------- PUT (Buổi 4) ----------
def test_put_replaces_whole_class(client, admin):
    classes = client.get("/classes", headers=admin).json()
    target = next(c for c in classes if c["code"] == "IELTS-A1")
    body = {"code": "IELTS-A1", "name": "Tên mới hoàn toàn", "teacher_id": target["teacher_id"]}
    r = client.put(f"/classes/{target['id']}", json=body, headers=admin)
    assert r.status_code == 200
    assert r.json()["name"] == "Tên mới hoàn toàn"
    assert r.json()["schedule"] is None  # PUT thay thế: trường không gửi về rỗng


def test_put_class_rules(client, admin, teacher):
    classes = client.get("/classes", headers=admin).json()
    target = next(c for c in classes if c["code"] == "IELTS-A1")
    other = next(c for c in classes if c["code"] == "GIAOTIEP-1")
    url = f"/classes/{target['id']}"
    body = {"code": "IELTS-A1", "name": "X", "teacher_id": target["teacher_id"]}
    assert client.put(url, json=body, headers=teacher).status_code == 403  # chỉ admin
    assert client.put(url, json={**body, "code": other["code"]}, headers=admin).status_code == 409
    admin_id = user_id(client, admin, "admin")
    assert client.put(url, json={**body, "teacher_id": admin_id}, headers=admin).status_code == 400
    assert client.put("/classes/999999", json=body, headers=admin).status_code == 404


# ---------- Exception handler (Buổi 7) ----------
def test_errors_keep_detail_shape(client):
    r = client.get("/classes")
    assert r.status_code == 401
    assert isinstance(r.json()["detail"], str)
    assert r.headers["www-authenticate"] == "Bearer"
    assert client.get("/khong-co-route").json() == {"detail": "Not Found"}


def test_validation_error_is_422_with_detail_list(client, admin):
    r = client.post("/classes", json={"code": "", "name": ""}, headers=admin)
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], list)


def test_unexpected_error_returns_generic_500():
    def boom():
        raise RuntimeError("lỗi nội bộ bí mật")

    app.add_api_route("/__boom", boom, methods=["GET"])
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/__boom")
    assert r.status_code == 500
    assert r.json() == {"detail": "Lỗi máy chủ. Vui lòng thử lại sau."}  # không lộ nội dung lỗi


# ---------- Logging (Buổi 7) ----------
def test_requests_are_logged_with_timing_header(client, caplog):
    caplog.set_level(logging.INFO, logger="hkii")
    r = client.get("/health")
    assert "X-Process-Time-ms" in r.headers
    assert any("/health" in rec.getMessage() and "ms" in rec.getMessage() for rec in caplog.records)


def test_login_failures_are_logged_without_secrets(client, caplog):
    caplog.set_level(logging.INFO, logger="hkii")
    for _ in range(5):
        client.post("/auth/login", json={"username": "hv03", "password": "mat-khau-sai-123"})
    text = caplog.text
    assert "Khóa tài khoản hv03" in text
    assert "mat-khau-sai-123" not in text  # không bao giờ ghi mật khẩu
