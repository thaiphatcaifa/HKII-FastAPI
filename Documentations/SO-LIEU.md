# SỐ LIỆU GỐC CỦA ĐỒ ÁN EduCenter (HKII, Nhóm 3)

Sinh tự động bằng `scripts/so_lieu.py` lúc 17/11/2026 08:31 từ chính mã nguồn. Không sửa tay: muốn đổi số thì sửa code rồi chạy lại script.
Mọi con số trong README, docs, Documentation, Installation Guide, User Guide và slide phải khớp file này (kiểm bằng `scripts/kiem_tra_so_lieu.py`).

## 1. Tóm tắt

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| Repo | https://github.com/thaiphatcaifa/HKII-FastAPI | |
| Số API (thao tác HTTP) | **52** | `/openapi.json`, không tính /docs, /redoc, /openapi.json |
| Số đường dẫn API | **38** | như trên |
| Số bảng CSDL | **9** | metadata của `backend/app/models.py` |
| Tổng số cột | **67** | như trên |
| Số migration Alembic | **3** | `backend/alembic/versions/` |
| Số test | **120** đạt / 120 test, 0 lỗi | `pytest`, chạy ngày 2026-11-17 |
| Độ phủ test | **98.13%** (làm tròn 98%), 2027 lệnh, thiếu 38 | `pytest-cov` |
| Số file test | **8** | `backend/tests/` |
| Số route giao diện | **11** | `frontend/src/App.jsx` |
| Số trang (pages) | **11** | `frontend/src/pages/` |
| Số thành phần (components) | **10** | `frontend/src/components/` |
| Số ảnh màn hình | **23** | `docs/images/` |

## 2. API theo nhóm (tag)

| Nhóm | Số API |
|---|---|
| classes | 9 |
| users | 9 |
| ai | 8 |
| tuition | 7 |
| scores | 5 |
| auth | 4 |
| attendance | 3 |
| coach | 3 |
| reports | 3 |
| system | 1 |
| **Tổng** | **52** |

Danh sách đầy đủ:

| # | Nhóm | Phương thức | Đường dẫn |
|---|---|---|---|
| 1 | ai | GET | `/ai/reviews` |
| 2 | ai | POST | `/ai/reviews` |
| 3 | ai | PATCH | `/ai/reviews/{note_id}` |
| 4 | ai | DELETE | `/ai/reviews/{note_id}` |
| 5 | ai | POST | `/ai/reviews/{note_id}/publish` |
| 6 | ai | POST | `/ai/reviews/{note_id}/unpublish` |
| 7 | ai | GET | `/ai/risk` |
| 8 | ai | POST | `/ai/risk/advice` |
| 9 | attendance | GET | `/attendance` |
| 10 | attendance | POST | `/attendance/batch` |
| 11 | attendance | GET | `/attendance/summary/{student_id}` |
| 12 | auth | POST | `/auth/change-password` |
| 13 | auth | POST | `/auth/login` |
| 14 | auth | GET | `/auth/me` |
| 15 | auth | POST | `/auth/token` |
| 16 | classes | GET | `/classes` |
| 17 | classes | POST | `/classes` |
| 18 | classes | GET | `/classes/{class_id}` |
| 19 | classes | PUT | `/classes/{class_id}` |
| 20 | classes | PATCH | `/classes/{class_id}` |
| 21 | classes | DELETE | `/classes/{class_id}` |
| 22 | classes | GET | `/classes/{class_id}/students` |
| 23 | classes | POST | `/classes/{class_id}/students` |
| 24 | classes | DELETE | `/classes/{class_id}/students/{student_id}` |
| 25 | coach | POST | `/coach/feedback` |
| 26 | coach | GET | `/coach/history` |
| 27 | coach | GET | `/coach/progress` |
| 28 | reports | GET | `/reports/class/{class_id}/export.xlsx` |
| 29 | reports | GET | `/reports/class/{class_id}/summary` |
| 30 | reports | GET | `/reports/tuition/export.xlsx` |
| 31 | scores | GET | `/scores` |
| 32 | scores | POST | `/scores` |
| 33 | scores | GET | `/scores/student/{student_id}/summary` |
| 34 | scores | PATCH | `/scores/{score_id}` |
| 35 | scores | DELETE | `/scores/{score_id}` |
| 36 | system | GET | `/health` |
| 37 | tuition | GET | `/tuition` |
| 38 | tuition | POST | `/tuition` |
| 39 | tuition | POST | `/tuition/mark-overdue` |
| 40 | tuition | GET | `/tuition/summary` |
| 41 | tuition | PATCH | `/tuition/{record_id}` |
| 42 | tuition | DELETE | `/tuition/{record_id}` |
| 43 | tuition | POST | `/tuition/{record_id}/pay` |
| 44 | users | GET | `/students` |
| 45 | users | GET | `/users` |
| 46 | users | POST | `/users` |
| 47 | users | POST | `/users/import` |
| 48 | users | GET | `/users/import/template` |
| 49 | users | GET | `/users/{parent_id}/children` |
| 50 | users | POST | `/users/{parent_id}/children` |
| 51 | users | GET | `/users/{user_id}` |
| 52 | users | PATCH | `/users/{user_id}` |

