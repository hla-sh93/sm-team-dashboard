/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور telegram-reports: قاعدة الدورة والتسميات (WORK_RULES §١)
 * كخصائص على المطابِق الحقيقي `matchDelivery` (نقي، بلا قاعدة).
 *
 * العالم الاصطناعي «Delta»: دورة ١٣/٩ → ١٣/١٠ (دلو أيلول m=8) ودورة مسجَّلة بعدها
 * ١٣/١٠ → ١٣/١١ (دلو تشرين m=9، تجديد مبكر متل BW وPhoenitech). كل قطعة إلها
 * تسميتان مشروعتان (شهر بداية الدورة · شهر النشر)، وكل شهر غيرهن غلطة تسمية.
 *
 * الاصطلاح: `it.fails("[TR-nn] …")` = عطل مثبت بالتقرير
 * `docs/qa/deep-test-2026-10-11/telegram-reports.md`؛ اقلبه لـ`it` لما ينصلح.
 */
import { describe, expect, it } from "vitest";
import { assetName } from "@/lib/asset-name";
import { currentCycleBucket } from "@/lib/contract";
import { matchDelivery, type Delivery, type MatchCandidate } from "@/lib/telegram/match";

const SLUG = "Delta";
const CO = { publishStartDate: new Date(2026, 8, 13), renewals: JSON.stringify(["2026-10-13"]) };
const D = (m0: number, d: number) => new Date(2026, m0, d);

type Piece = { type: "POST" | "STORY" | "REEL"; no: number; bucket: 8 | 9; publish: Date };
/** خطة الدورتين: البوستات والريلات بنشر بالشهرين، والستوري ١٠–١٢ لدورة تشرين بتنشر بتشرين التاني. */
const PIECES: Piece[] = [
  ...[1, 2, 3, 4].map((no) => ({ type: "POST" as const, no, bucket: 8 as const, publish: D(8, 14 + no * 4) })), // 18/9 … 30/9
  { type: "POST", no: 5, bucket: 8, publish: D(9, 8) }, // أيلول بتنشر بتشرين
  ...[1, 2].map((no) => ({ type: "REEL" as const, no, bucket: 8 as const, publish: D(no === 1 ? 8 : 9, no === 1 ? 25 : 10) })),
  ...[1, 2, 3, 4, 5].map((no) => ({ type: "POST" as const, no, bucket: 9 as const, publish: D(9, 14 + no * 3) })), // 17/10 … 29/10
  ...Array.from({ length: 12 }, (_, i) => i + 1).map((no) => ({
    type: "STORY" as const,
    no,
    bucket: 9 as const,
    publish: no <= 9 ? D(9, 14 + no * 2) : D(10, no - 8), // ١٠–١٢ بتنشر ٢–٤/١١
  })),
  { type: "REEL", no: 1, bucket: 9, publish: D(9, 30) },
];

const DESIGNER = "designer", PHOTOGRAPHER = "photographer", EDITOR = "editor";
function cardsOf(p: Piece): MatchCandidate[] {
  const base = { type: p.type, month: p.bucket, year: 2026, pieceNo: p.no, publishDate: p.publish, brief: null };
  const ready = new Date(p.publish.getTime() - 2 * 86_400_000);
  const key = `${p.bucket}-${p.type}-${p.no}`;
  if (p.type !== "REEL") return [{ ...base, id: `${key}-DESIGN`, stage: "DESIGN", readyDate: ready, assigneeId: DESIGNER }];
  return [
    { ...base, id: `${key}-SHOOT`, stage: "SHOOT", readyDate: new Date(ready.getTime() - 86_400_000), assigneeId: PHOTOGRAPHER },
    { ...base, id: `${key}-EDIT`, stage: "EDIT", readyDate: ready, assigneeId: EDITOR },
  ];
}
const ALL = PIECES.flatMap(cardsOf);
const ext = (t: string) => (t === "REEL" ? "mp4" : "jpg");
const delivery = (fileName: string | null, sentAt: Date, kind: Delivery["kind"] = "PHOTO", caption: string | null = null): Delivery => ({
  id: "x", chatId: "c#1", messageId: 1, sentAt, senderId: null, senderName: null, kind, fileName, caption, fileId: null, mediaGroupId: null,
});
const match = (d: Delivery, open = ALL, closed: MatchCandidate[] = [], sender: string | null = null) =>
  matchDelivery(d, SLUG, open, [], closed, currentCycleBucket(CO, d.sentAt), false, sender);
