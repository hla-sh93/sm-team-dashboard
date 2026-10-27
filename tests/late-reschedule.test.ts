/**
 * «إعادة جدولة المتأخر» (القائدة ٢٧/١٠) — المخطّط النقي `planLateReschedule`.
 * اليوم المختار بالأمثلة: الثلاثاء ٢٧/١٠/٢٠٢٦ (دوام الأحد→الخميس، السبت للنشر بس).
 */
import { describe, expect, it } from "vitest";
import { planLateReschedule, type RescheduleCompany, type RescheduleEmployee } from "@/lib/late-reschedule";
import type { Task } from "@/types";

const D = "2026-10-27"; // ثلاثاء
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const wd = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

const team: RescheduleEmployee[] = [
  { id: "des", name: "مصمم", role: "مصمم", rates: '{"POST":6,"STORY":6}', hoursPerDay: 8, workDays: "[0,1,2,3,4]" },
  { id: "pho", name: "مصورة", role: "مصور", rates: '{"REEL":6}', hoursPerDay: 8, workDays: "[0,1,2,3,4]" },
  { id: "edi", name: "مونتيرة", role: "مونتير", rates: '{"REEL":3}', hoursPerDay: 8, workDays: "[0,1,2,3,4]" },
  { id: "pub", name: "ناشر", role: "ناشر", rates: "{}", hoursPerDay: 8, workDays: "[0,1,2,3,4]" },
];

const company = (id: string, priority: number, extra: Partial<RescheduleCompany> = {}): RescheduleCompany => ({
  id,
  name: id,
  priority,
  status: "active",
  managed: true,
  publishStartDate: day("2026-10-01"),
  renewals: null,
  contractEndedAt: null,
  ...extra,
} as RescheduleCompany);

let seq = 0;
function card(p: Partial<Task> & { stage: string }): Task {
  seq++;
  return {
    id: p.id ?? `t${seq}`,
    kind: "CONTENT",
    type: "POST",
    title: p.title ?? `${p.stage} ${seq}`,
    hours: 0,
    quantity: 1,
    pieceNo: null,
    priority: "NORMAL",
    status: "NOT_STARTED",
    board: "TODO",
    publishDate: null,
    readyDate: null,
    workDate: null,
    manualDay: null,
    month: 9,
    year: 2026,
    isPinned: false,
    isAuto: true,
    blockedById: null,
    pipelineKey: null,
    notes: null,
    brief: "نص",
    completedAt: null,
    startedAt: null,
    finishedAt: null,
    companyId: "A",
    assigneeId: null,
    ...p,
  } as unknown as Task;
}

/** بوست: تصميم (المصمم) ← نشر (الناشر). */
function post(co: string, no: number, design: string, publish: string, opts: { done?: boolean; published?: boolean } = {}) {
  const key = `${co}|POST|${no}`;
  const d = card({
    id: `${key}|D`, companyId: co, stage: "DESIGN", type: "POST", pieceNo: no, assigneeId: "des", pipelineKey: key,
    workDate: day(design), readyDate: day(design), publishDate: day(publish),
    ...(opts.done ? { status: "READY", board: "DONE", finishedAt: day(design), completedAt: day(design) } : {}),
  });
  const p = card({
    id: `${key}|P`, companyId: co, stage: "PUBLISH", type: "POST", pieceNo: no, assigneeId: "pub", pipelineKey: key,
    blockedById: d.id, workDate: day(publish), readyDate: day(publish), publishDate: day(publish),
    ...(opts.published ? { status: "PUBLISHED", board: "DONE", finishedAt: day(publish), completedAt: day(publish) } : {}),
  });
  return [d, p];
}