## 3. CSDL

| Bảng | Số cột |
|---|---|
| `users` | 9 |
| `parent_students` | 2 |
| `classes` | 6 |
| `enrollments` | 4 |
| `attendance` | 8 |
| `scores` | 9 |
| `tuition_records` | 9 |
| `coach_sessions` | 9 |
| `ai_notes` | 11 |
| **9 bảng** | **67 cột** |

### `users`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `username` | VARCHAR(64) |  | không |  |
| `full_name` | VARCHAR(120) |  | không |  |
| `password_hash` | VARCHAR(255) |  | không |  |
| `role` | VARCHAR(16) |  | không |  |
| `is_active` | BOOLEAN |  | không |  |
| `failed_attempts` | INTEGER |  | không |  |
| `locked_until` | DATETIME |  | có |  |
| `created_at` | DATETIME |  | không |  |

### `parent_students`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `parent_id` | INTEGER | có | không | users.id |
| `student_id` | INTEGER | có | không | users.id |

### `classes`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `code` | VARCHAR(32) |  | không |  |
| `name` | VARCHAR(120) |  | không |  |
| `schedule` | VARCHAR(200) |  | có |  |
| `teacher_id` | INTEGER |  | có | users.id |
| `created_at` | DATETIME |  | không |  |

### `enrollments`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `class_id` | INTEGER |  | không | classes.id |
| `student_id` | INTEGER |  | không | users.id |
| `enrolled_at` | DATETIME |  | không |  |

### `attendance`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `class_id` | INTEGER |  | không | classes.id |
| `student_id` | INTEGER |  | không | users.id |
| `date` | DATE |  | không |  |
| `status` | VARCHAR(16) |  | không |  |
| `note` | VARCHAR(300) |  | có |  |
| `recorded_by` | INTEGER |  | có | users.id |
| `recorded_at` | DATETIME |  | không |  |

### `scores`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `class_id` | INTEGER |  | không | classes.id |
| `student_id` | INTEGER |  | không | users.id |
| `kind` | VARCHAR(40) |  | không |  |
| `value` | NUMERIC(5, 2) |  | không |  |
| `max_value` | NUMERIC(5, 2) |  | không |  |
| `note` | VARCHAR(300) |  | có |  |
| `recorded_by` | INTEGER |  | có | users.id |
| `recorded_at` | DATETIME |  | không |  |

### `tuition_records`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `student_id` | INTEGER |  | không | users.id |
| `class_id` | INTEGER |  | có | classes.id |
| `amount` | NUMERIC(12, 2) |  | không |  |
| `due_date` | DATE |  | không |  |
| `status` | VARCHAR(16) |  | không |  |
| `paid_at` | DATETIME |  | có |  |
| `note` | VARCHAR(300) |  | có |  |
| `created_at` | DATETIME |  | không |  |

### `coach_sessions`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `user_id` | INTEGER |  | không | users.id |
| `kind` | VARCHAR(16) |  | không |  |
| `input_text` | TEXT |  | không |  |
| `feedback` | TEXT |  | không |  |
| `provider` | VARCHAR(32) |  | không |  |
| `analysis` | JSON |  | có |  |
| `overall` | FLOAT |  | có |  |
| `created_at` | DATETIME |  | không |  |

