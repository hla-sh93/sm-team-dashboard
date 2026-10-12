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
} from "@/lib/contract";
import { CONTENT_TYPE_LABELS } from "@/lib/constants";
import { cardLabelFor } from "@/lib/cards";
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

  it.fails("[OP-02] نداء شريط «متأخر النشر» (publishing-client:264) وطابور الرئيسية (overview-client:697) بلا carryover → «متبقّي» على دورة شغّالة — عطل مفتوح", () => {
    // التعبير الحرفي من الصفحتين: <CyclePill cycleLabel={…} late /> — بلا carryover.
    const stripText = pillText({ cycleLabel: cycleSpanLabel(noor, 2026, 8), late: true });
    const expected = isCarryoverFromPastCycle(noor, 2026, 8, AT) ? "متبقّي من دورة 23/9 → 22/10" : "دورة 23/9 → 22/10";
    expect(stripText).toBe(expected);
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

  it.fails("[OP-03] صفحة النشر (seqLabel = `${CONTENT_TYPE_LABELS[t.type] ?? t.type}`) بتطبع «null» لكرت بلا نوع — عطل مفتوح", () => {
    // التعبير الحرفي من publishing-client.tsx:149-121.
    const typeLabel = (t: { type: string | null }) =>
      CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS] ?? t.type;
    const seqLabel = `${typeLabel(course)}`;
    expect(seqLabel).not.toBe("null");
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

  it.fails("[OP-04] بطاقة الأدمن «العقد حتى <endsAt>» بتطبع 1 تشرين الثاني بدل 31 تشرين الأول — عطل مفتوح", () => {
    const s = contractStateOf(training, AT);
    if (s.state !== "active") throw new Error("expected active");
    // التعبير الحرفي من admin/companies/companies-client.tsx:42.
    const adminLabel = `العقد حتى ${formatDateShort(s.endsAt)}`;
    const lastDay = new Date(s.endsAt.getTime() - 86_400_000);
    expect(adminLabel).toBe(`العقد حتى ${formatDateShort(lastDay)}`);
  });
});
