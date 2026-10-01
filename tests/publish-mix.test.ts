/**
 * تنويع النشر: ما في نوعين متشابهين يوم ورا يوم، والتوزيع بينفرد على الدورة.
 *
 * القائدة (٢٨/٩) على تقويم مخبر د.نور: «ليش هون في ريلين ورا بعض؟ وبعده
 * بوستين ورا بعض؟ ليش مافي تنويع بما يتناسب والعمل أولاً وخوارزمية السوشال
 * ميديا ثانياً؟» — والتقويم كان فعلاً:
 *
 *   ريل ٣٠/٩ · ريل ١/١٠ · بوست ٣/١٠ · بوست ٤/١٠ · ريل ٥/١٠ · بوست ٧/١٠ …
 *
 * ثلاث علل متراكبة، وكلها بخطوة التوزيع لا بترتيب الأنواع:
 *
 *   ١· **المنطقة الميتة**: `minIdxOf` بيمنع النشر بأول الدورة (أسبوع التحضير،
 *      ومهلة تصوير الريل). المسافات كانت تنحسب من يوم ٠، فالأهداف الأولى
 *      بتقع بمنطقة ممنوعة وكل قطعة بتنكبش لأول يوم مسموح — فبيتكدّسوا.
 *   ٢· **الاحتياطي الأعمى**: الموضِع كان يدوّر على يوم جيرانه فاضيين، وإذا ما
 *      لقي بينزل فوراً لـ«أي يوم حر» — بلا ما يسأل شو نوع الجار. فبالازدحام
 *      بيطلع ريل جنب ريل.
 *   ٣· **لفّ الأيام**: دوران الشركات كان يلفّ الأيام (`% cycleLen`)، فترتيب
 *      الأيام ينكسر عن ترتيب التسلسل والتنويع يوصل للتقويم مبعثراً — وصل طلعت
 *      `PPPP` مع إنّ تسلسلها المثالي أقصى تكرار فيه بوستين.
 *
 * النموذج البديل: التسلسل يلي بيبنيه `interleaveTypes` هو **نفسه** ترتيب
 * الأيام (مسح تصاعدي)، والمسافات تنحسب على النافذة الشرعية، والدوران صار
 * إزاحة بداية. والتنازل عن التنويع بيصير بس لما ما يبقى فسحة — خطة كثيفة
 * (١٥ بوست و٨ ريلات بـ٢٦ يوم) فيها التصاق حتمي رياضياً.
 */
import { describe, it, expect } from "vitest";
import { buildSchedule, type CompanyInput, type EmployeeInput } from "@/lib/scheduler";
import { applyPipelinePreservation, type ExistingPipelineTaskState } from "@/lib/pipeline-preservation";
import type { PipelineTask } from "@/lib/pipeline";
import { toISODate } from "@/lib/dates";

const emp = (over: Partial<EmployeeInput> = {}): EmployeeInput => ({
  id: "e1",
  name: "مصمم",
  role: "مصمم",
  hoursPerDay: 6,
  workDays: [6, 0, 1, 2, 3],
  isScheduled: true,
  isPhotographer: false,
  ...over,
});

const photographer = emp({ id: "e_photo", name: "مصور", role: "مصور", isPhotographer: true });

const co = (over: Partial<CompanyInput> = {}): CompanyInput => ({
  id: "c1",
  name: "شركة",
  managed: true,
  priority: 1,
  status: "active",
  posts: 6,
  reels: 6,
  stories: 0,
  aiReels: 0,
  contractStartDate: null,
  publishStartDate: new Date(2026, 8, 23),
  postOwnerId: "e1",
  storyOwnerId: "e1",
  aiReelOwnerId: "e1",
  defaultOwnerId: "e1",
  photographerId: "e_photo",
  ...over,
});

/** قطع الفيد (بوست/ريل/AI) مرتّبة بتاريخ النشر. */
function feed(company: Partial<CompanyInput>, year = 2026, month = 8) {
  const r = buildSchedule({
    year,
    month,
    employees: [emp(), photographer],
    companies: [co(company)],
  });
  return r.tasks
    .filter((t) => t.kind === "CONTENT" && t.type && t.type !== "STORY" && t.publishDate)
    .sort((a, b) => a.publishDate!.getTime() - b.publishDate!.getTime());
}

const letters = (rows: { type: string | null }[]) =>
  rows.map((t) => (t.type === "REEL" ? "R" : t.type === "POST" ? "P" : "A")).join("");

