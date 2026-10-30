"""Phân trang bằng skip/limit (Buổi 5). Tổng số bản ghi trả qua header X-Total-Count."""
from dataclasses import dataclass

from fastapi import Query, Response

DEFAULT_LIMIT = 100
MAX_LIMIT = 500


@dataclass
class Page:
    skip: int
    limit: int


def page_params(
    skip: int = Query(default=0, ge=0, description="Bỏ qua bao nhiêu bản ghi đầu"),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT, description="Số bản ghi tối đa"),
) -> Page:
    return Page(skip=skip, limit=limit)


def set_total(response: Response, total: int) -> None:
    response.headers["X-Total-Count"] = str(total)
