import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal
from app.error_handlers import register_exception_handlers
from app.logging_config import setup_logging
from app.routers import attendance, auth, classes, coach, reports, scores, tuition, users

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
    yield
    logger.info("Tắt HKII API")


app = FastAPI(
    title="HKII - Hệ thống quản lý trung tâm (FastAPI + PostgreSQL)",
    version="0.2.0",
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


for module in (auth, users, classes, attendance, scores, tuition, reports, coach):
    app.include_router(module.router)


@app.get("/health", tags=["system"])
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}
