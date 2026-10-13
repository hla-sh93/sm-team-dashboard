/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور telegram-reports: مسار الويبهوك الحي `ingestUpdate`
 * على قاعدة معزولة (نسخة من `prisma/dev.db` باسم فيه test+telegram، بتنحذف بالآخر).
 *
 * كل الصفوف المفحوصة لعالم اصطناعي (شركتان · توبيكات · خمس موظفين بمعرّفات تلغرام
 * اصطناعية) — ما منعتمد على داتا الإنتاج، والقاعدة بتنبني من جديد قبل كل اختبار.
 * ولا نداء شبكة: `ingestUpdate` ما بتبعت شي، والعالم كلّه بمحادثة وهمية.
 *
 * `it.fails("[TR-nn] …")` = عطل مثبت بـ`docs/qa/deep-test-2026-10-11/telegram-reports.md`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-telegram-ingest-${process.pid}.db`);
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
let ingest: typeof import("@/lib/telegram/ingest");

const P = process.pid;
const uniq = `فحص-تلغرام-${P}`;
const CHAT = -1007700000000 - P;
const T_Z1 = 11, T_Z2 = 12, T_FREE = 13;
const tgId = (n: number) => String(7_700_000_000 + P * 10 + n);
const ID = (s: string) => `tdi${P}_${s}`;
const E = { dA: ID("dA"), dB: ID("dB"), ed: ID("ed"), ph: ID("ph"), pub: ID("pub"), wr: ID("wr"), lead: ID("lead") };
const Z1 = ID("z1"), Z2 = ID("z2");
/** الإرسال: الخميس ٨/١٠ ١٠:٠٠ بالتوقيت المحلي. */
const AT = new Date(2026, 9, 8, 10, 0, 0);
const D = (m0: number, d: number) => new Date(2026, m0, d);

let nextMsg = 5000;
type Upd = {
  thread?: number; from?: string | null; name?: string; username?: string; bot?: boolean; at?: Date; msgId?: number;
  text?: string; caption?: string; photo?: boolean; doc?: { name: string; mime: string }; video?: string;
  group?: string; replyTo?: number; edited?: boolean;
};
function update(o: Upd) {
  const message_id = o.msgId ?? nextMsg++;
  const message: any = {
    message_id,
    date: Math.floor((o.at ?? AT).getTime() / 1000),
    chat: { id: CHAT, type: "supergroup", title: "فريق الاختبار" },
    ...(o.thread != null ? { message_thread_id: o.thread } : {}),
    ...(o.from === null
      ? {}
      : { from: { id: Number(o.from ?? tgId(1)), is_bot: !!o.bot, first_name: o.name ?? "x", ...(o.username ? { username: o.username } : {}) } }),
    ...(o.text ? { text: o.text } : {}),
    ...(o.caption ? { caption: o.caption } : {}),
    ...(o.photo ? { photo: [{ file_id: `f${message_id}`, width: 1080, height: 1350 }] } : {}),
    ...(o.doc ? { document: { file_id: `f${message_id}`, file_name: o.doc.name, mime_type: o.doc.mime } } : {}),
    ...(o.video ? { video: { file_id: `f${message_id}`, file_name: o.video, mime_type: "video/mp4" } } : {}),
    ...(o.group ? { media_group_id: o.group } : {}),
    ...(o.replyTo ? { reply_to_message: { message_id: o.replyTo } } : {}),
  };
  return { update_id: 900_000 + message_id, ...(o.edited ? { edited_message: message } : { message }) } as any;
}
const jpg = (name: string) => ({ name, mime: "image/jpeg" });

function card(co: string, slug: string, bucket: number, type: string, no: number, stage: string, over: Record<string, unknown> = {}) {
  const publish = (over.publishDate as Date) ?? D(9, 10 + no);
  const ready = new Date(publish.getTime() - 2 * 86_400_000);
  const assignee = stage === "PUBLISH" ? E.pub : stage === "SHOOT" ? E.ph : stage === "EDIT" ? E.ed : E.dA;
  return {
    id: ID(`${slug}_${bucket}_${type}_${no}_${stage}`), kind: stage === "PUBLISH" ? "PUBLISH" : "CONTENT",
    type, pieceNo: no, stage, title: `${type} ${no} ${stage}`, status: "NOT_STARTED", board: "TODO", quantity: 1,
    year: 2026, month: bucket, companyId: co, assigneeId: assignee, isAuto: true,
    pipelineKey: `${co}|${bucket}|${type}|${no}`, readyDate: stage === "PUBLISH" ? publish : ready, publishDate: publish,
    workDate: stage === "PUBLISH" ? publish : ready, ...over,
  };
}

async function resetWorld() {
  await prisma.telegramMessage.deleteMany({ where: { id: { startsWith: `${CHAT}:` } } });
  await prisma.task.deleteMany({ where: { companyId: { in: [Z1, Z2] } } });
  const z1: any[] = [];
  // Z1 «Zulu» — بلا أي وصف خطة (بداية دورة قبل استيراد الخطة) → طبقة النوع شغّالة.
  for (const no of [1, 2, 3, 4]) {
    z1.push(card(Z1, "zulu", 9, "POST", no, "DESIGN"));
    z1.push(card(Z1, "zulu", 9, "POST", no, "PUBLISH", { publishDate: D(9, 3 + no) })); // ٤–٧/١٠: مستحقّة قبل ٨/١٠
  }
  const shoot = card(Z1, "zulu", 9, "REEL", 1, "SHOOT");
  z1.push(shoot, card(Z1, "zulu", 9, "REEL", 1, "EDIT", { blockedById: shoot.id }), card(Z1, "zulu", 9, "REEL", 1, "PUBLISH", { publishDate: D(9, 20) }));
  // دلو أيلول (متبقّي مفتوح): نشر بوست ٢ و٣ مستحقّين ٢٨–٢٩/٩.
  z1.push(card(Z1, "zulu", 8, "POST", 2, "PUBLISH", { publishDate: D(8, 28) }), card(Z1, "zulu", 8, "POST", 3, "PUBLISH", { publishDate: D(8, 29) }));
  // Z2 «Yankee» — كروتها عليها وصف الخطة.
  const z2 = [1, 2].flatMap((no) => [
    card(Z2, "yankee", 9, "POST", no, "DESIGN", { brief: no === 1 ? "خبر عاجل عن الذهب" : "نصيحة الأسبوع للمتداولين" }),
    card(Z2, "yankee", 9, "POST", no, "PUBLISH", { publishDate: D(9, 25 + no) }),
  ]);
  // كروت كتابة نوال على Z2: خطة البوستات، سيناريو التصوير، ومقال مدوّنة (متل التوظيف).
  const write = (id: string, title: string, kind: string, ready: Date) => ({
    id: ID(`yankee_w_${id}`), kind, stage: "WRITE", type: null, pieceNo: null, title, status: "NOT_STARTED", board: "TODO",
    quantity: 1, year: 2026, month: 9, companyId: Z2, assigneeId: E.wr, readyDate: ready, workDate: ready, publishDate: null,
  });
  z2.push(
    write("plan", "كتابة بوستات وستوريز — Yankee · دورة 1 تشرين الأول", "CONTENT_WRITING", D(9, 12)) as any,
    write("shoot", "سيناريو تصوير — Yankee · دورة 1 تشرين الأول", "CONTENT_WRITING", D(9, 14)) as any,
    write("blog4", "المدونة — المقال 4: «كيف تجتاز مقابلة العمل بنجاح»", "ADHOC", D(9, 9)) as any,
  );
  await prisma.task.createMany({ data: [...z1, ...z2] });
}

const t = (id: string) => prisma.task.findUnique({ where: { id } });
const closedIds = async (co: string) =>
  (await prisma.task.findMany({ where: { companyId: co, board: "DONE" }, select: { id: true } })).map((x: any) => x.id).sort();

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma;
  ingest = await import("@/lib/telegram/ingest");
  const emp = (id: string, name: string, role: string, n: number | null, over: Record<string, unknown> = {}) =>
    prisma.employee.create({ data: { id, name: `${uniq} ${name}`, role, workDays: "[0,1,2,3,4]", ...(n ? { telegramUserId: tgId(n) } : {}), ...over } });
  await emp(E.dA, "مصمّم أ", "designer", 1);
  await emp(E.dB, "مصمّم ب", "designer", 2);
  await emp(E.ed, "مونتيرة", "مونتيرة", 3);
  await emp(E.ph, "مصوّر", "مصور", 4, { isPhotographer: true });
  await emp(E.pub, "ناشر", "publisher", 5);
  await emp(E.wr, "كاتبة", "كاتبة محتوى", 6);
  await emp(E.lead, "قائدة", "تيم ليدر + نص مصمم", 7);
  const co = (id: string, name: string, slug: string, over: Record<string, unknown> = {}) =>
    prisma.company.create({ data: { id, name: `${uniq} ${name}`, slug, managed: true, posts: 4, reels: 1, postOwnerId: E.dA, photographerId: E.ph, publishStartDate: D(8, 1), renewals: JSON.stringify(["2026-10-01"]), ...over } });
  await co(Z1, "أ", "Zulu");
  await co(Z2, "ب", "Yankee", { publishStartDate: D(9, 1), renewals: null });
  await prisma.telegramChat.createMany({
    data: [
      { id: `${CHAT}#${T_Z1}`, chatId: String(CHAT), threadId: T_Z1, title: "Zulu", type: "supergroup", companyId: Z1 },
      { id: `${CHAT}#${T_Z2}`, chatId: String(CHAT), threadId: T_Z2, title: "Yankee", type: "supergroup", companyId: Z2 },
    ],
  });
});

