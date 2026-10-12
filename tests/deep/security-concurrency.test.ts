/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: التزامن والتحديثات الضايعة.
 *
 * المراجع: WORK_RULES §٢–§٣ (الدليل والحالة المنجزة ما بينمحوا؛ إعادة الجدولة
 * بتحفظ اللوح/الحالة لكل كرت)، تعليق `src/server/schedule-engine.ts` («Board/status
 * are always kept»)، وPU-20 بتقرير plan-update (نفس الصنف: قراءة-تعديل-كتابة
 * بلا معاملة).
 *
 * القاعدة: نسخة `prisma/dev.db` → `prisma/test-deep-security-conc-<pid>.db`؛ بلاها
 * الفحوص بتتخطّى. SQLite بيسلسل الكتابات، فالتداخلات هون **محدّدة بالتصميم**
 * (نفس الترتيب يلي ممكن يصير على Postgres بين طلبين حقيقيين).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";

const HAS_DB = existsSync("prisma/dev.db");
const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
const scratch = vi.hoisted(() => ({ target: "" }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "sm_admin" && jar.value ? { name, value: jar.value } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db", async () => {
  const g = globalThis as any;
  if (!g.__secConcPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
    const { copyDevDb, fileUrl } = await import("./security-fixture");
    const copy = copyDevDb("conc");
    scratch.target = copy.target;
    g.__secConcPrisma = new PrismaClient({
      datasources: { db: { url: assertIsolatedTestDatabaseUrl(fileUrl(copy.target)) } },
    });
  }
  return { prisma: g.__secConcPrisma };
});

import { removeDb, signToken } from "./security-fixture";

let prisma: any;
let tasks: typeof import("@/server/actions/tasks");
let engine: typeof import("@/server/schedule-engine");
const now = new Date();
// دلو لقطة الإنتاج الشغّال (تشرين الأول ٢٠٢٦ = month 9) — ثابت مشان ما يتعلّق الفحص بساعة الجهاز.
const Y = 2026;
const M = 9;
const used = new Set<string>();

/** كرت آلي مفتوح بالدلو الحالي ما استعملناه قبل. */
async function openCard(where: Record<string, unknown> = {}) {
  const rows = await prisma.task.findMany({
    where: { isAuto: true, year: Y, month: M, status: "NOT_STARTED", companyId: { not: null }, ...where },
    take: 50,
  });
  const card = rows.find((r: any) => !used.has(r.id));
  expect(card, "كرت مفتوح للفحص").toBeTruthy();
  used.add(card.id);
  return card;
}

beforeAll(async () => {
  if (!HAS_DB) return;
  prisma = (await import("@/lib/db")).prisma;
  tasks = await import("@/server/actions/tasks");
  engine = await import("@/server/schedule-engine");
}, 60_000);

afterAll(async () => {
  const g = globalThis as any;
  await prisma?.$disconnect();
  delete g.__secConcPrisma;
  if (scratch.target) removeDb(scratch.target);
});

