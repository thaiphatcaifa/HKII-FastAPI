# EduCenter Management System (HKII) – FastAPI + PostgreSQL + Docker

Đồ án cuối kỳ: viết lại backend của hệ thống quản lý trung tâm (trước đây chạy trên Firebase Realtime
Database + Cloud Functions) bằng **FastAPI**, **PostgreSQL** và **Docker**. Phần AI và báo cáo viết bằng Python.

> Toàn bộ dữ liệu trong repo là **dữ liệu giả**. Không có khóa, credential hay dữ liệu thật của hệ thống cũ.

## Tài liệu

- [Hướng dẫn chạy dự án, kịch bản demo và câu hỏi bảo vệ](docs/HUONG-DAN-CHAY.md)
- Bài thuyết trình: `docs/HKII-ThuyetTrinh.pptx` (18 slide, có ghi chú lời nói ở từng slide)
- [Tài liệu thiết kế eProject (Review 1, 2, 3, kiểm thử, Task Sheet)](Documentations/README.md)
- [Phân công công việc nhóm](docs/PHAN-CONG.md)

## 5 module

| # | Module | Endpoint chính |
|---|---|---|
| 1 | Đăng nhập và phân quyền (JWT, 4 vai trò) | `/auth/login`, `/auth/me`, `/users`, `/students` |
| 2 | Lớp học và học viên | `/classes`, `/classes/{id}` (xem, sửa, xóa lớp trống), `/classes/{id}/students` |
| 3 | Điểm danh và điểm số (+ báo cáo) | `/attendance/batch`, `/attendance/summary/{id}`, `/scores`, `/reports/class/{id}/summary`, `/reports/class/{id}/export.xlsx` |
| 4 | Học phí | `/tuition`, `/tuition/{id}` (sửa, xóa khoản chưa đóng), `/tuition/{id}/pay`, `/tuition/mark-overdue`, `/tuition/summary` |
| 5 | AI Coach (chấm theo tiêu chí, sửa lỗi, theo dõi tiến bộ) | `/coach/feedback`, `/coach/history`, `/coach/progress` |
| + | AI hỗ trợ giáo viên (cảnh báo rủi ro + nhận xét học viên) | `/ai/risk`, `/ai/risk/advice`, `/ai/reviews`, `/ai/reviews/{id}/publish` |

Tổng cộng **52 API** trên 38 đường dẫn (đếm từ OpenAPI `/openapi.json`): users 9, classes 9, ai 8, tuition 7, scores 5, auth 4, attendance 3, coach 3, reports 3, system 1.

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
- Lần chạy đầu tự tạo bảng (Alembic) và dữ liệu mẫu (`SEED_ON_START=true`): đủ 3 mức cảnh báo rủi ro, đủ 3 trạng thái học phí, một nhận xét AI đã công bố của `hv01` để `ph.an` thấy ngay.
- `api` có healthcheck gọi `/health`; `web` chỉ khởi động khi `api` đã sẵn sàng, nên không còn lỗi 502 lúc mới bật.
- Chạy trên Kubernetes (minikube): manifest trong `k8s/`, các bước ở [docs/HUONG-DAN-CHAY.md](docs/HUONG-DAN-CHAY.md) mục 1.11.
- `APP_ENV` (`dev` | `prod`, mặc định `dev`): khi `prod` mà `SECRET_KEY` hoặc `SEED_PASSWORD` còn giá trị mặc định thì API dừng khởi động; khi `dev` chỉ ghi cảnh báo vào log.

Tài khoản mẫu (mật khẩu `SEED_PASSWORD`, mặc định `Hkii@12345`; **đổi trước khi dùng thật**):

| Vai trò | Username |
|---|---|
| admin | `admin` |
| teacher | `gv.lan`, `gv.minh` |
| student | `hv01` … `hv08` |
| parent | `ph.an` (con: hv01), `ph.ha` (con: hv02) |

## Chạy test

Có **120 test**, độ phủ **98%** (`pytest-cov`). Code nằm trong image nên sau khi sửa code hoặc test phải build lại: `docker compose build api`.

Mặc định test dùng SQLite riêng, không đụng PostgreSQL:

```bash
docker compose run --rm --no-deps api python -m pytest -q

# kèm báo cáo độ phủ từng file
docker compose run --rm --no-deps api python -m pytest -q --cov=app --cov-report=term-missing
```

Chạy trên PostgreSQL thật, bằng CSDL riêng `hkii_test` (mỗi test xóa và tạo lại toàn bộ bảng; `conftest.py` từ chối CSDL không có chữ `test` trong tên hoặc trùng `DATABASE_URL`):

```bash
docker compose up -d db
docker compose exec db createdb -U hkii hkii_test
docker compose run --rm --no-deps -e TEST_DATABASE_URL=postgresql+psycopg://hkii:hkii_dev@db:5432/hkii_test api python -m pytest -q
```

