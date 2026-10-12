/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور telegram-reports: مسار الإرسال الحقيقي (`service.ts`)
 * على قاعدة معزولة، و`fetch` مستبدَل بالكامل — ولا طلب شبكة، ولا توكن حقيقي.
 *
 *  - اتساق ٠٧:٤٥ مع «مهام اليوم» بالرئيسية (PROJECT.md §10 «never drift»): سطر كل
 *    شخص = `countByCompany(selectDailyWork(...).queue)` بنفس مدخلات الرئيسية — خاصية
 *    على داتا اللقطة لأربع أيام شغل.
 *  - الوجهة: كل رسالة لخاصّ القائدة بس، والموجة العامة رسالة وحدة.
 *  - تقرير ٢٠:٠٠ بيشوف كل يلي انسكّر اليوم — حتى كروت دلو دورة سابقة أو جاية.
 *
 * `it.fails("[TR-nn] …")` = عطل مثبت بـ`docs/qa/deep-test-2026-10-11/telegram-reports.md`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-telegram-reports-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

let prisma: any;
const P = process.pid;
const uniq = `فحص-تقارير-${P}`;
const KILO = `tdr${P}_kilo`, DES = `tdr${P}_des`;
const LEAD = "lead-chat-test";
const sent: { url: string; body: any }[] = [];

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma;
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token-not-real");
  vi.stubEnv("TELEGRAM_LEAD_CHAT_ID", LEAD);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
    sent.push({ url: String(url), body: JSON.parse(init?.body ?? "{}") });
    return { json: async () => ({ ok: true, result: { message_id: sent.length } }) };
  }));
});

afterEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId: KILO } });
  await prisma.company.deleteMany({ where: { id: KILO } });
  await prisma.employee.deleteMany({ where: { id: DES } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe.skipIf(!scratch.available)("التقارير المرسلة — على نسخة اللقطة", () => {
  it("خاصية: سطر كل شخص بموجة ٠٧:٤٥ = طابوره بالرئيسية (٤ أيام شغل، داتا اللقطة)", async () => {
    const { loadLiveTasks } = await import("@/lib/live-tasks");
    const { buildDailyBrief } = await import("@/lib/telegram/brief");
    const { selectDailyWork } = await import("@/lib/daily-work");
    const { hideDormantCompanyWork } = await import("@/lib/company-visibility");
    const { countByCompany } = await import("@/lib/telegram/summary");
    const employees = await prisma.employee.findMany({ orderBy: { createdAt: "asc" } });
    const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
    const drift: string[] = [];
    let compared = 0;
    for (const d of [11, 12, 13, 14]) {
      const today = new Date(2026, 9, d, 7, 45);
      const tasks = await loadLiveTasks(2026, 9, today);
      const text = buildDailyBrief({ today, companies, employees, tasks }).schedule.text;
      const home = hideDormantCompanyWork(tasks as never, companies) as never;
      const name = (t: any) => companies.find((c: any) => c.id === t.companyId)?.name ?? "—";
      for (const e of employees) {
        if (/publish|ناشر/i.test(e.role)) continue; // سطر الناشر بالنوع لا بالعدد بقرار ١٦/٩
        const queue = selectDailyWork({ employee: e, tasks: home, allTasks: home, companies, today }).queue;
        const want = countByCompany(queue as never, name as never);
        if (!want) continue;
        compared++;
        const who = e.telegramUsername ? `@${e.telegramUsername}` : e.name;
        const line = text.split("\n").find((l) => l.startsWith(`‏${who} `)) ?? "";
        if (!line.includes(want)) drift.push(`${d}/10 ${e.name}: home «${want}» · brief «${line}»`);
      }
    }
    expect(compared).toBeGreaterThan(5);
    expect(drift).toEqual([]);
  });

  it("الوجهة: الموجة العامة رسالة وحدة لخاصّ القائدة، والتفصيلية كمان — ولا رسالة لمحادثة زبون", async () => {
    const { sendDailyBrief } = await import("@/lib/telegram/service");
    const general = await sendDailyBrief(new Date(2026, 9, 12, 7, 45), "general");
    expect(general).toMatchObject({ ok: true, sent: 1 });
    expect(sent[0].body.text.startsWith("صباح الخير")).toBe(true);
    await sendDailyBrief(new Date(2026, 9, 12, 8, 0), "detail");
    expect(sent.every((s) => s.body.chat_id === LEAD)).toBe(true);
    expect(sent.every((s) => s.url === "https://api.telegram.org/bottest-token-not-real/sendMessage")).toBe(true);
  });

  it("[TR-28] بلا توكن: ولا خدمة بتلمس الشبكة — هي البوابة الوحيدة (ما في وضع «تجربة» بمتغيّر بيئة)", async () => {
    const svc = await import("@/lib/telegram/service");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    try {
      for (const r of [
        await svc.sendDailyBrief(new Date(2026, 9, 12, 7, 45), "all"),
        await svc.sendDailyDoneReport(new Date(2026, 9, 12, 20, 0)),
        await svc.sendWeeklyPublishDigest(new Date(2026, 9, 15, 10, 0)),
        await svc.sendShootAppointments(new Date(2026, 9, 11, 9, 0)),
      ])
        expect(r).toMatchObject({ ok: false });
      expect(sent).toEqual([]);
    } finally {
      vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token-not-real");
    }
  });

  it("يوم عطلة الفريق (الجمعة): ولا رسالة، والنتيجة «skipped» مو فشل", async () => {
    const { sendDailyBrief, sendDailyDoneReport } = await import("@/lib/telegram/service");
    expect(await sendDailyBrief(new Date(2026, 9, 9, 7, 45), "general")).toMatchObject({ ok: true, sent: 0, skipped: "عطلة" });
    expect(await sendDailyDoneReport(new Date(2026, 9, 9, 20, 0))).toMatchObject({ ok: true, sent: 0, skipped: "عطلة" });
    expect(sent).toEqual([]);
  });

  describe("تقرير ٢٠:٠٠ بيشوف كل منجز اليوم", () => {
    beforeAll(async () => {
      if (!scratch.available) return;
      await prisma.employee.create({ data: { id: DES, name: `${uniq} مصمّم`, role: "designer", workDays: "[0,1,2,3,4]", isScheduled: true, salary: 100 } });
      await prisma.company.create({
        data: { id: KILO, name: `${uniq} كيلو`, slug: "Kilo", managed: true, posts: 4, publishStartDate: new Date(2026, 8, 1), renewals: JSON.stringify(["2026-10-01", "2026-11-01"]) },
      });
      const doneToday = (id: string, month: number, no: number) => ({
        id: `tdr${P}_${id}`, kind: "CONTENT", type: "POST", stage: "DESIGN", pieceNo: no, year: 2026, month, companyId: KILO, assigneeId: DES,
        status: "READY", board: "DONE", finishedAt: new Date(2026, 9, 12, 10, 0), completedAt: new Date(2026, 9, 12, 10, 0),
        readyDate: new Date(2026, 9, 12), publishDate: new Date(2026, 9, 14), notes: "سُلّم على تلغرام (بالاسم): Kilo-post.jpg",
      });
      await prisma.task.createMany({
        data: [
          doneToday("oct", 9, 1), // دلو الدورة الشغّالة (تشرين) — الضابط
          doneToday("sep", 8, 3), // متبقّي أيلول انسكّر اليوم (متل BW أيلول المعاد جدولته ١٢–٢١/١٠)
          doneToday("nov", 10, 1), // تحضير دورة تشرين التاني (متل كتابة التوظيف لتشرين بأيلول)
        ],
      });
    });

    it("كرت دلو الدورة الشغّالة المنجز اليوم بيطلع بسطر صاحبه", async () => {
      const { sendDailyDoneReport } = await import("@/lib/telegram/service");
      await sendDailyDoneReport(new Date(2026, 9, 12, 20, 0));
      expect(sent.map((s) => s.body.text).join("\n")).toContain(`${uniq} مصمّم: ${uniq} كيلو`);
    });

    it.fails("[TR-23] متبقّي الدورة السابقة وتحضير الدورة الجاية المنجزين اليوم بينعدّوا كمان (٣ بوست مو ١)", async () => {
      const { sendDailyDoneReport } = await import("@/lib/telegram/service");
      await sendDailyDoneReport(new Date(2026, 9, 12, 20, 0));
      expect(sent.map((s) => s.body.text).join("\n")).toContain(`${uniq} مصمّم: ${uniq} كيلو 3 بوست`);
    });
  });
});