/** أطول سلسلة من نفس الحرف. */
const longestRun = (seq: string) => {
  let best = 0;
  let run = 0;
  for (let i = 0; i < seq.length; i++) {
    run = i > 0 && seq[i] === seq[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};

/** المسافة بالأيام بين كل نشرتين متتاليتين. */
const gaps = (rows: { publishDate: Date | null }[]) =>
  rows.slice(1).map((t, i) => Math.round((t.publishDate!.getTime() - rows[i].publishDate!.getTime()) / 86_400_000));

describe("تقويم مخبر د.نور — الحالة يلي اشتكت منها القائدة", () => {
  const rows = feed({ posts: 6, reels: 6 });

  it("ما في نوعين متشابهين ورا بعض — التسلسل بيتبادل", () => {
    expect(letters(rows)).toBe("RPRPRPRPRPRP");
  });

  it("ولا نشرتين بنفس اليوم", () => {
    const days = rows.map((t) => toISODate(t.publishDate!));
    expect(new Set(days).size).toBe(days.length);
  });

  it("والتوزيع منفرد: ما في فجوة ضعف جارتها", () => {
    const g = gaps(rows);
    expect(Math.min(...g)).toBeGreaterThanOrEqual(1);
    // كان: ١,٢,١,١,٢,٣,٢,٢,٣,٢,٣ — بداية مكدّسة وآخر مفرود.
    expect(Math.max(...g) - Math.min(...g)).toBeLessThanOrEqual(3);
  });

  it("وكل النشر داخل الدورة وبعد أسبوع التحضير", () => {
    const first = rows[0].publishDate!;
    const last = rows[rows.length - 1].publishDate!;
    // أسبوع التحضير: ولا قطعة تنزل قبل ٣٠/٩ (٢٣/٩ + ٧ أيام).
    expect(toISODate(first) >= "2026-09-30").toBe(true);
    // والدورة بتنتهي ٢٢/١٠ (٢٣/١٠ حصراً).
    expect(toISODate(last) <= "2026-10-22").toBe(true);
  });
});

describe("النموذج بيصمد على كل أشكال الخطة", () => {
  it("لما العددان متساويان بيتبادلوا تماماً", () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const seq = letters(feed({ posts: n, reels: n }));
      expect(longestRun(seq), `${n}+${n} → ${seq}`).toBe(1);
    }
  });

  it("ولما يختلفوا، أطول تكرار ما بيتجاوز الحدّ الرياضي", () => {
    // ١٥ بوست و٨ ريلات ما بيقدروا يتبادلوا: أقصر توزيع ممكن بوستين لكل ريل.
    // الحدّ هو `ceil(الأكتر / الأقل)` — وتجاوزه معناه إنّ الخوارزمية بعثرت.
    for (const [p, r] of [
      [15, 8],
      [10, 8],
      [10, 6],
      [12, 3],
      [6, 3],
      [4, 8],
      [3, 9],
    ]) {
      const seq = letters(feed({ posts: p, reels: r }));
      const limit = Math.ceil(Math.max(p, r) / Math.min(p, r));
      expect(longestRun(seq), `${p} بوست + ${r} ريل → ${seq}`).toBeLessThanOrEqual(limit);
    }
  });

  it("والنوع الواحد لحاله ما بينكسر", () => {
    expect(letters(feed({ posts: 6, reels: 0 }))).toBe("PPPPPP");
    expect(letters(feed({ posts: 0, reels: 5 }))).toBe("RRRRR");
  });

  it("وكل القطع بتضل داخل الدورة مهما كانت الخطة كثيفة", () => {
    for (const [p, r] of [
      [15, 8],
      [20, 10],
      [12, 12],
    ]) {
      const rows = feed({ posts: p, reels: r });
      expect(rows.length).toBe(p + r);
      for (const t of rows) {
        expect(toISODate(t.publishDate!) >= "2026-09-23").toBe(true);
        expect(toISODate(t.publishDate!) <= "2026-10-22").toBe(true);
      }
    }
  });
});

describe("الدوران بيضل يبعّد الشركات عن بعضها", () => {
  it("شركتان بنفس الخطة ما بينشروا بنفس الأيام", () => {
    // الدوران صار إزاحة بداية بدل لفّ أيام — لازم يضل بيفرّق، وإلا كل النشر
    // بيتكدّس بنفس الأيام على الناشر.
    const r = buildSchedule({
      year: 2026,
      month: 8,
      employees: [emp(), photographer],
      companies: [
        co({ id: "c1", name: "شركة ١" }),
        co({ id: "c2", name: "شركة ٢" }),
      ],
    });
    const daysOf = (id: string) =>
      r.tasks
        .filter((t) => t.companyId === id && t.type !== "STORY" && t.publishDate)
        .map((t) => toISODate(t.publishDate!))
        .sort();
    const a = daysOf("c1");
    const b = daysOf("c2");
    expect(a.length).toBe(b.length);
    expect(a.join(",")).not.toBe(b.join(","));
  });
});

