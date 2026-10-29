/**
 * ربط موظفين بتلغرام من الواجهة (القائدة ٢٩/١٠: «تلغرام يمكن ما عم يربط اسم ليلاس صح؟»).
 * نسخة معزولة من dev.db؛ الموظفين والشركة والكروت مخلوقين للفحص؛ رسائل تلغرام بتمرق بمسار
 * الويبهوك الحي (`ingestUpdate`).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-tg-identity-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
const sent = vi.hoisted(() => ({ calls: [] as { chatId: string; text: string }[], fail: "" }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  assertAdmin: async () => {},
  isOwnerSession: async () => true,
}));
vi.mock("@/lib/telegram/client", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/telegram/client")>();
  return {
    ...orig,
    sendMessage: async (chatId: string, text: string) => {
      sent.calls.push({ chatId, text });
      return sent.fail ? { ok: false as const, error: sent.fail } : { ok: true as const, result: { message_id: 1 } };
    },
  };
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let employees: typeof import("@/server/actions/employees");
let identity: typeof import("@/server/actions/telegram-identity");
let senders: typeof import("@/server/telegram-identity");
let ingest: typeof import("@/lib/telegram/ingest");

const CHAT = -1009990077;
const TOPIC = 501;
const LILAS_TG = "770000123";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
let lilasId = "";
let otherId = "";
let editCardId = "";
let shootCardId = "";
let n = 0;

const video = (fileName: string, from = { id: Number(LILAS_TG), first_name: "Lilas" }) => {
  n++;
  return {
    update_id: 990000 + n,
    message: {
      message_id: 8000 + n,
      date: Math.floor(Date.now() / 1000) - 60,
      chat: { id: CHAT, type: "supergroup", title: "Team" },
      message_thread_id: TOPIC,
      from: { is_bot: false, ...from },
      video: { file_id: `vid${n}`, file_name: fileName, duration: 30, width: 1080, height: 1920 },
    },
  };
};

const base = (name: string) => ({
  name,
  role: "مونتيرة",
  hoursPerDay: 8,
  workDays: [0, 1, 2, 3, 4],
  isScheduled: true,
  isPhotographer: false,
});

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  employees = await import("@/server/actions/employees");
  identity = await import("@/server/actions/telegram-identity");
  senders = await import("@/server/telegram-identity");
  ingest = await import("@/lib/telegram/ingest");
  lilasId = (await prisma.employee.create({ data: { name: "ليلاس-فحص", role: "مصوّرة ومونتيرة", workDays: "[0,1,2,3,4]" } })).id;
  otherId = (await prisma.employee.create({
    data: { name: "زميل-فحص", role: "مصمم", workDays: "[0,1,2,3,4]", telegramUserId: "770000999", telegramAliases: "Zameel" },
  })).id;
  const co = await prisma.company.create({
    data: { name: "شركة-فحص-تلغرام", slug: "Delta", status: "active", managed: true, publishStartDate: day("2026-10-10") } as never,
  });
  await prisma.telegramChat.create({ data: { id: `${CHAT}#${TOPIC}`, chatId: String(CHAT), threadId: TOPIC, title: "Delta", companyId: co.id } });
  const key = "tg-identity|REEL|2";
  const common = { companyId: co.id, type: "REEL", pieceNo: 2, kind: "CONTENT", month: 9, year: 2026, pipelineKey: key, brief: "سكريبت", publishDate: day("2026-11-05") };
  shootCardId = (await prisma.task.create({ data: { ...common, stage: "SHOOT", title: "تصوير ريل ٢", assigneeId: lilasId, workDate: day("2026-10-28"), readyDate: day("2026-10-28") } as never })).id;
  editCardId = (await prisma.task.create({ data: { ...common, stage: "EDIT", title: "مونتاج ريل ٢", assigneeId: lilasId, blockedById: shootCardId, workDate: day("2026-11-01"), readyDate: day("2026-11-01") } as never })).id;
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("حقول تلغرام بنموذج الموظف", () => {
  it("تعديل بلا حقول تلغرام ما بيمحي الربط الموجود (نداء قديم أو سكربت)", async () => {
    const r = await employees.updateEmployee(otherId, { ...base("زميل-فحص"), role: "مصمم" } as never);
    expect(r.ok).toBe(true);
    const e = await prisma.employee.findUniqueOrThrow({ where: { id: otherId } });
    expect(e.telegramUserId).toBe("770000999");
    expect(e.telegramAliases).toBe("Zameel");
  });

  it("الدور النصّي المخزَّن («مونتيرة») بيمرق وبيضل متل ما هو", async () => {
    const r = await employees.updateEmployee(lilasId, { ...base("ليلاس-فحص"), role: "مصوّرة ومونتيرة" } as never);
    expect(r.ok).toBe(true);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: lilasId } })).role).toBe("مصوّرة ومونتيرة");
  });

  it("هوية مكرّرة مرفوضة باسم صاحبها: نفس المعرّف · نفس الاسم البديل", async () => {
    const dupId = await employees.updateEmployee(lilasId, { ...base("ليلاس-فحص"), telegramUserId: "770000999" } as never);
    expect(dupId.ok).toBe(false);
    if (!dupId.ok) expect(dupId.error).toContain("زميل-فحص");
    const dupAlias = await employees.updateEmployee(lilasId, { ...base("ليلاس-فحص"), telegramAliases: "lilas, ZAMEEL" } as never);
    expect(dupAlias.ok).toBe(false);
  });

  it("معرّف بأحرف مرفوض، والأسماء البديلة بتنضّف (فراغات وتكرار)", async () => {
    expect((await employees.updateEmployee(lilasId, { ...base("ليلاس-فحص"), telegramUserId: "abc" } as never)).ok).toBe(false);
    const r = await employees.updateEmployee(lilasId, { ...base("ليلاس-فحص"), telegramAliases: " Lilas ,ليلاس, lilas ,," } as never);
    expect(r.ok).toBe(true);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: lilasId } })).telegramAliases).toBe("Lilas, ليلاس");
    // نرجّع الحالة: بلا أسماء — حتى الفحص الجاي يمثّل «ليلاس مو مربوطة».
    await employees.updateEmployee(lilasId, { ...base("ليلاس-فحص"), telegramAliases: "" } as never);
  });
});

describe.skipIf(!scratch.available)("ليلاس من أول ملف لحدّ الإقفال — بمسار البوت الحي", () => {
  it("قبل الربط: ملفها بينحجز «من غير صاحب الكرت» وما بيسكّر شي، وبتطلع بالمرسلين غير المعروفين", async () => {
    const out = await ingest.ingestUpdate(video("Delta-reel-11-2.mp4", { id: Number(LILAS_TG), first_name: "Lilas Photo" }) as never);
    expect(out?.held).toBe("NOT_OWNER");
    expect((await prisma.task.findUniqueOrThrow({ where: { id: editCardId } })).board).not.toBe("DONE");
    const rows = await senders.loadUnknownTelegramSenders();
    const row = rows.find((r) => r.senderId === LILAS_TG);
    expect(row).toBeTruthy();
    expect(row!.pendingFiles).toBe(1);
    expect(rows.some((r) => r.senderId === "770000999")).toBe(false); // المربوط ما بيطلع
  });

  it("الربط بنقرة ← بيرجّع عدد ملفاتها المعلّقة؛ وحساب مربوط بغيرها مرفوض", async () => {
    const wrong = await identity.linkTelegramSender(lilasId, "770000999");
    expect(wrong.ok).toBe(false);
    const r = await identity.linkTelegramSender(lilasId, LILAS_TG);
    expect(r).toMatchObject({ ok: true, pending: 1 });
    expect((await senders.loadUnknownTelegramSenders()).some((x) => x.senderId === LILAS_TG)).toBe(false);
  });

  it("«طابق ملفاته» بعدد قديم مرفوض، وبالعدد الصح بيسكّر المونتاج (والتصوير بالتتابع) بسطر دليل", async () => {
    expect((await identity.rematchSenderFiles(LILAS_TG, 5)).ok).toBe(false);
    const r = await identity.rematchSenderFiles(LILAS_TG, 1);
    expect(r).toMatchObject({ ok: true, matched: 1, tried: 1 });
    const edit = await prisma.task.findUniqueOrThrow({ where: { id: editCardId } });
    expect(edit.board).toBe("DONE");
    expect(edit.notes).toContain("سُلّم على تلغرام (بالاسم): Delta-reel-11-2.mp4");
    // ليلاس صاحبة التصوير والمونتاج سوا: الريل النهائي بيسكّر المونتاج، والتصوير بالتتابع.
    expect((await prisma.task.findUniqueOrThrow({ where: { id: shootCardId } })).board).toBe("DONE");
  });

  it("بعد الربط: أي ملف جديد منها بيتعرّف فوراً (ولو تغيّر اسمها الظاهر)", async () => {
    const out = await ingest.ingestUpdate(video("Delta-reel-11-2.mp4", { id: Number(LILAS_TG), first_name: "اسم جديد" }) as never);
    expect(out?.held).toBeUndefined();
  });
});

describe.skipIf(!scratch.available)("رسالة اختبار", () => {
  it("بلا معرّف ← رسالة واضحة؛ بمعرّف ← انبعتت للمعرّف؛ «chat not found» ← بيقول ليش", async () => {
    expect((await identity.sendTelegramTest(otherId)).ok).toBe(true);
    expect(sent.calls.at(-1)?.chatId).toBe("770000999");
    sent.fail = "Bad Request: chat not found";
    const r = await identity.sendTelegramTest(otherId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("/start");
    sent.fail = "";
    const none = await prisma.employee.create({ data: { name: "بلا-تلغرام", role: "ناشر", workDays: "[0,1,2,3,4]" } });
    expect((await identity.sendTelegramTest(none.id)).ok).toBe(false);
  });
});