### `ai_notes`

| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |
|---|---|---|---|---|
| `id` | INTEGER | có | không |  |
| `kind` | VARCHAR(16) |  | không |  |
| `class_id` | INTEGER |  | không | classes.id |
| `student_id` | INTEGER |  | không | users.id |
| `author_id` | INTEGER |  | có | users.id |
| `content` | TEXT |  | không |  |
| `provider` | VARCHAR(32) |  | không |  |
| `status` | VARCHAR(16) |  | không |  |
| `created_at` | DATETIME |  | không |  |
| `updated_at` | DATETIME |  | không |  |
| `published_at` | DATETIME |  | có |  |

Migration (3): `0001_initial_schema.py`, `0002_ai_notes.py`, `0003_coach_analysis.py`

## 4. Test

Lần chạy: `120 passed, 1 warning in 153.38s (0:02:33)` (ngày 2026-11-17).

| File test | Số test |
|---|---|
| `test_ai.py` | 17 |
| `test_api.py` | 24 |
| `test_classes_delete.py` | 5 |
| `test_coach.py` | 17 |
| `test_config.py` | 13 |
| `test_coverage.py` | 19 |
| `test_extra.py` | 19 |
| `test_tuition_edit.py` | 6 |
| **Tổng** | **120** |

Độ phủ từng file (`backend/app/`):

| File | Độ phủ |
|---|---|
| `__init__.py` | 100.0% |
| `config.py` | 100.0% |
| `crud/__init__.py` | 100.0% |
| `crud/ai_notes.py` | 97.7% |
| `crud/attendance.py` | 95.7% |
| `crud/classes.py` | 100.0% |
| `crud/coach.py` | 100.0% |
| `crud/common.py` | 100.0% |
| `crud/scores.py` | 100.0% |
| `crud/tuition.py` | 96.2% |
| `crud/users.py` | 100.0% |
| `db.py` | 100.0% |
| `deps.py` | 100.0% |
| `error_handlers.py` | 93.8% |
| `errors.py` | 100.0% |
| `logging_config.py` | 100.0% |
| `main.py` | 90.9% |
| `models.py` | 100.0% |
| `pagination.py` | 100.0% |
| `params.py` | 100.0% |
| `routers/__init__.py` | 100.0% |
| `routers/ai.py` | 100.0% |
| `routers/attendance.py` | 100.0% |
| `routers/auth.py` | 100.0% |
| `routers/classes.py` | 98.0% |
| `routers/coach.py` | 100.0% |
| `routers/reports.py` | 100.0% |
| `routers/scores.py` | 100.0% |
| `routers/tuition.py` | 100.0% |
| `routers/users.py` | 100.0% |
| `schemas.py` | 100.0% |
| `security.py` | 89.5% |
| `seed.py` | 95.2% |
| `services/__init__.py` | 100.0% |
| `services/coach.py` | 93.9% |
| `services/gemini.py` | 85.1% |
| `services/insights.py` | 100.0% |
| `services/insights_ai.py` | 100.0% |
| `services/report.py` | 95.7% |
| `services/stats.py` | 100.0% |
| `services/tuition_jobs.py` | 90.0% |
| **Tổng** | **98.13%** |

## 5. Giao diện

| Đường dẫn | Vai trò được vào | Trang |
|---|---|---|
| `/login` | công khai (chưa đăng nhập) | Login |
| `/` | mọi vai trò đã đăng nhập | Dashboard |
| `/account` | mọi vai trò đã đăng nhập | Account |
| `/classes` | admin, teacher | Classes |
| `/classes/:id` | admin, teacher | ClassDetail |
| `/users` | admin | Users |
| `/attendance` | student, parent | Attendance |
| `/grades` | student, parent | Grades |
| `/tuition` | admin, student, parent | Tuition |
| `/coach` | admin, teacher, student | Coach |
| `* (mọi đường dẫn khác, trang 404)` | mọi vai trò đã đăng nhập | NotFound |

Trang (11): Account, Attendance, ClassDetail, Classes, Coach, Dashboard, Grades, Login, NotFound, Tuition, Users

