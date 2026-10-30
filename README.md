# HKII – FastAPI + PostgreSQL + Docker

Đồ án cuối kỳ: viết lại backend của hệ thống quản lý trung tâm (trước đây chạy trên Firebase Realtime
Database + Cloud Functions) bằng **FastAPI**, **PostgreSQL** và **Docker**. Phần AI và báo cáo viết bằng Python.

> Toàn bộ dữ liệu trong repo là **dữ liệu giả**. Không có khóa, credential hay dữ liệu thật của hệ thống cũ.

## Tài liệu

- [Hướng dẫn chạy dự án, kịch bản demo và câu hỏi bảo vệ](docs/HUONG-DAN-CHAY.md)
- Bài thuyết trình: `docs/HKII-ThuyetTrinh.pptx` (17 slide, có ghi chú lời nói ở từng slide)
- [Phân công công việc nhóm](docs/PHAN-CONG.md)

## 5 module

| # | Module | Endpoint chính |
|---|---|---|
| 1 | Đăng nhập và phân quyền (JWT, 4 vai trò) | `/auth/login`, `/auth/me`, `/users`, `/students` |
| 2 | Lớp học và học viên | `/classes`, `/classes/{id}/students` |
| 3 | Điểm danh và điểm số (+ báo cáo) | `/attendance/batch`, `/attendance/summary/{id}`, `/scores`, `/reports/class/{id}/summary`, `/reports/class/{id}/export.xlsx` |
| 4 | Học phí | `/tuition`, `/tuition/{id}/pay`, `/tuition/mark-overdue`, `/tuition/summary` |
| 5 | AI Coach | `/coach/feedback`, `/coach/history` |

Vai trò: `admin`, `teacher`, `student`, `parent`. Quyền được kiểm tra ở `backend/app/deps.py`
(thay cho `database.rules.json` của Firebase).

## Chạy bằng Docker

```bash
cp .env.example .env        # chỉnh mật khẩu DB và SECRET_KEY
docker compose up --build
```

- **Giao diện web: http://localhost:8080** (React + nginx, gọi API qua `/api`)
- API: http://localhost:8000 · Tài liệu tương tác (Swagger): http://localhost:8000/docs
- PostgreSQL: `localhost:5433` (đổi bằng `DB_PORT`)
- Lần chạy đầu tự tạo bảng (Alembic) và dữ liệu mẫu (`SEED_ON_START=true`).

Tài khoản mẫu (mật khẩu `SEED_PASSWORD`, mặc định `Hkii@12345`; **đổi trước khi dùng thật**):

| Vai trò | Username |
|---|---|
| admin | `admin` |
| teacher | `gv.lan`, `gv.minh` |
| student | `hv01` … `hv08` |
| parent | `ph.an` (con: hv01), `ph.ha` (con: hv02) |

## Chạy test

> Lần đầu sau khi cập nhật (thêm `python-multipart` vào `requirements.txt`) cần build lại image: `docker compose build api`.

Test dùng SQLite riêng, không đụng PostgreSQL:

```bash
docker compose run --rm --no-deps api python -m pytest -q
```

## AI Coach

Không cần key vẫn chạy (bộ nhận xét theo luật, `provider = "rules"`). Muốn dùng Gemini thật,
đặt `GEMINI_API_KEY` trong `.env`; nếu gọi lỗi, hệ thống tự rơi về bộ nhận xét theo luật.

## Cấu trúc

```
docker-compose.yml
frontend/             # React 19 + Vite + Tailwind, gọi FastAPI (src/api.js)
  Dockerfile  nginx.conf
  src/pages/          # Login, Dashboard, Classes, ClassDetail, Attendance, Grades, Tuition, Users, Coach
backend/
  Dockerfile  requirements.txt  alembic.ini
  alembic/            # migration
  app/
    main.py config.py db.py models.py schemas.py security.py deps.py seed.py
    errors.py error_handlers.py logging_config.py pagination.py
    routers/          # ENDPOINTS: chỉ lo HTTP + phân quyền (auth users classes attendance scores tuition reports coach)
    crud/             # CRUD: toàn bộ truy vấn ORM/SQL (users classes attendance scores tuition coach)
    services/         # report.py (pandas), coach.py (AI)
  tests/              # test_api.py (luồng chính) + test_extra.py (phân trang, PUT, lỗi, logging)
docs/postman/         # Postman collection + environment để kiểm thử API
```

