/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — ثوابت «استيراد خطة JSON» على قاعدة معزولة:
 * الذرّية (كل-أو-لا-شي بفرق كامل على جدول Task)، المطابقة بصفّ واحد، العدّادات،
 * الحالة↔الطوابع، الإقفال التتابعي بعد النشر، العزل بين الشركات.
 *
 * العزل متل `plan-update-adhoc-dates.test.ts`: نسخة من `prisma/dev.db` بتنحذف بالآخر،
 * وكل الصفوف المفحوصة لشركتين اصطناعيتين — ما بنعتمد على داتا الإنتاج.
 * `it.fails` = باغ مثبت بالتقرير `docs/qa/deep-test-2026-10-11/plan-update.md`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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
  it.skipIf(skip())("قطعة بلا كرت · عنوان خارج الخطة بلا مطابق · مسؤول غير موجود · وصف لقطعة غير موجودة", async () => {
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

  it.skipIf(skip())("PU-01 مُصلَح: instagramHandle ما بينكتب لما ترفض باقي الحمولة", async () => {
    const r = await apply(payload({ instagramHandle: "leaked.handle", pieceStates: [{ type: "POST", pieceNo: 99, stage: "DESIGN", evidence: EV }] }));
    expect(r.ok).toBe(false);
    const co = await prisma.company.findUnique({ where: { id: A.id } });
    expect(co.instagramHandle).toBe("before.handle");
  });
});

describe("التزامن — تطبيقان بنفس اللحظة (PU-20 مُصلَح)", () => {
  it.skipIf(skip())("دليلان مختلفان على نفس الكرت بنفس اللحظة → السطرين بيضلّوا", async () => {
    const id = key("a_d_post_3");
    await prisma.task.update({ where: { id }, data: { notes: null } });
    const [r1, r2] = await Promise.all([
      apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", evidence: `${EV} — دليل متوازٍ أ` }] })),
      apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", evidence: `${EV} — دليل متوازٍ ب` }] })),
    ]);
    expect(r1.ok && r2.ok, `${r1.error ?? ""} ${r2.error ?? ""}`).toBe(true);
    const notes = (await prisma.task.findUnique({ where: { id } })).notes ?? "";
    expect(notes).toContain("دليل متوازٍ أ");
    expect(notes).toContain("دليل متوازٍ ب");
    await prisma.task.update({ where: { id }, data: { notes: null } });
  });
});