/** يوم إرسال جوّا دورة القطعة نفسها. */
const insideCycle = (p: Piece) => (p.bucket === 8 ? D(8, 20) : D(9, 20));
const earliestOpenStage = (p: Piece, open: MatchCandidate[]) =>
  open
    .filter((t) => t.type === p.type && t.pieceNo === p.no && t.month === p.bucket)
    .sort((a, b) => a.readyDate!.getTime() - b.readyDate!.getTime())[0];

describe("§١ خاصية: كل قطعة مفتوحة بتنمسك بتسميتيها، وبأبكر مرحلة مفتوحة", () => {
  it("التسميتان (شهر الدورة · شهر النشر) بالنوع، مرسلة جوّا دورتها → القطعة نفسها", () => {
    const misses: string[] = [];
    let checked = 0;
    for (const p of PIECES) {
      // نسقط حالة «ملف شهر النشر = شهر بداية دورة أحدث مسجَّلة» — هيي TR-03 تحت.
      const months = [...new Set([p.bucket, p.publish.getMonth()])].filter(
        (m) => !(p.bucket === 8 && m === 9),
      );
      for (const m of months) {
        const name = `${assetName(SLUG, m, p.no, p.type)}.${ext(p.type)}`;
        const hit = match(delivery(name, insideCycle(p), p.type === "REEL" ? "VIDEO" : "PHOTO"));
        checked++;
        if (hit?.taskId !== earliestOpenStage(p, ALL).id) misses.push(`${name} → ${hit?.taskId ?? "null"}`);
      }
    }
    expect(checked).toBeGreaterThan(25);
    expect(misses).toEqual([]);
  });

  it("بعد ما يخلص التصوير، نفس الاسم بيسكّر المونتاج (قطعة بمراحل، مو إعادة إرسال)", () => {
    const shoot = ALL.find((t) => t.id === "8-REEL-1-SHOOT")!;
    const open = ALL.filter((t) => t.id !== shoot.id);
    const hit = match(delivery("Delta-reel-9-1.mp4", D(8, 26), "VIDEO"), open, [shoot]);
    expect(hit?.taskId).toBe("8-REEL-1-EDIT");
  });

  it("المرسِل بيحدّد المرحلة: فيديو المونتيرة بيسكّر المونتاج حتى لو التصوير أبكر", () => {
    const hit = match(delivery("Delta-reel-9-1.mp4", D(8, 20), "VIDEO"), ALL, [], EDITOR);
    expect(hit?.taskId).toBe("8-REEL-1-EDIT");
  });

  it("كلمة النوع بتفكّ اللبس: post-10-3 ← البوست، story-10-3 ← الستوري", () => {
    expect(match(delivery("Delta-post-10-3.jpg", D(9, 20)))?.taskId).toBe("9-POST-3-DESIGN");
    expect(match(delivery("Delta-story-10-3.jpg", D(9, 20)))?.taskId).toBe("9-STORY-3-DESIGN");
  });

  it("الكابشن العربي بأرقام لاتينية على توبيك الشركة («بوست 10-2») بيمرق باسم التوبيك", () => {
    expect(match(delivery(null, D(9, 20), "PHOTO", "بوست 10-2"))?.taskId).toBe("9-POST-2-DESIGN");
  });

  it("[TR-30] الأرقام الهندية «بوست ١٠-٢» بتنقرا متل «بوست 10-2»", () => {
    const withBrief = ALL.map((t, i) => (i === 0 ? { ...t, brief: "خبر عاجل عن السوق" } : t));
    expect(match(delivery(null, D(9, 20), "PHOTO", "بوست ١٠-٢"), withBrief)?.taskId).toBe("9-POST-2-DESIGN");
  });
});

