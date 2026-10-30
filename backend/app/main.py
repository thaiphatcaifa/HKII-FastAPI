import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.db import SessionLocal
from app.error_handlers import register_exception_handlers
from app.logging_config import setup_logging
from app.routers import attendance, auth, classes, coach, reports, scores, tuition, users
from app.services.tuition_jobs import refresh_overdue

setup_logging()
logger = logging.getLogger("hkii.app")
request_logger = logging.getLogger("hkii.request")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Khởi động HKII API (log_level=%s)", settings.log_level)
    if settings.seed_on_start:
        from app.seed import seed_if_empty

        with SessionLocal() as db:
            if seed_if_empty(db):
                logger.info("Đã tạo dữ liệu mẫu")
    if settings.auto_overdue_enabled:
        await run_in_threadpool(refresh_overdue, True)  # quét học phí quá hạn một lần khi khởi động
    yield
    logger.info("Tắt HKII API")


TAGS_METADATA = [
    {"name": "auth", "description": "Đăng nhập (JSON hoặc OAuth2), thông tin tài khoản, đổi mật khẩu."},
    {"name": "users", "description": "Quản lý người dùng (admin), liên kết phụ huynh - học viên, nhập từ CSV."},
    {"name": "classes", "description": "Lớp học và ghi danh học viên."},
    {"name": "attendance", "description": "Điểm danh theo ngày và thống kê chuyên cần."},
    {"name": "scores", "description": "Nhập, sửa, xóa điểm và điểm trung bình theo lớp."},
    {"name": "tuition", "description": "Học phí: tạo khoản thu, thanh toán, tự động đánh dấu quá hạn."},
    {"name": "reports", "description": "Báo cáo lớp học và xuất file Excel."},
    {"name": "coach", "description": "AI Coach nhận xét bài viết/bài nói (Gemini hoặc bộ nhận xét theo luật)."},
    {"name": "system", "description": "Kiểm tra tình trạng hệ thống."},
]

app = FastAPI(
    title="HKII - Hệ thống quản lý trung tâm (FastAPI + PostgreSQL)",
    version="0.3.0",
    description=(
        "Backend của hệ thống quản lý trung tâm.\n\n"
        "**Thử API trên trang này:** bấm **Authorize**, nhập username/password (tài khoản mẫu `admin`) rồi gọi các endpoint.\n\n"
        "Các danh sách nhận `skip` và `limit`; tổng số bản ghi nằm ở header `X-Total-Count`."
    ),
    openapi_tags=TAGS_METADATA,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Process-Time-ms"],
)

register_exception_handlers(app)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Đo thời gian mỗi request, cảnh báo endpoint chậm (Buổi 7). Chỉ ghi đường dẫn, không ghi query/body."""
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed = (time.perf_counter() - start) * 1000
        request_logger.exception("%s %s -> lỗi (%.1f ms)", request.method, request.url.path, elapsed)
        raise
    elapsed = (time.perf_counter() - start) * 1000
    slow = elapsed >= settings.slow_request_ms
    request_logger.log(
        logging.WARNING if slow else logging.INFO,
        "%s %s -> %d (%.1f ms)%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
        " CHẬM" if slow else "",
    )
    response.headers["X-Process-Time-ms"] = f"{elapsed:.1f}"
    return response


COMMON_RESPONSES = {
    401: {"description": "Chưa đăng nhập hoặc phiên đã hết hạn."},
    403: {"description": "Không đủ quyền thực hiện thao tác này."},
}
for module in (auth, users, classes, attendance, scores, tuition, reports, coach):
    app.include_router(module.router, responses=COMMON_RESPONSES)


@app.get("/health", tags=["system"])
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}
