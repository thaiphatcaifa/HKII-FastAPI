"""Sửa, xóa khoản học phí (PATCH, DELETE /tuition/{id}): chỉ admin, chỉ khoản chưa đóng."""
import datetime as dt

from tests.conftest import user_id


def _new_record(client, admin, due="2030-01-31", amount=1_500_000):
    sid = user_id(client, admin, "hv02")
    r = client.post("/tuition", json={"student_id": sid, "amount": amount, "due_date": due, "note": "Tháng 1"}, headers=admin)
    assert r.status_code == 201, r.text
    return r.json()


def test_patch_unpaid_record(client, admin):
    rec = _new_record(client, admin)
    r = client.patch(f"/tuition/{rec['id']}", json={"amount": 1_800_000, "note": "Điều chỉnh"}, headers=admin)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amount"] == 1_800_000
    assert body["note"] == "Điều chỉnh"
    assert body["due_date"] == "2030-01-31"  # trường không gửi thì giữ nguyên
    assert body["status"] == "unpaid"


def test_patch_due_date_recomputes_status(client, admin):
    rec = _new_record(client, admin)
    past = (dt.date.today() - dt.timedelta(days=3)).isoformat()
    r = client.patch(f"/tuition/{rec['id']}", json={"due_date": past}, headers=admin)
    assert r.json()["status"] == "overdue"
    future = (dt.date.today() + dt.timedelta(days=10)).isoformat()
    r = client.patch(f"/tuition/{rec['id']}", json={"due_date": future}, headers=admin)
    assert r.json()["status"] == "unpaid"  # gia hạn thì khoản quá hạn trở lại chưa đóng


def test_patch_rejects_bad_input(client, admin):
    rec = _new_record(client, admin)
    assert client.patch(f"/tuition/{rec['id']}", json={}, headers=admin).status_code == 400
    assert client.patch(f"/tuition/{rec['id']}", json={"amount": None}, headers=admin).status_code == 400
    assert client.patch(f"/tuition/{rec['id']}", json={"due_date": None}, headers=admin).status_code == 400
    assert client.patch(f"/tuition/{rec['id']}", json={"amount": 0}, headers=admin).status_code == 422
    assert client.patch(f"/tuition/{rec['id']}", json={"note": "x" * 301}, headers=admin).status_code == 422
    # Ghi chú được phép xóa trắng
    r = client.patch(f"/tuition/{rec['id']}", json={"note": None}, headers=admin)
    assert r.status_code == 200 and r.json()["note"] is None


def test_paid_record_cannot_be_edited_or_deleted(client, admin):
    rec = _new_record(client, admin)
    assert client.post(f"/tuition/{rec['id']}/pay", headers=admin).status_code == 200
    assert client.patch(f"/tuition/{rec['id']}", json={"amount": 1}, headers=admin).status_code == 409
    assert client.delete(f"/tuition/{rec['id']}", headers=admin).status_code == 409


def test_delete_unpaid_record(client, admin):
    rec = _new_record(client, admin)
    assert client.delete(f"/tuition/{rec['id']}", headers=admin).status_code == 204
    ids = [t["id"] for t in client.get("/tuition", headers=admin).json()]
    assert rec["id"] not in ids
    assert client.delete(f"/tuition/{rec['id']}", headers=admin).status_code == 404
    assert client.patch(f"/tuition/{rec['id']}", json={"amount": 5}, headers=admin).status_code == 404


def test_tuition_edit_requires_admin(client, admin, teacher, student, parent):
    rec = _new_record(client, admin)
    for headers in (teacher, student, parent):
        assert client.patch(f"/tuition/{rec['id']}", json={"amount": 1}, headers=headers).status_code == 403
        assert client.delete(f"/tuition/{rec['id']}", headers=headers).status_code == 403
