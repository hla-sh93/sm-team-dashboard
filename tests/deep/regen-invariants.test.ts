/**
 * الفحص العميق — محرّك إعادة التوليد · ثوابت ما بين التوليدات (قاعدة معزولة)
 *
 *   • عزل `onlyCompanyId`: توليد شركة وحدة = صفر صفّ متغيّر عند غيرها (كل
 *     الأعمدة والمعرّفات، والجلسات، والكروت اليدوية) — مقارنة جدول كامل.
 *   • المنجز ما بيدفع الشغل المفتوح: إنهاء كرت ما بيأخّر ولا كرت مفتوح
 *     (متماثل: نفس الخطة ± إنجاز).
 *   • كرت يدوي منجز ما بيعود يتحرّك، والمفتوح بينحشر على أيام دوام صاحبه.
 *   • RG-08 (توصيف): كرت يدوي منجز مثبّت بيحجز طاقة يومه متل المفتوح.
 *   • RG-09 (توصيف): التوليد المحصور بيترك غيرها «قديمة» لأول توليد عام.
 *   • حالة جلسة التصوير بتصمد ولو تزحزح موعدها (مطابقة بالموضع بعد ما ينكسر
 *     `detKey`).
 *   • الترقيم مرساته خطة المحرّك مو التثبيت: تثبيت يوم نشر بوست ١ بعد بوست ٣
 *     ما بيبدّل الأرقام ولا الحالات.
 *
 * التقنيات: متماثلات (metamorphic) · ثوابت/تكافؤ · قيم حدّية.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { resolve } = await import("node:path");
  return { target: resolve(process.cwd(), "prisma", `test-deep-regen-invariants-${process.pid}.db`) };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {},
  requireAdminPage: async () => {},
  isAuthenticated: async () => true,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

import {
  createSchema,
  seedTeam,
  makeCompany,
  removeDb,
  TEAM,
  D,
  day,
  autoCards,
  pieceCards,
  relationViolations,
  tableSnapshot,
  diffSnapshots,
} from "./regen-fixture";

type Prisma = import("@prisma/client").PrismaClient;
let prisma: Prisma;
let gen: (y: number, m: number, only: string | null) => Promise<{ ok: boolean; error?: string }>;
let actions: typeof import("@/server/actions/tasks");

async function genOk(y: number, m: number, only: string | null = null) {
  const r = await gen(y, m, only);
  expect(r.ok, r.error).toBe(true);
  expect(await relationViolations(prisma)).toEqual([]);
}

/** كل أعمدة الصف (إلا ختمي الإنشاء/التعديل) — أدقّ من بصمة الحفظ. */
async function fullRows(where: Record<string, unknown>) {
  const rows = await prisma.task.findMany({ where, orderBy: { id: "asc" } });
  return new Map(
    rows.map((r) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = r;
      return [r.id, JSON.stringify(rest)];
    }),
  );
}
async function sessionRows(where: Record<string, unknown>) {
  const rows = await prisma.photoSession.findMany({ where, orderBy: { id: "asc" } });
  return rows.map((s) => `${s.companyId}|${s.kind}|${s.no}|${s.status}|${day(s.shootDate)}|${s.detKey}`);
}

beforeAll(async () => {
  prisma = (await import("@/lib/db")).prisma;
  await createSchema(prisma);
  await seedTeam(prisma);
  ({ generateScheduleInternal: gen } = (await import("@/server/schedule-engine")) as never);
  actions = await import("@/server/actions/tasks");
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeDb(scratch.target);
});