describe("الستوريات إلها نافذتها كمان", () => {
  it("ما بتنزل قبل أسبوع التحضير ولا بتتكدّس بأوله", () => {
    const r = buildSchedule({
      year: 2026,
      month: 8,
      employees: [emp(), photographer],
      companies: [co({ posts: 6, reels: 6, stories: 10 })],
    });
    const stories = r.tasks
      .filter((t) => t.type === "STORY" && t.publishDate)
      .sort((a, b) => a.publishDate!.getTime() - b.publishDate!.getTime());
    expect(stories.length).toBe(10);
    expect(toISODate(stories[0].publishDate!) >= "2026-09-30").toBe(true);
    const g = gaps(stories);
    // بلا نافذة شرعية كانت أول أربع ستوريات تتكدّس على أول يوم مسموح.
    expect(Math.min(...g)).toBeGreaterThanOrEqual(1);
  });
});

/**
 * إعادة توزيع دورة شغّالة: يوم النشر بينجمد لما يكون **صار** لا لما يكون
 * كرت الإنتاج منجزاً.
 *
 * بدون هالتمييز، أول إعادة جدولة لنور خلّت كرت تصوير ريل ١ (منجز ٢٨/٩) يقول
 * «نشر ٣٠/٩» وكرت النشر لنفس القطعة يقول «٣/١٠» — ومراحل القطعة الوحدة
 * بتتناقض، وترقيم القطع مبني على `publishDate`.
 */
const pipeTask = (over: Partial<PipelineTask>): PipelineTask =>
  ({
    id: "t",
    kind: "CONTENT",
    stage: "SHOOT",
    board: "TODO",
    type: "REEL",
    title: null,
    companyId: "c1",
    assigneeId: null,
    publishDate: "2026-10-03",
    readyDate: "2026-10-03",
    workDate: "2026-10-03",
    week: 1,
    blockedById: null,
    pipelineKey: "c1|REEL|2026-09-30|1",
    quantity: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    month: 8,
    year: 2026,
    ...over,
  }) as PipelineTask;

const savedTask = (over: Partial<ExistingPipelineTaskState>): ExistingPipelineTaskState =>
  ({
    pipelineKey: "c1|REEL|2026-09-30|1",
    stage: "SHOOT",
    board: "DONE",
    status: "READY",
    isPinned: false,
    title: null,
    workDate: new Date(2026, 8, 28),
    readyDate: new Date(2026, 8, 28),
    assigneeId: null,
    priority: "NORMAL",
    quantity: 1,
    companyId: "c1",
    type: "REEL",
    publishDate: new Date(2026, 8, 30),
    kind: "CONTENT",
    pieceNo: 1,
    ...over,
  }) as ExistingPipelineTaskState;

describe("الحفظ عند إعادة الجدولة", () => {
  it("قطعة ما نزلت بعد: يوم شغل التصوير المنجز بينحفظ، ويوم النشر بيمشي مع الخطة", () => {
    const shoot = pipeTask({ stage: "SHOOT", publishDate: "2026-10-03" });
    applyPipelinePreservation([shoot], [savedTask({ stage: "SHOOT" })]);
    expect(shoot.board).toBe("DONE");
    // السجلّ: يوم الشغل الفعلي ٢٨/٩ بيضل.
    expect(shoot.workDate).toBe("2026-09-28");
    // الخطة: يوم النشر الجديد بيمشي.
    expect(shoot.publishDate).toBe("2026-10-03");
  });

  it("وقطعة نزلت فعلاً: يوم نشرها بينجمد على كل مراحلها", () => {
    const shoot = pipeTask({ stage: "SHOOT", publishDate: "2026-10-03" });
    const publish = pipeTask({ stage: "PUBLISH", publishDate: "2026-10-03" });
    const saved = [
      savedTask({ stage: "SHOOT" }),
      savedTask({ stage: "PUBLISH", board: "DONE", status: "PUBLISHED", publishDate: new Date(2026, 8, 30) }),
    ];
    applyPipelinePreservation([shoot, publish], saved);
    expect(publish.publishDate).toBe("2026-09-30");
    expect(shoot.publishDate).toBe("2026-09-30");
  });
});