/** ريل: تصوير ← مونتاج ← نشر. */
function reel(co: string, no: number, shoot: string, edit: string, publish: string) {
  const key = `${co}|REEL|${no}`;
  const s = card({ id: `${key}|S`, companyId: co, stage: "SHOOT", type: "REEL", pieceNo: no, assigneeId: "pho", pipelineKey: key, workDate: day(shoot), readyDate: day(shoot), publishDate: day(publish) });
  const e = card({ id: `${key}|E`, companyId: co, stage: "EDIT", type: "REEL", pieceNo: no, assigneeId: "edi", pipelineKey: key, blockedById: s.id, workDate: day(edit), readyDate: day(edit), publishDate: day(publish) });
  const p = card({ id: `${key}|P`, companyId: co, stage: "PUBLISH", type: "REEL", pieceNo: no, assigneeId: "pub", pipelineKey: key, blockedById: e.id, workDate: day(publish), readyDate: day(publish), publishDate: day(publish) });
  return [s, e, p];
}

const plan = (tasks: Task[], companies = [company("A", 1)], extra: { fromISO?: string; companyIds?: (string | null)[] } = {}) =>
  planLateReschedule({ tasks, employees: team, companies, fromISO: extra.fromISO ?? D, companyIds: extra.companyIds });
const moveOf = (r: ReturnType<typeof plan>, id: string) => r.moves.find((m) => m.taskId === id);

describe("المتأخر بينحطّ من يوم البداية", () => {
  it("تصميم متأخر ← يوم البداية، والنشر بعده بمهلة `LEAD` (يومين)", () => {
    const r = plan(post("A", 1, "2026-10-20", "2026-10-22"));
    expect(moveOf(r, "A|POST|1|D")?.to.ready).toBe("2026-10-27");
    expect(moveOf(r, "A|POST|1|D")?.reason).toBe("late");
    expect(moveOf(r, "A|POST|1|P")?.to.publish).toBe("2026-10-29");
  });

  it("يوم بداية مختار بالمستقبل: ولا شي قبله", () => {
    const r = plan(post("A", 1, "2026-10-20", "2026-10-22"), undefined, { fromISO: "2026-11-01" });
    expect(moveOf(r, "A|POST|1|D")?.to.ready).toBe("2026-11-01");
    expect(moveOf(r, "A|POST|1|P")!.to.publish! >= "2026-11-03").toBe(true);
  });

  it("السعة: ٨ تصاميم متأخرة بمعدّل ٦/يوم ← ٦ اليوم و٢ يوم الدوام الجاي", () => {
    const pubs = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-14", "2026-11-15", "2026-11-16"];
    const tasks = pubs.map((pub, i) => post("A", i + 1, "2026-10-20", pub)).flat();
    const r = plan(tasks);
    const days = r.moves.filter((m) => m.stage === "DESIGN").map((m) => m.to.ready);
    expect(days.filter((d) => d === "2026-10-27")).toHaveLength(6);
    expect(days.filter((d) => d === "2026-10-28")).toHaveLength(2);
  });

  it("الحمل الموجود بينحسب: يوم فيه ٦ تصاميم مش متأخرة ما بياخد المتأخر", () => {
    // ٦ بوستات مش متأخرة على ٢٧/١٠، نشرها أيام دوام بعيدة (ولا جمعة).
    const pubs = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-14"];
    const busy = pubs.map((pub, i) => post("A", 10 + i, "2026-10-27", pub)).flat();
    const r = plan([...post("A", 1, "2026-10-20", "2026-10-22"), ...busy]);
    expect(moveOf(r, "A|POST|1|D")?.to.ready).toBe("2026-10-28");
    expect(r.moves.filter((m) => /\|POST\|1\d\|/.test(m.taskId))).toEqual([]);
  });
});