Thành phần (10): AiTabs, ErrorBoundary, Hero, Layout, StudentPicker, Tabs, ThemePicker, charts, feedback, ui

Ảnh màn hình (23): 01-login.png, 02-admin-dashboard.png, 03-admin-classes.png, 04-teacher-attendance.png, 05-teacher-report.png, 06-admin-tuition.png, 07-parent-attendance.png, 08-student-grades.png, 09-coach.png, 10-swagger.png, 11-admin-users.png, 12-student-dashboard.png, 13-teacher-risk.png, 14-teacher-reviews.png, 15-account.png, 16-parent-review.png, 17-not-found.png, 18-theme-picker.png, 19-confirm-delete-class.png, 20-toast-error.png, 21-admin-class-detail.png, 22-admin-tuition-edit.png, 23-confirm-delete-tuition.png

## 6. Phiên bản thư viện

Python (`backend/requirements.txt`):

| Thư viện | Phiên bản |
|---|---|
| fastapi | 0.115.6 |
| uvicorn[standard] | 0.34.0 |
| sqlalchemy | 2.0.36 |
| psycopg[binary] | 3.2.3 |
| alembic | 1.14.0 |
| pydantic | 2.10.3 |
| pydantic-settings | 2.7.0 |
| PyJWT | 2.10.1 |
| bcrypt | 4.2.1 |
| pandas | 2.2.3 |
| openpyxl | 3.1.5 |
| httpx | 0.28.1 |
| pytest | 8.3.4 |
| pytest-cov | 6.0.0 |
| python-multipart | 0.0.20 |

JavaScript (`frontend/package.json`, bản cài thật theo `package-lock.json`):

| Thư viện | Khai báo | Cài thật | Loại |
|---|---|---|---|
| @fontsource-variable/inter | ^5.3.0 | 5.3.0 | dependencies |
| @fontsource-variable/plus-jakarta-sans | ^5.3.0 | 5.3.0 | dependencies |
| lucide-react | ^1.58.0 | 1.58.0 | dependencies |
| react | ^19.2.0 | 19.3.0 | dependencies |
| react-dom | ^19.2.0 | 19.3.0 | dependencies |
| react-router-dom | ^7.13.0 | 7.18.4 | dependencies |
| @vitejs/plugin-react | ^5.1.1 | 5.2.0 | devDependencies |
| autoprefixer | ^10.4.23 | 10.6.1 | devDependencies |
| postcss | ^8.5.6 | 8.5.30 | devDependencies |
| tailwindcss | ^3.4.17 | 3.4.19 | devDependencies |
| vite | ^7.2.4 | 7.3.7 | devDependencies |

## 7. Dữ liệu máy đọc (dùng cho script kiểm tra)

