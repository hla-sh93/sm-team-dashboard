/**
 * الفحص العميق — محرّك إعادة التوليد · دورة حياة الشركة وحدود الدلو
 *
 * قاعدة معزولة تنبنى من الـschema. شركات اصطناعية مستقلّة لكل سيناريو:
 *   • التجديد وتثبيت خطة الدورة السابقة (WORK_RULES §٩)
 *   • الإيقاف ثم الإرجاع (§٨) — **توصيف** للسلوك الحالي (RG-10، قرار قائدة) + `it.fails` بـRG-05 (مؤشّر معلّق)
 *   • «لم يُجدد»: إلغاء بدليل، المنجز لا يُمسّ، والمحرّك ما بيلمس المؤرشفة
 *   • إنجازات `Setting` بتنطبق مرّة والحالة المحفوظة بتغلبها بعدها
 *   • حدود: خطة صفر، دورة تعبر حدّ الشهر، دلو رأس السنة (m=11 → 2027)،
 *     يوم العطلة، أول وآخر يوم بالدورة
 *
 * التقنيات: قيم حدّية · جداول قرار · متماثلات · سلبيات (رفض بصوت).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { resolve } = await import("node:path");
  return { target: resolve(process.cwd(), "prisma", `test-deep-regen-lifecycle-${process.pid}.db`) };
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
let gen: (
  y: number,
  m: number,
  only: string | null,
  allowEmpty?: boolean,
) => Promise<{ ok: boolean; error?: string }>;
let tasks: typeof import("@/server/actions/tasks");
let ops: typeof import("@/server/task-ops");
let companies: typeof import("@/server/actions/companies");
let lifecycle: typeof import("@/server/company-lifecycle");

const Y = 2026;
const M = 8;

async function genOk(y: number, m: number, only: string | null = null) {
  const r = await gen(y, m, only);
  expect(r.ok, r.error).toBe(true);
  expect(await relationViolations(prisma)).toEqual([]);
}

async function stable(y: number, m: number, only: string | null = null) {
  const s1 = await tableSnapshot(prisma);
  await genOk(y, m, only);
  const s2 = await tableSnapshot(prisma);
  expect(diffSnapshots(s1, s2)).toEqual([]);
}

const numsOf = (cards: { type: string | null; pieceNo: number | null }[], type: string) =>
  [...new Set(cards.filter((c) => c.type === type).map((c) => c.pieceNo))].sort();

beforeAll(async () => {
  prisma = (await import("@/lib/db")).prisma;
  await createSchema(prisma);
  await seedTeam(prisma);
  ({ generateScheduleInternal: gen } = (await import("@/server/schedule-engine")) as never);
  tasks = await import("@/server/actions/tasks");
  ops = await import("@/server/task-ops");
  companies = await import("@/server/actions/companies");
  lifecycle = await import("@/server/company-lifecycle");
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeDb(scratch.target);
});

describe("التجديد — WORK_RULES §٩: رقم السجلّ لآخر دورة، والسابقة مثبّتة بكروتها", () => {
  const CO = "c_renew";
  it("التجديد بيبني دلو الدورة الجديدة وما بيلمس دلو الدورة السابقة", async () => {
    await makeCompany(prisma, CO);
    await genOk(Y, M);
    const d1 = (await pieceCards(prisma, CO, "POST", 1)).production!;
    expect((await tasks.updateTaskStatus(d1.id, "READY")).ok).toBe(true);
    const before = await tableSnapshot(prisma, { companyId: CO, year: Y, month: M });
    const r = await companies.renewContract(CO, "2026-10-01");
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    const after = await tableSnapshot(prisma, { companyId: CO, year: Y, month: M });
    expect(diffSnapshots(before, after)).toEqual([]);
    const oct = await autoCards(prisma, CO, Y, 9);
    expect(oct.length).toBeGreaterThan(0);
    expect(numsOf(oct, "POST")).toEqual([1, 2, 3]);
    // الدورة الجديدة بتبلّش نظيفة — ما ورثت إنجاز بوست ١ من أيلول
    expect(oct.every((c) => c.board === "TODO")).toBe(true);
  });

  it("رفع السجلّ ٣→٦ بعد التجديد: دلو أيلول بيضل ٣ بوستات (مثبّت) ودلو تشرين بياخد ٦", async () => {
    await prisma.company.update({ where: { id: CO }, data: { posts: 6 } });
    await genOk(Y, M, CO);
    expect(numsOf(await autoCards(prisma, CO, Y, M), "POST")).toEqual([1, 2, 3]);
    expect((await pieceCards(prisma, CO, "POST", 1, { year: Y, month: M })).production!.board).toBe("DONE");
    await genOk(Y, 9, CO);
    expect(numsOf(await autoCards(prisma, CO, Y, 9), "POST")).toEqual([1, 2, 3, 4, 5, 6]);
    await stable(Y, M, CO);
    await stable(Y, 9, CO);
  });

  it("تجديد قبل نهاية الدورة الحالية مرفوض بصوت", async () => {
    const r = await companies.renewContract(CO, "2026-10-15");
    expect(r.ok).toBe(false);
  });
});

describe("الإيقاف ثم الإرجاع — توصيف السلوك الحالي (RG-10 قرار قائدة = OP-15) + RG-05", () => {
  const CO = "c_pause";
  it("[RG-10 مُصلَح] الإيقاف بيخفي ولا بيمحي (المفتوح بوصفه والملغى بيضلّوا)؛ والرجوع بيكمّل الباقي بأرقامه وأوصافه", async () => {
    await makeCompany(prisma, CO);
    await genOk(Y, M);
    const p1 = (await pieceCards(prisma, CO, "POST", 1)).production!;
    expect((await tasks.updateTaskStatus(p1.id, "READY")).ok).toBe(true);
    const p2 = (await pieceCards(prisma, CO, "POST", 2)).production!;
    await prisma.task.update({ where: { id: p2.id }, data: { brief: "وصف بوست ٢ من خطة الزبون" } });
    const p3 = (await pieceCards(prisma, CO, "POST", 3)).production!;
    expect((await tasks.deleteTasks([p3.id])).ok).toBe(true);
    const manual = await prisma.task.create({
      data: { id: "manual_pause", kind: "ADHOC", title: "يدوي", companyId: CO, year: Y, month: M, isAuto: false, hours: 8 },
    });
    const beforePause = await autoCards(prisma, CO, Y, M);

    const paused = await companies.pauseCompanyPublishing(CO);
    expect(paused.ok, (paused as { error?: string }).error).toBe(true);
    const left = await autoCards(prisma, CO, Y, M);
    // [RG-10] كل الكروت بتضل: المنجز، والمفتوح بوصفه، والإلغاء المثبّت.
    expect(left.map((c) => c.id).sort()).toEqual(beforePause.map((c) => c.id).sort());
    expect(left.find((c) => c.pieceNo === 2 && c.stage === "DESIGN")!.brief).toBe("وصف بوست ٢ من خطة الزبون");
    expect(left.filter((c) => c.pieceNo === 3).every((c) => c.status === "CANCELED")).toBe(true);
    expect(await prisma.task.findUnique({ where: { id: manual.id } })).not.toBeNull();
    const co = await prisma.company.findUniqueOrThrow({ where: { id: CO } });
    expect(co.status).toBe("paused");
    expect(co.publishStartDate).not.toBeNull();
    // [RG-05] ما في محي، فما في مؤشّر معلّق.
    expect((await relationViolations(prisma)).filter((v) => v.includes(CO))).toEqual([]);

    // وقت الإيقاف المحرّك ما بيلمس الشركة الموقوفة: توليد الدلو كله ما بيغيّر صفوفها
    const frozen = await tableSnapshot(prisma, { companyId: CO });
    expect((await gen(Y, M, null)).ok).toBe(true);
    expect(diffSnapshots(frozen, await tableSnapshot(prisma, { companyId: CO }))).toEqual([]);
    const refused = await gen(Y, M, CO);
    expect(refused.ok).toBe(false);

    const resumed = await companies.resumeCompanyPublishing(CO, "2026-09-15");
    expect(resumed.ok, (resumed as { error?: string }).error).toBe(true);
    const rebuilt = await autoCards(prisma, CO, Y, M);
    expect(numsOf(rebuilt, "POST")).toEqual([1, 2, 3]);
    const p1After = (await pieceCards(prisma, CO, "POST", 1)).production!;
    expect([p1After.board, p1After.status]).toEqual(["DONE", "READY"]);
    // [RG-10] بعد الرجوع: وصف بوست ٢ باقي، وبوست ٣ الملغى بيضل ملغى.
    expect((await pieceCards(prisma, CO, "POST", 2)).production!.brief).toBe("وصف بوست ٢ من خطة الزبون");
    expect((await pieceCards(prisma, CO, "POST", 3)).production!.status).toBe("CANCELED");
    const coAfter = await prisma.company.findUniqueOrThrow({ where: { id: CO } });
    expect(coAfter.status).toBe("active");
    // لا كرت مفتوح قبل يوم الرجوع
    for (const c of rebuilt) {
      if (c.board === "DONE" || c.status === "CANCELED" || !c.publishDate) continue;
      expect(day(c.publishDate)! >= "2026-09-15", `${c.type}#${c.pieceNo} ${c.stage}`).toBe(true);
    }
    await stable(Y, M);
  });

  it("[RG-05 مُصلَح] الإيقاف ما بيترك مؤشّر حجز معلّق (ما في محي أصلاً)", async () => {
    // PROJECT.md «Paused companies»: محو الشغل غير المطلوب بيصفّر `blockedById`
    // الضالّ أولاً (الخطوة ١١)؛ و`tests/data-integrity.test.ts` بيرفض أي مؤشّر معلّق.
    const CO2 = "c_pause_rel";
    await makeCompany(prisma, CO2);
    await genOk(Y, M);
    const d1 = (await pieceCards(prisma, CO2, "POST", 1)).production!;
    expect((await tasks.updateTaskStatus(d1.id, "READY")).ok).toBe(true);
    expect((await companies.pauseCompanyPublishing(CO2)).ok).toBe(true);
    try {
      expect((await relationViolations(prisma)).filter((v) => v.includes(CO2))).toEqual([]);
    } finally {
      // تنظيف: الاختبارات الجاية بتفحص علاقات الجدول كله
      await prisma.company.delete({ where: { id: CO2 } }); // بيتسلسل للكروت والجلسات
    }
  });
});

describe("«لم يُجدد» — أرشفة: إلغاء بدليل، المنجز لا يُمسّ، والمحرّك ما بيلمس المؤرشفة", () => {
  const CO = "c_end";
  it("إنهاء العقد بيلغي المفتوح بسطر دليل مثبّتاً، وإعادة توليد الدلو ما بتغيّر ولا صفّ للشركة", async () => {
    await makeCompany(prisma, CO);
    await genOk(Y, M);
    const p1 = (await pieceCards(prisma, CO, "POST", 1)).production!;
    expect((await tasks.updateTaskStatus(p1.id, "READY")).ok).toBe(true);
    const doneBefore = await prisma.task.findUniqueOrThrow({ where: { id: p1.id } });
    const r = await companies.endContract(CO);
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    const cards = await autoCards(prisma, CO, Y, M);
    const line = lifecycle.contractEndedEvidence(new Date());
    for (const c of cards) {
      if (c.id === p1.id) {
        expect([c.board, c.status, c.isPinned]).toEqual(["DONE", "READY", false]);
        expect(c.finishedAt?.getTime()).toBe(doneBefore.finishedAt!.getTime());
        expect(c.notes).toBeNull();
      } else {
        expect(c.status, `${c.type}#${c.pieceNo} ${c.stage}`).toBe("CANCELED");
        expect(c.isPinned).toBe(true);
        expect(c.notes).toContain(line);
      }
    }
    const co = await prisma.company.findUniqueOrThrow({ where: { id: CO } });
    expect(co.status).toBe("archived");
    expect(co.contractEndedAt).not.toBeNull();
    const frozen = await tableSnapshot(prisma, { companyId: CO });
    await genOk(Y, M);
    expect(diffSnapshots(frozen, await tableSnapshot(prisma, { companyId: CO }))).toEqual([]);
    const refused = await gen(Y, M, CO);
    expect(refused.ok).toBe(false);
    // الإغلاق متكافئ: مرّة تانية ما بتضيف سطراً ولا تغيّر شي
    await lifecycle.closeOpenWorkForEndedContract(CO, co.contractEndedAt!);
    expect(diffSnapshots(frozen, await tableSnapshot(prisma, { companyId: CO }))).toEqual([]);
  });
});

describe("إنجازات Setting — بتنطبق بالتوليد، والحالة المحفوظة بتغلبها بعدها", () => {
  const CO = "c_ach";
  it("published:1 ready:1 → بوست ١ منشور بالكامل، بوست ٢ إنتاجه منجز ونشره مفتوح، كرت الكتابة منجز", async () => {
    await makeCompany(prisma, CO);
    const value = JSON.stringify({ [`${CO}|POST`]: { published: 1, ready: 1 } });
    await prisma.setting.upsert({
      where: { key: `achievements:${Y}-${M}` },
      update: { value },
      create: { key: `achievements:${Y}-${M}`, value },
    });
    await genOk(Y, M);
    const p1 = await pieceCards(prisma, CO, "POST", 1);
    expect([p1.production!.board, p1.production!.status]).toEqual(["DONE", "READY"]);
    expect([p1.publish!.board, p1.publish!.status]).toEqual(["DONE", "PUBLISHED"]);
    expect(p1.production!.finishedAt).not.toBeNull();
    const p2 = await pieceCards(prisma, CO, "POST", 2);
    expect(p2.production!.board).toBe("DONE");
    expect(p2.publish!.board).toBe("TODO");
    const p3 = await pieceCards(prisma, CO, "POST", 3);
    expect(p3.production!.board).toBe("TODO");
    const write = (await autoCards(prisma, CO, Y, M)).find((c) => c.stage === "WRITE" && c.pipelineKey === `${CO}|DESIGN`);
    expect(write?.board).toBe("DONE");
    await stable(Y, M);
    // إعادة فتح نشر بوست ١ يدوياً: التوليد التالي ما بيرجّع يسكّره من الـSetting
    expect((await ops.setStageDone(p1.publish!.id, false)).ok).toBe(true);
    await genOk(Y, M);
    expect((await pieceCards(prisma, CO, "POST", 1)).publish!.board).toBe("TODO");
    await prisma.setting.delete({ where: { key: `achievements:${Y}-${M}` } });
  });
});

describe("حدود الدلو", () => {
  it("خطة صفر: التوليد المحصور بالشركة مرفوض بصوت، والعام ما بيولّد إلها شي وما بيمسّ كرتها اليدوي", async () => {
    const CO = "c_zero";
    await makeCompany(prisma, CO, { posts: 0, reels: 0, stories: 0, aiReels: 0 });
    await prisma.task.create({
      data: { id: "manual_zero", kind: "ADHOC", title: "حدث", companyId: CO, year: Y, month: M, isAuto: false, hours: 8, notes: "ملاحظة" },
    });
    const refused = await gen(Y, M, CO);
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/دورة|كرت/);
    await genOk(Y, M);
    expect(await autoCards(prisma, CO, Y, M)).toEqual([]);
    const manual = await prisma.task.findUniqueOrThrow({ where: { id: "manual_zero" } });
    expect(manual.notes).toBe("ملاحظة");
    // وبالعلَم الصريح (شيل آخر تجديد) بيمرق — وما في شي ينمحى أصلاً
    const forced = await gen(Y, M, CO, true);
    expect(forced.ok).toBe(true);
    expect(await prisma.task.findUnique({ where: { id: "manual_zero" } })).not.toBeNull();
  });

  it("دورة تعبر حدّ الشهر (٢٠/٩ → ٢٠/١٠): كروت تشرين بتبقى بدلو أيلول، وتوليد دلو تشرين ما بيلمسها", async () => {
    const CO = "c_span";
    await makeCompany(prisma, CO, { contractStartDate: D(2026, 9, 20), publishStartDate: D(2026, 9, 20) });
    await genOk(Y, M);
    const cards = await autoCards(prisma, CO, Y, M);
    expect(cards.length).toBeGreaterThan(0);
    const inOctober = cards.filter((c) => c.publishDate && day(c.publishDate)! >= "2026-10-01");
    expect(inOctober.length).toBeGreaterThan(0);
    expect(inOctober.every((c) => c.month === M && c.year === Y)).toBe(true);
    for (const c of cards) {
      if (c.publishDate) expect(day(c.publishDate)! < "2026-10-20", `${c.type}#${c.pieceNo}`).toBe(true);
    }
    const before = await tableSnapshot(prisma, { companyId: CO });
    await genOk(Y, 9);
    expect(diffSnapshots(before, await tableSnapshot(prisma, { companyId: CO }))).toEqual([]);
    expect(await autoCards(prisma, CO, Y, 9)).toEqual([]);
    const refused = await gen(Y, 9, CO);
    expect(refused.ok).toBe(false);
  });

  it("دلو رأس السنة (دورة ١٥/١٢/٢٠٢٦): الكروت بسنة 2026 شهر 11 ولو نشرها بكانون الثاني 2027، وتوليد 2027/0 ما بيلمسها", async () => {
    const CO = "c_year";
    await makeCompany(prisma, CO, { contractStartDate: D(2026, 12, 15), publishStartDate: D(2026, 12, 15) });
    await genOk(2026, 11);
    const cards = await autoCards(prisma, CO, 2026, 11);
    expect(cards.length).toBeGreaterThan(0);
    const inJanuary = cards.filter((c) => c.publishDate && day(c.publishDate)! >= "2027-01-01");
    expect(inJanuary.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.year === 2026 && c.month === 11)).toBe(true);
    for (const c of cards) if (c.publishDate) expect(day(c.publishDate)! < "2027-01-15").toBe(true);
    const before = await tableSnapshot(prisma, { companyId: CO });
    await genOk(2027, 0);
    expect(diffSnapshots(before, await tableSnapshot(prisma, { companyId: CO }))).toEqual([]);
    await stable(2026, 11);
  });

  it("يوم العطلة وحدود الدورة: المفتوح على أيام دوام صاحبه، لا نشر يوم جمعة، وتثبيت على أول/آخر يوم بالدورة بيصمد", async () => {
    const CO = "c_edges";
    await makeCompany(prisma, CO, { posts: 6, stories: 6, reels: 2 });
    await genOk(Y, M);
    const workDays = new Map(
      (await prisma.employee.findMany()).map((e) => [e.id, JSON.parse(e.workDays) as number[]]),
    );
    const cards = await autoCards(prisma, CO, Y, M);
    for (const c of cards) {
      if (c.workDate && c.assigneeId && c.board !== "DONE" && !c.isPinned)
        expect(workDays.get(c.assigneeId)!.includes(c.workDate.getDay()), `${c.type}#${c.pieceNo} ${c.stage} ${day(c.workDate)}`).toBe(true);
      if (c.publishDate) expect(c.publishDate.getDay(), `جمعة ${c.type}#${c.pieceNo}`).not.toBe(5);
      if (c.stage === "PUBLISH" && c.workDate && c.publishDate)
        expect(day(c.workDate)! <= day(c.publishDate)!).toBe(true);
      if (c.workDate) expect(day(c.workDate)! >= "2026-09-01").toBe(true);
      if (c.publishDate) expect(day(c.publishDate)! < "2026-10-01").toBe(true);
    }
    const first = (await pieceCards(prisma, CO, "POST", 1)).production!;
    const last = (await pieceCards(prisma, CO, "POST", 6)).publish!;
    expect((await tasks.updateTaskDetails([first.id], { workDate: "2026-09-01", readyDate: "2026-09-01" })).ok).toBe(true);
    // نشر يوم السبت (٢٦/٩) على آخر أسبوع: مسموح، ويوم شغل الناشر بيسبقه
    expect((await tasks.updateTaskDetails([last.id], { publishDate: "2026-09-26" })).ok).toBe(true);
    await stable(Y, M);
    const firstAfter = (await pieceCards(prisma, CO, "POST", 1)).production!;
    expect(day(firstAfter.workDate)).toBe("2026-09-01");
    const lastAfter = (await pieceCards(prisma, CO, "POST", 6)).publish!;
    expect(day(lastAfter.publishDate)).toBe("2026-09-26");
    expect(lastAfter.publishDate!.getDay()).toBe(6);
    expect(day(lastAfter.readyDate)).toBe("2026-09-26"); // جهوزية كرت النشر = يوم نشره
  });
});
