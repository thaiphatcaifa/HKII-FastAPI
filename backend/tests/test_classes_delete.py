"""Xóa lớp (DELETE /classes/{id}): chỉ admin, chỉ lớp trống, lớp còn dữ liệu trả 409 kèm lý do."""
from tests.conftest import user_id


def _class_id(client, headers, code):
    return next(c["id"] for c in client.get("/classes", headers=headers).json() if c["code"] == code)


def test_delete_empty_class(client, admin):
    r = client.post("/classes", json={"code": "TAM-01", "name": "Lớp tạm"}, headers=admin)
    class_id = r.json()["id"]
    assert client.delete(f"/classes/{class_id}", headers=admin).status_code == 204
    assert client.get(f"/classes/{class_id}", headers=admin).status_code == 404


def test_delete_class_with_data_is_conflict(client, admin):
    class_id = _class_id(client, admin, "IELTS-A1")
    r = client.delete(f"/classes/{class_id}", headers=admin)
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert "IELTS-A1" in detail
    assert "học viên ghi danh" in detail and "điểm danh" in detail and "điểm số" in detail
    assert client.get(f"/classes/{class_id}", headers=admin).status_code == 200  # lớp vẫn còn


def test_delete_class_blocked_by_leftover_scores(client, admin, teacher):
    """Đã gỡ hết học viên nhưng còn điểm số thì vẫn không xóa được."""
    class_id = client.post("/classes", json={"code": "TAM-02", "name": "Lớp tạm 2"}, headers=admin).json()["id"]
    sid = user_id(client, admin, "hv08")
    assert client.post(f"/classes/{class_id}/students", json={"student_id": sid}, headers=admin).status_code == 201
    r = client.post(
        "/scores", json={"class_id": class_id, "student_id": sid, "kind": "quiz", "value": 8}, headers=admin
    )
    assert r.status_code == 201, r.text
    assert client.delete(f"/classes/{class_id}/students/{sid}", headers=admin).status_code == 204
    r = client.delete(f"/classes/{class_id}", headers=admin)
    assert r.status_code == 409
    assert "1 điểm số" in r.json()["detail"]
    assert "học viên ghi danh" not in r.json()["detail"]


def test_delete_class_requires_admin(client, admin, teacher, student):
    class_id = client.post("/classes", json={"code": "TAM-03", "name": "Lớp tạm 3"}, headers=admin).json()["id"]
    assert client.delete(f"/classes/{class_id}", headers=teacher).status_code == 403
    assert client.delete(f"/classes/{class_id}", headers=student).status_code == 403
    assert client.delete(f"/classes/{class_id}").status_code == 401


def test_delete_missing_class(client, admin):
    assert client.delete("/classes/99999", headers=admin).status_code == 404
    assert client.delete("/classes/0", headers=admin).status_code == 422
