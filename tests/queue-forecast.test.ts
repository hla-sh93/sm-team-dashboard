/**
 * «تعبئة الأيام» (خطة التحسينات D) — توقّع الطابور يوماً بيوم بنفس `selectDailyWork`.
 * التواريخ: ١/١١/٢٠٢٦ أحد. دوام الأحد→الخميس.
 */
import { describe, it, expect } from "vitest";
import { forecastQueues } from "@/lib/queue-forecast";

const WEEK = JSON.stringify([0, 1, 2, 3, 4]);
const emp = (id: string, rates: Record<string, number>) =>
  ({ id, name: id, role: "مصمم", hoursPerDay: 8, workDays: WEEK, isScheduled: true, isPhotographer: false, rates: JSON.stringify(rates), color: null, telegramUsername: null, createdAt: new Date(), updatedAt: new Date() }) as never;
const companies = [{ id: "co", name: "Co", priority: 1 }, { id: "vip", name: "VIP", priority: 0 }] as never[];
const d = (iso: string) => {
  const [y, m, dd] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};
let n = 0;
const task = (o: Record<string, unknown>) =>
  ({
    id: `t${++n}`,
    kind: "CONTENT",
    type: "POST",
    stage: "DESIGN",
    title: null,
    hours: 0,
    quantity: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    board: "TODO",
    publishDate: null,
    readyDate: d("2026-11-12"),
    workDate: d("2026-11-10"),
    manualDay: null,
    month: 10,
    year: 2026,
    isPinned: false,
    isAuto: true,
    blockedById: null,
    pipelineKey: null,
    pieceNo: null,
    notes: null,
    brief: "x",
    completedAt: null,
    startedAt: null,
    finishedAt: null,
    companyId: "co",
    assigneeId: "ayman",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  }) as never;

const run = (tasks: never[], employees = [emp("ayman", { POST: 6 })], horizonDays = 10) =>
  forecastQueues({ tasks, employees, companies, fromISO: "2026-11-01", horizonDays });

describe("forecastQueues", () => {
  it("بيعبّي كل يوم دوام لطاقته: ١٢ بوست بمعدّل ٦ ← ٦ الأحد و٦ الاثنين (بدل يوم البداية المخزَّن ١٠/١١)", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => task({ pieceNo: i + 1 }));
    const f = run(tasks);
    const byDay = new Map<string, number>();
    for (const e of f.entries) byDay.set(e.startISO, (byDay.get(e.startISO) ?? 0) + 1);
    expect([...byDay.entries()]).toEqual([
      ["2026-11-01", 6],
      ["2026-11-02", 6],
    ]);
    expect(f.days.every((x) => x.load <= 1 + 1e-9)).toBe(true);
    expect(f.entries.every((e) => e.fromISO === "2026-11-10" && !e.late)).toBe(true);
  });

  it("التسليم بين شخصين: الكتابة الأحد ← التصميم بيبلّش الاثنين، مو قبل", () => {
    const write = task({ id: "w", stage: "WRITE", kind: "CONTENT_WRITING", type: null, assigneeId: "nawal" });
    const design = task({ id: "x", blockedById: "w" });
    const f = run([write, design], [emp("ayman", { POST: 6 }), emp("nawal", { PLAN: 1 })]);
    const at = (id: string) => f.entries.find((e) => e.taskId === id)?.startISO;
    expect(at("w")).toBe("2026-11-01");
    expect(at("x")).toBe("2026-11-02");
  });

  it("الجمعة والسبت ما بيدخلوا: الخميس ٥/١١ ← بعده الأحد ٨/١١", () => {
    const tasks = Array.from({ length: 30 }, (_, i) => task({ pieceNo: i + 1 }));
    const f = run(tasks);
    const used = [...new Set(f.days.map((x) => x.dayISO))];
    expect(used).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    const more = run(Array.from({ length: 36 }, (_, i) => task({ pieceNo: i + 1 })));
    expect(more.days.map((x) => x.dayISO)).toContain("2026-11-08");
    expect(more.days.map((x) => x.dayISO)).not.toContain("2026-11-06");
  });

  it("الاختناق بيبان: كروت ما بتلحق تسليمها بتنعلّم late", () => {
    const tasks = Array.from({ length: 18 }, (_, i) => task({ pieceNo: i + 1, readyDate: d("2026-11-02") }));
    const f = run(tasks);
    expect(f.entries.filter((e) => e.late)).toHaveLength(6); // ٦ يوم الثلاثاء بعد تسليم الاثنين
  });

  it("كرت أكبر من يوم (مهمة يومين) بياخد يومين متتاليين", () => {
    const big = task({ id: "big", kind: "ADHOC", type: null, stage: null, hours: 16, isAuto: false, workDate: null, readyDate: d("2026-11-20") });
    const f = run([big]);
    expect(f.entries[0]).toMatchObject({ startISO: "2026-11-01", endISO: "2026-11-02" });
  });

  it("المستعجل قبل العادي، وشركة الأولوية الأعلى بنفس الموعد", () => {
    const normal = task({ id: "a", readyDate: d("2026-11-03"), pieceNo: 1 });
    const urgent = task({ id: "b", priority: "URGENT", readyDate: d("2026-11-05"), pieceNo: 2 });
    const vip = task({ id: "c", companyId: "vip", readyDate: d("2026-11-03"), pieceNo: 3 });
    const one = run([normal, urgent, vip], [emp("ayman", { POST: 1 })]);
    const order = [...one.entries].sort((x, y) => x.startISO.localeCompare(y.startISO)).map((e) => e.taskId);
    expect(order).toEqual(["b", "c", "a"]);
  });

  it("التصوير على موعده بس: مونتاج ورا تصوير ٤/١١ ما بيبلّش قبل ٥/١١ ولو المونتيرة فاضية", () => {
    const shoot = task({ id: "s", type: "REEL", stage: "SHOOT", assigneeId: "lilas", workDate: d("2026-11-04"), readyDate: d("2026-11-04"), isPinned: true });
    const edit = task({ id: "e", type: "REEL", stage: "EDIT", assigneeId: "alissar", blockedById: "s", workDate: d("2026-11-08"), readyDate: d("2026-11-09") });
    const f = run([shoot, edit], [emp("lilas", { REEL: 6 }), emp("alissar", { REEL: 3 })]);
    const at = (id: string) => f.entries.find((x) => x.taskId === id)?.startISO;
    expect(at("s")).toBe("2026-11-04");
    expect(at("e")).toBe("2026-11-05");
  });

  it("حتمي: نفس المدخل = نفس الناتج؛ والنشر ما بيدخل التوقّع", () => {
    const tasks = [...Array.from({ length: 8 }, (_, i) => task({ pieceNo: i + 1 })), task({ id: "pub", stage: "PUBLISH", publishDate: d("2026-11-04") })];
    expect(run(tasks)).toEqual(run(tasks));
    expect(run(tasks).entries.some((e) => e.taskId === "pub")).toBe(false);
  });
});