describe("المطابقة — صفّ واحد بالضبط", () => {
  it.skipIf(skip())("PU-03 مُصلَح: صفّان بنفس (النوع·الرقم·المرحلة) → الحمولة بتنرفض متل الفحص المسبق", async () => {
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

  it.skipIf(skip())("الدلو الغلط ما بيطابق، والشركة التانية ما بتنلمس (عزل)", async () => {
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

  it.skipIf(skip())("PU-05: اسم موظف مكرّر → رفض بدل اختيار صامت لآخر واحد", async () => {
    const dup = await prisma.employee.create({ data: { name: `${uniq} مصمّم`, role: "designer-dup", workDays: "[0,1,2,3,4]" } });
    try {
      const r = await apply(payload({ adhocCards: [{ slug: `deep-${P}-dupname`, title: "كرت اسم مكرّر", assignee: `${uniq} مصمّم`, hours: 1, workDate: "2026-09-21", readyDate: "2026-09-21", evidence: EV }] }));
      expect(r.ok).toBe(false);
      expect(r.error).toContain("لأكتر من موظف");
      expect(await prisma.task.count({ where: { id: `adhoc_deep-${P}-dupname` } })).toBe(0);
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
  it.skipIf(skip())("أول تطبيق: affectedRows = الصفوف المتغيّرة + المضافة (وصف البوست صفّان، الريل ثلاثة)", async () => {
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
  it.skipIf(skip())("[PU-04] إعادة التطبيق نفسها: ولا صف يتغيّر — والعدّادات بتعدّ المتغيّر (صفر) لا المطابَق", async () => {
    const before = await dump();
    const r = await apply(mixed());
    expect(r.ok, r.error).toBe(true);
    expect(noChange(diff(before, await dump()))).toBe(true);
    expect([r.describedPieces, r.updatedStates, r.updatedAdhoc, r.updatedAdhocCards, r.affectedRows]).toEqual([0, 0, 0, 0, 0]);
    expect(r.unchangedAdhocCards).toBe(1);
  });
});

describe("الحالة ↔ الطوابع", () => {
  it.skipIf(skip())("PU-02: READY بلا date بياخد طابع إنجاز = موعد الكرت نفسه (بلا تحريك أي موعد) — فبيظهر بالتقارير", async () => {
    const before = await prisma.task.findUnique({ where: { id: key("a_d_post_1") } });
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "READY", evidence: `${EV} ر١` }] }));
    expect(r.ok, r.error).toBe(true);
    const t = await prisma.task.findUnique({ where: { id: key("a_d_post_1") } });
    expect(t.status).toBe("READY");
    const scheduled = before.readyDate ?? before.workDate;
    expect(toISODate(t.completedAt)).toBe(toISODate(scheduled));
    expect(toISODate(t.finishedAt)).toBe(toISODate(scheduled));
    expect([toISODate(t.workDate), toISODate(t.readyDate)]).toEqual([toISODate(before.workDate), toISODate(before.readyDate)]);
    // إعادة التطبيق ما بتحرّك الطابع.
    const again = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "READY", evidence: `${EV} ر١` }] }));
    expect(again.updatedStates).toBe(0);
  });
  it.skipIf(skip())("READY بـdate بيكتب الطوابع الثلاثة ويوم الشغل/الجهوزية؛ وإعادة الفتح بتمحيها وبتضيف الدليل", async () => {
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
  it.skipIf(skip())("[PU-09] IN_PROGRESS مع date مرفوضة (كان التاريخ ينشال بالصمت) — ولا شي بيتغيّر", async () => {
    const before = await dump();
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 2, stage: "DESIGN", status: "IN_PROGRESS", date: "2026-09-10", evidence: `${EV} ق` }] }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("بس مع حالة منجزة");
    expect(noChange(diff(before, await dump()))).toBe(true);
  });
  it.skipIf(skip())("PUBLISHED على كرت النشر بيسكّر مراحل الإنتاج قبله بتاريخ النشر", async () => {
    const r = await apply(payload({ pieceStates: [{ type: "REEL", pieceNo: 1, stage: "PUBLISH", status: "PUBLISHED", date: "2026-09-25", evidence: `${EV} نشر` }] }));
    expect(r.ok, r.error).toBe(true);
    for (const id of ["a_s_reel_1", "a_e_reel_1"]) {
      const t = await prisma.task.findUnique({ where: { id: key(id) } });
      expect(t.status, id).toBe("READY");
      expect(toISODate(t.completedAt), id).toBe("2026-09-25");
    }
  });
  it.skipIf(skip())("PU-11 مُصلَح: الإقفال التتابعي بيكتب دليلاً على الكرت المُقفَل (قاعدة ٢)", async () => {
    const t = await prisma.task.findUnique({ where: { id: key("a_e_reel_1") } });
    expect(t.status).toBe("READY");
    expect((t.notes ?? "").trim()).not.toBe("");
  });
  it.skipIf(skip())("PU-06 مُصلَح: READY على كرت النشر (بتتطبّع PUBLISHED) بتسكّر الإنتاج قبلها كمان", async () => {
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 2, stage: "PUBLISH", status: "READY", date: "2026-09-26", evidence: `${EV} جاهز` }] }));
    expect(r.ok, r.error).toBe(true);
    const pub = await prisma.task.findUnique({ where: { id: key("a_p_post_2") } });
    expect(pub.status).toBe("PUBLISHED");
    const des = await prisma.task.findUnique({ where: { id: key("a_d_post_2") } });
    expect(des.status).toBe("READY");
  });
  it.skipIf(skip())("[PU-12] pinned:false الصريح بيغلب publishDate؛ وبلاه publishDate بيثبّت. [PU-13] PUBLISHED على مرحلة تصميم = READY", async () => {
    await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", pinned: false, publishDate: "2026-10-05", evidence: `${EV} ث` }] }));
    let t = await prisma.task.findUnique({ where: { id: key("a_d_post_3") } });
    expect(t.isPinned).toBe(false);
    expect(toISODate(t.publishDate)).toBe("2026-10-05");
    await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", publishDate: "2026-10-06", evidence: `${EV} ث٢` }] }));
    t = await prisma.task.findUnique({ where: { id: key("a_d_post_3") } });
    expect(t.isPinned).toBe(true);
    await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 3, stage: "DESIGN", status: "PUBLISHED", date: "2026-09-21", evidence: `${EV} م` }] }));
    t = await prisma.task.findUnique({ where: { id: key("a_d_post_3") } });
    expect(t.status).toBe("READY");
    expect(t.board).toBe("DONE");
  });
});

describe("items — الوصف", () => {
  it.skipIf(skip())("[PU-08] items.stage مرفوض فوصف كرت النشر ما بينلمس", async () => {
    await prisma.task.update({ where: { id: key("a_p_post_3") }, data: { brief: "وصف النشر الأصلي" } });
    const r = await apply(payload({ items: [{ type: "POST", pieceNo: 3, stage: "DESIGN", brief: "وصف للتصميم بس" }] }));
    expect(r.ok).toBe(false);
    const pub = await prisma.task.findUnique({ where: { id: key("a_p_post_3") } });
    expect(pub.brief).toBe("وصف النشر الأصلي");
  });
});

