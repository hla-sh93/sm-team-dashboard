/**
 * «سلسلة مراحل» من أولها لآخرها (خطة التحسينات B) — نسخة معزولة من dev.db.
 * إنشاء ← إعادة توليد الشهر ما بتمحي ولا بتحرّك ← «بانتظار» ← الإقفال من اللوح وتلغرام.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-task-chain-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
const auth = vi.hoisted(() => ({ admin: true }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {
    if (!auth.admin) throw new Error("unauthorized");
  },
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
let chain: typeof import("@/server/actions/task-chain");
let tasks: typeof import("@/server/actions/tasks");
let engine: typeof import("@/server/schedule-engine");
let ingest: typeof import("@/lib/telegram/ingest");
let readiness: typeof import("@/lib/readiness");

const CHAT = -1009990099;
const TOPIC = 701;
const TG = { ayman: "772000001", omar: "772000002" };
const ids = { ayman: "", omar: "", co: "" };
const TARGET = "2026-11-17"; // ثلاثاء، دلو تشرين التاني
const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
let created: string[] = [];
let fileNames: string[] = [];

const input = () => ({
  title: "هوية بصرية جديدة",
  brief: "لوغو + ألوان + بوست إعلان",
  companyId: ids.co,
  priority: "NORMAL" as const,
  targetISO: TARGET,
  steps: [
    { stage: "DESIGN" as const, assigneeId: ids.ayman, days: 2 },
    { stage: "PUBLISH" as const, assigneeId: ids.omar, days: 0 },
  ],
});

beforeAll(async () => {
  if (!scratch.available) return;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T08:00:00Z")); // الاثنين ١١:٠٠ دمشق
  prisma = (await import("@/lib/db")).prisma as never;
  chain = await import("@/server/actions/task-chain");
  tasks = await import("@/server/actions/tasks");
  engine = await import("@/server/schedule-engine");
  ingest = await import("@/lib/telegram/ingest");
  readiness = await import("@/lib/readiness");
  ids.ayman = (await prisma.employee.create({ data: { name: "أيمن-سلسلة", role: "مصمم", workDays: "[0,1,2,3,4]", telegramUserId: TG.ayman } })).id;
  ids.omar = (await prisma.employee.create({ data: { name: "عمر-سلسلة", role: "ناشر", workDays: "[0,1,2,3,4,6]", telegramUserId: TG.omar } })).id;
  ids.co = (await prisma.company.create({
    data: { name: "شركة-فحص-سلسلة", slug: "Chainco", status: "active", managed: false } as never,
  })).id;
  await prisma.telegramChat.create({ data: { id: `${CHAT}#${TOPIC}`, chatId: String(CHAT), threadId: TOPIC, title: "Chainco", companyId: ids.co } });
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("سلسلة تصميم ← نشر", () => {
  it("بلا صلاحية إدارة ← رفض بالمعاينة والإنشاء", async () => {
    auth.admin = false;
    expect((await chain.previewTaskChain(input())).ok).toBe(false);
    expect((await chain.createTaskChain(input(), "x")).ok).toBe(false);
    auth.admin = true;
  });

  it("بلا وصف · ترتيب مقلوب ← رفض بسبب", async () => {
    expect((await chain.previewTaskChain({ ...input(), brief: " " })).ok).toBe(false);
    const flipped = { ...input(), steps: [...input().steps].reverse() };
    const r = await chain.previewTaskChain(flipped);
    expect(r.ok).toBe(false);
  });

  it("المعاينة: التصميم ١٢–١٥/١١ عند أيمن، والنشر ١٧/١١ عند عمر", async () => {
    const r = await chain.previewTaskChain(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps.map((s) => [s.label, s.assigneeName, s.workISO, s.readyISO])).toEqual([
      ["تصميم", "أيمن-سلسلة", "2026-11-12", "2026-11-15"],
      ["نشر", "عمر-سلسلة", TARGET, TARGET],
    ]);
  });

  it("بصمة قديمة ← رفض وما بينخلق شي", async () => {
    const before = await prisma.task.count();
    const r = await chain.createTaskChain(input(), "stale");
    expect(r.ok).toBe(false);
    expect(await prisma.task.count()).toBe(before);
  });

  it("الإنشاء: كرتين مربوطين بمفتاح واحد، مثبّتين، بدلو تشرين التاني، وكل كرت إله اسم ملف", async () => {
    const p = await chain.previewTaskChain(input());
    if (!p.ok) throw new Error(p.error);
    const r = await chain.createTaskChain(input(), p.fingerprint);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    created = r.ids;
    fileNames = r.fileNames;
    const [design, publish] = await Promise.all(created.map((id) => prisma.task.findUniqueOrThrow({ where: { id } })));
    expect(design).toMatchObject({ kind: "ADHOC", stage: "DESIGN", assigneeId: ids.ayman, isPinned: true, blockedById: null, year: 2026, month: 10, hours: 16 });
    expect(publish).toMatchObject({ kind: "ADHOC", stage: "PUBLISH", assigneeId: ids.omar, isPinned: true, blockedById: design.id });
    expect(design.pipelineKey).toMatch(/^chain_/);
    expect(publish.pipelineKey).toBe(design.pipelineKey);
    expect(dayKey(publish.publishDate)).toBe(TARGET);
    expect(design.title).toBe("تصميم: هوية بصرية جديدة");
    expect(design.notes).toContain("سلسلة «تصميم ← نشر»");
    expect(fileNames[0]).toMatch(/^Chainco-extra-[a-z]{5}$/);
  });

  it("إعادة توليد الشهر ما بتمحي ولا بتحرّك كروت السلسلة", async () => {
    const before = await prisma.task.findMany({ where: { id: { in: created } } });
    const built = await engine.generateScheduleInternal(2026, 10, null);
    expect(built.ok).toBe(true);
    const after = await prisma.task.findMany({ where: { id: { in: created } } });
    expect(after).toHaveLength(2);
    for (const a of after) {
      const b = before.find((x) => x.id === a.id)!;
      expect([dayKey(a.workDate), dayKey(a.readyDate), dayKey(a.publishDate), a.blockedById]).toEqual([
        dayKey(b.workDate), dayKey(b.readyDate), dayKey(b.publishDate), b.blockedById,
      ]);
    }
  });

  it("النشر «بانتظار» التصميم وصاحبه أيمن", async () => {
    const all = (await prisma.task.findMany({ where: { id: { in: created } } })) as never[];
    const r = readiness.makeReadiness(all)(all.find((t: { stage: string }) => t.stage === "PUBLISH")!);
    expect(r).toMatchObject({ state: "waiting", blockerOwnerId: ids.ayman });
  });

  it("تلغرام: ملف أيمن باسم الكرت بيسكّر التصميم، ورد عمر «تم النشر» عليه بيسكّر النشر", async () => {
    const msg = (id: number, from: string, extra: Record<string, unknown>) => ({
      update_id: 993000 + id,
      message: {
        message_id: id,
        date: Math.floor(Date.now() / 1000) - 30,
        chat: { id: CHAT, type: "supergroup", title: "Team" },
        message_thread_id: TOPIC,
        from: { id: Number(from), is_bot: false, first_name: "x" },
        ...extra,
      },
    });
    const file = await ingest.ingestUpdate(
      msg(9301, TG.ayman, { document: { file_id: "docC1", file_name: `${fileNames[0]}.pdf`, mime_type: "application/pdf" } }) as never,
    );
    expect(file?.held).toBeUndefined();
    expect((await prisma.task.findUniqueOrThrow({ where: { id: created[0] } })).board).toBe("DONE");
    await ingest.ingestUpdate(msg(9302, TG.omar, { text: "تم النشر", reply_to_message: { message_id: 9301 } }) as never);
    const publish = await prisma.task.findUniqueOrThrow({ where: { id: created[1] } });
    expect(publish.board).toBe("DONE");
  });

  it("سلسلة كتابة ← تصميم: الكتابة كرت إضافي بلا مرحلة (مدّته من الساعات)، والتصميم ورا", async () => {
    const steps = [
      { stage: "WRITE" as const, assigneeId: ids.ayman, days: 0.5 },
      { stage: "DESIGN" as const, assigneeId: ids.ayman, days: 1 },
    ];
    const p = await chain.previewTaskChain({ ...input(), steps, targetISO: "2026-11-20" });
    if (!p.ok) throw new Error(p.error);
    const r = await chain.createTaskChain({ ...input(), steps, targetISO: "2026-11-20" }, p.fingerprint);
    if (!r.ok) throw new Error(r.error);
    const [write, design] = await Promise.all(r.ids.map((id) => prisma.task.findUniqueOrThrow({ where: { id } })));
    expect(write).toMatchObject({ stage: null, hours: 4, title: "كتابة: هوية بصرية جديدة" });
    expect(design.blockedById).toBe(write.id);
    // مونتاج/تصميم ما بينسكّر قبل الكتابة (حاجز إضافي بلا مرحلة = حاجز حقيقي).
    expect((await tasks.moveCard(design.id, "DONE")).ok).toBe(false);
    expect((await tasks.moveCard(write.id, "DONE")).ok).toBe(true);
    expect((await tasks.moveCard(design.id, "DONE")).ok).toBe(true);
  });

  it("حذف مرحلة من النص ← يلي بعدها بينربط باللي قبلها (ما بتنفكّ قبل وقتها)", async () => {
    const steps = [
      { stage: "WRITE" as const, assigneeId: ids.ayman, days: 0.5 },
      { stage: "DESIGN" as const, assigneeId: ids.ayman, days: 1 },
      { stage: "PUBLISH" as const, assigneeId: ids.omar, days: 0 },
    ];
    const body = { ...input(), steps, targetISO: "2026-11-24" };
    const p = await chain.previewTaskChain(body);
    if (!p.ok) throw new Error(p.error);
    const r = await chain.createTaskChain(body, p.fingerprint);
    if (!r.ok) throw new Error(r.error);
    const [writeId, designId, publishId] = r.ids;
    expect((await tasks.deleteTasks([designId])).ok).toBe(true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: publishId } })).blockedById).toBe(writeId);
    // حذف المرحلتين قبل النشر سوا ← النشر بلا حاجز.
    expect((await tasks.deleteTasks([writeId])).ok).toBe(true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: publishId } })).blockedById).toBeNull();
  });
});
