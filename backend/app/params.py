"""Kiểm tra hợp lệ path parameter (Buổi 2): mã định danh phải là số nguyên dương."""
from typing import Annotated

from fastapi import Path

IdPath = Annotated[int, Path(ge=1, description="Mã định danh (số nguyên dương)")]
