/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — ثوابت «استيراد خطة JSON» على قاعدة معزولة:
 * الذرّية (كل-أو-لا-شي بفرق كامل على جدول Task)، المطابقة بصفّ واحد، العدّادات،
 * الحالة↔الطوابع، الإقفال التتابعي بعد النشر، العزل بين الشركات.
 *
 * العزل متل `plan-update-adhoc-dates.test.ts`: نسخة من `prisma/dev.db` بتنحذف بالآخر،
 * وكل الصفوف المفحوصة لشركتين اصطناعيتين — ما بنعتمد على داتا الإنتاج.
 * `it.fails` = باغ مثبت بالتقرير `docs/qa/deep-test-2026-10-11/plan-update.md`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-pu-inv-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({ assertAdmin: async () => {}, requireAdminPage: async () => {}, isAuthenticated: async () => true }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

type Row = Record<string, unknown>;
let prisma: any;
let apply: (input: unknown) => Promise<any>;
let fromISODate: (s: string) => Date;
let toISODate: (d: Date) => string;

const P = `dpu${process.pid}`;
const uniq = `فحص-عميق-${process.pid}`;
const A = { name: `${uniq} أ`, id: "" };
const B = { name: `${uniq} ب`, id: "" };
const Y = 2026, M = 8;
const EV = "فحص عميق ١٢/١٠ — دليل";
const skip = () => !scratch.available;
let designerId = "";

const key = (s: string) => `${P}_${s}`;

async function dump(): Promise<Map<string, Row>> {
  const rows: Row[] = await prisma.task.findMany({ where: { companyId: { in: [A.id, B.id] } } });
  return new Map(rows.map((r) => [String(r.id), r]));
}
const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? "∅" : typeof v === "string" ? v : JSON.stringify(v));
function diff(before: Map<string, Row>, after: Map<string, Row>) {
  const changed: string[] = [];
  for (const [id, a] of before) {
    const b = after.get(id);
    if (!b) continue;
    for (const col of Object.keys(a)) if (col !== "updatedAt" && norm(a[col]) !== norm(b[col])) { changed.push(id); break; }
  }
  return { changed, added: [...after.keys()].filter((k) => !before.has(k)), removed: [...before.keys()].filter((k) => !after.has(k)) };
}
const noChange = (d: ReturnType<typeof diff>) => d.changed.length + d.added.length + d.removed.length === 0;
const payload = (extra: Record<string, unknown>) => ({ companyId: A.id, year: Y, month: M, ...extra });
const piece = (id: string, type: string, no: number, stage: string, day: string, extra: Record<string, unknown> = {}) => ({
  id: key(id), kind: "CONTENT", stage, type, pieceNo: no, isAuto: true, pipelineKey: `${A.id}|${type}|${no}`,
  title: `${type} ${no} ${stage}`, status: "NOT_STARTED", board: "TODO", quantity: 1, year: Y, month: M, companyId: A.id,
  workDate: fromISODate(day), readyDate: fromISODate(day), publishDate: fromISODate("2026-09-28"), ...extra,
});

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply } = await import("@/server/plan-update"));
  ({ fromISODate, toISODate } = await import("@/lib/dates"));
  designerId = (await prisma.employee.create({ data: { name: `${uniq} مصمّم`, role: "designer", workDays: "[0,1,2,3,4]" } })).id;
  A.id = (await prisma.company.create({ data: { name: A.name, managed: true, posts: 3, reels: 1, publishStartDate: fromISODate("2026-09-01"), contentSupplied: true, instagramHandle: "before.handle" } })).id;
  B.id = (await prisma.company.create({ data: { name: B.name, managed: true, posts: 1, publishStartDate: fromISODate("2026-09-01"), contentSupplied: true } })).id;
  await prisma.task.createMany({
    data: [
      ...[1, 2, 3].flatMap((n) => [piece(`a_d_post_${n}`, "POST", n, "DESIGN", "2026-09-20"), piece(`a_p_post_${n}`, "POST", n, "PUBLISH", "2026-09-28")]),
      piece("a_s_reel_1", "REEL", 1, "SHOOT", "2026-09-18"),
      piece("a_e_reel_1", "REEL", 1, "EDIT", "2026-09-22"),
      piece("a_p_reel_1", "REEL", 1, "PUBLISH", "2026-09-28"),
      { id: key("a_manual"), kind: "ADHOC", title: `كرت يدوي ${uniq}`, status: "NOT_STARTED", board: "TODO", quantity: 1, isAuto: false, year: Y, month: M, companyId: A.id, assigneeId: designerId, hours: 2, workDate: fromISODate("2026-09-21"), readyDate: fromISODate("2026-09-21") },
      { ...piece("b_d_post_1", "POST", 1, "DESIGN", "2026-09-20"), companyId: B.id, pipelineKey: `${B.id}|POST|1` },
      { ...piece("b_p_post_1", "POST", 1, "PUBLISH", "2026-09-28"), companyId: B.id, pipelineKey: `${B.id}|POST|1` },
    ],
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { OR: [{ companyId: { in: [A.id, B.id] } }, { id: { startsWith: `adhoc_deep-${P}` } }] } });
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.employee.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe("الذرّية — بند واحد غلط = ولا صف يتغيّر", () => {
  it("قطعة بلا كرت · عنوان خارج الخطة بلا مطابق · مسؤول غير موجود · وصف لقطعة غير موجودة", async () => {
    if (skip()) return;
    const bad = [
      payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "IN_PROGRESS", evidence: EV }, { type: "POST", pieceNo: 99, stage: "DESIGN", evidence: EV }] }),
      payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "IN_PROGRESS", evidence: EV }], adhocStates: [{ title: "عنوان مو موجود أبداً", evidence: EV }] }),
      payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "IN_PROGRESS", evidence: EV }], adhocCards: [{ slug: `deep-${P}-x`, title: "كرت", assignee: "لا أحد", hours: 1, workDate: "2026-09-21", readyDate: "2026-09-21", evidence: EV }] }),
      payload({ items: [{ type: "POST", pieceNo: 1, brief: "وصف" }, { type: "POST", pieceNo: 99, brief: "وصف" }] }),
      payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "DONE", evidence: EV }] }),
    ];
    for (const p of bad) {
      const before = await dump();
      const r = await apply(p);
      expect(r.ok).toBe(false);
      expect(noChange(diff(before, await dump())), JSON.stringify(p).slice(0, 80)).toBe(true);
    }
  });

  it.fails("PU-01: instagramHandle ما لازم ينكتب لما ترفض باقي الحمولة", async () => {
    if (skip()) throw new Error("skip");
    const r = await apply(payload({ instagramHandle: "leaked.handle", pieceStates: [{ type: "POST", pieceNo: 99, stage: "DESIGN", evidence: EV }] }));
    expect(r.ok).toBe(false);
    const co = await prisma.company.findUnique({ where: { id: A.id } });
    expect(co.instagramHandle).toBe("before.handle");
  });
});

