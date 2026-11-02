"""Ngoại lệ tùy chỉnh (Buổi 7).

Mọi lỗi nghiệp vụ đều là một AppError và được `error_handlers.py` đổi thành JSON
dạng {"detail": "..."} (giống HTTPException) nên giao diện không phải đổi gì.
"""


class AppError(Exception):
    status_code = 400
    default_detail = "Yêu cầu không hợp lệ."
    default_headers: dict[str, str] | None = None

    def __init__(self, detail: str | None = None, headers: dict[str, str] | None = None):
        self.detail = detail or self.default_detail
        self.headers = headers if headers is not None else self.default_headers
        super().__init__(self.detail)


class BadRequestError(AppError):
    status_code = 400


class UnauthorizedError(AppError):
    status_code = 401
    default_detail = "Chưa đăng nhập hoặc phiên đã hết hạn."
    default_headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(AppError):
    status_code = 403
    default_detail = "Không đủ quyền thực hiện thao tác này."


class NotFoundError(AppError):
    status_code = 404
    default_detail = "Không tìm thấy dữ liệu."


class ConflictError(AppError):
    status_code = 409
    default_detail = "Dữ liệu bị trùng."


class LockedError(AppError):
    status_code = 423
    default_detail = "Tài khoản đang bị khóa tạm thời."


class TooManyRequestsError(AppError):
    status_code = 429
    default_detail = "Bạn thao tác quá nhiều lần, vui lòng thử lại sau."


class PayloadTooLargeError(AppError):
    status_code = 413
    default_detail = "Dữ liệu gửi lên quá lớn."
