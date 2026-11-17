"""Sinh Documentations/SO-LIEU.md: bảng số liệu gốc lấy thẳng từ code. Mọi con số trong tài liệu lấy từ file này.

Chạy trong container api (đủ thư viện), mount cả repo vào /repo:
    docker compose run --rm --no-deps -v "<đường dẫn repo>:/repo" -w /repo/backend api python /repo/scripts/so_lieu.py

Thêm --no-tests để bỏ qua phần chạy test (dùng số test, độ phủ của lần chạy trước trong file JSON cũ).
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys
from collections import Counter, OrderedDict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"
FRONTEND = REPO / "frontend"
OUT_MD = REPO / "Documentations" / "SO-LIEU.md"
REPO_URL = "https://github.com/thaiphatcaifa/HKII-FastAPI"
SKIP_PATHS = {"/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"}
METHODS = ("get", "post", "put", "patch", "delete")

# Import app với cấu hình tạm, không đụng CSDL thật
os.environ.setdefault("DATABASE_URL", "sqlite:///./so_lieu_tmp.db")
os.environ["SEED_ON_START"] = "false"
os.environ["AUTO_OVERDUE_ENABLED"] = "false"
sys.path.insert(0, str(BACKEND))


def api_numbers():
    from app.main import app

    spec = app.openapi()
    paths = {p: v for p, v in spec["paths"].items() if p not in SKIP_PATHS}
    ops = []
    for path, item in paths.items():
        for method in METHODS:
            if method in item:
                tag = (item[method].get("tags") or ["-"])[0]
                ops.append({"method": method.upper(), "path": path, "tag": tag, "summary": item[method].get("summary", "")})
    by_tag = Counter(o["tag"] for o in ops)
    return {
        "paths": len(paths),
        "operations": len(ops),
        "by_tag": dict(sorted(by_tag.items(), key=lambda kv: (-kv[1], kv[0]))),
        "list": sorted(ops, key=lambda o: (o["tag"], o["path"], METHODS.index(o["method"].lower()))),
    }


def db_numbers():
    from app.db import Base
    import app.models  # noqa: F401  (đăng ký bảng vào metadata)

    tables = OrderedDict()
    for name, table in Base.metadata.tables.items():
        tables[name] = [
            {
                "name": c.name,
                "type": str(c.type),
                "pk": c.primary_key,
                "nullable": c.nullable,
                "fk": ", ".join(sorted(f.target_fullname for f in c.foreign_keys)),
            }
            for c in table.columns
        ]
    migrations = sorted(p.name for p in (BACKEND / "alembic" / "versions").glob("*.py"))
    return {
        "tables": len(tables),
        "columns_total": sum(len(c) for c in tables.values()),
        "columns": {k: len(v) for k, v in tables.items()},
        "detail": tables,
        "migrations": len(migrations),
        "migration_files": migrations,
    }


def test_numbers():
    collected = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q"], cwd=BACKEND, capture_output=True, text=True
    ).stdout
    per_file = Counter(line.split("::")[0].replace("tests/", "") for line in collected.splitlines() if "::" in line)
    cov_json = Path("/tmp/so_lieu_cov.json")
    run = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--cov=app", f"--cov-report=json:{cov_json}"],
        cwd=BACKEND,
        capture_output=True,
        text=True,
    )
    tail = run.stdout.strip().splitlines()[-1] if run.stdout.strip() else ""
    passed = int(re.search(r"(\d+) passed", tail).group(1)) if re.search(r"(\d+) passed", tail) else 0
    failed = int(re.search(r"(\d+) failed", tail).group(1)) if re.search(r"(\d+) failed", tail) else 0
    cov = json.loads(cov_json.read_text())
    files = {k.replace("app/", "", 1): round(v["summary"]["percent_covered"], 1) for k, v in cov["files"].items()}
    return {
        "collected": sum(per_file.values()),
        "per_file": dict(sorted(per_file.items())),
        "passed": passed,
        "failed": failed,
        "run_line": tail,
        "coverage_percent": round(cov["totals"]["percent_covered"], 2),
        "coverage_rounded": round(cov["totals"]["percent_covered"]),
        "statements": cov["totals"]["num_statements"],
        "missing": cov["totals"]["missing_lines"],
        "coverage_files": dict(sorted(files.items())),
        "run_date": dt.date.today().isoformat(),
    }


def frontend_numbers():
    app_jsx = (FRONTEND / "src" / "App.jsx").read_text(encoding="utf-8")
    routes = [{"path": "/login", "roles": "công khai (chưa đăng nhập)", "page": "Login"}]
    # Mỗi <Route ... path="x" hoặc index ... element={...}> lấy path, vai trò, trang
    for m in re.finditer(r"<Route\s+(index|path=\"([^\"]+)\")\s+element=\{(.*?)\}\s*/>", app_jsx, re.S):
        path = "/" if m.group(1) == "index" else m.group(2)
        if path == "/login":
            continue
        body = m.group(3)
        roles = re.search(r"roles=\{\[([^\]]+)\]\}", body)
        page = re.findall(r"<([A-Z][A-Za-z]+)\s*/>", body)
        routes.append(
            {
                "path": "/" + path.lstrip("/") if path != "*" else "* (mọi đường dẫn khác, trang 404)",
                "roles": ", ".join(r.strip().strip("'\"") for r in roles.group(1).split(",")) if roles else "mọi vai trò đã đăng nhập",
                "page": page[-1] if page else "",
            }
        )
    pages = sorted(p.stem for p in (FRONTEND / "src" / "pages").glob("*.jsx"))
    components = sorted(p.stem for p in (FRONTEND / "src" / "components").glob("*.jsx"))
    pkg = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((FRONTEND / "package-lock.json").read_text(encoding="utf-8"))
    locked = {name.replace("node_modules/", ""): info.get("version") for name, info in lock.get("packages", {}).items() if name}
    deps = {}
    for section in ("dependencies", "devDependencies"):
        for name, spec in pkg.get(section, {}).items():
            deps[name] = {"khai_bao": spec, "cai_that": locked.get(name, ""), "loai": section}
    images = sorted(p.name for p in (REPO / "docs" / "images").glob("*.png"))
    return {
        "routes": routes,
        "route_count": len(routes),
        "pages": pages,
        "page_count": len(pages),
        "components": components,
        "component_count": len(components),
        "npm": deps,
        "screenshots": images,
        "screenshot_count": len(images),
    }


def python_numbers():
    reqs = OrderedDict()
    for line in (BACKEND / "requirements.txt").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            name, _, ver = line.partition("==")
            reqs[name] = ver
    return reqs


def main():
    no_tests = "--no-tests" in sys.argv
    old = {}
    if no_tests and OUT_MD.exists():
        found = re.search(r"```json\n(.*?)\n```", OUT_MD.read_text(encoding="utf-8"), re.S)
        old = json.loads(found.group(1)) if found else {}
    data = {
        "repo_url": REPO_URL,
        "generated": dt.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "api": api_numbers(),
        "db": db_numbers(),
        "tests": old.get("tests") if no_tests else test_numbers(),
        "frontend": frontend_numbers(),
        "python": python_numbers(),
    }
    tmp_db = BACKEND / "so_lieu_tmp.db"
    if tmp_db.exists():
        tmp_db.unlink()
    OUT_MD.write_text(render(data), encoding="utf-8", newline="\n")
    print(f"Đã ghi {OUT_MD.relative_to(REPO)}: {data['api']['operations']} API, {data['db']['tables']} bảng, "
          f"{data['tests']['passed']} test đạt, độ phủ {data['tests']['coverage_percent']}%")


def render(d):
    a, db, t, fe, py = d["api"], d["db"], d["tests"], d["frontend"], d["python"]
    L = []
    w = L.append
    w("# SỐ LIỆU GỐC CỦA ĐỒ ÁN EduCenter (HKII, Nhóm 3)")
    w("")
    w(f"Sinh tự động bằng `scripts/so_lieu.py` lúc {d['generated']} từ chính mã nguồn. Không sửa tay: muốn đổi số thì sửa code rồi chạy lại script.")
    w("Mọi con số trong README, docs, Documentation, Installation Guide, User Guide và slide phải khớp file này (kiểm bằng `scripts/kiem_tra_so_lieu.py`).")
    w("")
    w("## 1. Tóm tắt")
    w("")
    w("| Chỉ số | Giá trị | Nguồn |")
    w("|---|---|---|")
    w(f"| Repo | {d['repo_url']} | |")
    w(f"| Số API (thao tác HTTP) | **{a['operations']}** | `/openapi.json`, không tính /docs, /redoc, /openapi.json |")
    w(f"| Số đường dẫn API | **{a['paths']}** | như trên |")
    w(f"| Số bảng CSDL | **{db['tables']}** | metadata của `backend/app/models.py` |")
    w(f"| Tổng số cột | **{db['columns_total']}** | như trên |")
    w(f"| Số migration Alembic | **{db['migrations']}** | `backend/alembic/versions/` |")
    w(f"| Số test | **{t['passed']}** đạt / {t['collected']} test, {t['failed']} lỗi | `pytest`, chạy ngày {t['run_date']} |")
    w(f"| Độ phủ test | **{t['coverage_percent']}%** (làm tròn {t['coverage_rounded']}%), {t['statements']} lệnh, thiếu {t['missing']} | `pytest-cov` |")
    w(f"| Số file test | **{len(t['per_file'])}** | `backend/tests/` |")
    w(f"| Số route giao diện | **{fe['route_count']}** | `frontend/src/App.jsx` |")
    w(f"| Số trang (pages) | **{fe['page_count']}** | `frontend/src/pages/` |")
    w(f"| Số thành phần (components) | **{fe['component_count']}** | `frontend/src/components/` |")
    w(f"| Số ảnh màn hình | **{fe['screenshot_count']}** | `docs/images/` |")
    w("")
    w("## 2. API theo nhóm (tag)")
    w("")
    w("| Nhóm | Số API |")
    w("|---|---|")
    for tag, n in a["by_tag"].items():
        w(f"| {tag} | {n} |")
    w(f"| **Tổng** | **{a['operations']}** |")
    w("")
    w("Danh sách đầy đủ:")
    w("")
    w("| # | Nhóm | Phương thức | Đường dẫn |")
    w("|---|---|---|---|")
    for i, o in enumerate(a["list"], 1):
        w(f"| {i} | {o['tag']} | {o['method']} | `{o['path']}` |")
    w("")
    w("## 3. CSDL")
    w("")
    w("| Bảng | Số cột |")
    w("|---|---|")
    for name, n in db["columns"].items():
        w(f"| `{name}` | {n} |")
    w(f"| **{db['tables']} bảng** | **{db['columns_total']} cột** |")
    w("")
    for name, cols in db["detail"].items():
        w(f"### `{name}`")
        w("")
        w("| Cột | Kiểu | Khóa chính | Cho phép rỗng | Khóa ngoại |")
        w("|---|---|---|---|---|")
        for c in cols:
            w(f"| `{c['name']}` | {c['type']} | {'có' if c['pk'] else ''} | {'có' if c['nullable'] else 'không'} | {c['fk']} |")
        w("")
    w(f"Migration ({db['migrations']}): " + ", ".join(f"`{m}`" for m in db["migration_files"]))
    w("")
    w("## 4. Test")
    w("")
    w(f"Lần chạy: `{t['run_line']}` (ngày {t['run_date']}).")
    w("")
    w("| File test | Số test |")
    w("|---|---|")
    for f, n in t["per_file"].items():
        w(f"| `{f}` | {n} |")
    w(f"| **Tổng** | **{t['collected']}** |")
    w("")
    w("Độ phủ từng file (`backend/app/`):")
    w("")
    w("| File | Độ phủ |")
    w("|---|---|")
    for f, p in t["coverage_files"].items():
        w(f"| `{f}` | {p}% |")
    w(f"| **Tổng** | **{t['coverage_percent']}%** |")
    w("")
    w("## 5. Giao diện")
    w("")
    w("| Đường dẫn | Vai trò được vào | Trang |")
    w("|---|---|---|")
    for r in fe["routes"]:
        w(f"| `{r['path']}` | {r['roles']} | {r['page']} |")
    w("")
    w(f"Trang ({fe['page_count']}): " + ", ".join(fe["pages"]))
    w("")
    w(f"Thành phần ({fe['component_count']}): " + ", ".join(fe["components"]))
    w("")
    w(f"Ảnh màn hình ({fe['screenshot_count']}): " + ", ".join(fe["screenshots"]))
    w("")
    w("## 6. Phiên bản thư viện")
    w("")
    w("Python (`backend/requirements.txt`):")
    w("")
    w("| Thư viện | Phiên bản |")
    w("|---|---|")
    for name, ver in py.items():
        w(f"| {name} | {ver} |")
    w("")
    w("JavaScript (`frontend/package.json`, bản cài thật theo `package-lock.json`):")
    w("")
    w("| Thư viện | Khai báo | Cài thật | Loại |")
    w("|---|---|---|---|")
    for name, info in fe["npm"].items():
        w(f"| {name} | {info['khai_bao']} | {info['cai_that']} | {info['loai']} |")
    w("")
    w("## 7. Dữ liệu máy đọc (dùng cho script kiểm tra)")
    w("")
    compact = {
        "repo_url": d["repo_url"],
        "api": {k: a[k] for k in ("paths", "operations", "by_tag")},
        "db": {k: db[k] for k in ("tables", "columns_total", "columns", "migrations")},
        "tests": t,
        "frontend": {k: fe[k] for k in ("route_count", "page_count", "component_count", "screenshot_count", "pages", "components", "screenshots")},
        "python": py,
        "npm": {k: v["cai_that"] for k, v in fe["npm"].items()},
    }
    w("```json")
    w(json.dumps(compact, ensure_ascii=False, indent=1))
    w("```")
    w("")
    return "\n".join(L)


if __name__ == "__main__":
    main()
