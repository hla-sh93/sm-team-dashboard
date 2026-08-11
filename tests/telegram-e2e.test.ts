/**
 * فحص السلسلة كاملة: رسالة تلغرام ← تخزين ← ربط بالشركة ← مطابقة ← إقفال
 * الكرت ← ظهورها بتقرير المنجَز.
 *
 * القائدة (11/8): «ارجع اعمل تيست عميق وشامل للتلغرام والربط مع البرنامج
 * وكيف التقرير بيقرأ الانجاز». والسبب المباشر: صورة بعتها أيمن على Siizen
 * وما بان أثرها — فالفحص هون بيمشي بنفس مسار الويبهوك الحي حرفياً
 * (`ingestUpdate` نفسها)، مو بمحاكاة مبسّطة.
 *
 * ⚠️ **على نسخة، ولا حرف على داتا الشغل** — نفس عقد `lifecycle.test.ts`:
 * نسخ قبل، فحص بصمة الأصل بعد، ومحو النسخة.
 */
import { copyFileSync, existsSync, readFileSync, rmSync } from "fs";
import { createHash } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REAL = "prisma/dev.db";
const COPY = "prisma/.telegram-e2e.db";
const fingerprint = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");

/** الوحدات بتنستورد **بعد** تحويل DATABASE_URL للنسخة — لأن عميل پريزما بينبني وقت الاستيراد. */
let ingest: typeof import("../src/lib/telegram/ingest");
let db: typeof import("../src/lib/db");
let report: typeof import("../src/lib/telegram/done-report");
let realBefore = "";

/** تحديث تلغرام كما بيوصل الويبهوك فعلاً — القناة الحقيقية بالحقول الحقيقية. */
const photoUpdate = (o: { caption?: string; msgId: number; thread: number; from: string }) => ({
  update_id: 900000 + o.msgId,
  message: {
    message_id: o.msgId,
    date: Math.floor(Date.now() / 1000),
    chat: { id: -1003563508968, type: "supergroup", title: "Desgin only (Team)🎭" },
    message_thread_id: o.thread,
    from: { id: 999001, is_bot: false, first_name: o.from },
    photo: [{ file_id: `test_file_${o.msgId}`, width: 1080, height: 1350 }],
    ...(o.caption ? { caption: o.caption } : {}),
  },
});

beforeAll(async () => {
  realBefore = fingerprint(REAL);
  copyFileSync(REAL, COPY);
  process.env.DATABASE_URL = `file:${process.cwd()}/${COPY}`;
  db = await import("../src/lib/db");
  ingest = await import("../src/lib/telegram/ingest");
  report = await import("../src/lib/telegram/done-report");
});

afterAll(async () => {
  await db?.prisma.$disconnect();
  expect(fingerprint(REAL)).toBe(realBefore); // الأصل ما انلمس
  for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(COPY + ext)) rmSync(COPY + ext);
});

