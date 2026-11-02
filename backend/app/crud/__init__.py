"""Tầng CRUD: nơi duy nhất chứa truy vấn SQL/ORM (Buổi 4–5).

Router chỉ lo HTTP + phân quyền, gọi các hàm ở đây để đọc/ghi CSDL.
Các hàm ở đây không ném HTTPException; router quyết định trả lỗi gì.
"""
from app.crud import ai_notes, attendance, classes, coach, scores, tuition, users  # noqa: F401
