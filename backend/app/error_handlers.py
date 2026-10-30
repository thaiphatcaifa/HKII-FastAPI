"""Đăng ký các exception handler. Dạng trả về luôn là {"detail": ...}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.errors import AppError

logger = logging.getLogger("hkii.errors")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        level = logging.ERROR if exc.status_code >= 500 else logging.INFO
        logger.log(level, "%s %s -> %d: %s", request.method, request.url.path, exc.status_code, exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException):
        logger.info("%s %s -> %d: %s", request.method, request.url.path, exc.status_code, exc.detail)
        return await http_exception_handler(request, exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        # Chỉ ghi vị trí lỗi, không ghi giá trị người dùng nhập (có thể là mật khẩu)
        fields = [".".join(str(p) for p in err["loc"]) for err in exc.errors()]
        logger.info("%s %s -> 422: dữ liệu sai ở %s", request.method, request.url.path, fields)
        return await request_validation_exception_handler(request, exc)

    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(request: Request, exc: IntegrityError):
        logger.warning("%s %s -> 409: vi phạm ràng buộc CSDL (%s)", request.method, request.url.path, type(exc.orig).__name__)
        return JSONResponse(status_code=409, content={"detail": "Dữ liệu bị trùng hoặc vi phạm ràng buộc."})

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        logger.exception("%s %s -> 500: lỗi không mong đợi", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Lỗi máy chủ. Vui lòng thử lại sau."})