describe("§١ المسلَّم ما بينسلّم مرتين — على مستوى القطعة", () => {
  const resendLeaks = (pieces: Piece[]) => {
    const leaks: string[] = [];
    for (const p of pieces) {
      const mine = cardsOf(p);
      const open = ALL.filter((t) => !mine.some((c) => c.id === t.id));
      for (const m of new Set([p.bucket, p.publish.getMonth()])) {
        const name = `${assetName(SLUG, m, p.no, p.type)}.${ext(p.type)}`;
        const hit = match(delivery(name, insideCycle(p), p.type === "REEL" ? "VIDEO" : "PHOTO"), open, mine);
        // مسموح بس لو الاسم بيفسّر قطعة تانية **حرفياً** (شهر دلوها = شهر الاسم ونفس الرقم والنوع).
        if (hit) {
          const t = ALL.find((x) => x.id === hit.taskId)!;
          const literal = t.type === p.type && t.pieceNo === p.no && t.month === m;
          if (!literal) leaks.push(`${name} → ${hit.taskId}`);
        }
      }
    }
    return leaks;
  };

  it("خاصية: اسم بوست/ريل مسكّر ما بيسكّر قطعة تانية (أرقام ما بتنقلب على قطعة مفتوحة)", () => {
    expect(resendLeaks(PIECES.filter((p) => p.type !== "STORY"))).toEqual([]);
  });

  it("[TR-04] خاصية: اسم أي ستوري مسكّرة ما بيسكّر ستوري تانية — القراءة المقلوبة ما لازم تمرق بعد ما الأولى تسمّي قطعة مسلّمة", () => {
    // «Delta-story-11-10» (ستوري ١٠ مسلّمة) ← ستوري ١١؛ «Delta-story-10-11» (ستوري ١١ مسلّمة) ← ستوري ١٠.
    expect(resendLeaks(PIECES.filter((p) => p.type === "STORY"))).toEqual([]);
  });

  it("رقم مفتوح بدورتين: التسمية الصريحة بشهر الدورة القديمة بتوصل للقديمة", () => {
    // بوست ٣ أيلول (متبقّي) وبوست ٣ تشرين مفتوحين سوا، والإرسال جوّا تشرين.
    expect(match(delivery("Delta-post-9-3.jpg", D(9, 20)))?.taskId).toBe("8-POST-3-DESIGN");
    expect(match(delivery("Delta-post-10-3.jpg", D(9, 20)))?.taskId).toBe("9-POST-3-DESIGN");
  });

  it("[٢ب e2e] اسم ستوري قطعتها مسلّمة بيرجع null عن حق — مش عطل بالمطابِق", () => {
    // نفس شكل فشل `tests/telegram-e2e.test.ts` ٢ب على لقطة ١٢:٤٩: ستوري ١ Siizen
    // (m=7) READY من ٣/٩، والاختبار بيفتح بوست ١–٢ بس. «Siizen-story-8-1» بتلاقي
    // قطعتها مسكّرة → قاعدة إعادة الإرسال بترجّع null.
    const story1 = { id: "s1", type: "STORY", stage: "DESIGN", month: 7, year: 2026, pieceNo: 1, readyDate: D(8, 3), publishDate: D(8, 6) };
    const post1 = { id: "p1", type: "POST", stage: "DESIGN", month: 7, year: 2026, pieceNo: 1, readyDate: D(7, 19), publishDate: D(7, 29) };
    const hit = matchDelivery(delivery("Siizen-story-8-1", D(9, 12)), "Siizen", [post1], [], [story1], { year: 2026, month: 9 });
    expect(hit).toBeNull();
  });
});