beforeEach(async () => {
  if (scratch.available) await resetWorld();
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.telegramMessage.deleteMany({ where: { id: { startsWith: `${CHAT}:` } } });
  await prisma.telegramChat.deleteMany({ where: { chatId: String(CHAT) } });
  await prisma.task.deleteMany({ where: { companyId: { in: [Z1, Z2] } } });
  await prisma.company.deleteMany({ where: { id: { in: [Z1, Z2] } } });
  await prisma.employee.deleteMany({ where: { id: { in: Object.values(E) } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe.skipIf(!scratch.available)("ويبهوك تلغرام — مسار ingestUpdate الحي على قاعدة معزولة", () => {
  describe("التخزين والربط بالتوبيك", () => {
    it("ملف بتوبيك مربوط بينخزّن بمعرّف «محادثة#توبيك» وبشركته وبرقم التوبيك", async () => {
      const out = await ingest.ingestUpdate(update({ thread: T_Z1, doc: jpg("Zulu-post-10-1.jpg") }));
      expect(out?.stored).toBe(true);
      expect(out?.companyId).toBe(Z1);
      const row = await prisma.telegramMessage.findUnique({ where: { id: `${CHAT}:${nextMsg - 1}` } });
      expect(row.chatId).toBe(`${CHAT}#${T_Z1}`);
      expect(row.threadId).toBe(T_Z1);
    });

    it("توبيك مجهول: بينخزّن غير مربوط، وما بيسكّر شي", async () => {
      const out = await ingest.ingestUpdate(update({ thread: T_FREE, doc: jpg("Zulu-post-10-1.jpg") }));
      expect(out?.unlinked).toBe(true);
      expect(out?.taskId).toBeNull();
      expect(await closedIds(Z1)).toEqual([]);
      await prisma.telegramChat.deleteMany({ where: { id: `${CHAT}#${T_FREE}` } });
    });

    it("رسالة البوت نفسه ما بتنقرا أبداً", async () => {
      expect(await ingest.ingestUpdate(update({ thread: T_Z1, bot: true, doc: jpg("Zulu-post-10-1.jpg") }))).toBeNull();
    });

    it("نفس التحديث مرتين (تلغرام بيعيد): ما بينخزّن مرتين وما بيسكّر قطعة تانية", async () => {
      const u = update({ thread: T_Z1, doc: jpg("Zulu-post-10-1.jpg") });
      await ingest.ingestUpdate(u);
      const again = await ingest.ingestUpdate(u);
      expect(again?.stored).toBe(false);
      expect(await closedIds(Z1)).toEqual([ID("zulu_9_POST_1_DESIGN")]);
    });

    it("[TR-30] تعديل كابشن ملف ما طابق شي = تصحيح اسم: بياخد جولة مطابقة، وما بينخزّن مرّة تانية", async () => {
      const id = nextMsg++;
      await ingest.ingestUpdate(update({ thread: T_Z2, msgId: id, photo: true }));
      expect(await closedIds(Z2)).toEqual([]);
      const edited = await ingest.ingestUpdate(update({ thread: T_Z2, msgId: id, photo: true, caption: "Yankee-post-10-1", edited: true }));
      expect(edited?.stored).toBe(false);
      expect(edited?.advanced).toBe(true);
      expect(await closedIds(Z2)).toEqual([ID("yankee_9_POST_1_DESIGN")]);
      expect(await prisma.telegramMessage.count({ where: { id: `${CHAT}:${id}` } })).toBe(1);
    });

    it("[TR-30] تعديل ملف مطابَق أصلاً ما بيعيد المطابقة", async () => {
      const id = nextMsg++;
      await ingest.ingestUpdate(update({ thread: T_Z1, msgId: id, doc: jpg("Zulu-post-10-1.jpg") }));
      await ingest.ingestUpdate(update({ thread: T_Z1, msgId: id, doc: jpg("Zulu-post-10-1.jpg"), caption: "Zulu-post-10-2", edited: true }));
      expect(await closedIds(Z1)).toEqual([ID("zulu_9_POST_1_DESIGN")]);
    });
  });

  describe("الدليل على كل إقفال آلي (WORK_RULES §٢)", () => {
    it("إقفال بالاسم بيكتب «سُلّم على تلغرام (بالاسم): <الملف>» وطابع الإنهاء = وقت الملف", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, doc: jpg("Zulu-post-10-2.jpg") }));
      const c = await t(ID("zulu_9_POST_2_DESIGN"));
      expect(c.notes).toContain("سُلّم على تلغرام (بالاسم): Zulu-post-10-2.jpg");
      expect(new Date(c.finishedAt).getTime()).toBe(Math.floor(AT.getTime() / 1000) * 1000);
    });

    it("[TR-12] مونتاج بيسكّر تصويره بالتتابع — كرت التصوير لازم يحمل سطر دليل كمان", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(3), video: "Zulu-reel-10-1.mp4" }));
      const edit = await t(ID("zulu_9_REEL_1_EDIT"));
      const shoot = await t(ID("zulu_9_REEL_1_SHOOT"));
      expect(edit.board).toBe("DONE");
      expect(shoot.board).toBe("DONE");
      expect(shoot.notes ?? "").toMatch(/تلغرام|Zulu-reel-10-1/);
    });
  });

  describe("تأكيد النشر من المجموعة", () => {
    it("«تم النشر» من الناشر بتسكّر أقدم قطعة نشر مستحقّة — وحدة بس، بدليل", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), text: "تم النشر" }));
      const closed = await closedIds(Z1);
      expect(closed).toEqual([ID("zulu_8_POST_2_PUBLISH")]);
      expect((await t(closed[0])).notes).toContain("تأكيد نشر على تلغرام");
    });

    it("[TR-08] نفس تحديث «تم النشر» لما تلغرام يعيده — ما لازم يسكّر قطعة تانية", async () => {
      const u = update({ thread: T_Z1, from: tgId(5), text: "تم النشر" });
      await ingest.ingestUpdate(u);
      await ingest.ingestUpdate(u);
      expect(await closedIds(Z1)).toHaveLength(1);
    });

    it("[TR-08] تعديل رسالة «تم النشر» (edited_message) ما لازم يسكّر قطعة تانية", async () => {
      const id = nextMsg++;
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), msgId: id, text: "تم النشر" }));
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), msgId: id, text: "تم النشر ✅", edited: true }));
      expect(await closedIds(Z1)).toHaveLength(1);
    });

    it("[TR-08] رسالة التأكيد لازم تنخزّن بسجلّ الرسائل (هي مفتاح التكافؤ، و«شو وصل اليوم» بيقرا منه)", async () => {
      const id = nextMsg++;
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), msgId: id, text: "تم النشر" }));
      expect(await prisma.telegramMessage.findUnique({ where: { id: `${CHAT}:${id}` } })).not.toBeNull();
    });

    it("[TR-01] كابشن كاتبة المحتوى فيه ✅ مو تأكيد نشر", async () => {
      // نوال بتبعت نصوص الكابشن بالتوبيك — ٢٨ إقفال نشر باللقطة مصدرها هيك («… التداول✅ 📍»).
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(6), text: "المعرفة هي رأس مالك الأول في التداول✅ 📍 تابعونا" }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("[TR-01] النفي «ما نزلت عالموقع» من الناشر مو تأكيد", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), text: "الخارجية نزلتها بس ما نزلت عالموقع" }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("[TR-01] «حقوق نشر» بنصّ حديث مو تأكيد", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), text: "عليها حقوق نشر للفيديو طريقة التسجيل" }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("[TR-08] ملف تصميم كابشنه «جاهز ✅» بيتسجّل تسليماً لتصميمه — مو إقفال نشر وضياع الملف", async () => {
      const id = nextMsg++;
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), msgId: id, doc: jpg("Zulu-post-10-3.jpg"), caption: "جاهز ✅" }));
      expect((await t(ID("zulu_9_POST_3_DESIGN"))).board).toBe("DONE");
      expect(await prisma.telegramMessage.findUnique({ where: { id: `${CHAT}:${id}` } })).not.toBeNull();
      expect((await closedIds(Z1)).filter((x: string) => x.endsWith("PUBLISH"))).toEqual([]);
    });

    it("[TR-09] «تم نشر بوست 3» لقطعة متبقّية من الدورة السابقة ما لازم تسكّر بوست 2", async () => {
      // الأرقام بتنحصر بدلو الدورة الشغّالة؛ بوست ٣ أيلول برّاه فبتنزل لـ«أقدم مستحقّة» = بوست ٢ أيلول.
      // دلو تشرين فيه كمان نشر بوست ٣ (٦/١٠) — القطعة المسمّاة بالدورة الشغّالة لازم تربح لو موجودة،
      // فمنشيلها لنعزل حالة المتبقّي.
      await prisma.task.delete({ where: { id: ID("zulu_9_POST_3_PUBLISH") } });
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), text: "تم نشر بوست 3" }));
      expect(await closedIds(Z1)).not.toContain(ID("zulu_8_POST_2_PUBLISH"));
    });
  });

  describe("الألبوم بتوبيك (media_group_id)", () => {
    it("[TR-10] ألبوم ٣ صور بلا اسم = قطعة وحدة — مو ٣ كروت", async () => {
      for (let i = 0; i < 3; i++) await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), photo: true, group: `g${P}` }));
      expect((await closedIds(Z1)).filter((x: string) => x.includes("DESIGN"))).toHaveLength(1);
    });

    it("ألبوم ملفات مسمّاة لقطع مختلفة (BW-post-9-1…4 بألبوم واحد) بيسكّر كل قطعة باسمها — حارس لأي إصلاح لـTR-10", async () => {
      for (const n of [1, 2, 3]) await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), doc: jpg(`Zulu-post-10-${n}.jpg`), group: `h${P}` }));
      expect(await closedIds(Z1)).toEqual([1, 2, 3].map((n) => ID(`zulu_9_POST_${n}_DESIGN`)).sort());
    });

    it("[TR-14] شرائح الكاروسيل «-10-2-2…4» بتنربط بقطعتها وبتسجّل عدد الشرائح (§٥: وحدة تصميم لكل شريحة)", async () => {
      for (const s of [1, 2, 3, 4]) await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), doc: jpg(`Zulu-post-10-2-${s}.jpg`), group: `k${P}` }));
      const rows = await prisma.telegramMessage.findMany({ where: { mediaGroupId: `k${P}` } });
      expect(rows.every((r: any) => r.taskId === ID("zulu_9_POST_2_DESIGN"))).toBe(true);
      expect((await t(ID("zulu_9_POST_2_DESIGN"))).quantity).toBe(4);
    });
  });

  describe("صاحب الكرت والكريدت (القائدة ١١/١٠ مقابل ١/٨)", () => {
    it("[TR-11] ملف من غير صاحب الكرت ما بيسكّر الكرت (البوستات لأيمن)", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(2), doc: jpg("Zulu-post-10-1.jpg") }));
      const c = await t(ID("zulu_9_POST_1_DESIGN"));
      expect(c.board).not.toBe("DONE");
      expect(c.assigneeId).toBe(E.dA);
    });

    it("[TR-02] صورة خام من المونتيرة (IMG_1342.jpg) ما بتسكّر تصميم بوست — حادثة فونيتيك ١٩/٨", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(3), doc: jpg("IMG_1342.jpg") }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("[TR-02] صورة خام من المصوّر (DSC03882.JPG) ما بتسكّر تصميم — حادثة مانغو ٣/٩", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(4), doc: jpg("DSC03882.JPG") }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("مع وصف خطة على الكروت (Z2) الصورة الخام بتضل غير مطابقة — طبقة النوع مطفية", async () => {
      const out = await ingest.ingestUpdate(update({ thread: T_Z2, from: tgId(3), doc: jpg("IMG_1342.jpg") }));
      expect(out?.taskId).toBeNull();
      expect(await closedIds(Z2)).toEqual([]);
    });

    it("[TR-11] مرسِل مجهول (لا معرّف ولا اسم مستخدم ولا اسم بديل): ما بيسكّر، والملف بيتخزّن «من غير صاحب الكرت» مع كرته", async () => {
      const id = nextMsg++;
      const out = await ingest.ingestUpdate(update({ thread: T_Z1, from: "7799999999", name: "Ayman", msgId: id, doc: jpg("Zulu-post-10-4.jpg") }));
      expect(out?.held).toBe("NOT_OWNER");
      expect(out?.advanced).toBe(false);
      const c = await t(ID("zulu_9_POST_4_DESIGN"));
      expect(c.board).not.toBe("DONE");
      expect(c.assigneeId).toBe(E.dA);
      const row = await prisma.telegramMessage.findUnique({ where: { id: `${CHAT}:${id}` } });
      expect(row).toMatchObject({ taskId: ID("zulu_9_POST_4_DESIGN"), matchedBy: "NOT_OWNER", confirmed: false });
    });
  });

  describe("D3 — السكّر لصاحب الكرت أو القائدة (قرار ١٢/١٠)", () => {
    it("الاسم البديل (مطابقة كاملة للاسم الظاهر) بيعرّف المرسِل بلا معرّف رقمي، فبيسكّر كرته", async () => {
      await prisma.employee.update({ where: { id: E.dA }, data: { telegramAliases: `Ayman ${P},Ayman D` } });
      try {
        await ingest.ingestUpdate(update({ thread: T_Z1, from: "7799999997", name: `Ayman ${P}`, doc: jpg("Zulu-post-10-1.jpg") }));
        expect(await closedIds(Z1)).toEqual([ID("zulu_9_POST_1_DESIGN")]);
        // مطابقة **كاملة** بس: «Ayman» لحالها مش اسم بديل.
        await ingest.ingestUpdate(update({ thread: T_Z1, from: "7799999997", name: "Ayman", doc: jpg("Zulu-post-10-2.jpg") }));
        expect((await t(ID("zulu_9_POST_2_DESIGN"))).board).not.toBe("DONE");
      } finally {
        await prisma.employee.update({ where: { id: E.dA }, data: { telegramAliases: null } });
      }
    });

    it("اسم المستخدم (`from.username`) بيعرّف المرسِل لما المعرّف الرقمي مش مسجّل", async () => {
      await prisma.employee.update({ where: { id: E.ed }, data: { telegramUsername: `editor_${P}` } });
      try {
        await ingest.ingestUpdate(update({ thread: T_Z1, from: "7799999996", username: `editor_${P}`, video: "Zulu-reel-10-1.mp4" }));
        expect((await t(ID("zulu_9_REEL_1_EDIT"))).board).toBe("DONE");
      } finally {
        await prisma.employee.update({ where: { id: E.ed }, data: { telegramUsername: null } });
      }
    });

    it("القائدة بتسكّر كرت غيرها — والكريدت بيضل لصاحب الكرت (ما في إعادة إسناد)", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(7), doc: jpg("Zulu-post-10-3.jpg") }));
      const c = await t(ID("zulu_9_POST_3_DESIGN"));
      expect(c.board).toBe("DONE");
      expect(c.assigneeId).toBe(E.dA);
      expect(c.isPinned).toBe(false);
    });

    it("الصاحب نفسه: الكرت بيضل باسمه وما بينثبّت", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), doc: jpg("Zulu-post-10-1.jpg") }));
      const c = await t(ID("zulu_9_POST_1_DESIGN"));
      expect(c.assigneeId).toBe(E.dA);
      expect(c.isPinned).toBe(false);
    });

    it("مستند الخطة من غير الكاتبة (المصمّم) ما بيسكّر كرت الكتابة", async () => {
      const docx = { name: "Yankee - Oct-Plan NO.3.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
      const out = await ingest.ingestUpdate(update({ thread: T_Z2, from: tgId(1), doc: docx }));
      expect(out?.held).toBe("NOT_OWNER");
      expect((await t(ID("yankee_w_plan"))).board).not.toBe("DONE");
    });

    it("«تم النشر» من المصمّم (مش ناشر ولا قائدة) ما بيسكّر شي — حتى الصيغة الصريحة", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), text: "تم النشر" }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("«تم النشر» من القائدة بيسكّر أقدم مستحقّة", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(7), text: "تم النشر ✅" }));
      expect(await closedIds(Z1)).toEqual([ID("zulu_8_POST_2_PUBLISH")]);
    });

    it("رد «تم النشر» من الناشر على ملف التصميم بيسكّر نشر قطعته بالذات", async () => {
      const fileId = nextMsg++;
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), msgId: fileId, doc: jpg("Zulu-post-10-4.jpg") }));
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), replyTo: fileId, text: "تم النشر" }));
      const closed = await closedIds(Z1);
      expect(closed).toContain(ID("zulu_9_POST_4_PUBLISH"));
      expect(closed).not.toContain(ID("zulu_8_POST_2_PUBLISH"));
    });

    it("ملف القطعة بكابشن «تم النشر» من الناشر بيسكّر نشر **قطعته** — حتى لو تصميمها مسكّر (مراجعة ١٢/١٠)", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), doc: jpg("Zulu-post-10-3.jpg") }));
      expect((await t(ID("zulu_9_POST_3_DESIGN"))).board).toBe("DONE");
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), doc: jpg("Zulu-post-10-3.jpg"), caption: "تم النشر" }));
      const closed = await closedIds(Z1);
      expect(closed).toContain(ID("zulu_9_POST_3_PUBLISH"));
      expect(closed).not.toContain(ID("zulu_8_POST_2_PUBLISH"));
    });

    it("ملف بيسمّي قطعة ما إلها كرت («Zulu-post-10-9») بكابشن «تم النشر» ما بيسكّر شي — ولا «أقدم مستحقّة»", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), doc: jpg("Zulu-post-10-9.jpg"), caption: "تم النشر" }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("رد على رسالة إنشاء التوبيك (كل رسالة بالتوبيكات) مو «مرتبط بقطعة»: رسالة سطرين ما بتسكّر شي", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), replyTo: T_Z1, text: "نشرت\nبس الصورة مقصوصة" }));
      expect(await closedIds(Z1)).toEqual([]);
    });

    it("تعديل كابشن ملف محجوز («باسم شركة تانية») لاسم صحيح بيسكّر كرته", async () => {
      const id = nextMsg++;
      const first = await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), msgId: id, photo: true, caption: "Yankee-post-10-1" }));
      expect(first?.held).toBe("WRONG_TOPIC");
      const edited = await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), msgId: id, photo: true, caption: "Zulu-post-10-1", edited: true }));
      expect(edited?.advanced).toBe(true);
      expect(await closedIds(Z1)).toEqual([ID("zulu_9_POST_1_DESIGN")]);
    });

    it("«نشرت 10-2» بلا كلمة نوع ومفتوح بنوعين بالدورة = ما منعرف أي وحدة — ما بيسكّر شي", async () => {
      await prisma.task.create({
        data: card(Z1, "zulu", 9, "STORY", 2, "PUBLISH", { publishDate: D(9, 7) }),
      });
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), text: "نشرت 10-2" }));
      expect(await closedIds(Z1)).toEqual([]);
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(5), text: "نشرت بوست 10-2" }));
      expect(await closedIds(Z1)).toEqual([ID("zulu_9_POST_2_PUBLISH")]);
    });
  });

  describe("«مو هي» — التراجع عن مطابقة", () => {
    it("بيرجّع الكرت مفتوح لما يكون هالملف وحده يلي سكّره — وبلا سطر الدليل تبعه", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), doc: jpg("Zulu-post-10-1.jpg") }));
      expect((await t(ID("zulu_9_POST_1_DESIGN"))).notes).toContain("سُلّم على تلغرام");
      await ingest.unmatchMessage(`${CHAT}:${nextMsg - 1}`);
      const c = await t(ID("zulu_9_POST_1_DESIGN"));
      expect(c.board).toBe("DOING");
      expect(c.finishedAt).toBeNull();
      expect(c.notes ?? "").not.toContain("سُلّم على تلغرام");
    });

    it("«مو هي» على ملف محجوز («من غير صاحب الكرت») بيفكّ الربط بس — ما بيفتح كرتاً مسكّر بإيد صاحبه", async () => {
      await prisma.task.update({ where: { id: ID("zulu_9_POST_1_DESIGN") }, data: { status: "READY", board: "DONE" } });
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(2), doc: jpg("Zulu-post-10-1.jpg") }));
      await ingest.unmatchMessage(`${CHAT}:${nextMsg - 1}`);
      expect((await t(ID("zulu_9_POST_1_DESIGN"))).board).toBe("DONE");
    });

    it("[TR-12] التراجع بيمحي أثر الإقفال: سطر الدليل والإسناد للمرسِل والتثبيت", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(2), doc: jpg("Zulu-post-10-1.jpg") }));
      await ingest.unmatchMessage(`${CHAT}:${nextMsg - 1}`);
      const c = await t(ID("zulu_9_POST_1_DESIGN"));
      expect(c.assigneeId).toBe(E.dA);
      expect(c.notes ?? "").not.toContain("سُلّم على تلغرام");
    });

    it("[TR-12] التراجع عن ملف مونتاج بيرجّع كرت التصوير يلي انسكّر بالتتابع", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(3), video: "Zulu-reel-10-1.mp4" }));
      await ingest.unmatchMessage(`${CHAT}:${nextMsg - 1}`);
      expect((await t(ID("zulu_9_REEL_1_SHOOT"))).board).not.toBe("DONE");
    });
  });

  describe("المستندات ← كروت الكتابة (مسار DOCUMENT)", () => {
    const docx = (name: string) => ({ name, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const writeClosed = async () => (await closedIds(Z2)).filter((x: string) => x.includes("_w_"));

    it("«3 Scripts For Shooting- Yankee.docx» من الكاتبة بيسكّر كرت سيناريو التصوير بدليل", async () => {
      await ingest.ingestUpdate(update({ thread: T_Z2, from: tgId(6), doc: docx("3 Scripts For Shooting- Yankee.docx") }));
      expect(await writeClosed()).toEqual([ID("yankee_w_shoot")]);
      expect((await t(ID("yankee_w_shoot"))).notes).toContain("3 Scripts For Shooting- Yankee.docx");
    });

    it("[TR-24] خطة الشهر (docx) بتسكّر كرت «كتابة بوستات وستوريز» — مو أقرب كرت كتابة (مقال المدونة)", async () => {
      // باللقطة: «Phoeni Jobs - Aug-Plan NO.2.docx» سكّر «المدونة — المقال 4»، و«PhoeniJobs__New_Posts_Ideas.docx» سكّر «لينكد إن — دراسة حالة».
      await ingest.ingestUpdate(update({ thread: T_Z2, from: tgId(6), doc: docx("Yankee - Oct-Plan NO.3.docx") }));
      expect(await writeClosed()).toEqual([ID("yankee_w_plan")]);
    });

    it("[TR-24] مستند من برّا الفريق (دليل شركة PDF) ما بيسكّر كرت كتابة", async () => {
      // باللقطة: رند (مو من الفريق) بعتت ٤ أدلّة PDF ٢٤/٨ فسكّرت ٤ مقالات لنوال، و«phoenijobs features.docx» (٦/١٠)
      // سكّر خطة بوستات التوظيف — وأوصاف بوست ٢–١٠ لسا فاضية.
      await ingest.ingestUpdate(update({ thread: T_Z2, from: "7799999998", name: "Rand", doc: { name: "Yankee-Company-Guide-AR.pdf", mime: "application/pdf" } }));
      expect(await writeClosed()).toEqual([]);
    });

    it("[TR-24] نفس المستند مرّتين (إعادة إرسال) ما بيسكّر كرت كتابة تاني", async () => {
      // باللقطة: «3 Scripts For Shooting- Mango.docx» ٤/٨ سكّر السيناريو، ونفس الملف ٥/٨ سكّر كرت البوستات والستوريز.
      await ingest.ingestUpdate(update({ thread: T_Z2, from: tgId(6), doc: docx("3 Scripts For Shooting- Yankee.docx") }));
      await ingest.ingestUpdate(update({ thread: T_Z2, from: tgId(6), doc: docx("3 Scripts For Shooting- Yankee.docx") }));
      expect(await writeClosed()).toHaveLength(1);
    });
  });

  describe("ملف باسم شركة تانية بتوبيك غلط", () => {
    it("[TR-26] (تحذير — سلوك حالي) «Yankee-post-10-1» بتوبيك Zulu: ما بيسكّر شي هون، ولا بيوصل لكرت Yankee", async () => {
      // مع وصف خطة بالشركتين حتى ما توقع بطبقة النوع (TR-02).
      await prisma.task.update({ where: { id: ID("zulu_9_POST_1_DESIGN") }, data: { brief: "إطلاق الخدمة الجديدة" } });
      const out = await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), doc: jpg("Yankee-post-10-1.jpg") }));
      expect(out?.taskId).toBeNull();
      expect(out?.held).toBe("WRONG_TOPIC");
      expect(await closedIds(Z2)).toEqual([]);
      expect(await closedIds(Z1)).toEqual([]);
      const row = await prisma.telegramMessage.findUnique({ where: { id: `${CHAT}:${nextMsg - 1}` } });
      expect(row).toMatchObject({ taskId: null, matchedBy: "WRONG_TOPIC", confirmed: false });
    });

    it("[TR-26] بلا وصف خطة كمان: اسم شركة تانية ما بيوقع بطبقة النوع حتى من صاحب الكروت", async () => {
      const out = await ingest.ingestUpdate(update({ thread: T_Z1, from: tgId(1), doc: jpg("Yankee-post-10-1.jpg") }));
      expect(out?.held).toBe("WRONG_TOPIC");
      expect(await closedIds(Z1)).toEqual([]);
    });
  });
});
