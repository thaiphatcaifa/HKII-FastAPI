# Phân công công việc nhóm (2 thành viên)

> Bản nháp để hai bạn cùng chỉnh. Điền tên vào bảng đầu tiên, đổi lại các mục nếu hai bạn mạnh yếu khác nhau.
> Nguyên tắc chính: **mỗi người làm trọn một nhóm module** (API, giao diện, test) và **cả hai đều phải giải thích được toàn bộ hệ thống** khi bảo vệ.
>
> Cập nhật 01/11/2026 theo code ở nhánh `feature/crud-logging-pagination`: giao người phụ trách cho các file thêm sau bản đầu (xử lý lỗi, logging, phân trang, việc chạy nền học phí, nhập CSV, Postman), chia lại test theo đúng file đang có, cân lại việc còn lại.

## 1. Thành viên

| | Họ tên | Mã sinh viên | GitHub |
|---|---|---|---|
| **A** (học vụ và dữ liệu) | | | |
| **B** (tài chính, AI và vận hành) | | | |

## 2. Phân công theo module

| | **A: học vụ và dữ liệu** | **B: tài chính, AI và vận hành** |
|---|---|---|
| Module | 1. Đăng nhập, phân quyền<br>2. Lớp học<br>3. Điểm danh, điểm số, báo cáo | 4. Học phí<br>5. AI Coach<br>+ AI hỗ trợ giáo viên (cảnh báo rủi ro, nhận xét học viên) |
| Router và CRUD (`backend/app/`) | `routers/`: `auth`, `users` (kể cả nhập người dùng từ CSV), `classes`, `attendance`, `scores`, `reports`<br>`crud/`: `users`, `classes`, `attendance`, `scores` | `routers/`: `tuition`, `coach`, `ai`<br>`crud/`: `tuition`, `coach`, `ai_notes` |
| Dịch vụ (`services/`) | `report.py` (pandas, Excel), `stats.py` (công thức chuyên cần dùng chung) | `gemini.py`, `coach.py` (Gemini, bộ nhận xét theo luật), `insights.py` (luật rủi ro), `insights_ai.py` (AI soạn nháp), `tuition_jobs.py` (tự đánh dấu học phí quá hạn, chạy nền) |
| Khung ứng dụng (`backend/app/`) | `deps.py` (kiểm tra quyền theo vai trò), `security.py` (JWT, băm mật khẩu), `db.py` | `main.py`, `config.py`, `errors.py`, `error_handlers.py` (mã lỗi thống nhất), `logging_config.py`, `pagination.py`, `params.py` |
| Giao diện (`frontend/src/`) | `pages/`: `Login`, `Account`, `Dashboard`, `Classes`, `ClassDetail`, `Attendance`, `Grades`, `Users`<br>`auth.jsx` (trạng thái đăng nhập) | `pages/`: `Tuition`, `Coach` (điểm tiêu chí, lỗi kèm câu sửa, biểu đồ tiến bộ)<br>`components/AiTabs.jsx` (tab Cảnh báo, Nhận xét AI) |
| Hạ tầng | Thiết kế CSDL (`models.py`, 9 bảng), Alembic | `docker-compose.yml`, `Dockerfile`, `nginx.conf`, `.env.example`, CI |
| Test (`backend/tests/`) | Xem mục 2.2 | Xem mục 2.2 |
| Tài liệu | Sơ đồ ER, ma trận phân quyền | Hướng dẫn chạy, kịch bản demo, bộ Postman (`docs/postman/`) |

Giao diện của A nhiều hơn (khoảng 1.600 dòng so với 800 dòng của B); bù lại B giữ toàn bộ hạ tầng, CI và nhiều việc còn lại hơn ở mục 3.

### 2.1. File dùng chung

**Không ai sở hữu riêng.** Ai sửa thì báo người kia trước, sửa nhỏ và commit riêng:
- Backend: `models.py`, `schemas.py`, `seed.py`, `crud/common.py`, `crud/__init__.py`, `requirements.txt`
- Frontend: `api.js`, `App.jsx` (khai báo route), `main.jsx`, `index.css`, `components/ui.jsx`, `components/Layout.jsx` (thanh bên), `components/StudentPicker.jsx`, `package.json`

**Có người phụ trách nhưng phần của người kia gọi tới.** Đổi tên hàm, tham số hay cách dùng thì phải báo:

| File | Phụ trách | Người kia dùng ở đâu |
|---|---|---|
| `deps.py`, `security.py` | A | Mọi router của B để kiểm tra đăng nhập và quyền |
| `services/stats.py` | A | `services/insights.py` (B) dùng `attendance_rate` |
| `errors.py`, `pagination.py`, `params.py` | B | Mọi router của A (mã lỗi, phân trang, kiểm tra id) |
| `components/AiTabs.jsx` | B | Gắn trong `ClassDetail.jsx` và `Dashboard.jsx` (A) |