```json
{
 "repo_url": "https://github.com/thaiphatcaifa/HKII-FastAPI",
 "api": {
  "paths": 38,
  "operations": 52,
  "by_tag": {
   "classes": 9,
   "users": 9,
   "ai": 8,
   "tuition": 7,
   "scores": 5,
   "auth": 4,
   "attendance": 3,
   "coach": 3,
   "reports": 3,
   "system": 1
  }
 },
 "db": {
  "tables": 9,
  "columns_total": 67,
  "columns": {
   "users": 9,
   "parent_students": 2,
   "classes": 6,
   "enrollments": 4,
   "attendance": 8,
   "scores": 9,
   "tuition_records": 9,
   "coach_sessions": 9,
   "ai_notes": 11
  },
  "migrations": 3
 },
 "tests": {
  "collected": 120,
  "per_file": {
   "test_ai.py": 17,
   "test_api.py": 24,
   "test_classes_delete.py": 5,
   "test_coach.py": 17,
   "test_config.py": 13,
   "test_coverage.py": 19,
   "test_extra.py": 19,
   "test_tuition_edit.py": 6
  },
  "passed": 120,
  "failed": 0,
  "run_line": "120 passed, 1 warning in 153.38s (0:02:33)",
  "coverage_percent": 98.13,
  "coverage_rounded": 98,
  "statements": 2027,
  "missing": 38,
  "coverage_files": {
   "__init__.py": 100.0,
   "config.py": 100.0,
   "crud/__init__.py": 100.0,
   "crud/ai_notes.py": 97.7,
   "crud/attendance.py": 95.7,
   "crud/classes.py": 100.0,
   "crud/coach.py": 100.0,
   "crud/common.py": 100.0,
   "crud/scores.py": 100.0,
   "crud/tuition.py": 96.2,
   "crud/users.py": 100.0,
   "db.py": 100.0,
   "deps.py": 100.0,
   "error_handlers.py": 93.8,
   "errors.py": 100.0,
   "logging_config.py": 100.0,
   "main.py": 90.9,
   "models.py": 100.0,
   "pagination.py": 100.0,
   "params.py": 100.0,
   "routers/__init__.py": 100.0,
   "routers/ai.py": 100.0,
   "routers/attendance.py": 100.0,
   "routers/auth.py": 100.0,
   "routers/classes.py": 98.0,
   "routers/coach.py": 100.0,
   "routers/reports.py": 100.0,
   "routers/scores.py": 100.0,
   "routers/tuition.py": 100.0,
   "routers/users.py": 100.0,
   "schemas.py": 100.0,
   "security.py": 89.5,
   "seed.py": 95.2,
   "services/__init__.py": 100.0,
   "services/coach.py": 93.9,
   "services/gemini.py": 85.1,
   "services/insights.py": 100.0,
   "services/insights_ai.py": 100.0,
   "services/report.py": 95.7,
   "services/stats.py": 100.0,
   "services/tuition_jobs.py": 90.0
  },
  "run_date": "2026-11-17"
 },
 "frontend": {
  "route_count": 11,
  "page_count": 11,
  "component_count": 10,
  "screenshot_count": 23,
  "pages": [
   "Account",
   "Attendance",
   "ClassDetail",
   "Classes",
   "Coach",
   "Dashboard",
   "Grades",
   "Login",
   "NotFound",
   "Tuition",
   "Users"
  ],
  "components": [
   "AiTabs",
   "ErrorBoundary",
   "Hero",
   "Layout",
   "StudentPicker",
   "Tabs",
   "ThemePicker",
   "charts",
   "feedback",
   "ui"
  ],
  "screenshots": [
   "01-login.png",
   "02-admin-dashboard.png",
   "03-admin-classes.png",
   "04-teacher-attendance.png",
   "05-teacher-report.png",
   "06-admin-tuition.png",
   "07-parent-attendance.png",
   "08-student-grades.png",
   "09-coach.png",
   "10-swagger.png",
   "11-admin-users.png",
   "12-student-dashboard.png",
   "13-teacher-risk.png",
   "14-teacher-reviews.png",
   "15-account.png",
   "16-parent-review.png",
   "17-not-found.png",
   "18-theme-picker.png",
   "19-confirm-delete-class.png",
   "20-toast-error.png",
   "21-admin-class-detail.png",
   "22-admin-tuition-edit.png",
   "23-confirm-delete-tuition.png"
  ]
 },
 "python": {
  "fastapi": "0.115.6",
  "uvicorn[standard]": "0.34.0",
  "sqlalchemy": "2.0.36",
  "psycopg[binary]": "3.2.3",
  "alembic": "1.14.0",
  "pydantic": "2.10.3",
  "pydantic-settings": "2.7.0",
  "PyJWT": "2.10.1",
  "bcrypt": "4.2.1",
  "pandas": "2.2.3",
  "openpyxl": "3.1.5",
  "httpx": "0.28.1",
  "pytest": "8.3.4",
  "pytest-cov": "6.0.0",
  "python-multipart": "0.0.20"
 },
 "npm": {
  "@fontsource-variable/inter": "5.3.0",
  "@fontsource-variable/plus-jakarta-sans": "5.3.0",
  "lucide-react": "1.58.0",
  "react": "19.3.0",
  "react-dom": "19.3.0",
  "react-router-dom": "7.18.4",
  "@vitejs/plugin-react": "5.2.0",
  "autoprefixer": "10.6.1",
  "postcss": "8.5.30",
  "tailwindcss": "3.4.19",
  "vite": "7.3.7"
 }
}
```
