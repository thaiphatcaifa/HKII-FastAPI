import os

from sqlalchemy.engine import make_url

DEFAULT_TEST_DATABASE_URL = "sqlite:///./test.db"


def resolve_test_database_url(test_url: str | None, main_url: str | None) -> str:
    """Chọn CSDL cho test. Mỗi test đều drop_all nên phải từ chối mọi URL có thể là CSDL chính."""
    if not test_url:
        return DEFAULT_TEST_DATABASE_URL
    target = make_url(test_url)
    name = target.database or ""
    if "test" not in name.lower():
        raise RuntimeError(f"TEST_DATABASE_URL phải trỏ tới CSDL riêng có chữ 'test' trong tên (đang là '{name}').")
    if main_url:
        main = make_url(main_url)
        if (target.host, target.port, target.database) == (main.host, main.port, main.database):
            raise RuntimeError("TEST_DATABASE_URL trùng với DATABASE_URL: test sẽ xóa dữ liệu của CSDL chính.")
    return test_url


# BẮT BUỘC đặt trước khi import app: mặc định test chạy trên SQLite riêng. Muốn chạy trên PostgreSQL
# thì đặt TEST_DATABASE_URL trỏ tới CSDL dành riêng cho test (create_all/drop_all sẽ xóa dữ liệu).
os.environ["DATABASE_URL"] = resolve_test_database_url(os.environ.get("TEST_DATABASE_URL"), os.environ.get("DATABASE_URL"))
os.environ["APP_ENV"] = "dev"
os.environ["GEMINI_API_KEY"] = ""
os.environ["SEED_ON_START"] = "false"
os.environ["SEED_PASSWORD"] = "Hkii@12345"  # không phụ thuộc .env của máy đang chạy test
os.environ["SECRET_KEY"] = "test-secret"
os.environ["AUTO_OVERDUE_ENABLED"] = "false"  # test học phí tự bật lại khi cần

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def login(client: TestClient, username: str, password: str = "Hkii@12345") -> dict:
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def admin(client):
    return login(client, "admin")


@pytest.fixture()
def teacher(client):
    return login(client, "gv.lan")


@pytest.fixture()
def student(client):
    return login(client, "hv01")


@pytest.fixture()
def parent(client):
    return login(client, "ph.an")


def user_id(client: TestClient, admin_headers: dict, username: str) -> int:
    users = client.get("/users", headers=admin_headers).json()
    return next(u["id"] for u in users if u["username"] == username)