### 2.2. Test theo người

Test đang nằm lẫn trong 4 file. Mỗi người chịu trách nhiệm giữ cho các test dưới đây luôn đạt và giải thích được chúng. Lần chạy ngày 01/11/2026: **62 test đạt** (`docker compose run --rm --no-deps api python -m pytest -q`).

| File | A | B |
|---|---|---|
| `test_api.py` | đăng nhập sai, khóa tài khoản, thiếu token, phân quyền (học viên, phụ huynh, giáo viên, giáo viên không xem học phí), điểm danh, điểm số, báo cáo và Excel | `test_health`, `test_tuition_overdue_and_pay`, `test_coach_uses_rule_based_fallback`, `test_parent_cannot_use_coach` |
| `test_extra.py` | phân trang `/users`, `/students`, điểm danh; `PUT` lớp; token OAuth2 và Swagger; nhập người dùng từ CSV (3 test) | tham số phân trang sai, id âm, định dạng lỗi (detail, 422, 500), log request và log đăng nhập sai, nhóm tag OpenAPI, việc chạy nền đánh dấu quá hạn (2 test) |
| `test_coach.py` | | toàn bộ |
| `test_ai.py` | | toàn bộ |

**Test mới:** A thêm vào `test_api.py`; B thêm vào file của module mình (`test_coach.py`, `test_ai.py`, hoặc tạo `test_tuition.py`). Không thêm test mới vào `test_extra.py`.

## 3. Việc còn lại

### Thành viên A
- [x] Màn **đổi mật khẩu** trên giao diện (API `POST /auth/change-password` đã có) — `frontend/src/pages/Account.jsx`
- [x] Màn **liên kết phụ huynh với học viên** cho admin (API `POST /users/{id}/children` đã có) — mục "Quản lý" trong trang Người dùng
- [x] Chức năng **sửa điểm** trên giao diện (API `PATCH /scores/{id}` đã có; nút xóa điểm đã có sẵn) — tab Điểm số của lớp
- [ ] Thêm test cho **ghi danh vào lớp** (thêm, trùng, xóa khỏi lớp) và **quản lý người dùng** (tạo, trùng tên, sửa, admin tự khóa mình). Phân trang và nhập CSV đã có test
- [ ] Vẽ lại sơ đồ ER và ma trận phân quyền bằng lời của nhóm (không chép nguyên từ slide)
- [ ] Chạy test trên **PostgreSQL thật** (hiện `conftest.py` ép SQLite). Phải dùng CSDL riêng cho test; nếu chạy trong CI thì phối hợp với B
- [ ] Rà slide 1–10 cho khớp code mới: slide 3 "5 module" thêm AI hỗ trợ giáo viên; bảng quyền ở slide 7 thêm dòng cho AI hỗ trợ giáo viên (xem cảnh báo, duyệt và công bố nhận xét); cân nhắc nhắc tới nhập người dùng từ CSV

### Thành viên B
- [x] Test giới hạn **20 lượt AI Coach mỗi ngày** — `test_coach_daily_limit` trong `test_coach.py` (giới hạn của AI hỗ trợ giáo viên: `test_ai_daily_limit` trong `test_ai.py`)
- [ ] Thử tính năng **Cảnh báo** và **Nhận xét AI** trên giao diện với dữ liệu mẫu; ghi lại nếu luật rủi ro (ngưỡng trong `services/insights.py`) cần chỉnh cho hợp lý hơn
- [ ] Giải thích được vì sao rủi ro tính bằng **luật** còn AI chỉ **gợi ý và soạn nháp** (xem câu hỏi bảo vệ trong `HUONG-DAN-CHAY.md`)
- [ ] **GitHub Actions** chạy `pytest` và `npm run build` mỗi lần push
- [ ] Rà soát bảo mật cấu hình. Đã kiểm tra ngày 01/11/2026: `.env` không bị commit (git chỉ theo dõi `.env.example`). Còn lại: `SECRET_KEY` mặc định `dev-only-change-me` và mật khẩu mẫu `Hkii@12345` trong `backend/app/config.py`, cần ghi rõ phải đổi hoặc cảnh báo khi khởi động
- [ ] Cập nhật slide 11–17 cho khớp code mới: slide 12 AI Coach bản mới (chấm theo tiêu chí, lỗi kèm câu sửa, biểu đồ tiến bộ); thêm slide **AI hỗ trợ giáo viên**; slide 13 đếm lại số API ở `/docs`; slide 15 sửa "15/15" thành số test hiện tại
- [ ] (Tùy chọn) Bật Gemini thật bằng `GEMINI_API_KEY` và thử một lượt AI Coach: nhãn phải là **Gemini** và có đủ 4 tiêu chí kể cả Ngữ pháp. Nếu luôn rơi về "Ước lượng theo luật", xem log `hkii.coach` (chỉ ghi loại lỗi) để biết Gemini lỗi mạng, sai khóa hay trả sai định dạng

