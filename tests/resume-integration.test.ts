/**
 * الرجوع من إيقاف و«تسليم الشغل» مع إعادة التوليد الحقيقية — مراجعة ١٢/١٠ على D1/D4:
 *
 *  - الرجوع بيحطّ مواعيد النافذة على **كل** قطعة باقية — حتى المثبّتة — بأول توليد
 *    بس، وبكل دلو فيه باقي (الأقدم أولاً، والنوافذ ورا بعض). بعدها التعديل اليدوي بيغلب.
 *  - المنجز قبل تاريخ التسليم بيضل باسم يلي عمله بعد إعادة التوليد، والمفتوح للخلف —
 *    والأدوار المختارة «بالدور» (الكاتبة) بتروح للخلف كمان.
 *
 * قاعدة معزولة: نسخة من `prisma/dev.db` (اسمها فيه test) بتنحذف بالآخر؛ الشركات
 * والموظفون المفحوصون مصطنعون.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-resume-int-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {},
  requireAdminPage: async () => {},
  isAuthenticated: async () => true,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

let prisma: any;
let companies: typeof import("@/server/actions/companies");
let schedule: typeof import("@/server/actions/schedule");
let employees: typeof import("@/server/actions/employees");
const P = process.pid;
const uniq = `resume-int-${P}`;
const skip = () => !scratch.available;
const ids = { designer: "", designer2: "", co: "", co2: "" };
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  companies = await import("@/server/actions/companies");
  schedule = await import("@/server/actions/schedule");
  employees = await import("@/server/actions/employees");
  const mk = (name: string) =>
    prisma.employee.create({
      data: { name, role: "designer", workDays: "[0,1,2,3,4]", rates: '{"POST":6}', isScheduled: true },
    });
  ids.designer = (await mk(`${uniq}-مصمّم`)).id;
  ids.designer2 = (await mk(`${uniq}-خلف`)).id;
  const co = (name: string, slug: string, posts: number) =>
    prisma.company.create({
      data: {
        name,
        slug,
        managed: true,
        priority: 900,
        posts,
        reels: 0,
        stories: 0,
        aiReels: 0,
        postOwnerId: ids.designer,
        contractStartDate: new Date(2026, 8, 1),
        publishStartDate: new Date(2026, 8, 1),
        renewals: JSON.stringify(["2026-10-01"]),
      },
    });
  ids.co = (await co(`${uniq}-راجعة`, `Rsm${P}`, 3)).id;
  ids.co2 = (await co(`${uniq}-تسليم`, `Hnd${P}`, 2)).id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

const publishCard = (year: number, month: number, pieceNo: number, companyId = ids.co) =>
  prisma.task.findFirst({ where: { companyId, year, month, stage: "PUBLISH", type: "POST", pieceNo } });
const designCard = (year: number, month: number, pieceNo: number, companyId = ids.co) =>
  prisma.task.findFirst({ where: { companyId, year, month, stage: "DESIGN", type: "POST", pieceNo } });

describe.skipIf(!scratch.available)("الرجوع من إيقاف — مع التوليد الحقيقي", () => {
  let windows: { from: string; until: string; year: number; month: number; datesApplied?: boolean }[] = [];

  it("التحضير: دلوين مولّدين، قطعة محسومة ببوست ١ أيلول، وبوست ٢ أيلول مثبّت بمواعيده القديمة", async () => {
    expect((await schedule.generateCompanySchedule(ids.co, 2026, 8)).ok).toBe(true);
    expect((await schedule.generateCompanySchedule(ids.co, 2026, 9)).ok).toBe(true);
    const done = new Date(2026, 8, 6, 12);
    for (const card of [await designCard(2026, 8, 1), await publishCard(2026, 8, 1)])
      await prisma.task.update({
        where: { id: card.id },
        data: { status: card.stage === "PUBLISH" ? "PUBLISHED" : "READY", board: "DONE", startedAt: done, finishedAt: done, completedAt: done, isPinned: true },
      });
    for (const card of [await designCard(2026, 8, 2), await publishCard(2026, 8, 2)])
      await prisma.task.update({ where: { id: card.id }, data: { isPinned: true } });
    expect((await publishCard(2026, 8, 2)).isPinned).toBe(true);
  });

  it("الإيقاف ما بيمحي شي، والرجوع ٢/١١ بيعمل نافذة لكل دلو فيه باقي — الأقدم أولاً وورا بعض", async () => {
    const before = await prisma.task.count({ where: { companyId: ids.co } });
    expect((await companies.pauseCompanyPublishing(ids.co)).ok).toBe(true);
    expect(await prisma.task.count({ where: { companyId: ids.co } })).toBe(before);
    const r = await companies.resumeCompanyPublishing(ids.co, "2026-11-02");
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    expect((r as { remaining?: number }).remaining).toBe(5); // أيلول ٢ + تشرين ٣
    const row = await prisma.setting.findUnique({ where: { key: `companyResume:${ids.co}` } });
    windows = JSON.parse(row.value);
    expect(windows.map((w) => [w.year, w.month])).toEqual([[2026, 8], [2026, 9]]);
    expect(windows[0].from).toBe("2026-11-02");
    expect(windows[1].from).toBe(windows[0].until);
    expect(windows.every((w) => w.datesApplied)).toBe(true);
  });

  it("القطعة الباقية المثبّتة بأيلول انتقلت لنافذتها، والمحسومة ضلّت بمكانها", async () => {
    const pinned = await publishCard(2026, 8, 2);
    expect(iso(pinned.publishDate) >= windows[0].from && iso(pinned.publishDate) < windows[0].until, iso(pinned.publishDate)).toBe(true);
    const design2 = await designCard(2026, 8, 2);
    expect(iso(design2.workDate) >= "2026-11-02", iso(design2.workDate)).toBe(true);
    expect(iso((await publishCard(2026, 8, 1)).publishDate) < "2026-10-01").toBe(true);
    for (const no of [1, 2, 3]) {
      const c = await publishCard(2026, 9, no);
      expect(iso(c.publishDate) >= windows[1].from && iso(c.publishDate) < windows[1].until, `تشرين ${no}: ${iso(c.publishDate)}`).toBe(true);
    }
  });

  it("بعد الرجوع التعديل اليدوي بيغلب: موعد مثبّت جديد بيضل بإعادة التوليد", async () => {
    const c = await publishCard(2026, 9, 3);
    const manual = new Date(2026, 11, 20);
    await prisma.task.update({ where: { id: c.id }, data: { publishDate: manual, isPinned: true } });
    expect((await schedule.generateCompanySchedule(ids.co, 2026, 9)).ok).toBe(true);
    expect(iso((await publishCard(2026, 9, 3)).publishDate)).toBe(iso(manual));
  });
});

describe.skipIf(!scratch.available)("«تسليم الشغل» — وبعدها إعادة التوليد", () => {
  it("المنجز قبل التاريخ بيضل لصاحبه، والمفتوح للخلف — بعد التوليد كمان", async () => {
    expect((await schedule.generateCompanySchedule(ids.co2, 2026, 9)).ok).toBe(true);
    const d1 = await designCard(2026, 9, 1, ids.co2);
    const doneAt = new Date(2026, 9, 5, 12);
    await prisma.task.update({
      where: { id: d1.id },
      data: { status: "READY", board: "DONE", startedAt: doneAt, finishedAt: doneAt, completedAt: doneAt },
    });
    const preview = await employees.handoverEmployeeWork({ fromId: ids.designer, toId: ids.designer2, fromDate: "2026-10-10" });
    expect(preview.ok).toBe(true);
    const total = (preview as { total: number }).total;
    const applied = await employees.handoverEmployeeWork({ fromId: ids.designer, toId: ids.designer2, fromDate: "2026-10-10", confirm: total });
    expect(applied.ok, (applied as { error?: string }).error).toBe(true);
    expect((await schedule.generateCompanySchedule(ids.co2, 2026, 9)).ok).toBe(true);
    expect((await designCard(2026, 9, 1, ids.co2)).assigneeId).toBe(ids.designer);
    expect((await designCard(2026, 9, 2, ids.co2)).assigneeId).toBe(ids.designer2);
  });

  it("الدور المختار «بالدور» (الكاتبة) بيروح للخلف بإعادة التوليد", async () => {
    const writer = await prisma.employee.findFirst({ where: { role: { contains: "كات" } }, orderBy: { createdAt: "asc" } });
    if (!writer) return;
    const heir = await prisma.employee.create({
      data: { name: `${uniq}-كاتبة جديدة`, role: "كاتبة محتوى", workDays: "[0,1,2,3,4]", isScheduled: false },
    });
    const preview = await employees.handoverEmployeeWork({ fromId: writer.id, toId: heir.id, fromDate: "2026-10-10" });
    expect(preview.ok).toBe(true);
    const total = (preview as { total: number }).total;
    expect((await employees.handoverEmployeeWork({ fromId: writer.id, toId: heir.id, fromDate: "2026-10-10", confirm: total })).ok).toBe(true);
    expect((await schedule.generateCompanySchedule(ids.co2, 2026, 9)).ok).toBe(true);
    const write = await prisma.task.findFirst({ where: { companyId: ids.co2, year: 2026, month: 9, stage: "WRITE" } });
    if (write && !["READY", "PUBLISHED"].includes(write.status)) expect(write.assigneeId).toBe(heir.id);
  });
});