describe("الإزاحة وتأثيراتها", () => {
  it("بوست ٣ المتأخر بيصير بعد بوست ٤ ← بوست ٤ بينزاح بعده (الترتيب الرقمي)، وبوست ٥ البعيد ما بيتحرّك", () => {
    const r = plan([
      ...post("A", 3, "2026-10-20", "2026-10-22"),
      ...post("A", 4, "2026-10-26", "2026-10-28", { done: true }),
      ...post("A", 5, "2026-11-10", "2026-11-12"),
    ]);
    expect(moveOf(r, "A|POST|3|P")?.to.publish).toBe("2026-10-29");
    expect(moveOf(r, "A|POST|4|P")?.to.publish).toBe("2026-10-31"); // السبت مسموح للنشر
    expect(moveOf(r, "A|POST|4|P")?.reason).toBe("order");
    expect(moveOf(r, "A|POST|4|D")).toBeUndefined(); // المنجز ما بيتحرّك
    expect(moveOf(r, "A|POST|5|P")).toBeUndefined();
    expect(moveOf(r, "A|POST|5|D")).toBeUndefined();
  });

  it("ريل: تصوير متأخر ← موعد بعد يومين عالأقل (مع تنبيه)، المونتاج بعده، والنشر بعد المونتاج", () => {
    const r = plan(reel("A", 1, "2026-10-19", "2026-10-21", "2026-10-23"));
    const s = moveOf(r, "A|REEL|1|S")!;
    const e = moveOf(r, "A|REEL|1|E")!;
    const p = moveOf(r, "A|REEL|1|P")!;
    expect(s.to.ready).toBe("2026-10-29");
    expect(s.warnings.join()).toContain("الزبون");
    expect(e.to.ready! >= "2026-10-31").toBe(true);
    expect([0, 1, 2, 3, 4]).toContain(wd(e.to.ready!));
    expect(p.to.publish! >= e.to.ready!).toBe(true);
    expect(e.to.publish).toBe(p.to.publish); // يوم النشر على كروت القطعة
  });

  it("تأثير الحاجز: تصوير متأخر بيزيح مونتاجاً مش متأخر لبعده، والنشر وراه (سبب «after»)", () => {
    const r = plan(reel("A", 2, "2026-10-20", "2026-10-29", "2026-10-31"));
    const s = moveOf(r, "A|REEL|2|S")!;
    const e = moveOf(r, "A|REEL|2|E")!;
    expect(s.reason).toBe("late");
    expect(e.reason).toBe("after");
    expect(e.to.ready! > s.to.ready!).toBe(true);
    expect(moveOf(r, "A|REEL|2|P")!.to.publish! > e.to.ready!).toBe(true);
  });

  it("مهلة ضيّقة موجودة من قبل (مش من الزرّ) ما بتتحرّك", () => {
    const tight = reel("A", 3, "2026-10-26", "2026-10-27", "2026-10-29");
    tight[0] = { ...tight[0], status: "READY", board: "DONE", finishedAt: day("2026-10-26") } as Task;
    expect(plan(tight).moves).toEqual([]);
  });

  it("ما في قطعتي تغذية لنفس الشركة بنفس اليوم: البوست المنقول ما بينزل على يوم ريل", () => {
    const reelKept = reel("A", 1, "2026-10-25", "2026-10-27", "2026-10-29"); // مش متأخر
    reelKept[0] = { ...reelKept[0], status: "READY", board: "DONE", finishedAt: day("2026-10-26") } as Task;
    const r = plan([...post("A", 1, "2026-10-20", "2026-10-22"), ...reelKept]);
    expect(moveOf(r, "A|POST|1|P")?.to.publish).toBe("2026-10-31");
    expect(moveOf(r, "A|REEL|1|P")).toBeUndefined();
  });

  it("ولا إنتاج يوم جمعة أو سبت، ولا نشر يوم جمعة", () => {
    const tasks = Array.from({ length: 14 }, (_, i) => post("A", i + 1, "2026-10-15", "2026-10-18")).flat();
    const r = plan(tasks);
    for (const m of r.moves) {
      if (m.stage === "PUBLISH") expect(wd(m.to.publish!)).not.toBe(5);
      else expect([5, 6]).not.toContain(wd(m.to.ready!));
    }
  });
});

