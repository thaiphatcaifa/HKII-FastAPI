from sqlalchemy import func, select
from sqlalchemy.orm import Session


def paginate(db: Session, query, skip: int, limit: int):
    """Trả về (danh sách của trang hiện tại, tổng số bản ghi khớp truy vấn)."""
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    items = db.scalars(query.offset(skip).limit(limit)).all()
    return items, total
