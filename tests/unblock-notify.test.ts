/**
 * «صار جاهز إلك» (خطة A، ٢٩/١٠) — رسالة خاصة لصاحب المرحلة الجاية لما ينفكّ حجزه.
 * نسخة معزولة من dev.db؛ الإقفال بيمرق من نفس المسارات الحية: قائمة الحالة (`moveCard` /
 * `updateTaskStatus`) وملف على تلغرام (`ingestUpdate`).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-unblock-notify-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
const sent = vi.hoisted(() => ({
  calls: [] as { chatId: string; text: string; silent: boolean }[],
  fail: "",
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({ assertAdmin: async () => {} }));
vi.mock("@/lib/telegram/client", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/telegram/client")>();
  return {
    ...orig,
    sendMessage: async (chatId: string, text: string, opts: { silent?: boolean } = {}) => {
      sent.calls.push({ chatId, text, silent: !!opts.silent });
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
let tasks: typeof import("@/server/actions/tasks");
let tg: typeof import("@/server/actions/telegram");
let notify: typeof import("@/server/unblock-notify");
let ingest: typeof import("@/lib/telegram/ingest");

const CHAT = -1009990088;
const TOPIC = 601;
const TG = { majed: "771000001", lilas: "771000002", omar: "771000003" };
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ids = { majed: "", lilas: "", omar: "", noTg: "", co: "" };

/** سلسلة ريل كاملة: تصوير ← مونتاج ← نشر، كل مرحلة لصاحبها. */
async function chain(piece: number, owners: { shoot: string; edit: string; publish: string }) {
  const key = `unblock|REEL|${piece}`;
  const common = {
    companyId: ids.co, type: "REEL", pieceNo: piece, kind: "CONTENT", month: 9, year: 2026,
    pipelineKey: key, brief: "سكريبت", publishDate: day("2026-11-05"),
  };
  const shoot = await prisma.task.create({ data: { ...common, stage: "SHOOT", title: `تصوير ريل ${piece}`, assigneeId: owners.shoot, workDate: day("2026-10-28"), readyDate: day("2026-10-28") } as never });
  const edit = await prisma.task.create({ data: { ...common, stage: "EDIT", title: `مونتاج ريل ${piece}`, assigneeId: owners.edit, blockedById: shoot.id, workDate: day("2026-11-01"), readyDate: day("2026-11-01") } as never });
  const publish = await prisma.task.create({ data: { ...common, stage: "PUBLISH", title: `نشر ريل ${piece}`, assigneeId: owners.publish, blockedById: edit.id } as never });
  return { shoot: shoot.id, edit: edit.id, publish: publish.id };
}

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  tasks = await import("@/server/actions/tasks");
  tg = await import("@/server/actions/telegram");
  notify = await import("@/server/unblock-notify");
  ingest = await import("@/lib/telegram/ingest");
  const emp = (name: string, telegramUserId: string | null, role: string) =>
    prisma.employee.create({ data: { name, role, workDays: "[0,1,2,3,4]", telegramUserId } });
  ids.majed = (await emp("ماجد-إشعار", TG.majed, "مصوّر")).id;
  ids.lilas = (await emp("ليلاس-إشعار", TG.lilas, "مونتيرة")).id;
  ids.omar = (await emp("عمر-إشعار", TG.omar, "ناشر")).id;
  ids.noTg = (await emp("بلا-تلغرام-إشعار", null, "ناشر")).id;
  ids.co = (await prisma.company.create({
    data: { name: "شركة-فحص-إشعار", slug: "Gamma", status: "active", managed: true, publishStartDate: day("2026-10-10") } as never,
  })).id;
  await prisma.telegramChat.create({ data: { id: `${CHAT}#${TOPIC}`, chatId: String(CHAT), threadId: TOPIC, title: "Gamma", companyId: ids.co } });
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

beforeEach(() => {
  sent.calls = [];
  sent.fail = "";
});

const std = () => ({ shoot: ids.majed, edit: ids.lilas, publish: ids.omar });

