# -*- coding: utf-8 -*-
"""
جدول النشر لكل شركة — ملف Excel خارجي مؤقّت.

طلب القائدة (٣/٩): «من تاريخ بداية الدورة لتاريخ نهايتها، النشر يراعي اليوم
(تاريخ)، نوع المحتوى، والمحتوى المرتبط بالخطة… بشكل مؤقت بس لهاد الشهر، أو
ملفات خارجية فقط للشركات يلي لسا ما انتهت دورتها».

مؤقّت عن قصد: الحلّ الدائم مكتوبة إله خطة بـ`tasks/plan-publishing-schedule-pdf.md`
(صفحة داخل التطبيق + PDF + تذكير تلغرام) وما انتنفّذ بعد.

المصدر: آخر لقطة إنتاج بـ`backups/prod-*.json` — يعني الأرقام هي الحيّة.

التشغيل:  python scripts/build-publishing-schedule.py
"""
import glob
import io
import json
import os
from datetime import date, datetime, timedelta

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

FONT = "Arial"
OUT = os.path.join("docs", "cycle-reports", "publishing-schedule-2026-09.xlsx")
AR_DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]
TYPE_AR = {"POST": "بوست", "REEL": "ريل", "AI_REEL": "ريل AI", "STORY": "ستوري"}
DONE = {"READY", "PUBLISHED"}

snap = sorted(glob.glob(os.path.join("backups", "prod-*.json")))[-1]
data = json.load(io.open(snap, encoding="utf8"))
companies = {c["id"]: c for c in data["companies"]}


def d(v):
    return datetime.fromisoformat(v.replace("Z", "+00:00")).date() if v else None


def cycle_of(co):
    """بداية الدورة الشغّالة ونهايتها — من تاريخ بدء النشر وآخر تجديد."""
    start = d(co.get("publishStartDate"))
    if not start:
        return None
    renewals = sorted(d(r) for r in json.loads(co.get("renewals") or "[]"))
    today = date(2026, 9, 3)
    for r in renewals:
        if r <= today:
            start = r
    return start, start + timedelta(days=29)


head_fill = PatternFill("solid", fgColor="1F4E5F")
head_font = Font(name=FONT, bold=True, color="FFFFFF", size=11)
thin = Side(style="thin", color="BFCED3")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
FILL = {
    "منشور": PatternFill("solid", fgColor="D9EAD3"),
    "جاهز — ينتظر النشر": PatternFill("solid", fgColor="FFF2CC"),
    "لسا بالإنتاج": PatternFill("solid", fgColor="F4CCCC"),
    "متأخرة من قبل الدورة": PatternFill("solid", fgColor="E6E0EC"),
}
HEAD = ["اليوم", "التاريخ", "نوع المحتوى", "#", "المحتوى المرتبط بالخطة", "اسم الملف", "المسؤول", "الحالة"]
WIDTH = [11, 12, 12, 5, 68, 22, 11, 20]

employees = {e["id"]: e["name"] for e in data["employees"]}
slug_of = {c["id"]: (c.get("slug") or c["name"]) for c in companies.values()}

wb = Workbook()
wb.remove(wb.active)
summary = []