describe("[PU-02 · مراجعة F–H] منجز بلا date موعده بالمستقبل → الطابع اليوم، مو الموعد", () => {
  // «اليوم» ١٥/٩ ودورة الكروت موعدها ٢٠/٩ (تصميم) و٢٨/٩ (نشر): الكرت انسكّر اليوم، فطابعه
  // اليوم — كان ينختم بموعده فيغيب عن تقرير ٢٠:٠٠ وبينعدّ بفترة جاية (عكس OP-07).
  beforeAll(async () => {
    if (skip()) return;
    await prisma.task.createMany({
      data: [7, 8].flatMap((n) => [
        piece(`a_d_post_${n}`, "POST", n, "DESIGN", "2026-09-20"),
        piece(`a_p_post_${n}`, "POST", n, "PUBLISH", "2026-09-28"),
      ]),
    });
  });
  afterEach(() => vi.useRealTimers());

  it.skipIf(skip())("READY على تصميم موعده ٢٠/٩، يوم ١٥/٩ → completedAt/finishedAt = ١٥/٩", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T09:00:00Z"));
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 7, stage: "DESIGN", status: "READY", evidence: `${EV} مستقبل` }] }));
    expect(r.ok, r.error).toBe(true);
    const t = await prisma.task.findUnique({ where: { id: key("a_d_post_7") } });
    expect([t.completedAt, t.finishedAt, t.startedAt].map(toISODate)).toEqual(Array(3).fill("2026-09-15"));
    // المواعيد نفسها ما بتتحرّك.
    expect(toISODate(t.readyDate)).toBe("2026-09-20");
  });

  it.skipIf(skip())("PUBLISHED بلا date على نشر موعده ٢٨/٩، يوم ١٥/٩ → النشر والتصميم قبله بطابع ١٥/٩ (الإنتاج ما بيخلص بعد النشر)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T09:00:00Z"));
    const r = await apply(payload({ pieceStates: [{ type: "POST", pieceNo: 8, stage: "PUBLISH", status: "PUBLISHED", evidence: `${EV} نشر مستقبل` }] }));
    expect(r.ok, r.error).toBe(true);
    const pub = await prisma.task.findUnique({ where: { id: key("a_p_post_8") } });
    const des = await prisma.task.findUnique({ where: { id: key("a_d_post_8") } });
    expect(pub.status).toBe("PUBLISHED");
    expect(toISODate(pub.completedAt)).toBe("2026-09-15");
    expect(des.board).toBe("DONE");
    expect(toISODate(des.completedAt)).toBe("2026-09-15");
    expect(des.completedAt.getTime()).toBeLessThanOrEqual(pub.completedAt.getTime());
  });
});

describe("[PU-13 · مراجعة F–H] سطر adhocStates بلا stage بيتطبّع بمرحلة الكرت يلي طابقه", () => {
  beforeAll(async () => {
    if (skip()) return;
    const adhoc = (id: string, stage: string, title: string) => ({
      id: key(id), kind: "ADHOC", stage, title, status: "NOT_STARTED", board: "TODO", quantity: 1, isAuto: false,
      year: Y, month: M, companyId: A.id, assigneeId: designerId, hours: 1,
      workDate: fromISODate("2026-09-10"), readyDate: fromISODate("2026-09-10"), publishDate: fromISODate("2026-09-12"),
    });
    await prisma.task.createMany({
      data: [adhoc("adh_design", "DESIGN", `تصميم إضافي ${uniq}`), adhoc("adh_publish", "PUBLISH", `نشر إضافي ${uniq}`)],
    });
  });

  it.skipIf(skip())("«PUBLISHED» على كرت تصميم → جاهز (مو منشور)؛ «READY» على كرت نشر → منشور بيوم النشر", async () => {
    const r = await apply(payload({
      adhocStates: [
        { title: `تصميم إضافي ${uniq}`, status: "PUBLISHED", date: "2026-09-10", evidence: `${EV} بلا مرحلة ١` },
        { title: `نشر إضافي ${uniq}`, status: "READY", date: "2026-09-12", evidence: `${EV} بلا مرحلة ٢` },
      ],
    }));
    expect(r.ok, r.error).toBe(true);
    const design = await prisma.task.findUnique({ where: { id: key("adh_design") } });
    const publish = await prisma.task.findUnique({ where: { id: key("adh_publish") } });
    expect(design.status).toBe("READY");
    expect(publish.status).toBe("PUBLISHED");
    expect(toISODate(publish.publishDate)).toBe("2026-09-12");
    // يوم الشغل تبع كرت النشر ما بيتحرّك على تاريخ النشر — التاريخ للنشر.
    expect(toISODate(publish.workDate)).toBe("2026-09-10");
  });
});