Lệnh trên dùng mật khẩu mặc định khi **không có** file `.env`. Nếu đã chép `.env.example` thành `.env` thì thay `hkii_dev` bằng giá trị `POSTGRES_PASSWORD` trong `.env` (file mẫu là `doi_mat_khau_nay`), và đổi cả `POSTGRES_USER` nếu đã sửa.

**CI:** `.github/workflows/ci.yml` chạy mỗi lần push và pull request: pytest trên SQLite, pytest trên PostgreSQL (service container), cả hai đều đo độ phủ và báo lỗi nếu dưới 90% (`--cov-fail-under=90`), `npm ci` và `npm run build`.

## AI Coach

Học viên nộp bài viết hoặc bài nói (dạng văn bản) và nhận kết quả **có cấu trúc** (`POST /coach/feedback`):
điểm 0-10 cho từng tiêu chí (ngữ pháp, từ vựng, mạch lạc, triển khai ý), điểm tổng, danh sách lỗi kèm câu sửa và 2 gợi ý.
Điểm tổng của các lượt được lưu để vẽ **biểu đồ tiến bộ** (`GET /coach/progress`, trang AI Coach).

- **Có `GEMINI_API_KEY`:** Gemini trả JSON (`responseMimeType: application/json`), backend kiểm tra lại bằng Pydantic (`CoachAnalysis`),
  ép điểm về 0-10, bỏ tiêu chí lạ và **loại các lỗi "bịa"** (đoạn trích không có trong bài). Lời nhắc dặn bỏ qua mệnh lệnh nằm trong bài.
- **Không có key, Gemini lỗi hoặc trả sai định dạng:** dùng bộ chấm theo luật (`provider = "rules"`). Bộ luật chỉ **ước lượng** 3 tiêu chí đo được
  (từ vựng, mạch lạc, triển khai ý), **không chấm ngữ pháp**, và chỉ bắt vài lỗi chắc chắn: viết thường `i`, `a`/`an`, từ lặp liền nhau, chữ đầu câu.
  Điểm theo luật được đánh dấu riêng trên biểu đồ vì không so sánh trực tiếp với điểm của Gemini.
- Mỗi người tối đa `coach_daily_limit` (20) lượt/ngày. Bài viết của học viên được gửi tới Google khi bật Gemini nên giao diện nhắc không dán thông tin cá nhân.

## AI hỗ trợ giáo viên

Hai tính năng nằm trong màn hình lớp học của giáo viên (tab **Cảnh báo** và **Nhận xét AI**), dùng chung lớp gọi Gemini `services/gemini.py`.
Nguyên tắc: **AI chỉ đề xuất, giáo viên quyết định**; không có key hoặc Gemini lỗi thì tự dùng bộ soạn theo luật nên vẫn chạy được.

- **Cảnh báo học viên có nguy cơ tụt lại** (`GET /ai/risk?class_id=`): mức rủi ro (cao / trung bình / thấp) tính bằng **luật minh bạch** từ chuyên cần và điểm số
  (`services/insights.py`: chuyên cần thấp, vắng liên tiếp, hay đi trễ, điểm trung bình thấp, điểm giảm mạnh). Mỗi học viên kèm lý do cụ thể.
  Bấm **Gợi ý hành động** (`POST /ai/risk/advice`) để AI đề xuất 3 việc nên làm. Không dùng dữ liệu học phí.
- **Nhận xét học viên** (`/ai/reviews`): AI soạn **bản nháp** → giáo viên sửa (`PATCH`) → **Công bố** (`POST .../publish`) → học viên và phụ huynh mới thấy
  ở trang Tổng quan. Có thể **Thu hồi** về nháp hoặc xóa. Học viên/phụ huynh chỉ đọc được bản đã công bố của chính mình.
- **Riêng tư:** lời nhắc gửi cho Gemini chỉ chứa **con số** (tỷ lệ chuyên cần, điểm), không có tên học viên hay ghi chú tự do.
- **Giới hạn:** mỗi giáo viên tối đa `AI_DAILY_LIMIT` lượt/ngày (mặc định 30, tính chung nhận xét và gợi ý, theo giờ UTC), quá mức trả `429`.

## Cấu trúc

