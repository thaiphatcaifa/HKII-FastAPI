import logging
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "dev-only-change-me"
DEFAULT_SEED_PASSWORD = "Hkii@12345"


class InsecureConfigError(RuntimeError):
    """Chạy ở môi trường prod mà khóa/mật khẩu vẫn là giá trị mặc định công khai trong repo."""


class Settings(BaseSettings):
    # dev: chỉ cảnh báo khi còn giá trị mặc định. prod: từ chối khởi động. Giá trị khác sẽ báo lỗi ngay.
    app_env: Literal["dev", "prod"] = "dev"

    database_url: str = "sqlite:///./dev.db"
    secret_key: str = DEFAULT_SECRET_KEY
    access_token_minutes: int = 8 * 60

    # Khóa tạm thời sau nhiều lần đăng nhập sai (tương đương node loginAttempts cũ)
    max_failed_logins: int = 5
    lock_minutes: int = 15

    # AI Coach: nếu không có key thì dùng bộ nhận xét theo luật
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    coach_daily_limit: int = 20
    # Nhận xét học viên + gợi ý hành động: số lượt AI mỗi giáo viên được dùng trong một ngày (tính theo UTC)
    ai_daily_limit: int = 30

    # Logging: ghi cảnh báo nếu một request chậm hơn ngưỡng này (mili giây)
    log_level: str = "INFO"
    slow_request_ms: int = 500

    # Tự động đánh dấu học phí quá hạn (chạy nền). Tương đương tuitionAutoOverdue của Firebase.
    auto_overdue_enabled: bool = True
    overdue_refresh_seconds: int = 3600

    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    seed_on_start: bool = False
    seed_password: str = DEFAULT_SEED_PASSWORD

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def insecure_settings(self) -> list[str]:
        """Tên các biến còn giá trị mặc định hoặc để trống. Chỉ trả tên, không bao giờ trả giá trị."""
        insecure = []
        if self.secret_key in ("", DEFAULT_SECRET_KEY):
            insecure.append("SECRET_KEY")
        if self.seed_password in ("", DEFAULT_SEED_PASSWORD):
            insecure.append("SEED_PASSWORD")
        return insecure


def check_security_config(config: Settings, log: logging.Logger) -> None:
    """Gọi đầu tiên khi khởi động API: prod thì dừng hẳn, dev thì chỉ ghi cảnh báo."""
    insecure = config.insecure_settings()
    if not insecure:
        return
    names = ", ".join(insecure)
    if config.app_env == "prod":
        raise InsecureConfigError(
            f"APP_ENV=prod nhưng {names} vẫn là giá trị mặc định hoặc để trống. "
            "Đặt giá trị riêng trong .env rồi khởi động lại."
        )
    log.warning("%s đang dùng giá trị mặc định, chỉ chấp nhận khi chạy thử (APP_ENV=dev).", names)


settings = Settings()
