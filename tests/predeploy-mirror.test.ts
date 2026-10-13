/**
 * فحص ما قبل النشر — على **مرآة الإنتاج** (`prisma/dev.db` الحقيقية)، مرّة وحدة قبل الدمج.
 *
 * بيشتغل بس بـ`PREDEPLOY=1` (قاعدة seed ما بتعني شي هون):
 *   PREDEPLOY=1 npx vitest run tests/predeploy-mirror.test.ts
 *
 * بينسخ `dev.db` لملف معزول وما بيلمس الأصل. بيفحص يلي ما بتغطّيه `regen-snapshot` و
 * `regen-reality` (المنجز والمثبّت ما بيتغيّروا، والتوليد متكافئ — شغّليهن كمان):
 *   ١. كل منتج بالفريق البوت بيعرفه — بلا هوية تلغرام ملفاته ما بتسكّر كروته (D3).
 *   ٢. ولا شركة **شغّالة** عليها نصّ «سبب إعفاء» (قرار القائدة ١٣/١٠: الإعفاء = الإيقاف).
 *   ٣. أول توليد بعد النشر ما بيزحزح ولا نزلة تصوير **مرقت** (مراجعة نهائية ١٣/١٠)،
 *      ولا كرت منجز؛ وبيطبع كم كرت مفتوح غير مثبّت رح يتغيّر يومه — للعلم قبل النشر.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-predeploy-${process.pid}.db`);
  const available = process.env.PREDEPLOY === "1" && existsSync(source);
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

type Prisma = import("@prisma/client").PrismaClient;
let prisma: Prisma;
let gen: (y: number, m: number, only: string | null) => Promise<{ ok: boolean; error?: string }>;
let teamDayStart: () => Date;

const PRODUCER = /مصمم|designer|مصور|مصوّر|photo|مونت|edit|ناشر|publish|ليدر|lead|قائد|كات|writer/i;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "∅");

describe.skipIf(!scratch.available)("فحص ما قبل النشر — مرآة الإنتاج", () => {
  beforeAll(async () => {
    prisma = (await import("@/lib/db")).prisma;
    ({ generateScheduleInternal: gen } = (await import("@/server/schedule-engine")) as never);
    ({ teamDayStart } = await import("@/lib/team-day"));
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    const { rmSync } = await import("node:fs");
    for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
  });

  it("١. كل منتج بالفريق إلو هوية تلغرام (رقم، أو يوزرنيم، أو اسم بديل)", async () => {
    const people = await prisma.employee.findMany({
      where: { isScheduled: true },
      select: { name: true, role: true, telegramUserId: true, telegramUsername: true, telegramAliases: true },
    });
    const missing = people
      .filter((p) => PRODUCER.test(p.role))
      .filter((p) => !p.telegramUserId && !p.telegramUsername && !(p.telegramAliases ?? "").trim())
      .map((p) => `${p.name} (${p.role})`);
    expect(missing, "بلا هوية تلغرام — ملفاتهن ما رح تسكّر كروتهن").toEqual([]);
  });

  it("٢. ولا شركة شغّالة عليها نصّ «سبب إعفاء»", async () => {
    const rows = await prisma.company.findMany({
      where: { status: "active", lateExemptReason: { not: null } },
      select: { name: true, lateExemptReason: true },
    });
    expect(rows.filter((r) => r.lateExemptReason?.trim()).map((r) => r.name)).toEqual([]);
  });

  it("٣. أول توليد: ولا نزلة تصوير مرقت ولا كرت منجز بيتزحزح — والمفتوح المتغيّر بينطبع", async () => {
    const now = teamDayStart();
    const sessionKey = (s: { year: number; month: number; companyId: string | null; kind: string; no: number }) =>
      `${s.year}/${s.month}|${s.companyId}|${s.kind}|${s.no}`;
    const pastBefore = new Map(
      (await prisma.photoSession.findMany({ where: { shootDate: { lt: now } } })).map((s) => [sessionKey(s), day(s.shootDate)]),
    );
    const tasksBefore = new Map((await prisma.task.findMany()).map((t) => [t.id, t]));

    const buckets = await prisma.task.groupBy({ by: ["year", "month"], where: { isAuto: true }, orderBy: [{ year: "desc" }, { month: "desc" }] });
    const live = buckets.slice(0, 4); // آخر ٤ دلاء — يلي ممكن ينعاد توليدها
    for (const b of live) {
      const r = await gen(b.year, b.month, null);
      expect(r.ok, `${b.year}/${b.month + 1}: ${r.error ?? ""}`).toBe(true);
    }

    const movedPast: string[] = [];
    for (const s of await prisma.photoSession.findMany({ where: { shootDate: { lt: now } } })) {
      const was = pastBefore.get(sessionKey(s));
      if (was && was !== day(s.shootDate)) movedPast.push(`${sessionKey(s)}: ${was} → ${day(s.shootDate)}`);
    }
    expect(movedPast, "نزلات تصوير مرقت تزحزحت").toEqual([]);

    const doneChanged: string[] = [];
    const openMoved: string[] = [];
    for (const t of await prisma.task.findMany()) {
      const was = tasksBefore.get(t.id);
      if (!was) continue;
      const dates = (x: typeof t) => `${day(x.workDate)}|${day(x.readyDate)}|${day(x.publishDate)}`;
      if (was.board === "DONE") {
        if (dates(was) !== dates(t) || was.status !== t.status || was.brief !== t.brief || was.notes !== t.notes)
          doneChanged.push(`${t.id}: ${dates(was)} → ${dates(t)}`);
      } else if (!was.isPinned && dates(was) !== dates(t)) {
        openMoved.push(`${t.title ?? t.id} [${t.stage}]: ${dates(was)} → ${dates(t)}`);
      }
    }
    expect(doneChanged, "كروت منجزة تغيّرت").toEqual([]);
    console.log(`\n[predeploy] كروت مفتوحة غير مثبّتة رح يتغيّر يومها بأول توليد: ${openMoved.length}`);
    for (const line of openMoved.slice(0, 40)) console.log(`  ${line}`);
  }, 300_000);
});