describe("المسار الحي: صورة أيمن على Siizen", () => {
  it("١· الرسالة بتنخزّن وبتنربط بالشركة الصح من التوبيك", async () => {
    const out = await ingest.ingestUpdate(photoUpdate({
      caption: "Siizen 8-1",
      msgId: 5001,
      thread: 3584, // توبيك Siizen كما بالربط الحقيقي
      from: "أيمن ديزاينst",
    }) as never);
    expect(out?.stored).toBe(true);
    expect(out?.unlinked).toBe(false);
    const co = await db.prisma.company.findFirst({ where: { name: { contains: "Siizen" } } });
    expect(out?.companyId).toBe(co!.id);
  });

  it("٢· الكابشن «Siizen 8-1» بيطابق بوست ١ وبيسكّر تصميمه", async () => {
    const msg = await db.prisma.telegramMessage.findFirst({
      where: { messageId: 5001 },
    });
    expect(msg?.taskId).not.toBeNull();
    const task = await db.prisma.task.findUnique({ where: { id: msg!.taskId! } });
    expect(task?.type).toBe("POST");
    expect(task?.pieceNo).toBe(1);
    expect(task?.stage).toBe("DESIGN");
    expect(task?.board).toBe("DONE"); // الإقفال صار، مو بس المطابقة
  });

  it("٣· وتقرير المنجَز بيشوفها: بحصيلة الفريق وبقسم التسليمات", async () => {
    const today = new Date();
    const [employees, companies, tasks, messages] = await Promise.all([
      db.prisma.employee.findMany(),
      db.prisma.company.findMany(),
      db.prisma.task.findMany(),
      db.prisma.telegramMessage.findMany({
        where: { sentAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) } },
      }),
    ]);
    const coName = new Map(companies.map((c) => [c.id, c.name]));
    const r = report.buildDailyDoneReport(
      today,
      employees as never,
      companies as never,
      tasks as never,
      report.DONE_REPORT_PEOPLE,
      messages.map((m) => ({
        senderName: m.senderName,
        companyName: m.companyId ? (coName.get(m.companyId) ?? null) : null,
        kind: m.kind,
        fileName: m.fileName,
        matched: m.taskId != null,
      })),
    );
    // بالحصيلة لأن الكرت انسكّر اليوم…
    expect(r.text).toMatch(/تصميم:.*Siizen 1 بوست/);
    // …وبقسم التسليمات لأن الملف وصل اليوم — مطابقاً، فبلا ⚠️.
    expect(r.text).toMatch(/تلغرام اليوم: 1 ملف(?! — منها)/);
    expect(r.text).toContain("Siizen: أيمن ديزاينst 1");
  });

  it("٤· الصورة بلا كابشن بتنخزّن حرّة وبتبان «غير مطابق» — ما بتختفي", async () => {
    const out = await ingest.ingestUpdate(photoUpdate({
      msgId: 5002,
      thread: 3584,
      from: "أيمن ديزاينst",
    }) as never);
    expect(out?.stored).toBe(true);
    expect(out?.taskId ?? null).toBeNull(); // بلا اسم ولا كابشن: ما في شي يُطابَق عليه

    const messages = await db.prisma.telegramMessage.findMany({ where: { messageId: { in: [5001, 5002] } } });
    const companies = await db.prisma.company.findMany();
    const coName = new Map(companies.map((c) => [c.id, c.name]));
    const r = report.buildDailyDoneReport(
      new Date(),
      (await db.prisma.employee.findMany()) as never,
      companies as never,
      (await db.prisma.task.findMany()) as never,
      report.DONE_REPORT_PEOPLE,
      messages.map((m) => ({
        senderName: m.senderName,
        companyName: m.companyId ? (coName.get(m.companyId) ?? null) : null,
        kind: m.kind,
        fileName: m.fileName,
        matched: m.taskId != null,
      })),
    );
    expect(r.text).toContain("منها 1 غير مطابق ⚠️");
  });

  it("٤ب· الكابشن العربي بلا اسم الشركة بيطابق — التوبيك بيسمّيها", async () => {
    // «هو بعت رقم البوست والشهر متل ما اتفقنا» (القائدة 11/8): أيمن بيكتب
    // «بوست 8-2» بلا «Siizen» لأن التوبيك نفسه بيقول الشركة. كانت المطابقة
    // تشترط اسماً لاتينياً فترفضه — وهاد سبب «غير مطابق» الحقيقي.
    const out = await ingest.ingestUpdate(photoUpdate({
      caption: "بوست 8-2",
      msgId: 5004,
      thread: 3584,
      from: "أيمن ديزاينst",
    }) as never);
    expect(out?.taskId).not.toBeNull();
    const task = await db.prisma.task.findUnique({ where: { id: out!.taskId! } });
    expect(task?.type).toBe("POST");
    expect(task?.pieceNo).toBe(2);
    expect(task?.board).toBe("DONE");
  });

  it("٥· نفس الرسالة مرتين ما بتنخزّن مرتين (تلغرام بيعيد الإرسال)", async () => {
    const again = await ingest.ingestUpdate(photoUpdate({
      caption: "Siizen 8-1",
      msgId: 5001,
      thread: 3584,
      from: "أيمن ديزاينst",
    }) as never);
    expect(again?.stored).toBe(false);
    expect(await db.prisma.telegramMessage.count({ where: { messageId: 5001 } })).toBe(1);
  });

  it("٦· توبيك مجهول بينخزّن غير مربوط — وبيبان للقائدة بدل ما ينبلع", async () => {
    const out = await ingest.ingestUpdate(photoUpdate({
      caption: "شي جديد",
      msgId: 5003,
      thread: 999777, // توبيك ما منعرفه
      from: "حدا جديد",
    }) as never);
    expect(out?.stored).toBe(true);
    expect(out?.unlinked).toBe(true);
    const chat = await db.prisma.telegramChat.findFirst({ where: { threadId: 999777 } });
    expect(chat).not.toBeNull();
    expect(chat?.companyId).toBeNull();
  });
});