### Cả hai
- [ ] **Đưa code mới nhất lên GitHub:** chủ repo đẩy nhánh `feature/crud-logging-pagination` (4 commit: CRUD, logging, phân trang, AI hỗ trợ giáo viên, AI Coach mới) và mở pull request; người kia duyệt rồi gộp vào `main`. Trước bước này, ai clone repo cũng chỉ nhận bản cũ
- [ ] Điền bảng thành viên (mục 1) và ngày hạn cho từng giai đoạn (mục 6)
- [ ] Mỗi người **giảng lại phần của mình** cho người kia (20–30 phút), rồi đổi vai
- [ ] Chạy thử từ đầu trên máy sạch: `git clone`, `docker compose up --build`, đăng nhập
- [ ] Tập demo theo `docs/HUONG-DAN-CHAY.md` (mục 3), có phương án dự phòng
- [ ] Đọc danh sách câu hỏi bảo vệ (mục 4 cùng file) và tự trả lời không nhìn tài liệu
- [ ] Kiểm tra quy định của trường về việc **khai báo công cụ AI**, ghi vào báo cáo nếu cần

## 4. Cách làm việc với Git

> **Issues:** mỗi ô trong mục 3 có một Issue tương ứng. Tạo bằng `python scripts/create_issues.py` (chạy thử trước: `--dry-run`). Cần đăng nhập `gh` bằng tài khoản **chủ repo** có quyền ghi. Script bỏ qua Issue trùng tiêu đề, nên Issue đã tạo từ trước (ví dụ "Chạy test trên PostgreSQL thật", nay chuyển sang A) phải đổi người phụ trách và nhãn trực tiếp trên GitHub.

- Mỗi người một nhánh: `feature/<tên-module>`. **Không commit thẳng vào `main`.**
- Gộp bằng pull request, **người kia duyệt** trước khi gộp. Commit nhỏ, nội dung rõ.
- Commit bằng tài khoản GitHub của chính mình, để lịch sử thể hiện đúng phần việc của từng người.
- **Alembic:** mỗi lúc chỉ một người tạo migration mới (hai người cùng tạo sẽ sinh hai "đầu" và lỗi khi chạy). Báo nhau trước.
- Chủ repo (`laviquyen229`) mời thành viên còn lại: **Settings, Collaborators**.
- Trước khi gộp nhớ chạy: `docker compose run --rm --no-deps api python -m pytest -q` và `npm run build` trong `frontend/`. Trên Windows có thể chạy cả ba bước bằng `hkii-run-tests.bat` (ghi kết quả ra `hkii-test-log.txt`).

## 5. Chia phần thuyết trình

Bài thuyết trình hiện có 17 slide (`docs/HKII-ThuyetTrinh.pptx`), mỗi slide có ghi chú lời nói. Slide làm trước khi có AI hỗ trợ giáo viên và AI Coach bản mới, nên cần cập nhật (việc ở mục 3). Thêm slide thì đánh lại số trong bảng dưới.

| Người nói | Nội dung | Slide |
|---|---|---|
| **A** | Mở đầu, 5 module, kiến trúc, CSDL, phân quyền | 1–7 |
| **A** | Demo giáo viên điểm danh, báo cáo, phụ huynh theo dõi con | 8–10 |
| **B** | Demo học phí, AI Coach, AI hỗ trợ giáo viên (slide mới) | 11–12, thêm 1 slide |
| **B** | API, Docker, kiểm thử, hạn chế, kết luận | 13–17 |

Cả hai cùng trả lời phần hỏi đáp, ai nắm rõ hơn thì trả lời trước, người kia bổ sung.

## 6. Thứ tự gợi ý

1. **Thiết lập:** gộp nhánh `feature/crud-logging-pagination` vào `main`, mời cộng tác, mỗi người clone repo và chạy được `docker compose up` trên máy mình.
2. **Hoàn thiện:** mỗi người làm các việc còn lại ở mục 3 trên nhánh riêng, gộp qua pull request.
3. **Kiểm thử chéo:** đổi vai, mỗi người thử phần của người kia như người dùng và ghi lỗi tìm được.
4. **Luyện tập:** đọc chéo, tập demo, đo thời gian, chốt phương án dự phòng.

Thêm ngày hạn vào từng giai đoạn sau khi biết lịch của trường.