describe("ما بيتحرّك", () => {
  it("«بدّل» القائدة على يوم بعد البداية بيضل حدّاً أدنى", () => {
    const [d, p] = post("A", 1, "2026-10-20", "2026-10-22");
    const r = plan([{ ...d, manualDay: day("2026-11-02") } as Task, p]);
    expect(moveOf(r, d.id)?.to.ready).toBe("2026-11-02");
  });

  it("المنجز والمنشور ما بيتحرّكوا", () => {
    const r = plan(post("A", 1, "2026-10-10", "2026-10-12", { done: true, published: true }));
    expect(r.moves).toEqual([]);
  });

  it("كرت شغّال بلّش قبل يوم البداية وموعده لقدّام ما بيتحرّك", () => {
    const [d, p] = post("A", 1, "2026-10-29", "2026-11-02");
    const running = { ...d, workDate: day("2026-10-25"), status: "IN_PROGRESS", board: "DOING" } as Task;
    expect(plan([running, p]).moves).toEqual([]);
  });

  it("حصر بشركة: متأخر الشركة التانية ما بينلمس", () => {
    const r = plan([...post("A", 1, "2026-10-20", "2026-10-22"), ...post("B", 1, "2026-10-20", "2026-10-22")], [company("A", 1), company("B", 2)], { companyIds: ["A"] });
    expect(r.moves.every((m) => m.companyId === "A")).toBe(true);
    expect(r.moves.length).toBeGreaterThan(0);
  });

  it("الشركة الموقوفة ما بينلمس شغلها", () => {
    const r = plan(post("A", 1, "2026-10-20", "2026-10-22"), [company("A", 1, { status: "paused" })]);
    expect(r.moves).toEqual([]);
  });
});

describe("الأولوية والتنبيهات", () => {
  it("شركتان على نفس المصمم: الأعلى أولوية (رقم أصغر) بتاخد يوم البداية", () => {
    const pubs = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-14"];
    const many = (co: string) => pubs.map((pub, i) => post(co, i + 1, "2026-10-20", pub)).flat();
    const r = plan([...many("LOW"), ...many("TOP")], [company("LOW", 9), company("TOP", 1)]);
    const designs = (co: string) => r.moves.filter((m) => m.companyId === co && m.stage === "DESIGN").map((m) => m.to.ready);
    expect(designs("TOP").every((d) => d === "2026-10-27")).toBe(true);
    expect(designs("LOW").every((d) => d === "2026-10-28")).toBe(true);
  });

  it("نشر بعد نهاية الدورة بينعلّم", () => {
    const co = company("A", 1, { publishStartDate: day("2026-10-01") }); // الدورة لحدّ ٣٠/١٠
    const r = plan(post("A", 1, "2026-10-29", "2026-10-30").map((t) => ({ ...t, readyDate: day("2026-10-26"), workDate: day("2026-10-26") }) as Task), [co]);
    const p = moveOf(r, "A|POST|1|P");
    expect(p?.to.publish).toBe("2026-10-29");
    // نفس القطعة بس النشر صار بعد آخر يوم بالدورة
    const late = plan(Array.from({ length: 7 }, (_, i) => post("A", i + 1, "2026-10-20", "2026-10-22")).flat(), [co]);
    expect(late.moves.some((m) => m.warnings.some((w) => w.includes("نهاية الدورة")))).toBe(true);
  });

  it("نفس الداتا = نفس البصمة (المعاينة والتطبيق بيقرو نفس الخطة)", () => {
    const tasks = [...post("A", 1, "2026-10-20", "2026-10-22"), ...reel("A", 1, "2026-10-19", "2026-10-21", "2026-10-23")];
    expect(plan(tasks).fingerprint).toBe(plan(tasks).fingerprint);
    expect(plan(tasks).fingerprint).not.toBe(plan(tasks, undefined, { fromISO: "2026-10-28" }).fingerprint);
  });
});
