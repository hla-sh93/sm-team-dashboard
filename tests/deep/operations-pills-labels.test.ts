/**
 * الفحص العميق — العمليات · الشارات والتسميات عبر الشاشات (§١ · §٥ · §٨).
 *
 * ثلاث ملاحظات من جولة المتصفّح على نسخة ١٢:٤٩ (أ · ب · ج بتكليف المنسّق)
 * ومعها خلاف تسمية بين بطاقة الأدمن وصفحة الموظّف:
 *   - «متبقّي من دورة 23/9 → 22/10» على كروت دورة **شغّالة** (مخبر د.نور).
 *   - «null · التدريب» لكرت نشر بلا نوع.
 *   - «العقد حتى 1/11» (أدمن) مقابل «1/10 ← 31/10» (الموظّف) لنفس الدورة.
 *
 * مكوّنات العميل (publishing-client · overview-client) ما بتنرسم هون؛ منعكس
 * **التعبير نفسه** يلي بيكتبوه ومنرسم `CyclePill` فعلاً.
 *
 * الاصطلاح: `it.fails` = عطل مفتوح موثَّق ([OP-nn])؛ اقلبه لـ`it` لما ينصلح.
 * التقرير: `docs/qa/deep-test-2026-10-11/operations.md`.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CyclePill } from "@/components/ui/pills";
import {
  contractStateOf,
  currentCycleBucket,
  cycleSpanLabel,
  isCarryoverFromPastCycle,
  lastDayOf,
} from "@/lib/contract";
import { CONTENT_TYPE_LABELS } from "@/lib/constants";
import { cardLabelFor, publishTypeLabel } from "@/lib/cards";
import { readFileSync } from "node:fs";
import { formatDateShort, toISODate } from "@/lib/dates";

const AT = new Date(2026, 9, 11, 9, 0, 0);

/** مخبر د.نور كما بلقطة ١٢:٤٩: بدء ١٥/٦، تجديدان ١٥/٧ و٢٣/٩ → الدورة الجارية ٢٣/٩ → ٢٢/١٠ بدلو أيلول. */
const noor = {
  contractStartDate: new Date(2026, 5, 15),
  publishStartDate: new Date(2026, 5, 15),
  renewals: JSON.stringify(["2026-07-15", "2026-09-23"]),
  contractEndedAt: null,
};
/** التدريب: بدء نشر ١/١٠ بلا تجديدات → دورة ١/١٠ → ٣١/١٠. */
const training = {
  contractStartDate: new Date(2026, 9, 1),
  publishStartDate: new Date(2026, 9, 1),
  renewals: null,
  contractEndedAt: null,
};

const pillText = (props: Parameters<typeof CyclePill>[0]) =>
  renderToStaticMarkup(createElement(CyclePill, props)).replace(/<[^>]+>/g, "");

describe("(أ) شارة الدورة — «متبقّي» للدورة السابقة بس (§١)", () => {
  it("دلو الدورة الجارية لمخبر نور بـ١١/١٠ هو أيلول، وهو مو «متبقّي من دورة سابقة»", () => {
    expect(currentCycleBucket(noor, AT)).toEqual({ year: 2026, month: 8 });
    expect(isCarryoverFromPastCycle(noor, 2026, 8, AT)).toBe(false);
    expect(isCarryoverFromPastCycle(noor, 2026, 7, AT)).toBe(true);
    expect(cycleSpanLabel(noor, 2026, 8)).toBe("23/9 → 22/10");
  });

  it("CyclePill بـcarryover=false بتكتب «دورة …» بلا «متبقّي» حتى لو الكرت متأخر", () => {
    const text = pillText({ cycleLabel: cycleSpanLabel(noor, 2026, 8), late: true, carryover: false });
    expect(text).toBe("دورة 23/9 → 22/10");
  });

  it("[OP-02] نداء بلا carryover ما بيقول «متبقّي» (الافتراضي «لأ»)", () => {
    const stripText = pillText({ cycleLabel: cycleSpanLabel(noor, 2026, 8), late: true });
    expect(stripText).toBe("دورة 23/9 → 22/10");
  });

  it("[OP-02] كل نداء لـCyclePill بالشاشات بيمرّر carryover من isCarryoverFromPastCycle", () => {
    const files = [
      "src/app/publishing/publishing-client.tsx",
      "src/app/overview-client.tsx",
      "src/components/KanbanBoard.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const calls = src.match(/<CyclePill[\s\S]*?\/>/g) ?? [];
      expect(calls.length, file).toBeGreaterThan(0);
      for (const call of calls) expect(call, file).toMatch(/carryover=\{isCarryoverFromPastCycle\(/);
    }
  });
});

describe("(ج) تسمية كرت نشر بلا نوع", () => {
  const course = {
    id: "course_x_publish",
    kind: "ADHOC",
    stage: "PUBLISH",
    type: null,
    title: "نشر إعلان: البرنامج التدريبي الذكاء الاصطناعي في الإدارة الحديثة",
    companyId: "c_training",
    pieceNo: null,
  } as never;

  it("اللوح (cardLabelFor) بيرجّع العنوان لكرت بلا نوع", () => {
    expect(cardLabelFor(course, 1, new Map(), () => "التدريب")).toContain("نشر إعلان");
  });

  it("[OP-03] صفحة النشر بتسمّي كرت النشر بلا نوع بعنوانه (`publishTypeLabel`) — مو «null»", () => {
    expect(publishTypeLabel(course)).toContain("نشر إعلان");
    expect(publishTypeLabel({ type: "POST", title: null })).toBe(CONTENT_TYPE_LABELS.POST);
    expect(publishTypeLabel({ type: null, title: null })).toBe("نشر");
    expect(readFileSync("src/app/publishing/publishing-client.tsx", "utf8")).toMatch(/publishTypeLabel\(t\)/);
  });
});

describe("تسمية نهاية الدورة — بطاقة الأدمن مقابل صفحة الموظّف (§١: «13/7 → 12/8» شاملة)", () => {
  it("صفحة الموظّف بتكتب آخر يوم بالدورة شاملاً: 1/10 → 31/10", () => {
    expect(cycleSpanLabel(training, 2026, 9)).toBe("1/10 → 31/10");
  });

  it("contractStateOf.endsAt هي نهاية **حصرية** (اليوم يلي بعد آخر يوم)", () => {
    const s = contractStateOf(training, AT);
    expect(s.state).toBe("active");
    if (s.state !== "active") return;
    expect(toISODate(s.endsAt)).toBe("2026-11-01");
  });

  it("[OP-04] بطاقة الأدمن «العقد حتى» بتطبع آخر يوم بالدورة (31 تشرين الأول) — نفس صفحة الموظّف", () => {
    const s = contractStateOf(training, AT);
    if (s.state !== "active") throw new Error("expected active");
    expect(toISODate(lastDayOf(s.endsAt))).toBe("2026-10-31");
    expect(cycleSpanLabel(training, 2026, 9)).toBe("1/10 → 31/10");
    // كل نصّ بالأدمن بيطبع نهاية الدورة بيمرق من `lastDayOf` — ولا وحدة بالنهاية الحصرية.
    const src = readFileSync("src/app/admin/companies/companies-client.tsx", "utf8");
    expect(src).toMatch(/العقد حتى \$\{formatDateShort\(lastDayOf\(s\.endsAt\)\)\}/);
    expect(src).not.toMatch(/formatDateShort\(s\.endsAt\)/);
  });
});
