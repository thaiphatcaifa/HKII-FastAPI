"""Nghiệm thu chéo: so mọi con số trong tài liệu với Documentations/SO-LIEU.md. Chỉ qua khi số lệch bằng 0.

Chạy ở máy (cần pymupdf, python-pptx):  python scripts/kiem_tra_so_lieu.py
Đọc: README.md, docs/*.md, Documentations/README.md, Documentation (pdf), Installation Guide (pdf),
User Guide (pdf), slide (chữ trên slide và ghi chú lời nói).
Số liệu lịch sử (ví dụ dòng Task Sheet ngày 14/10) nằm trong danh sách NGOAI_LE kèm lý do.
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "Documentations"
S = json.loads(re.search(r"```json\n(.*?)\n```", (DOCS / "SO-LIEU.md").read_text(encoding="utf-8"), re.S).group(1))

API, PATHS, TABLES = S["api"]["operations"], S["api"]["paths"], S["db"]["tables"]
TESTS, COV = S["tests"]["passed"], S["tests"]["coverage_rounded"]
SCREENS = S["frontend"]["screenshot_count"]
TFILES = len(S["tests"]["per_file"])
VERSIONS = {**{k.lower(): v for k, v in S["python"].items()}, **{k.lower(): v for k, v in S["npm"].items()}}
ALIASES = {"react router": "react-router-dom", "tailwind css": "tailwindcss", "tailwind": "tailwindcss"}

# Câu chứa số liệu lịch sử, đúng tại thời điểm được ghi, không phải số hiện tại
NGOAI_LE = [
    ("36 API operations, 15 tests", "Task Sheet dòng 3: bản đầu ngày 14/10/2026"),
    ("8 tables", "Task Sheet dòng 2: thiết kế CSDL ngày 11/10/2026, ai_notes thêm sau"),
    ("15/15 automated", "1st Status Report 23/10/2026"),
    ("từ 92% lên", "mô tả mức độ phủ trước khi chốt"),
    ("92% to", "mô tả mức độ phủ trước khi chốt"),
    ("92% lên", "mô tả mức độ phủ trước khi chốt"),
    ("18 slide", "bản slide cũ 05/11/2026 giữ làm nguồn"),
    ("9 luồng giao diện và 90 test", "PHAN-CONG: lần chạy thử ngày 05/11/2026"),
]


def sources():
    out = {}
    for p in [REPO / "README.md", DOCS / "README.md", *sorted((REPO / "docs").glob("*.md"))]:
        out[str(p.relative_to(REPO))] = p.read_text(encoding="utf-8")
    import pymupdf

    for name in ["EduCenter_Group03_Documentation.pdf", "EduCenter_Group03_InstallationGuide.pdf", "EduCenter_Group03_UserGuide.pdf"]:
        doc = pymupdf.open(DOCS / name)
        out[f"Documentations/{name}"] = "\n".join(page.get_text() for page in doc)
    from pptx import Presentation

    prs = Presentation(DOCS / "EduCenter_Group03_Presentation.pptx")
    parts = []
    for i, s in enumerate(prs.slides, 1):
        for sh in s.shapes:
            if sh.has_text_frame:
                parts.append(sh.text_frame.text)
            if sh.has_table:
                parts.extend(c.text for r in sh.table.rows for c in r.cells)
        if s.has_notes_slide:
            parts.append(s.notes_slide.notes_text_frame.text)
    out["Documentations/EduCenter_Group03_Presentation.pptx"] = "\n".join(parts)
    return out


def norm(text):
    return re.sub(r"[ \t ]+", " ", text.replace("\n", " "))


def is_exception(window):
    return next((why for phrase, why in NGOAI_LE if phrase in window), None)


def check(name, text, problems, counts):
    t = norm(text)

    def claim(pattern, expected, label, group=1):
        for m in re.finditer(pattern, t, re.I):
            val = int(m.group(group))
            win = t[max(0, m.start() - 40): m.end() + 40]
            counts[label] = counts.get(label, 0) + 1
            if val == expected or is_exception(win):
                continue
            if label == "số test":
                # Số test của một file: phải khớp đúng số test của file đó
                files = re.findall(r"(test_\w+\.py)", t[max(0, m.start() - 60): m.start()])
                if files and S["tests"]["per_file"].get(files[-1]) == val:
                    continue
                # Số test của một nhóm nhỏ ghi trong ngoặc, ví dụ "(3 test)"
                if t[max(0, m.start() - 1): m.start()] == "(" and val < expected:
                    continue
            problems.append((name, label, val, expected, win.strip()))

    claim(r"\b(\d+)\s+(?:API\b|thao tác API|API operations|operations\b)", API, "số API")
    claim(r"\b(\d+)\s+(?:đường dẫn|paths)\b", PATHS, "số đường dẫn")
    claim(r"\b(\d+)\s+(?:bảng|tables)\b(?! (?:màu|design))", TABLES, "số bảng")
    claim(r"\b(\d+)\s*(?:test|tests)\b(?! (?:files?|tự động cho))", TESTS, "số test")
    claim(r"\b(\d+)\s+passed\b", TESTS, "số test")
    claim(r"\b(\d+)/\d+\s+test", TESTS, "số test")
    claim(r"\b(\d+)\s+(?:file test|test files|files? test)\b", TFILES, "số file test")
    claim(r"\b(\d+)\s+(?:màn hình|screens)\b", SCREENS, "số màn hình")
    # độ phủ
    for m in re.finditer(r"(?:độ phủ|coverage|phủ mã)[^%]{0,40}?(\d+(?:[.,]\d+)?)\s*%|(\d+(?:[.,]\d+)?)\s*%\s*(?:code coverage|coverage|độ phủ)", t, re.I):
        raw = m.group(1) or m.group(2)
        val = float(raw.replace(",", "."))
        win = t[max(0, m.start() - 40): m.end() + 40]
        counts["độ phủ"] = counts.get("độ phủ", 0) + 1
        ok = round(val) == COV
        ok = ok or (val == 90 and re.search(r"dưới|below|under|fail|>=|ngưỡng|chặn|báo đỏ", win, re.I))
        ok = ok or (val == 85 and re.search(r"file|mỗi|every", win, re.I))
        ok = ok or (val in (66, 69, 77, 83, 92) and re.search(r"trước|lên|to |from|->|nay", win, re.I))
        ok = ok or (val == 100 and re.search(r"scores|insights_ai|nay", win, re.I))
        if not ok and not is_exception(win):
            problems.append((name, "độ phủ", val, COV, win.strip()))
    # phiên bản thư viện
    for lib in sorted(set(list(VERSIONS) + list(ALIASES)), key=len, reverse=True):
        for m in re.finditer(rf"(?<![\w-]){re.escape(lib)}\s+v?(\d+(?:\.\d+){{1,2}})\b", t, re.I):
            key = ALIASES.get(lib, lib)
            real = VERSIONS[key]
            counts["phiên bản"] = counts.get("phiên bản", 0) + 1
            if not (real == m.group(1) or real.startswith(m.group(1) + ".")):
                win = t[max(0, m.start() - 30): m.end() + 30]
                if not is_exception(win):
                    problems.append((name, f"phiên bản {lib}", m.group(1), real, win.strip()))
    # link repo
    for m in re.finditer(r"github\.com/([\w.-]+/[\w.-]+)", t):
        counts["link repo"] = counts.get("link repo", 0) + 1
        target = m.group(1).removesuffix(".git").rstrip(".")
        if target.lower() != "thaiphatcaifa/hkii-fastapi":
            problems.append((name, "link repo", target, "thaiphatcaifa/HKII-FastAPI", t[max(0, m.start() - 30): m.end() + 10]))


def main():
    problems, counts = [], {}
    srcs = sources()
    for name, text in srcs.items():
        check(name, text, problems, counts)
    print(f"Đã đọc {len(srcs)} nguồn. Số chỗ đã so: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    print(f"SO-LIEU: {API} API, {PATHS} đường dẫn, {TABLES} bảng, {TESTS} test, {TFILES} file test, độ phủ {COV}%, {SCREENS} màn hình")
    if problems:
        print(f"\nLỆCH: {len(problems)}")
        for name, label, val, exp, win in problems:
            print(f"- {name} | {label}: ghi {val}, đúng {exp} | ...{win}...")
        sys.exit(1)
    print("\nLỆCH: 0. ĐẠT")


if __name__ == "__main__":
    main()
