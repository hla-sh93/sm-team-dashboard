/**
 * «مين عمل شو» (خطة التحسينات F، ٢٩/١٠) — نسخة معزولة من dev.db. صار ١١/١٠: ٦ مونتاجات انسكّروا
 * بالإيد وما في طريقة نعرف مين. هلّق كل تغيير حالة بينكتب: من اللوح، من قائمة الحالة، ومن تلغرام.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-task-events-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
const jar = vi.hoisted(() => ({ actor: undefined as string | undefined, admin: null as null | { kind: "owner" } }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "sm_actor" && jar.actor ? { name, value: jar.actor } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {},
  currentAdmin: async () => jar.admin,
  listExtraAdmins: async () => [],
}));
vi.mock("@/lib/telegram/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telegram/client")>()),
  sendMessage: async () => ({ ok: true as const, result: { message_id: 1 } }),
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let events: typeof import("@/server/task-events");
let tasks: typeof import("@/server/actions/tasks");
let ingest: typeof import("@/lib/telegram/ingest");
const ids = { lilas: "", co: "" };
const CHAT = -1009990111;
const TOPIC = 801;
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const card = (data: Record<string, unknown>) =>
  prisma.task.create({
    data: { kind: "ADHOC", title: "كرت فحص الأثر", hours: 4, year: 2026, month: 9, isAuto: false, status: "NOT_STARTED", board: "TODO", assigneeId: ids.lilas, companyId: ids.co, ...data } as never,
  });
const eventsOf = async (taskId: string) => (await events.loadTaskEvents(30)).filter((e) => e.taskId === taskId);

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  events = await import("@/server/task-events");
  tasks = await import("@/server/actions/tasks");
  ingest = await import("@/lib/telegram/ingest");
  ids.lilas = (await prisma.employee.create({ data: { name: "ليلاس-أثر", role: "مونتيرة", workDays: "[0,1,2,3,4]", telegramUserId: "773000001" } })).id;
  ids.co = (await prisma.company.create({ data: { name: "شركة-فحص-أثر", slug: "Traceco", status: "active", managed: false } as never })).id;
  await prisma.telegramChat.create({ data: { id: `${CHAT}#${TOPIC}`, chatId: String(CHAT), threadId: TOPIC, title: "Traceco", companyId: ids.co } });
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

beforeEach(() => {
  jar.actor = undefined;
  jar.admin = null;
});

describe.skipIf(!scratch.available)("أثر الفاعل", () => {
  it("الفاعل: «أنا مين» من الكوكي ← اسمه؛ جلسة الإدارة ← «الإدارة»؛ كوكي غريبة ← بلا اسم", async () => {
    jar.actor = ids.lilas;
    expect(await events.currentActor()).toEqual({ id: ids.lilas, name: "ليلاس-أثر" });
    jar.admin = { kind: "owner" };
    expect((await events.currentActor()).name).toBe("الإدارة");
    jar.admin = null;
    jar.actor = "not-an-employee";
    expect(await events.currentActor()).toEqual({ id: null, name: null });
    jar.actor = "bad value; drop";
    expect(await events.currentActor()).toEqual({ id: null, name: null });
  });

  it("اللوح (moveCard) بيكتب: الكرت، من ← لـ، المصدر، واسم الجهاز", async () => {
    const t = await card({});
    jar.actor = ids.lilas;
    expect((await tasks.moveCard(t.id, "DOING")).ok).toBe(true);
    expect((await tasks.moveCard(t.id, "DONE")).ok).toBe(true);
    const ev = await eventsOf(t.id);
    expect(ev.map((e) => [e.from, e.to, e.source, e.actor])).toEqual([
      ["DOING", "DONE", "board", "ليلاس-أثر"],
      ["TODO", "DOING", "board", "ليلاس-أثر"],
    ]);
  });

  it("قائمة الحالة (updateTaskStatus) بلا «أنا مين» ← بينكتب «بلا اسم»، وما في سطر لما الحالة ما تغيّرت", async () => {
    const t = await card({});
    expect((await tasks.updateTaskStatus(t.id, "IN_PROGRESS")).ok).toBe(true);
    expect((await tasks.updateTaskStatus(t.id, "IN_PROGRESS")).ok).toBe(true);
    const ev = await eventsOf(t.id);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ from: "NOT_STARTED", to: "IN_PROGRESS", source: "status", actor: null });
  });

  it("الإقفال المرفوض (مونتاج قبل تصويره) ما بيكتب أثر", async () => {
    const shoot = await card({ kind: "CONTENT", type: "REEL", stage: "SHOOT", isAuto: true, title: "تصوير أثر" });
    const edit = await card({ kind: "CONTENT", type: "REEL", stage: "EDIT", isAuto: true, blockedById: shoot.id, title: "مونتاج أثر" });
    expect((await tasks.moveCard(edit.id, "DONE")).ok).toBe(false);
    expect(await eventsOf(edit.id)).toHaveLength(0);
  });

  it("تلغرام: ملف ليلاس باسم الكرت ← أثر باسمها والملف", async () => {
    const t = await card({});
    const { extraAssetName } = await import("@/lib/asset-name");
    const name = extraAssetName({ name: "شركة-فحص-أثر", slug: "Traceco" }, t);
    const out = await ingest.ingestUpdate({
      update_id: 994001,
      message: {
        message_id: 9401,
        date: Math.floor(Date.now() / 1000) - 30,
        chat: { id: CHAT, type: "supergroup", title: "Team" },
        message_thread_id: TOPIC,
        from: { id: 773000001, is_bot: false, first_name: "Lilas" },
        document: { file_id: "docT1", file_name: `${name}.pdf`, mime_type: "application/pdf" },
      },
    } as never);
    expect(out?.held).toBeUndefined();
    const ev = await eventsOf(t.id);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ source: "telegram", to: "DONE", actorId: ids.lilas });
    expect(ev[0].actor).toContain("ليلاس-أثر");
    expect(ev[0].actor).toContain(`${name}.pdf`);
  });

  it("التقليم: الأحداث الأقدم من ١٢٠ يوم بتنشال بأول كتابة", async () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    await prisma.setting.create({ data: { key: `taskEvent:${old}:zzz`, value: JSON.stringify({ taskId: "x", from: "TODO", to: "DONE", source: "board", actor: null, actorId: null, at: old }) } });
    await events.recordTaskEvent({ taskId: "y", from: "TODO", to: "DOING", source: "board", actor: "فحص", actorId: null });
    expect(await prisma.setting.count({ where: { key: `taskEvent:${old}:zzz` } })).toBe(0);
  });
});