for co in sorted(companies.values(), key=lambda c: c["name"]):
    if not co.get("managed") or co["status"] == "archived":
        continue
    cy = cycle_of(co)
    if not cy:
        continue  # ما بلّش النشر → ما في دورة
    if co.get("contractEndedAt"):
        continue  # العقد منتهي
    start, end = cy
    rows = []
    for t in data["tasks"]:
        if t["companyId"] != co["id"] or t.get("stage") != "PUBLISH" or not t.get("type"):
            continue
        pub = d(t.get("publishDate"))
        if not pub:
            continue
        # الطلب: «من تاريخ بداية الدورة لتاريخ نهايتها». وأي قطعة **غير منشورة**
        # موعدها قبل الدورة بتضل تبيّن — هي متأخرة محمولة، وإخفاؤها بيخفي شغل
        # واقف فعلاً.
        carry = pub < start and t["status"] != "PUBLISHED"
        if not carry and not (start <= pub <= end):
            continue
        if t["status"] == "PUBLISHED":
            state = "منشور"
        else:
            prod = [
                x for x in data["tasks"]
                if x.get("pipelineKey") and x["pipelineKey"] == t.get("pipelineKey") and x["stage"] != "PUBLISH"
            ]
            ready = prod and all(p["board"] == "DONE" or p["status"] in DONE for p in prod)
            state = "جاهز — ينتظر النشر" if ready else "لسا بالإنتاج"
            if carry:
                state = "متأخرة من قبل الدورة"
        rows.append((pub, t, state))
    if not rows:
        continue
    rows.sort(key=lambda r: (r[0], r[1].get("type") or "", r[1].get("pieceNo") or 0))

    ws = wb.create_sheet(co["name"][:28])
    ws.sheet_view.rightToLeft = True
    ws["A1"] = f'{co["name"]} — دورة {start.day}/{start.month} → {end.day}/{end.month}'
    ws["A1"].font = Font(name=FONT, bold=True, size=14, color="1F4E5F")
    ws["A2"] = (
        f'الخطة: {co["reels"]} ريل · {co["posts"]} بوست'
        + (f' · {co["aiReels"]} ريل AI' if co["aiReels"] else "")
        + (f' · {co["stories"]} ستوري' if co["stories"] else "")
        + f'     ·     الاسم اللاتيني: {slug_of[co["id"]]}'
    )
    ws["A2"].font = Font(name=FONT, size=10)
    ws.append([])
    ws.append(HEAD)
    hr = ws.max_row
    for c in range(1, len(HEAD) + 1):
        cell = ws.cell(row=hr, column=c)
        cell.fill, cell.font, cell.border = head_fill, head_font, border
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    counts = {"منشور": 0, "جاهز — ينتظر النشر": 0, "لسا بالإنتاج": 0, "متأخرة من قبل الدورة": 0}
    for pub, t, state in rows:
        counts[state] += 1
        no = t.get("pieceNo")
        typ = TYPE_AR.get(t["type"], t["type"])
        prefix = {"POST": "post", "REEL": "reel", "AI_REEL": "ai", "STORY": "story"}[t["type"]]
        name = f'{slug_of[co["id"]]}-{prefix}-{start.month}-{no}' if no else ""
        brief = (t.get("brief") or t.get("title") or "").replace("\n", " ").strip()
        ws.append([
            AR_DAYS[pub.weekday()], f"{pub.day}/{pub.month}", typ, no,
            brief or "— بلا وصف بالخطة —", name,
            employees.get(t.get("assigneeId"), "—"), state,
        ])
        r = ws.max_row
        for c in range(1, len(HEAD) + 1):
            cell = ws.cell(row=r, column=c)
            cell.font = Font(name=FONT, size=10)
            cell.border = border
            cell.alignment = Alignment(
                horizontal="right" if c == 5 else "center", vertical="center", wrap_text=(c == 5)
            )
        if state in FILL:
            for c in range(1, len(HEAD) + 1):
                ws.cell(row=r, column=c).fill = FILL[state]

    for i, w in enumerate(WIDTH, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f"A{hr + 1}"
    ws.auto_filter.ref = f"A{hr}:H{ws.max_row}"
    today = date(2026, 9, 3)
    cy_state = "لسا ما بلّشت" if start > today else ("شغّالة" if end >= today else "منتهية")
    summary.append((co["name"], f"{start.day}/{start.month} → {end.day}/{end.month}", cy_state, len(rows), *counts.values()))

# ورقة الملخّص أولاً
s = wb.create_sheet("الملخّص", 0)
s.sheet_view.rightToLeft = True
s.append(["الشركة", "الدورة", "حالة الدورة", "قطع النشر", "منشور", "جاهز ينتظر النشر", "لسا بالإنتاج", "متأخرة من قبل"])
for c in range(1, 9):
    cell = s.cell(row=1, column=c)
    cell.fill, cell.font, cell.border = head_fill, head_font, border
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
for row in summary:
    s.append(list(row))
for r in s.iter_rows(min_row=2, max_row=s.max_row, max_col=8):
    for cell in r:
        cell.font = Font(name=FONT, size=10)
        cell.border = border
        cell.alignment = Alignment(horizontal="center", vertical="center")
for i, w in enumerate([26, 16, 13, 11, 10, 18, 14, 15], start=1):
    s.column_dimensions[get_column_letter(i)].width = w
note = s.max_row + 2
s.cell(row=note, column=1, value=f"المصدر: {os.path.basename(snap)} — لقطة الإنتاج الحيّة.").font = Font(name=FONT, size=9)
s.cell(row=note + 1, column=1, value="ملف مؤقّت لهذا الشهر. الحلّ الدائم (صفحة داخل التطبيق + PDF + تذكير تلغرام) مكتوبة إله خطة بـtasks/plan-publishing-schedule-pdf.md وما انتنفّذ.").font = Font(name=FONT, size=9)
s.cell(row=note + 2, column=1, value="«لسا بالإنتاج» = في مرحلة تصميم/تصوير/مونتاج لهالقطعة لسا مفتوحة. «جاهز» = كل الإنتاج خلص والنشر بس ناقص.").font = Font(name=FONT, size=9)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print("saved:", OUT, "· أوراق:", len(wb.sheetnames))
for row in summary:
    print("  ", row)