```
docker-compose.yml    # db, api (healthcheck /health), web (chờ api healthy)
k8s/                  # Kubernetes: ConfigMap, Secret mẫu, PVC + Deployment + Service cho db, api, web
.github/workflows/    # ci.yml: test SQLite, test PostgreSQL (kèm độ phủ >= 90%), build frontend
frontend/             # React 19 + Vite + Tailwind, gọi FastAPI (src/api.js)
  Dockerfile  nginx.conf
  src/pages/          # Login, Dashboard, Classes, ClassDetail, Attendance, Grades, Tuition, Users, Coach, Account, NotFound (404)
  src/components/     # ui.jsx, Layout, Hero, Tabs, charts, feedback (thông báo + hộp xác nhận), ThemePicker (3 bảng màu),
                      # ErrorBoundary, StudentPicker, AiTabs (tab Cảnh báo / Nhận xét AI, thẻ nhận xét cho phụ huynh)
backend/
  Dockerfile  requirements.txt  alembic.ini
  alembic/            # migration
  app/
    main.py config.py db.py models.py schemas.py security.py deps.py seed.py
    errors.py error_handlers.py logging_config.py pagination.py
    routers/          # ENDPOINTS: chỉ lo HTTP + phân quyền (auth users classes attendance scores tuition reports coach ai)
    crud/             # CRUD: toàn bộ truy vấn ORM/SQL (users classes attendance scores tuition coach ai_notes)
    services/         # report.py (pandas), gemini.py (gọi Gemini + dự phòng), coach.py (chấm bài), insights.py (luật rủi ro), insights_ai.py (AI soạn nháp)
  tests/              # test_api.py (luồng chính), test_extra.py (phân trang, PUT, lỗi, logging), test_ai.py (AI hỗ trợ giáo viên),
                      # test_coach.py (AI Coach), test_config.py (APP_ENV, bảo vệ CSDL chính), test_classes_delete.py (xóa lớp),
                      # test_tuition_edit.py (sửa, xóa học phí), test_coverage.py (nhánh lỗi, phân quyền, dữ liệu mẫu)
docs/postman/         # Postman collection + environment để kiểm thử API
```

Bốn lớp theo tài liệu môn học: `models.py` (bảng) → `schemas.py` (dữ liệu vào/ra) → `crud/` (thao tác CSDL) → `routers/` (endpoint).

## Quy ước API

- **Phân trang:** các danh sách (`/users`, `/students`, `/classes`, `/attendance`, `/scores`, `/tuition`) nhận `?skip=0&limit=100`
  (`limit` tối đa 500). Tổng số bản ghi nằm ở header `X-Total-Count`. Giao diện dùng `api.getAll()` để tự lấy đủ các trang.
- **PUT và PATCH:** `PATCH /classes/{id}` sửa một phần; `PUT /classes/{id}` thay thế toàn bộ (trường tùy chọn không gửi sẽ về rỗng).
- **Xóa an toàn:** `DELETE /classes/{id}` (admin) chỉ xóa lớp trống; lớp còn học viên, điểm danh, điểm số, học phí hoặc nhận xét AI trả `409` kèm số lượng từng loại.
  `PATCH /tuition/{id}` và `DELETE /tuition/{id}` (admin) chỉ áp dụng cho khoản chưa đóng; khoản đã đóng trả `409`. Sửa hạn đóng thì trạng thái tự tính lại.
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
- **Bất đồng bộ:** `POST /ai/risk/advice` là ví dụ `async def`: chờ Gemini bằng `httpx.AsyncClient`, còn truy vấn SQLAlchemy (đồng bộ) chạy qua `run_in_threadpool` và trả kết nối CSDL về pool trong lúc chờ.
  Các endpoint khác vẫn là `def`, FastAPI tự chạy trong threadpool nên cũng không chặn event loop.
- **Kiểm tra path parameter:** mọi mã trong đường dẫn (`/classes/{id}`...) phải là số nguyên dương, sai trả `422`.
- **Postman:** import `docs/postman/HKII.postman_collection.json` và `HKII.local.postman_environment.json`,
  chạy "Đăng nhập admin" trước (tự lưu token), rồi chạy cả collection bằng Collection Runner.

## Giao diện

Giao diện được viết mới, gọn, chỉ phục vụ 5 module trên: thông báo nổi, hộp xác nhận cho thao tác xóa, tab, trang 404, biểu đồ,
3 bảng màu chọn ở trang **Tài khoản** (Xanh ngọc mặc định, Xanh biển, Ấm áp). Màn hình theo vai trò (ai cũng có trang Tài khoản để đổi mật khẩu và bảng màu):

| Vai trò | Màn hình |
|---|---|
| admin | Tổng quan, Lớp học (tạo, sửa, xóa lớp trống, ghi danh), Người dùng, Học phí (tạo, sửa, xóa khoản chưa đóng, ghi nhận đã đóng), AI Coach |
| teacher | Lớp của mình: Học viên / Điểm danh / Điểm số / Báo cáo (xuất Excel) / Cảnh báo / Nhận xét AI, AI Coach |
| student | Tổng quan (kèm nhận xét giáo viên đã công bố), Chuyên cần, Điểm số, Học phí, AI Coach |
| parent | Tổng quan, Chuyên cần, Điểm số, Học phí, chọn từng con (không có AI Coach) |

Chạy riêng giao diện để phát triển (cần API ở cổng 8000):

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Hướng dẫn tiếp theo

- Mở rộng module: chat, thông báo, game, Bonus nếu đề bài yêu cầu.
- Bổ sung test giao diện tự động trong CI (Vitest/Playwright).