Bốn lớp theo tài liệu môn học: `models.py` (bảng) → `schemas.py` (dữ liệu vào/ra) → `crud/` (thao tác CSDL) → `routers/` (endpoint).

## Quy ước API

- **Phân trang:** các danh sách (`/users`, `/students`, `/classes`, `/attendance`, `/scores`, `/tuition`) nhận `?skip=0&limit=100`
  (`limit` tối đa 500). Tổng số bản ghi nằm ở header `X-Total-Count`. Giao diện dùng `api.getAll()` để tự lấy đủ các trang.
- **PUT và PATCH:** `PATCH /classes/{id}` sửa một phần; `PUT /classes/{id}` thay thế toàn bộ (trường tùy chọn không gửi sẽ về rỗng).
- **Lỗi:** luôn có dạng `{"detail": ...}`. Lỗi nghiệp vụ là các `AppError` trong `errors.py` (404, 409, 403...);
  lỗi không lường trước trả `500` chung chung, chi tiết chỉ nằm trong log.
- **Logging:** logger `hkii.*` ghi mỗi request kèm thời gian (cảnh báo nếu chậm hơn `SLOW_REQUEST_MS`, mặc định 500 ms),
  đăng nhập sai/khóa tài khoản, lỗi Gemini. Không ghi mật khẩu, token, khóa API hay nội dung bài viết. Chỉnh bằng `LOG_LEVEL`.
- **Đăng nhập trên Swagger:** mở http://localhost:8000/docs, bấm **Authorize**, nhập username/password. Nút này gọi `POST /auth/token` (chuẩn OAuth2, dạng form);
  giao diện web dùng `POST /auth/login` (JSON). Cả hai dùng chung một hàm kiểm tra và cùng cơ chế khóa tài khoản.
- **Việc chạy nền (`BackgroundTasks`):** sau khi trả kết quả `GET /tuition` và `GET /tuition/summary`, hệ thống tự đánh dấu quá hạn các khoản đã quá hạn
  (tối đa mỗi `OVERDUE_REFRESH_SECONDS` giây một lần, mặc định 3600; tắt bằng `AUTO_OVERDUE_ENABLED=false`). Cũng chạy một lần khi khởi động.
- **Nhập người dùng từ CSV (`UploadFile`):** `POST /users/import` (admin) nhận file `.csv` tối đa 1 MB, 100 dòng, cột `username, full_name, password, role`;
  không tạo được `admin` bằng CSV. `GET /users/import/template` tải file mẫu. Xóa file CSV sau khi nhập vì có mật khẩu dạng chữ thường.
- **Kiểm tra path parameter:** mọi mã trong đường dẫn (`/classes/{id}`...) phải là số nguyên dương, sai trả `422`.
- **Postman:** import `docs/postman/HKII.postman_collection.json` và `HKII.local.postman_environment.json`,
  chạy "Đăng nhập admin" trước (tự lưu token), rồi chạy cả collection bằng Collection Runner.

## Giao diện

Giao diện được viết mới, gọn, chỉ phục vụ 5 module trên. Màn hình theo vai trò:

| Vai trò | Màn hình |
|---|---|
| admin | Tổng quan, Lớp học (tạo lớp, ghi danh), Người dùng, Học phí, AI Coach |
| teacher | Lớp của mình: Học viên / Điểm danh / Điểm số / Báo cáo (xuất Excel), AI Coach |
| student | Tổng quan, Chuyên cần, Điểm số, Học phí, AI Coach |
| parent | Như học viên, chọn từng con |

Chạy riêng giao diện để phát triển (cần API ở cổng 8000):

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Hướng dẫn tiếp theo

- Mở rộng module: chat, thông báo, game, Bonus nếu đề bài yêu cầu.
- Bổ sung test giao diện (Vitest/Playwright) và CI chạy `pytest` + `npm run build`.
