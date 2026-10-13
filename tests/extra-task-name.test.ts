/**
 * المهام الإضافية (القائدة ١٣/١٠):
 *  - «ممنوع مهمة بلا وصف واسم (هاد يلي قابل للنسخ مشان تلغرام يلقطه)» — والاسم «الموقع
 *    بيولّده لحاله»: `<Slug>-extra-<خمس أحرف>` من معرّف الكرت.
 *  - «مهمة سابين ونوال تبع بكرا ليش نزلت ضمن مهام اليوم؟ هيي بكرا بتبدأ» — المهمة
 *    الإضافية المثبّتة على يوم بداية ما بتبلّش قبله.
 */
import { describe, expect, it } from "vitest";
import { cardAssetName, extraAssetName, extraCode, parseAssetName, parseExtraName } from "@/lib/asset-name";
import { makeHeldReason, selectDailyWork } from "@/lib/daily-work";

describe("اسم الملف التلقائي للمهمة الإضافية", () => {
  it("رمز ثابت من المعرّف: خمس أحرف لاتينية صغيرة، بلا أرقام", () => {
    const ids = ["cmv6w5wi9000e2ltx48cchouq", "adhoc_tawzeef-first-syrian-uae-publish", "x"];
    for (const id of ids) {
      expect(extraCode(id)).toMatch(/^[a-z]{5}$/);
      expect(extraCode(id)).toBe(extraCode(id));
    }
    expect(new Set(ids.map(extraCode)).size).toBe(ids.length);
  });

  it("الاسم بسلَق الشركة، والداخلي «Team»", () => {
    const t = { id: "cmv6w5wi9000e2ltx48cchouq" };
    expect(extraAssetName({ name: "التوظيف" }, t)).toBe(`Jobs-extra-${extraCode(t.id)}`);
    expect(extraAssetName(null, t)).toBe(`Team-extra-${extraCode(t.id)}`);
  });

  it("الكرت الإضافي بياخد الاسم التلقائي؛ قطعة الخطة اسمها من رقمها؛ كرت الكتابة بلا اسم", () => {
    const co = { name: "التوظيف" };
    const extra = { id: "e1", kind: "ADHOC", type: null, month: 9, pieceNo: null };
    const piece = { id: "p1", kind: "CONTENT", type: "POST", month: 9, pieceNo: 2 };
    const write = { id: "w1", kind: "CONTENT_WRITING", type: null, month: 9, pieceNo: null };
    expect(cardAssetName(co, extra)).toBe(`Jobs-extra-${extraCode("e1")}`);
    expect(cardAssetName(co, piece)).toBe("Jobs-post-10-2");
    expect(cardAssetName(co, write)).toBeNull();
  });

  it("بينقرا من اسم الملف أو الكابشن بأي فاصل وأي حالة أحرف", () => {
    for (const text of ["Jobs-extra-kqfzt.jpg", "jobs extra KQFZT", "Team_extra_kqfzt", "تصميم Jobs-extra-kqfzt"]) {
      expect(parseExtraName(text)).toEqual({ code: "kqfzt" });
    }
    expect(parseExtraName("Jobs-post-10-2.jpg")).toBeNull();
    expect(parseExtraName("extraordinary.jpg")).toBeNull();
  });

  it("ما بينقرا قطعة خطة أبداً — فما بيسكّر بوست بالغلط", () => {
    expect(parseAssetName("Jobs-extra-kqfzt.jpg")?.readings.length ?? 0).toBe(0);
  });
});

describe("المهمة الإضافية ما بتبلّش قبل يوم بدايتها (القائدة ١٣/١٠)", () => {
  const sabine = {
    id: "sabine",
    name: "سابين",
    role: "designer",
    hoursPerDay: 8,
    workDays: JSON.stringify([0, 1, 2, 3, 4]),
    isScheduled: true,
    isPhotographer: false,
    rates: JSON.stringify({ POST: 6 }),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;
  const card = (over: Record<string, unknown>) =>
    ({
      id: "c",
      kind: "ADHOC",
      type: null,
      title: "تصميم بوست: الثانوية الوطنية الخاصة",
      hours: 4,
      quantity: 1,
      priority: "URGENT",
      status: "NOT_STARTED",
      board: "TODO",
      workDate: new Date(2026, 9, 14),
      readyDate: new Date(2026, 9, 14),
      publishDate: null,
      manualDay: null,
      isPinned: true,
      isAuto: false,
      stage: null,
      blockedById: null,
      pipelineKey: null,
      pieceNo: null,
      notes: null,
      completedAt: null,
      startedAt: null,
      finishedAt: null,
      companyId: null,
      assigneeId: "sabine",
      year: 2026,
      month: 9,
      ...over,
    }) as never;
  const today = new Date(2026, 9, 13);

  it("مثبّتة على ١٤/١٠ → مو بقائمة ١٣/١٠، وسببها «لحدّ ١٤/١٠»؛ ويوم ١٤/١٠ بتطلع", () => {
    const school = card({ id: "school" });
    expect(selectDailyWork({ employee: sabine, tasks: [school], companies: [], today }).queue).toEqual([]);
    expect(makeHeldReason([school], "2026-10-13")(school)?.parkedUntil).toBe("2026-10-14");
    const tomorrow = selectDailyWork({ employee: sabine, tasks: [school], companies: [], today: new Date(2026, 9, 14) });
    expect(tomorrow.queue.map((t) => t.id)).toEqual(["school"]);
  });

  it("…أما قطعة الخطة المثبّتة على يوم لاحق فبتنسحب لقدّام متل ما هي (§١٦)", () => {
    const post = card({ id: "post", kind: "CONTENT", type: "POST", stage: "DESIGN", isAuto: true, pieceNo: 2, hours: 0 });
    expect(selectDailyWork({ employee: sabine, tasks: [post], companies: [], today }).queue.map((t) => t.id)).toEqual(["post"]);
  });

  it("…ويوم البداية بيمنع البداية بس، ما بيصدّر: بوست خطة مستحق اليوم بيسبق إضافية تسليمها بعدين", () => {
    // فحص ما بعد النشر ١٣/١٠: «إطلاق ميزة Featured Job» (مثبّتة ١٤/١٠، تسليم ٢١/١٠) كانت
    // تتصدّر يوم سابين وتطلّع بوست التوظيف 10-2 المستحق ١٤/١٠.
    const featured = card({ id: "featured", priority: "NORMAL", hours: 3, readyDate: new Date(2026, 9, 21) });
    const post = card({
      id: "post-10-2", kind: "CONTENT", type: "POST", stage: "DESIGN", isAuto: true, pieceNo: 2, hours: 0,
      priority: "NORMAL", workDate: new Date(2026, 9, 13), readyDate: new Date(2026, 9, 14), manualDay: new Date(2026, 9, 13),
    });
    const q = selectDailyWork({ employee: sabine, tasks: [featured, post], companies: [], today: new Date(2026, 9, 14) }).queue;
    expect(q.map((t) => t.id)).toEqual(["post-10-2", "featured"]);
  });

  it("…والإضافية بلا قفل (يومها من المحرّك) ما بتستنّى", () => {
    const loose = card({ id: "loose", isPinned: false });
    expect(selectDailyWork({ employee: sabine, tasks: [loose], companies: [], today }).queue.map((t) => t.id)).toEqual(["loose"]);
  });
});
