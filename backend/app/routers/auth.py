import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.errors import BadRequestError, LockedError, UnauthorizedError
from app.models import User, as_utc, utcnow
from app.schemas import ChangePasswordIn, LoginIn, OAuth2Token, TokenOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("hkii.auth")


def authenticate(db: Session, username: str, password: str) -> User:
    """Kiểm tra tên đăng nhập + mật khẩu, có khóa tạm khi sai nhiều lần. Dùng chung cho /login và /token."""
    user = crud.users.get_by_username(db, username.strip())

    if user and user.locked_until and as_utc(user.locked_until) > utcnow():
        logger.warning("Từ chối đăng nhập: tài khoản %s đang bị khóa tạm", user.username)
        raise LockedError("Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.")

    ok = bool(user and user.is_active and verify_password(password, user.password_hash))
    if not ok:
        if user:
            locked = crud.users.record_failed_login(db, user, settings.max_failed_logins, settings.lock_minutes)
            if locked:
                logger.warning("Khóa tài khoản %s %d phút sau nhiều lần đăng nhập sai", user.username, settings.lock_minutes)
            else:
                logger.info("Đăng nhập sai mật khẩu: tài khoản %s", user.username)
        # Không ghi tên đăng nhập người dùng gõ khi tài khoản không tồn tại (có thể gõ nhầm mật khẩu vào ô tên)
        # Thông báo gộp chung để không lộ việc tài khoản có tồn tại hay không
        raise UnauthorizedError("Sai tên đăng nhập hoặc mật khẩu.")

    crud.users.reset_login_state(db, user)
    logger.info("Đăng nhập thành công: %s (%s)", user.username, user.role.value)
    return user


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Đăng nhập bằng JSON (giao diện web dùng endpoint này)."""
    user = authenticate(db, data.username, data.password)
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/token", response_model=OAuth2Token)
def login_for_swagger(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    """Đăng nhập chuẩn OAuth2 (form: username, password). Nút **Authorize** trên /docs gọi endpoint này."""
    user = authenticate(db, form.username, form.password)
    return OAuth2Token(access_token=create_access_token(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/change-password", status_code=204)
def change_password(
    data: ChangePasswordIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.old_password, user.password_hash):
        raise BadRequestError("Mật khẩu hiện tại không đúng.")
    crud.users.set_password(db, user, hash_password(data.new_password))
    logger.info("Đổi mật khẩu: %s", user.username)
