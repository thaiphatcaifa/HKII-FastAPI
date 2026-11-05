"""Test cấu hình: APP_ENV chặn giá trị mặc định khi prod, và lớp bảo vệ CSDL chính khi chạy test."""
import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import (
    DEFAULT_SECRET_KEY,
    DEFAULT_SEED_PASSWORD,
    InsecureConfigError,
    Settings,
    check_security_config,
    settings,
)
from app.main import app
from tests.conftest import DEFAULT_TEST_DATABASE_URL, resolve_test_database_url

LOG = logging.getLogger("hkii.app")
SAFE_KEY = "khoa-rieng-dai-va-ngau-nhien"
SAFE_PASSWORD = "MatKhauRieng@2026"


def make_settings(**values) -> Settings:
    return Settings(_env_file=None, **values)


# ---------- APP_ENV ----------
def test_app_env_defaults_to_dev_and_rejects_other_values(monkeypatch):
    monkeypatch.delenv("APP_ENV")
    assert make_settings().app_env == "dev"
    with pytest.raises(ValidationError):
        make_settings(app_env="production")


@pytest.mark.parametrize(
    ("secret_key", "seed_password", "named", "not_named"),
    [
        (DEFAULT_SECRET_KEY, SAFE_PASSWORD, "SECRET_KEY", "SEED_PASSWORD"),
        (SAFE_KEY, DEFAULT_SEED_PASSWORD, "SEED_PASSWORD", "SECRET_KEY"),
        ("", SAFE_PASSWORD, "SECRET_KEY", "SEED_PASSWORD"),
    ],
)
def test_prod_refuses_each_default_value(secret_key, seed_password, named, not_named):
    config = make_settings(app_env="prod", secret_key=secret_key, seed_password=seed_password)
    with pytest.raises(InsecureConfigError) as exc:
        check_security_config(config, LOG)
    assert named in str(exc.value) and not_named not in str(exc.value)


def test_prod_error_lists_both_names_without_values():
    config = make_settings(app_env="prod", secret_key=DEFAULT_SECRET_KEY, seed_password=DEFAULT_SEED_PASSWORD)
    with pytest.raises(InsecureConfigError) as exc:
        check_security_config(config, LOG)
    message = str(exc.value)
    assert "SECRET_KEY" in message and "SEED_PASSWORD" in message
    assert DEFAULT_SECRET_KEY not in message and DEFAULT_SEED_PASSWORD not in message  # không in giá trị ra log


def test_prod_with_own_values_starts_silently(caplog):
    config = make_settings(app_env="prod", secret_key=SAFE_KEY, seed_password=SAFE_PASSWORD)
    with caplog.at_level(logging.WARNING, logger="hkii"):
        check_security_config(config, LOG)
    assert caplog.records == []


def test_dev_only_logs_warning(caplog):
    config = make_settings(app_env="dev", secret_key=DEFAULT_SECRET_KEY, seed_password=DEFAULT_SEED_PASSWORD)
    with caplog.at_level(logging.WARNING, logger="hkii"):
        check_security_config(config, LOG)  # không dừng
    assert "SECRET_KEY, SEED_PASSWORD" in caplog.text
    assert DEFAULT_SEED_PASSWORD not in caplog.text


def test_api_stops_on_startup_when_prod_uses_defaults(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "prod")
    monkeypatch.setattr(settings, "secret_key", DEFAULT_SECRET_KEY)
    monkeypatch.setattr(settings, "seed_password", DEFAULT_SEED_PASSWORD)
    with pytest.raises(InsecureConfigError):
        with TestClient(app):
            pass


def test_api_starts_on_prod_with_own_values(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "prod")
    monkeypatch.setattr(settings, "secret_key", SAFE_KEY)
    monkeypatch.setattr(settings, "seed_password", SAFE_PASSWORD)
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200


def test_api_starts_on_dev_with_defaults_and_warns(monkeypatch, caplog):
    monkeypatch.setattr(settings, "secret_key", DEFAULT_SECRET_KEY)
    monkeypatch.setattr(settings, "seed_password", DEFAULT_SEED_PASSWORD)
    with caplog.at_level(logging.WARNING, logger="hkii"):
        with TestClient(app) as c:
            assert c.get("/health").status_code == 200
    assert "SECRET_KEY, SEED_PASSWORD" in caplog.text


# ---------- Bảo vệ CSDL chính khi chạy test ----------
def test_tests_use_sqlite_without_test_database_url():
    assert resolve_test_database_url(None, "postgresql+psycopg://u:p@db:5432/hkii") == DEFAULT_TEST_DATABASE_URL
    assert resolve_test_database_url("", None) == DEFAULT_TEST_DATABASE_URL


def test_test_database_url_accepts_dedicated_database():
    url = "postgresql+psycopg://u:p@db:5432/hkii_test"
    assert resolve_test_database_url(url, "postgresql+psycopg://u:p@db:5432/hkii") == url


def test_test_database_url_refuses_main_database():
    with pytest.raises(RuntimeError, match="test"):
        resolve_test_database_url("postgresql+psycopg://u:p@db:5432/hkii", None)  # tên không có "test"
    same = "postgresql+psycopg://u:p@db:5432/hkii_test"
    with pytest.raises(RuntimeError, match="trùng"):
        resolve_test_database_url(same, same)
