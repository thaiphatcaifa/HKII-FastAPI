from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    secret_key: str = "dev-only-change-me"
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
    seed_password: str = "Hkii@12345"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