describe("عزل onlyCompanyId — مقارنة جدول كامل", () => {
  const Y = 2026;
  const M = 8;
  const A = "c_scope_a";
  const B = "c_scope_b";

  it("توليد الشركة A وحدها بعد تغيير خطتها وحالاتها: صفر تغيير على B (معرّفات وكل الأعمدة والجلسات واليدوي)", async () => {
    await makeCompany(prisma, A, { reels: 2 });
    await makeCompany(prisma, B, { reels: 2, defaultOwnerId: TEAM.designer.id });
    await prisma.task.create({
      data: { id: "manual_scope_b", kind: "ADHOC", title: "يدوي B", companyId: B, assigneeId: TEAM.designer.id, hours: 8, year: Y, month: M, isAuto: false, notes: "ب" },
    });
    await genOk(Y, M);
    const b1 = (await pieceCards(prisma, B, "POST", 1)).production!;
    expect((await actions.updateTaskStatus(b1.id, "READY")).ok).toBe(true);
    // updateTaskStatus ما بيعيد التوليد — منثبّت الحالة كنقطة انطلاق
    await genOk(Y, M);

    const bRows = await fullRows({ companyId: B });
    const bSessions = await sessionRows({ companyId: B });
    const aBefore = await tableSnapshot(prisma, { companyId: A });

    // تغيير على A: عدد أكبر + منجز + زحزحة بداية النشر
    await prisma.company.update({ where: { id: A }, data: { posts: 5, publishStartDate: D(2026, 9, 3) } });
    const a2 = (await pieceCards(prisma, A, "POST", 2)).production!;
    expect((await actions.updateTaskStatus(a2.id, "READY")).ok).toBe(true);
    await genOk(Y, M, A);

    expect(diffSnapshots(bRows, await fullRows({ companyId: B }))).toEqual([]);
    expect(await sessionRows({ companyId: B })).toEqual(bSessions);
    // و A فعلاً تغيّرت (الفحص مو فاضي)
    expect(diffSnapshots(aBefore, await tableSnapshot(prisma, { companyId: A })).length).toBeGreaterThan(0);
    const posts = (await autoCards(prisma, A, Y, M)).filter((c) => c.type === "POST");
    expect([...new Set(posts.map((c) => c.pieceNo))].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("وتوليد A للمرة التانية متكافئ (صفر فرق على كل الجدول)", async () => {
    const all = await fullRows({});
    await genOk(Y, M, A);
    expect(diffSnapshots(all, await fullRows({}))).toEqual([]);
  });
});

describe("RG-09 · التوليد المحصور بيترك الشركات التانية «قديمة» — بتتزحزح بأول توليد عام لاحق (توصيف)", () => {
  // نسخة اصطناعية من حادثة ١١/١٠ ١٢:٤٢ (BW تشرين ±يوم): تجديد Phoenitech دخّلها
  // دلو تشرين بتوليد محصور (prod-61/63)، فتغيّر موضع BW بين شركات الدلو
  // (`offset = coIdx*2` بـ`scheduler.ts`) بلا ما تنكتب صفوفها. أول توليد عام —
  // إنشاء كرت يدوي بأي شركة — طبّق الفرق. إعادة تشغيل لقطة ١٢:٠٤ محلياً بتطلع
  // نتيجة الإنتاج ١٢:٤٦ حرفياً (٠ فرق من ٢٩)، فالمحرّك حتمي والسبب المدخلات.
  const Y = 2039;
  const M = 2;
  const LATE = "c_stale_b";
  const EARLY = "c_stale_a";

  it("شركة جديدة أسبق بالأولوية بتنبني لحالها: صفوف B ما بتتغيّر هلّق، وبتتزحزح بأول توليد عام", async () => {
    await makeCompany(prisma, LATE, { reels: 0, stories: 2, contractStartDate: D(Y, M + 1, 1), publishStartDate: D(Y, M + 1, 1), priority: 50 });
    await genOk(Y, M, null);
    const before = await tableSnapshot(prisma, { companyId: LATE });
    await makeCompany(prisma, EARLY, { reels: 0, stories: 2, contractStartDate: D(Y, M + 1, 1), publishStartDate: D(Y, M + 1, 1), priority: 1 });
    await genOk(Y, M, EARLY);
    expect(diffSnapshots(before, await tableSnapshot(prisma, { companyId: LATE }))).toEqual([]);
    const dates = async () =>
      new Map(
        (await autoCards(prisma, LATE)).map((c) => [
          `${c.type}#${c.pieceNo}|${c.stage}`,
          `${day(c.workDate)}|${day(c.publishDate)}`,
        ]),
      );
    const datesBefore = await dates();
    // «أي تعديل كرت» = generateScheduleInternal(y, m, null)
    await genOk(Y, M, null);
    const datesAfter = await dates();
    const shifted = [...datesBefore].filter(([k, v]) => datesAfter.get(k) !== v);
    expect(shifted.length, "مواعيد B (بالقطعة، مو بالمعرّف) تزحزحت").toBeGreaterThan(0);
    // وبعدها متكافئ
    const settled = await tableSnapshot(prisma);
    await genOk(Y, M, null);
    expect(diffSnapshots(settled, await tableSnapshot(prisma))).toEqual([]);
  });
});

describe("المنجز ما بيحجز طاقة مستقبلية — متماثل «نفس الخطة ± إنجاز»", () => {
  const Y = 2036;
  const M = 2;
  const CO = "c_capacity";

  it("إنهاء تصميمين ما بيأخّر ولا كرت مفتوح (ولا بيغيّر يوم أي كرت مفتوح)", async () => {
    await makeCompany(prisma, CO, {
      posts: 8,
      stories: 6,
      reels: 0,
      contractStartDate: D(Y, M + 1, 1),
      publishStartDate: D(Y, M + 1, 1),
    });
    await genOk(Y, M, CO);
    const key = (c: { type: string | null; pieceNo: number | null; stage: string | null }) => `${c.type}#${c.pieceNo}|${c.stage}`;
    const before = new Map((await autoCards(prisma, CO)).map((c) => [key(c), day(c.workDate)]));
    for (const [type, no] of [["POST", 5], ["STORY", 2]] as const) {
      const p = (await pieceCards(prisma, CO, type, no)).production!;
      expect((await actions.updateTaskStatus(p.id, "READY")).ok).toBe(true);
    }
    await genOk(Y, M, CO);
    const later: string[] = [];
    for (const c of await autoCards(prisma, CO)) {
      if (c.board === "DONE") continue;
      const was = before.get(key(c));
      if (was && day(c.workDate)! > was) later.push(`${key(c)} ${was} → ${day(c.workDate)}`);
      expect(day(c.workDate), key(c)).toBe(was);
    }
    expect(later).toEqual([]);
  });

  it("كرت يدوي منجز غير مثبّت ما بيرجع يتحرّك بالتوليد (سجلّ مو خطة)، والمفتوح بينحشر على يوم دوام", async () => {
    // السبت ٧/٣/٢٠٣٦ يوم عطلة: المنجز عليه بيضل عليه، المفتوح بينسحب ليوم دوام
    const sat = D(Y, M + 1, 8);
    expect(sat.getDay()).toBe(6);
    await prisma.task.create({
      data: { id: "adhoc_done_sat", kind: "ADHOC", title: "منجز يوم سبت", companyId: CO, assigneeId: TEAM.designer.id, hours: 8, year: Y, month: M, isAuto: false, status: "READY", board: "DONE", workDate: sat, readyDate: sat, finishedAt: sat, completedAt: sat, startedAt: sat },
    });
    await prisma.task.create({
      data: { id: "adhoc_open_sat", kind: "ADHOC", title: "مفتوح يوم سبت", companyId: CO, assigneeId: TEAM.designer.id, hours: 8, year: Y, month: M, isAuto: false, workDate: sat, readyDate: D(Y, M + 1, 20) },
    });
    await genOk(Y, M, null);
    const done = await prisma.task.findUniqueOrThrow({ where: { id: "adhoc_done_sat" } });
    const open = await prisma.task.findUniqueOrThrow({ where: { id: "adhoc_open_sat" } });
    expect(day(done.workDate)).toBe(day(sat));
    expect([0, 1, 2, 3, 4]).toContain(open.workDate!.getDay());
  });
});

describe("RG-08 · كرت يدوي منجز بيحجز طاقة يومه متل المفتوح (توصيف — قرار قائدة)", () => {
  const Y = 2050;
  const M = 2;
  const CO = "c_capacity_adhoc";

  it("كرت يدوي منجز ٨ س مثبّت على يوم تصميم بوست ٣ بيزيح نفس الكروت يلي بيزيحها كرت مفتوح", async () => {
    await makeCompany(prisma, CO, {
      posts: 10,
      stories: 10,
      reels: 0,
      contractStartDate: D(Y, M + 1, 1),
      publishStartDate: D(Y, M + 1, 1),
    });
    const snap = async () =>
      (await autoCards(prisma, CO))
        .filter((c) => c.stage !== "WRITE" && c.assigneeId === TEAM.designer.id)
        .map((c) => `${c.type}#${c.pieceNo}:${day(c.workDate)}`)
        .sort();
    await genOk(Y, M, null);
    const base = await snap();
    const X = (await pieceCards(prisma, CO, "POST", 3)).production!.workDate!;
    const moved: Record<string, string[]> = {};
    for (const kind of ["done", "open"] as const) {
      await prisma.task.deleteMany({ where: { id: { startsWith: "adhoc_cap_" } } });
      await prisma.task.create({
        data: {
          id: `adhoc_cap_${kind}`,
          kind: "ADHOC",
          title: kind === "done" ? "شغل خلص" : "شغل جاي",
          companyId: CO,
          assigneeId: TEAM.designer.id,
          hours: 8,
          year: Y,
          month: M,
          isAuto: false,
          isPinned: true,
          workDate: X,
          readyDate: X,
          ...(kind === "done" ? { status: "READY", board: "DONE", startedAt: X, finishedAt: X, completedAt: X } : {}),
        },
      });
      await genOk(Y, M, null);
      const now = await snap();
      moved[kind] = base.filter((v, i) => v !== now[i]);
    }
    // المفتوح لازم يزيح (الفحص حسّاس)، والمنجز اليوم بيزيح **نفس** الكروت —
    // يعني السجلّ بيحجز طاقة يومه. تفضيل القائدة المسجَّل: المنجز ما بيحجز طاقة.
    expect(moved.open.length).toBeGreaterThan(0);
    expect(moved.done).toEqual(moved.open);
    await prisma.task.deleteMany({ where: { id: { startsWith: "adhoc_cap_" } } });
  });
});

describe("جلسات التصوير — الحالة بتصمد ولو انكسر detKey", () => {
  const Y = 2037;
  const M = 2;
  const CO = "c_sessions";

  it("جلسة «تم التصوير» بتضل SHOT بعد زحزحة العقد ٣ أيام (مطابقة company|kind|no)", async () => {
    await makeCompany(prisma, CO, {
      posts: 0,
      stories: 0,
      reels: 4,
      contractStartDate: D(Y, M + 1, 1),
      publishStartDate: D(Y, M + 1, 1),
    });
    await genOk(Y, M, CO);
    const s1 = await prisma.photoSession.findFirstOrThrow({ where: { companyId: CO, no: 1 } });
    expect((await actions.updatePhotoSessionStatus(s1.id, "SHOT")).ok).toBe(true);
    await prisma.company.update({
      where: { id: CO },
      data: { contractStartDate: D(Y, M + 1, 4), publishStartDate: D(Y, M + 1, 4) },
    });
    await genOk(Y, M, CO);
    const after = await prisma.photoSession.findMany({ where: { companyId: CO }, orderBy: { no: "asc" } });
    const first = after.find((s) => s.no === 1)!;
    expect(first.detKey).not.toBe(s1.detKey); // المفتاح انكسر فعلاً
    expect(first.status).toBe("SHOT");
    expect(after.filter((s) => s.no !== 1).every((s) => s.status === "NOT_STARTED")).toBe(true);
  });
});

describe("الترقيم — مرساته خطة المحرّك مو التاريخ المثبّت", () => {
  const Y = 2038;
  const M = 2;
  const CO = "c_numbers";

  it("تثبيت نشر بوست ١ بعد بوست ٣: الأرقام والمعرّفات والحالات ثابتة على توليدين", async () => {
    await makeCompany(prisma, CO, {
      posts: 3,
      reels: 0,
      stories: 0,
      contractStartDate: D(Y, M + 1, 1),
      publishStartDate: D(Y, M + 1, 1),
    });
    await genOk(Y, M, CO);
    const p1 = await pieceCards(prisma, CO, "POST", 1);
    const p2 = await pieceCards(prisma, CO, "POST", 2);
    const p3 = await pieceCards(prisma, CO, "POST", 3);
    expect((await actions.updateTaskStatus(p2.production!.id, "READY")).ok).toBe(true);
    const late = new Date(p3.publish!.publishDate!);
    late.setDate(late.getDate() + 1);
    const lateIso = day(late)!;
    const r = await actions.updateTaskDetails([p1.publish!.id], { publishDate: lateIso });
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    for (let i = 0; i < 2; i++) await genOk(Y, M, CO);
    const a1 = await pieceCards(prisma, CO, "POST", 1);
    const a2 = await pieceCards(prisma, CO, "POST", 2);
    expect(a1.publish!.id).toBe(p1.publish!.id);
    expect(day(a1.publish!.publishDate)).toBe(lateIso);
    expect(a1.publish!.isPinned).toBe(true);
    expect([a2.production!.board, a2.production!.status]).toEqual(["DONE", "READY"]);
    expect(a2.production!.id).toBe(p2.production!.id);
    expect((await pieceCards(prisma, CO, "POST", 3)).publish!.id).toBe(p3.publish!.id);
  });
});