describe("المطابقة — صفّ واحد بالضبط", () => {
  it.fails("PU-03: صفّان بنفس (النوع·الرقم·المرحلة) → الحمولة لازم تنرفض متل ما بيقول الفحص المسبق", async () => {
    if (skip()) throw new Error("skip");
    const orig = await prisma.task.findUnique({ where: { id: key("a_d_post_3") } });
    const { id: _i, ...rest } = orig;
    await prisma.task.create({ data: { ...rest, id: key("a_d_post_3_dup") } });
    try {
      const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", status: "IN_PROGRESS", evidence: EV }] }));
      expect(r.ok).toBe(false);
    } finally {
      await prisma.task.delete({ where: { id: key("a_d_post_3_dup") } });
      await prisma.task.update({ where: { id: key("a_d_post_3") }, data: { status: "NOT_STARTED", board: "TODO", notes: null } });
    }
  });

  it("الدلو الغلط ما بيطابق، والشركة التانية ما بتنلمس (عزل)", async () => {
    if (skip()) return;
    const before = await dump();
    const r = await apply({ ...payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", evidence: EV }] }), month: 9 });
    expect(r.ok).toBe(false);
    expect(noChange(diff(before, await dump()))).toBe(true);
    const r2 = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", evidence: `${EV} عزل` }] }));
    expect(r2.ok, r2.error).toBe(true);
    const d = diff(before, await dump());
    expect(d.changed).toEqual([key("a_d_post_1")]);
    const bRows = await prisma.task.findMany({ where: { companyId: B.id } });
    expect(bRows.every((t: any) => t.notes == null && t.status === "NOT_STARTED")).toBe(true);
  });

  it.fails("PU-05: اسم موظف مكرّر → رفض بدل اختيار صامت لآخر واحد", async () => {
    if (skip()) throw new Error("skip");
    const dup = await prisma.employee.create({ data: { name: `${uniq} مصمّم`, role: "designer-dup", workDays: "[0,1,2,3,4]" } });
    try {
      const r = await apply(payload({ adhocCards: [{ slug: `deep-${P}-dupname`, title: "كرت اسم مكرّر", assignee: `${uniq} مصمّم`, hours: 1, workDate: "2026-09-21", readyDate: "2026-09-21", evidence: EV }] }));
      expect(r.ok).toBe(false);
    } finally {
      await prisma.task.deleteMany({ where: { id: `adhoc_deep-${P}-dupname` } });
      await prisma.employee.delete({ where: { id: dup.id } });
    }
  });
});

describe("العدّادات", () => {
  const mixed = () =>
    payload({
      items: [{ type: "POST", pieceNo: 2, brief: "وصف بوست ٢" }, { type: "REEL", pieceNo: 1, brief: "وصف ريل ١" }],
      pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", status: "IN_PROGRESS", evidence: EV }],
      adhocStates: [{ title: `كرت يدوي ${uniq}`, hours: 3, evidence: EV }],
      adhocCards: [{ slug: `deep-${P}-c1`, title: "كرت جديد", assignee: `${uniq} مصمّم`, hours: 1, workDate: "2026-09-21", readyDate: "2026-09-21", evidence: EV }],
    });
  it("أول تطبيق: affectedRows = الصفوف المتغيّرة + المضافة (وصف البوست صفّان، الريل ثلاثة)", async () => {
    if (skip()) return;
    const before = await dump();
    const r = await apply(mixed());
    expect(r.ok, r.error).toBe(true);
    const d = diff(before, await dump());
    expect(r.describedPieces).toBe(2);
    expect(r.updatedStates).toBe(1);
    expect(r.updatedAdhoc).toBe(1);
    expect(r.createdAdhocCards).toBe(1);
    expect(d.added).toEqual([`adhoc_deep-${P}-c1`]);
    expect(d.changed.length).toBe(2 + 3 + 1 + 1);
    expect(r.affectedRows).toBe(d.changed.length + d.added.length);
  });
  it("إعادة التطبيق نفسها: ولا صف يتغيّر — بس العدّادات بتعدّ المطابَق لا المتغيّر (PU-04، توثيق)", async () => {
    if (skip()) return;
    const before = await dump();
    const r = await apply(mixed());
    expect(r.ok, r.error).toBe(true);
    expect(noChange(diff(before, await dump()))).toBe(true);
    // السلوك الحالي الموثَّق: الرسالة رح تقول «2 وصفاً · 1 حالة قطعة · 1 كرتاً خارج الخطة · 1 كرتاً خارج الخطة معاد توقيته»
    expect(r.affectedRows).toBeGreaterThan(0);
    expect(r.updatedAdhocCards).toBe(1);
  });
});

describe("الحالة ↔ الطوابع", () => {
  it.fails("PU-02: READY بلا date لازم ياخد طابع إنجاز (وإلا ما بيظهر بأي تقرير دوري)", async () => {
    if (skip()) throw new Error("skip");
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "READY", evidence: `${EV} ر١` }] }));
    expect(r.ok, r.error).toBe(true);
    const t = await prisma.task.findUnique({ where: { id: key("a_d_post_1") } });
    expect(t.status).toBe("READY");
    expect(t.completedAt).not.toBeNull();
  });
  it("READY بـdate بيكتب الطوابع الثلاثة ويوم الشغل/الجهوزية؛ وإعادة الفتح بتمحيها وبتضيف الدليل", async () => {
    if (skip()) return;
    await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "READY", date: "2026-09-19", evidence: `${EV} ر٢` }] }));
    let t = await prisma.task.findUnique({ where: { id: key("a_d_post_1") } });
    expect([t.startedAt, t.finishedAt, t.completedAt, t.workDate, t.readyDate].map(toISODate)).toEqual(Array(5).fill("2026-09-19"));
    expect(t.board).toBe("DONE");
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "NOT_STARTED", evidence: `${EV} فتح` }] }));
    expect(r.ok).toBe(true);
    t = await prisma.task.findUnique({ where: { id: key("a_d_post_1") } });
    expect([t.startedAt, t.finishedAt, t.completedAt]).toEqual([null, null, null]);
    expect(t.board).toBe("TODO");
    expect(t.notes.split("\n")).toContain(`${EV} فتح`);
  });
  it("IN_PROGRESS مع date: التاريخ بينشال بالصمت (PU-09، توثيق) — ولا طابع ولا نقل يوم", async () => {
    if (skip()) return;
    const before = await prisma.task.findUnique({ where: { id: key("a_d_post_2") } });
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 2, stage: "DESIGN", status: "IN_PROGRESS", date: "2026-09-10", evidence: `${EV} ق` }] }));
    expect(r.ok).toBe(true);
    const t = await prisma.task.findUnique({ where: { id: key("a_d_post_2") } });
    expect(t.status).toBe("IN_PROGRESS");
    expect(t.startedAt).toBeNull();
    expect(toISODate(t.workDate)).toBe(toISODate(before.workDate));
  });
  it("PUBLISHED على كرت النشر بيسكّر مراحل الإنتاج قبله بتاريخ النشر", async () => {
    if (skip()) return;
    const r = await apply(payload({ pieceStates: [{ type: "REEL", pieceNo: 1, stage: "PUBLISH", status: "PUBLISHED", date: "2026-09-25", evidence: `${EV} نشر` }] }));
    expect(r.ok, r.error).toBe(true);
    for (const id of ["a_s_reel_1", "a_e_reel_1"]) {
      const t = await prisma.task.findUnique({ where: { id: key(id) } });
      expect(t.status, id).toBe("READY");
      expect(toISODate(t.completedAt), id).toBe("2026-09-25");
    }
  });
  it.fails("PU-11: الإقفال التتابعي لازم يكتب دليلاً على الكرت المُقفَل (قاعدة ٢)", async () => {
    if (skip()) throw new Error("skip");
    const t = await prisma.task.findUnique({ where: { id: key("a_e_reel_1") } });
    expect(t.status).toBe("READY");
    expect((t.notes ?? "").trim()).not.toBe("");
  });
  it.fails("PU-06: READY على كرت النشر (بتتطبّع PUBLISHED) لازم تسكّر الإنتاج قبلها كمان", async () => {
    if (skip()) throw new Error("skip");
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 2, stage: "PUBLISH", status: "READY", date: "2026-09-26", evidence: `${EV} جاهز` }] }));
    expect(r.ok, r.error).toBe(true);
    const pub = await prisma.task.findUnique({ where: { id: key("a_p_post_2") } });
    expect(pub.status).toBe("PUBLISHED");
    const des = await prisma.task.findUnique({ where: { id: key("a_d_post_2") } });
    expect(des.status).toBe("READY");
  });
  it("pinned:false مع publishDate → التثبيت بيغلب (PU-12، توثيق)؛ وPUBLISHED على مرحلة تصميم بتنحفظ حرفياً (PU-13، توثيق)", async () => {
    if (skip()) return;
    await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", pinned: false, publishDate: "2026-10-05", evidence: `${EV} ث` }] }));
    let t = await prisma.task.findUnique({ where: { id: key("a_d_post_3") } });
    expect(t.isPinned).toBe(true);
    await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", status: "PUBLISHED", date: "2026-09-21", evidence: `${EV} م` }] }));
    t = await prisma.task.findUnique({ where: { id: key("a_d_post_3") } });
    expect(t.status).toBe("PUBLISHED");
  });
});

describe("items — الوصف", () => {
  it("items.stage بينشال بالصمت فالوصف بيكتب على كل مراحل القطعة (PU-08، توثيق الأثر)", async () => {
    if (skip()) return;
    await prisma.task.update({ where: { id: key("a_p_post_3") }, data: { brief: "وصف النشر الأصلي" } });
    const r = await apply(payload({ items: [{ type: "POST", pieceNo: 3, stage: "DESIGN", brief: "وصف للتصميم بس" }] }));
    expect(r.ok, r.error).toBe(true);
    const pub = await prisma.task.findUnique({ where: { id: key("a_p_post_3") } });
    expect(pub.brief).toBe("وصف للتصميم بس");
  });
});