describe("§١ عطول مثبتة", () => {
  it("[TR-03] الدورة الشغّالة بتربح: قطعة أيلول بتنشر بتشرين، مسمّاة بشهر النشر قبل ما تبلّش دورة تشرين، ما لازم تسكّر قطعة تشرين", () => {
    // ٥/١٠ جوّا دورة أيلول (١٣/٩ → ١٣/١٠)؛ بوست ٥ أيلول بينشر ٨/١٠ → «Delta-post-10-5».
    // القراءة المباشرة (شهر ١٠ = دلو تشرين) بتلاقي بوست ٥ **تشرين** (مولّد بالتجديد المبكر) وبتسكّره.
    const hit = match(delivery("Delta-post-10-5.jpg", D(9, 5)));
    expect(hit?.taskId).toBe("8-POST-5-DESIGN");
  });

  it("[TR-04] تسمية شهر النشر لقطعة الدورة الجاية (أسبوع التحضير) ما لازم تنقلب قطعة-أول وتسكّر قطعة تانية", () => {
    // ستوري ١٠ تشرين بتنشر ٢/١١ → «Delta-story-11-10» مرسلة ١١/١٠ (قبل بداية الدورة ١٣/١٠).
    // القراءة شهر-أول ما بتلاقي شي، فالمقلوبة «شهر ١٠ قطعة ١١» بتسكّر **ستوري ١١**.
    const hit = match(delivery("Delta-story-11-10.jpg", D(9, 11)));
    expect(hit?.taskId === "9-STORY-11-DESIGN").toBe(false);
  });

  it("[TR-04] نفس الاسم بعد ما تبلّش الدورة بيوصل صح — العطل محصور بأسبوع التحضير", () => {
    expect(match(delivery("Delta-story-11-10.jpg", D(9, 20)))?.taskId).toBe("9-STORY-10-DESIGN");
  });

  it("[TR-05] «أي شهر تاني = غلطة تسمية، ممنوع تطابق» — حتى لو الشهر جنب شهر الإرسال", () => {
    // ستوري ١ تشرين (دلو m=9، بتنشر ١٦/١٠). «Delta-story-1-9» قراءتاها: كانون/٩ أو أيلول/١
    // — ولا وحدة بتفسّرها. احتياط «رقم القطعة لحاله» (±شهر من الإرسال) بيسكّرها.
    const hit = match(delivery("Delta-story-1-9.jpg", D(9, 20)));
    expect(hit).toBeNull();
  });

  it("[TR-05] خاصية: شهر بعيد (>١ عن الإرسال) وما بيفسّر ولا قراءة → ما بيطابق", () => {
    const sentAt = D(9, 20);
    const bad: string[] = [];
    const near = (m0: number) => Math.min(Math.abs(m0 - 9), 12 - Math.abs(m0 - 9)) <= 1;
    let checked = 0;
    for (const p of PIECES.filter((x) => x.bucket === 9)) {
      for (let m = 0; m < 12; m++) {
        if (m === p.bucket || m === p.publish.getMonth()) continue;
        // القراءتان: شهر-أول (m, no) وقطعة-أول (no-1, m+1) — `N-N` ملتبس بالتصميم.
        const readings = [{ m0: m, no: p.no }, ...(p.no <= 12 ? [{ m0: p.no - 1, no: m + 1 }] : [])];
        if (readings.some((r) => near(r.m0))) continue; // منطقة احتياط ±شهر — TR-05 فوق
        const name = `${assetName(SLUG, m, p.no, p.type)}.${ext(p.type)}`;
        checked++;
        const hit = match(delivery(name, sentAt, p.type === "REEL" ? "VIDEO" : "PHOTO"));
        if (!hit) continue;
        const t = ALL.find((x) => x.id === hit.taskId)!;
        const explained = readings.some(
          (r) => t.pieceNo === r.no && (t.month === r.m0 || t.publishDate!.getMonth() === r.m0),
        );
        if (!explained) bad.push(`${name} → ${hit.taskId}`);
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });

  it("[TR-06] المخبر: الفريق بيكتب «Drnoor-reel-10-2» والسلَق «Makhbar|Drnoor» (اسم بديل بنفس الحقل) — التسليم بيلاقي مونتاج ريل ٢", () => {
    // لقطة ١٢:٤٩: أليسار بعتت Drnoor-reel-10-2.mov (٢/١٠) وDrnoor-reel-10-5.mp4 (٢/١٠)،
    // وكروت مونتاج ريل ٢·٣·٤·٥ (دلو m=8، دورة ٢٣/٩ → ٢٣/١٠) لسا مفتوحة ومتأخرة من ٢٩/٩.
    const noor = { publishStartDate: new Date(2026, 5, 15), renewals: JSON.stringify(["2026-07-15", "2026-09-23"]) };
    // كروت المخبر المفتوحة كلها عليها وصف (٦/٦ باللقطة) → طبقة النوع مطفية.
    const edit2 = { id: "noor-edit-2", type: "REEL", stage: "EDIT", month: 8, year: 2026, pieceNo: 2, readyDate: D(8, 29), publishDate: D(9, 7), assigneeId: EDITOR, brief: "ريل فويس أوفر عن التحاليل الدورية" };
    const d = delivery("Drnoor-reel-10-2.mov", D(9, 2), "VIDEO");
    const hit = matchDelivery(d, "Makhbar|Drnoor", [edit2], [], [], currentCycleBucket(noor, d.sentAt), false, EDITOR);
    expect(hit?.taskId).toBe("noor-edit-2");
    // «dr.noor-post-…» نفس البديل بعد التطبيع.
    const post = { ...edit2, id: "noor-post-1", type: "POST", stage: "DESIGN", pieceNo: 1, assigneeId: DESIGNER };
    expect(matchDelivery(delivery("dr.noor-post-9-1.jpg", D(9, 5)), "Makhbar|Drnoor", [post], [], [], currentCycleBucket(noor, D(9, 5)))?.taskId).toBe("noor-post-1");
  });

  it("[TR-06] بلا الاسم البديل بالسلَق («Makhbar» لحالها) الملف بيضل ما بيطابق — البديل داتا (المرحلة J)، مو قاعدة بالكود", () => {
    const noor = { publishStartDate: new Date(2026, 5, 15), renewals: JSON.stringify(["2026-07-15", "2026-09-23"]) };
    const edit2 = { id: "noor-edit-2", type: "REEL", stage: "EDIT", month: 8, year: 2026, pieceNo: 2, readyDate: D(8, 29), publishDate: D(9, 7), assigneeId: EDITOR, brief: "ريل فويس أوفر عن التحاليل الدورية" };
    const d = delivery("Drnoor-reel-10-2.mov", D(9, 2), "VIDEO");
    expect(matchDelivery(d, "Makhbar", [edit2], [], [], currentCycleBucket(noor, d.sentAt), false, EDITOR)).toBeNull();
  });

  it("[TR-06] نفس الملف بسلَق «Drnoor» بيوصل — العطل بالسلَق الوحيد، مو بالقراءة", () => {
    const noor = { publishStartDate: new Date(2026, 5, 15), renewals: JSON.stringify(["2026-07-15", "2026-09-23"]) };
    const edit2 = { id: "noor-edit-2", type: "REEL", stage: "EDIT", month: 8, year: 2026, pieceNo: 2, readyDate: D(8, 29), publishDate: D(9, 7), assigneeId: EDITOR, brief: "ريل فويس أوفر عن التحاليل الدورية" };
    const d = delivery("Drnoor-reel-10-2.mov", D(9, 2), "VIDEO");
    expect(matchDelivery(d, "Drnoor", [edit2], [], [], currentCycleBucket(noor, d.sentAt))?.taskId).toBe("noor-edit-2");
  });
});

describe("الصور الخام والطبقة الثالثة (بالنوع) — شركة بلا نصّ خطة", () => {
  // طبقة النوع شغّالة بس لما ولا كرت مفتوح عليه وصف — بداية كل دورة قبل استيراد الخطة.
  const raw = ["IMG_1342.jpg", "DSC03882.JPG", "WhatsApp Image 2026-08-10 at 11.19.47 AM.jpeg", null];

  for (const name of raw) {
    it(`[TR-02] صورة خام «${name ?? "بلا اسم"}» ما بتسكّر كرت تصميم`, () => {
      // صار فعلاً: IMG_1342/1358/1359/1360 (أليسار ١٩/٨) سكّرت تصاميم بوستات فونيتيك،
      // وDSC03882/85/62 (المصوّر ٣/٩) سكّرت ستوري مانغو ٦–٨.
      expect(match(delivery(name, D(9, 20)))).toBeNull();
    });
  }

  it("بس لما في وصف خطة على أي كرت مفتوح، الصورة الخام ما بتطابق (الطبقة الثالثة مطفية)", () => {
    const withBrief = ALL.map((t, i) => (i === 0 ? { ...t, brief: "خبر عاجل عن السوق" } : t));
    expect(match(delivery("IMG_1342.jpg", D(9, 20)), withBrief)).toBeNull();
  });
});

describe("الكاروسيل «-M-P-S»", () => {
  it("الشريحة ١ بتسكّر القطعة، والشرائح بعدها ما بتنزلق على قطعة تانية", () => {
    const first = match(delivery("Delta-post-10-2-1.jpg", D(9, 20)));
    expect(first?.taskId).toBe("9-POST-2-DESIGN");
    const closed = ALL.filter((t) => t.id === "9-POST-2-DESIGN");
    const open = ALL.filter((t) => t.id !== "9-POST-2-DESIGN");
    for (const s of [2, 3, 4, 7]) expect(match(delivery(`Delta-post-10-2-${s}.jpg`, D(9, 20)), open, closed)).toBeNull();
  });
});

describe("ملف بتوبيك شركة تانية", () => {
  it("[TR-26] (تحذير) اسم شركة تانية صريح بيترفض بالتوبيك الغلط — وما في مسار يوصّله لشركته", () => {
    // phoenitech-reel-9-3.mp4 بتوبيك التدريب (٣٠/٩) وphoenitech-reel-10-1.mp4 بتوبيك التوظيف:
    // المطابِق بيحمي الكرت الغلط (مع وصف خطة)، بس التسليم الحقيقي بيضيع لحدّ ما حدا يسكّره بحمولة.
    const withBrief = ALL.map((t, i) => (i === 0 ? { ...t, brief: "خبر عاجل عن السوق" } : t));
    expect(match(delivery("Yankee-reel-10-1.mp4", D(9, 20), "VIDEO"), withBrief)).toBeNull();
  });

  it("[TR-02] «الاسم الصريح أقوى من مكان الإرسال» — حتى بشركة بلا وصف خطة", () => {
    // PROJECT.md §14: ملف باسم شركة تانية بيضل مرفوض. بلا وصف، الملف بينزل لطبقة النوع وبيسكّر أبكر ريل هون.
    expect(match(delivery("Yankee-reel-10-1.mp4", D(9, 20), "VIDEO"))).toBeNull();
  });
});

describe("الاسم القديم بلا نوع — قيد موثَّق", () => {
  it("[TR-07] «Delta 10-3» بلا كلمة نوع بتسكّر الأبكر موعداً (ستوري ٣) مو البوست — ليش القالب صار بالنوع", () => {
    // `asset-name.ts`: الاسم بلا نوع بيوصف التنين. ملاحظة: حارس §12 بـfull-system-audit
    // بيولّد هالشكل بالذات وبيعدّ أي إقفال «نجاح» بلا ما يفحص هوية القطعة (TR-07).
    expect(match(delivery("Delta 10-3.jpg", D(9, 20)))?.taskId).toBe("9-STORY-3-DESIGN");
  });
});