describe.skipIf(!scratch.available)("إشعار «صار جاهز إلك»", () => {
  it("مطفي افتراضياً: إقفال التصوير ما بيبعت شي", async () => {
    expect(await notify.isUnblockNotifyOn()).toBe(false);
    const c = await chain(1, std());
    expect((await tasks.moveCard(c.shoot, "DONE")).ok).toBe(true);
    expect(sent.calls).toHaveLength(0);
  });

  it("بعد التشغيل: إقفال التصوير من اللوح ← رسالة وحدة للمونتيرة بالكرت يلي صار جاهز", async () => {
    expect((await tg.setUnblockNotify(true)).ok).toBe(true);
    const c = await chain(2, std());
    expect((await tasks.moveCard(c.shoot, "DONE")).ok).toBe(true);
    expect(sent.calls).toHaveLength(1);
    expect(sent.calls[0].chatId).toBe(TG.lilas);
    expect(sent.calls[0].text).toContain("مونتاج ريل 2");
    expect(sent.calls[0].text).toContain("شركة-فحص-إشعار");
    expect(sent.calls[0].text).not.toContain("نشر ريل 2"); // النشر لسا ورا المونتاج
  });

  it("كل كرت مرّة وحدة: رجوع التصوير وإقفاله من جديد ما بيكرّر الرسالة", async () => {
    const c = await chain(3, std());
    await tasks.moveCard(c.shoot, "DONE");
    await tasks.moveCard(c.shoot, "TODO");
    await tasks.moveCard(c.shoot, "DONE");
    expect(sent.calls.filter((m) => m.text.includes("مونتاج ريل 3"))).toHaveLength(1);
  });

  it("ما بيبعت للشخص عن شغله هو (ليلاس مصوّرة ومونتيرة)", async () => {
    const c = await chain(4, { shoot: ids.lilas, edit: ids.lilas, publish: ids.omar });
    await tasks.moveCard(c.shoot, "DONE");
    expect(sent.calls).toHaveLength(0);
  });

  it("updateTaskStatus كمان: إقفال المونتاج ← الناشر بيوصله", async () => {
    const c = await chain(5, std());
    await tasks.moveCard(c.shoot, "DONE");
    sent.calls = [];
    expect((await tasks.updateTaskStatus(c.edit, "READY")).ok).toBe(true);
    expect(sent.calls.map((m) => m.chatId)).toEqual([TG.omar]);
    expect(sent.calls[0].text).toContain("نشر ريل 5");
  });

  it("الإقفال المرفوض (مونتاج قبل تصويره) ما بيبعت شي", async () => {
    const c = await chain(6, std());
    expect((await tasks.moveCard(c.edit, "DONE")).ok).toBe(false);
    expect(sent.calls).toHaveLength(0);
  });

  it("فشل الإرسال ما بيوقّع الإقفال، وما بينعلّم «انبعت» — بيرجع ينبعت بالمرّة الجاية", async () => {
    const c = await chain(7, std());
    sent.fail = "Bad Request: chat not found";
    expect((await tasks.moveCard(c.shoot, "DONE")).ok).toBe(true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: c.shoot } })).board).toBe("DONE");
    sent.fail = "";
    sent.calls = [];
    const again = await notify.notifyUnblocked([c.shoot]);
    expect(again.sent).toBe(1);
  });

  it("صاحب بلا معرّف تلغرام ← ما في إرسال، والسبب مكتوب", async () => {
    const c = await chain(8, { shoot: ids.majed, edit: ids.noTg, publish: ids.omar });
    await prisma.task.update({ where: { id: c.shoot }, data: { board: "DONE", status: "READY" } });
    const r = await notify.notifyUnblocked([c.shoot]);
    expect(r.sent).toBe(0);
    expect(r.skipped.join()).toContain("بلا معرّف تلغرام");
  });

  it("برّا الدوام صامتة: الجمعة، أو قبل ٩ الصبح بدمشق؛ وجوّا الدوام بصوت", async () => {
    const mk = async (piece: number) => {
      const c = await chain(piece, std());
      await prisma.task.update({ where: { id: c.shoot }, data: { board: "DONE", status: "READY" } });
      return c;
    };
    const fri = await mk(9);
    await notify.notifyUnblocked([fri.shoot], new Date("2026-10-30T09:00:00Z")); // جمعة ١٢:٠٠ دمشق
    const early = await mk(10);
    await notify.notifyUnblocked([early.shoot], new Date("2026-10-29T04:00:00Z")); // خميس ٠٧:٠٠
    const work = await mk(11);
    await notify.notifyUnblocked([work.shoot], new Date("2026-10-29T08:00:00Z")); // خميس ١١:٠٠
    expect(sent.calls.map((m) => m.silent)).toEqual([true, true, false]);
  });

  it("بمسار البوت الحي: ليلاس بتبعت المونتاج على تلغرام ← بينسكّر، والناشر بيوصله «صار جاهز»", async () => {
    const c = await chain(12, std());
    await prisma.task.update({ where: { id: c.shoot }, data: { board: "DONE", status: "READY" } });
    const out = await ingest.ingestUpdate({
      update_id: 991001,
      message: {
        message_id: 9101,
        date: Math.floor(Date.now() / 1000) - 60,
        chat: { id: CHAT, type: "supergroup", title: "Team" },
        message_thread_id: TOPIC,
        from: { id: Number(TG.lilas), is_bot: false, first_name: "Lilas" },
        video: { file_id: "vidG12", file_name: "Gamma-reel-11-12.mp4", duration: 30, width: 1080, height: 1920 },
      },
    } as never);
    expect(out?.held).toBeUndefined();
    expect((await prisma.task.findUniqueOrThrow({ where: { id: c.edit } })).board).toBe("DONE");
    expect(sent.calls.map((m) => m.chatId)).toEqual([TG.omar]);
    expect(sent.calls[0].text).toContain("نشر ريل 12");
  });

  it("الإطفاء بيرجّع الصمت", async () => {
    expect((await tg.setUnblockNotify(false)).ok).toBe(true);
    const c = await chain(13, std());
    await tasks.moveCard(c.shoot, "DONE");
    expect(sent.calls).toHaveLength(0);
  });
});