describe.skipIf(!HAS_DB)("[SA-03] تحديثات ضايعة على الكروت", () => {
  it.fails("[SA-03] نافذة تعديل مفتوحة (قيم قديمة) بتحفظ بعد ما الكرت انسكّر من اللوح → لازم يضل منجز أو ينرفض الحفظ", async () => {
    const card = await openCard({ stage: "DESIGN" });
    // الموظف أ فتح «تعديل» — النموذج حمل الحالة NOT_STARTED
    const form = { title: `${card.title} (معدّل)`, status: card.status, priority: card.priority, assigneeId: card.assigneeId };
    // الموظف ب خلّص الكرت من اللوح
    expect((await tasks.moveCard(card.id, "DONE")).ok).toBe(true);
    // أ بيحفظ النافذة (TaskForm بيبعت كل الحقول دايماً)
    const r = await tasks.updateTaskDetails([card.id], form);
    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(r.ok === false || after.board === "DONE").toBe(true);
  });

  it.fails("[SA-03] تعديلان جزئيان متوازيان (عنوان + مسؤول) → لازم يضلّوا التنين", async () => {
    const card = await openCard({ assigneeId: { not: null } });
    const other = await prisma.employee.findFirst({ where: { id: { not: card.assigneeId } } });
    const [a, b] = await Promise.all([
      tasks.updateTaskDetails([card.id], { title: "عنوان-متوازي-أ" }),
      tasks.updateTaskDetails([card.id], { assigneeId: other.id }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(after.title).toBe("عنوان-متوازي-أ");
    expect(after.assigneeId).toBe(other.id);
  });

  it.fails("[SA-03] كرت انسكّر بين قراءة «الحفظ» وكتابة إعادة الجدولة → الإعادة لازم ما ترجّعه مفتوح", async () => {
    const card = await openCard({ stage: "DESIGN" });
    // نفس الترتيب الحقيقي: المحرّك بيقرأ الكروت الموجودة (للحفظ) خارج المعاملة،
    // بعدها بيقرأ جلسات التصوير، بعدها المعاملة. أي كتابة بهالنافذة بتضيع.
    const orig = prisma.photoSession.findMany.bind(prisma.photoSession);
    let moved: any = null;
    prisma.photoSession.findMany = async (...args: any[]) => {
      if (!moved) moved = await tasks.moveCard(card.id, "DONE");
      return orig(...args);
    };
    let r: any;
    try {
      r = await engine.generateScheduleInternal(Y, M, null);
    } finally {
      prisma.photoSession.findMany = orig;
    }
    expect(moved?.ok).toBe(true);
    expect(r.ok).toBe(true);
    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(after.board).toBe("DONE");
  });
});

describe.skipIf(!HAS_DB)("تزامن نظيف (للسجلّ)", () => {
  it("إعادتا جدولة لنفس الدلو بنفس اللحظة → لا صفوف مكرّرة ولا ضايعة", async () => {
    const before = await prisma.task.count({ where: { year: Y, month: M } });
    const [r1, r2]: any[] = await Promise.all([
      engine.generateScheduleInternal(Y, M, null),
      engine.generateScheduleInternal(Y, M, null),
    ]);
    expect(r1.ok && r2.ok).toBe(true);
    expect(await prisma.task.count({ where: { year: Y, month: M } })).toBe(before);
    const dups: any[] = await prisma.$queryRawUnsafe(
      "SELECT pipelineKey, stage, COUNT(*) n FROM Task WHERE year=? AND month=? AND isAuto=1 AND pipelineKey IS NOT NULL AND status!='CANCELED' GROUP BY pipelineKey, stage HAVING n>1",
      Y, M,
    );
    expect(dups).toEqual([]);
  });

  it("createTask مرّتين بنفس اللحظة (كل وحدة بتعيد الجدولة) → +٢ بالضبط", async () => {
    const before = await prisma.task.count();
    const emp = await prisma.employee.findFirst();
    const mk = (t: string) =>
      tasks.createTask({ title: t, kind: "ADHOC", month: M, year: Y, assigneeId: emp.id, priority: "NORMAL", status: "NOT_STARTED", hours: 8, isPinned: false } as never);
    const [a, b] = await Promise.all([mk("فحص-تزامن-١"), mk("فحص-تزامن-٢")]);
    expect(a.ok && b.ok).toBe(true);
    expect(await prisma.task.count()).toBe(before + 2);
  });

  it("updateDailyTasks مرّتين (نقر مزدوج) → نفس النتيجة (معاملة وحدة)", async () => {
    const cards = await prisma.task.findMany({ where: { status: "NOT_STARTED", assigneeId: { not: null } }, take: 3, skip: 40 });
    const ids = cards.map((c: any) => c.id);
    const todayISO = `${Y}-${String(M + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const [a, b] = await Promise.all([
      tasks.updateDailyTasks(ids.slice(0, 2), ids.slice(2), todayISO),
      tasks.updateDailyTasks(ids.slice(0, 2), ids.slice(2), todayISO),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const after = await prisma.task.findMany({ where: { id: { in: ids } } });
    expect(after.every((t: any) => t.isPinned && t.manualDay)).toBe(true);
  });

  it("«جدّد» بنقر مزدوج وبنفس التاريخ → تجديد واحد بس", async () => {
    vi.stubEnv("AUTH_SECRET", "conc-secret");
    jar.value = signToken("conc-secret", Date.now() + 600_000);
    try {
      const { renewContract } = await import("@/server/actions/companies");
      const { cyclesOf, parseRenewals } = await import("@/lib/contract");
      const cos = await prisma.company.findMany({ where: { status: "active", managed: true, publishStartDate: { not: null } } });
      const co = cos.find((c: any) => cyclesOf(c).length > 0);
      const last = cyclesOf(co).at(-1)!;
      const s = new Date(last.end.getTime() + 2 * 86_400_000);
      const iso = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
      const before = parseRenewals(co).length;
      const [a, b]: any[] = await Promise.all([renewContract(co.id, iso), renewContract(co.id, iso)]);
      expect(a.ok || b.ok).toBe(true);
      const after = await prisma.company.findUnique({ where: { id: co.id } });
      expect(parseRenewals(after).length).toBe(before + 1);
    } finally {
      jar.value = undefined;
      vi.unstubAllEnvs();
    }
  });
});
