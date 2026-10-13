/**
 * الفحص العميق — محرّك إعادة التوليد · انتقالات حالة الكرت (جدول انتقالات)
 *
 * قاعدة معزولة تنبنى من الـschema (بلا dev.db). شركة اصطناعية بدورة ثابتة
 * (١/٩/٢٠٢٦ → دلو 2026/8) وبنمشي عليها سلسلة عمليات حقيقية من الأكشنات،
 * وبعد كل خطوة بنعيد التوليد مرّتين وبنتأكد إنّو:
 *   • المنجز والمثبّت بحالته وأختامه ويومه (WORK_RULES §٣ + §٤)،
 *   • الملغى بيضل ملغى (PROJECT §6.1)،
 *   • رفع العدد ما بيورّث حالة قديمة (حارس الصفوف المحجوزة، ١١/١٠)،
 *   • العلاقات سليمة (بلا مؤشّر معلّق، الحاجز من نفس القطعة وأسبق مرحلةً).
 *
 * التقنيات: انتقالات حالة · متماثلات (توليد تاني = صفر فرق) · ارتداد على
 * حوادث مسجَّلة (وصل ١٣/٧→٢١/٧، مخبر/أغاليا فقدان الأوصاف بتغيير المصمّم).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { resolve } = await import("node:path");
  return { target: resolve(process.cwd(), "prisma", `test-deep-regen-states-${process.pid}.db`) };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {},
  requireAdminPage: async () => {},
  isAuthenticated: async () => true,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

import {
  createSchema,
  seedTeam,
  makeCompany,
  removeDb,
  TEAM,
  D,
  day,
  addDays,
  autoCards,
  pieceCards,
  relationViolations,
  tableSnapshot,
  diffSnapshots,
} from "./regen-fixture";

type Prisma = import("@prisma/client").PrismaClient;
let prisma: Prisma;
let gen: (y: number, m: number, only: string | null) => Promise<{ ok: boolean; error?: string }>;
let actions: typeof import("@/server/actions/tasks");
let ops: typeof import("@/server/task-ops");

const Y = 2026;
const M = 8; // أيلول (0-based)
const CO = "c_states";

/** توليدان متتاليان: الأول بيطبّق التغيير، والتاني لازم يكون صفر فرق. */
async function regenTwiceStable(only: string | null = null) {
  const r1 = await gen(Y, M, only);
  expect(r1.ok, r1.error).toBe(true);
  const s1 = await tableSnapshot(prisma);
  const r2 = await gen(Y, M, only);
  expect(r2.ok, r2.error).toBe(true);
  const s2 = await tableSnapshot(prisma);
  expect(diffSnapshots(s1, s2), "التوليد التاني لازم يكون صفر فرق").toEqual([]);
  expect(await relationViolations(prisma)).toEqual([]);
}

beforeAll(async () => {
  prisma = (await import("@/lib/db")).prisma;
  await createSchema(prisma);
  await seedTeam(prisma);
  ({ generateScheduleInternal: gen } = (await import("@/server/schedule-engine")) as never);
  actions = await import("@/server/actions/tasks");
  ops = await import("@/server/task-ops");
  await makeCompany(prisma, CO);
  const r = await gen(Y, M, null);
  expect(r.ok, r.error).toBe(true);
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeDb(scratch.target);
});

describe("إعادة التوليد — انتقالات حالة الكرت على قاعدة معزولة", () => {
  it("التوليد الأول: قطعة لكل رقم، كل شي مفتوح بلا أختام، والعلاقات سليمة", async () => {
    const cards = await autoCards(prisma, CO, Y, M);
    // ٣ بوست + ٢ ستوري (تصميم + نشر) + ٢ ريل (تصوير + مونتاج + نشر) + كرتا كتابة
    expect(cards.length).toBe(2 + 5 * 2 + 2 * 3);
    expect(cards.every((c) => c.board === "TODO" && c.status === "NOT_STARTED")).toBe(true);
    expect(cards.every((c) => !c.startedAt && !c.finishedAt && !c.completedAt && !c.isPinned)).toBe(true);
    const nums = (type: string) =>
      [...new Set(cards.filter((c) => c.type === type).map((c) => c.pieceNo))].sort();
    expect(nums("POST")).toEqual([1, 2, 3]);
    expect(nums("STORY")).toEqual([1, 2]);
    expect(nums("REEL")).toEqual([1, 2]);
    // لا كرت قبل بداية العقد ولا نشر قبل أسبوع التحضير (PROJECT §11)
    for (const c of cards) {
      if (c.workDate) expect(day(c.workDate)! >= "2026-09-01").toBe(true);
      if (c.stage === "PUBLISH") expect(day(c.publishDate)! >= "2026-09-08").toBe(true);
    }
    expect(await relationViolations(prisma)).toEqual([]);
    await regenTwiceStable();
  });

  it("بدء تصميم ثم إنهاؤه: الحالة والأختام ويوم الشغل المنجز بيصمدوا على توليدين", async () => {
    const { production: design } = await pieceCards(prisma, CO, "POST", 2);
    expect(design).not.toBeNull();
    expect((await actions.updateTaskStatus(design!.id, "IN_PROGRESS")).ok).toBe(true);
    const doing = await prisma.task.findUnique({ where: { id: design!.id } });
    expect(doing?.board).toBe("DOING");
    expect(doing?.startedAt).not.toBeNull();
    await regenTwiceStable();
    const afterDoing = (await pieceCards(prisma, CO, "POST", 2)).production!;
    expect([afterDoing.board, afterDoing.status]).toEqual(["DOING", "IN_PROGRESS"]);
    expect(afterDoing.startedAt?.getTime()).toBe(doing!.startedAt!.getTime());

    expect((await actions.updateTaskStatus(afterDoing.id, "READY")).ok).toBe(true);
    const done = await prisma.task.findUnique({ where: { id: afterDoing.id } });
    expect(done?.board).toBe("DONE");
    expect(done?.finishedAt).not.toBeNull();
    expect(done?.completedAt).not.toBeNull();
    await regenTwiceStable();
    const kept = (await pieceCards(prisma, CO, "POST", 2)).production!;
    expect([kept.board, kept.status]).toEqual(["DONE", "READY"]);
    expect(kept.startedAt?.getTime()).toBe(done!.startedAt!.getTime());
    expect(kept.finishedAt?.getTime()).toBe(done!.finishedAt!.getTime());
    expect(kept.completedAt?.getTime()).toBe(done!.completedAt!.getTime());
    expect(day(kept.workDate)).toBe(day(done!.workDate));
    expect(kept.isPinned).toBe(false); // المنجز بيصمد بلا تثبيت (قاعدة «السجل مو خطة»)
  });

  it("نشر ريل: إنتاجه بينسكر، ويوم النشر بيتجمّد على كل مراحله حتى لو تزحزحت الخطة — والمونتاج المسكّر بالتتابع بيقعد على يوم النشر (RG-06)", async () => {
    const before = await pieceCards(prisma, CO, "REEL", 1);
    const plannedPublish = day(before.publish!.publishDate)!;
    expect((await ops.setStageDone(before.publish!.id, true)).ok).toBe(true);
    const closed = await pieceCards(prisma, CO, "REEL", 1);
    expect([closed.publish!.board, closed.publish!.status]).toEqual(["DONE", "PUBLISHED"]);
    expect(closed.production!.board).toBe("DONE");
    expect(closed.edit!.board).toBe("DONE");

    // زحزحة بداية النشر ٣ أيام بتعيد توزيع كل الدورة — القطعة المنشورة ما بتتحرّك
    await prisma.company.update({ where: { id: CO }, data: { publishStartDate: D(2026, 9, 4) } });
    await regenTwiceStable();
    const after = await pieceCards(prisma, CO, "REEL", 1);
    for (const c of after.all) {
      expect(day(c.publishDate), `${c.stage} publishDate`).toBe(plannedPublish);
      expect(c.board, `${c.stage} board`).toBe("DONE");
    }
    expect(day(after.production!.workDate)).toBe(day(closed.production!.workDate));
    // المونتاج المسكّر بالتتابع **مجمَّد كمان** (القائدة ١٣/١٠): الكرت المنجز تاريخه سجلّ،
    // والتوليد ما بيعيد تأريخه أبداً — يومه الحقيقي (لو مختلف) بيجي من الدليل بحمولة.
    // الترتيب صادق: تصوير ≤ مونتاج ≤ نشر.
    expect(day(closed.edit!.workDate)! < plannedPublish).toBe(true);
    expect(day(after.edit!.workDate)).toBe(day(closed.edit!.workDate));
    expect(day(after.edit!.workDate)! <= plannedPublish).toBe(true);
    expect([after.edit!.board, after.edit!.status]).toEqual(["DONE", "READY"]);
    expect(after.edit!.finishedAt?.getTime()).toBe(closed.edit!.finishedAt!.getTime());
    expect(day(after.production!.workDate)! <= day(after.edit!.workDate)!).toBe(true);
    // أما قطعة مفتوحة فيوم نشرها خطة وبيتحرّك مع الدورة
    const open = await pieceCards(prisma, CO, "POST", 3);
    expect(open.publish!.board).toBe("TODO");
  });

  it("إعادة فتح كرت النشر: بيرجع مفتوحاً وبيضل مفتوحاً بعد التوليد، والإنتاج المنجز ما بينفتح معه", async () => {
    const piece = await pieceCards(prisma, CO, "REEL", 1);
    expect((await ops.setStageDone(piece.publish!.id, false)).ok).toBe(true);
    await regenTwiceStable();
    const after = await pieceCards(prisma, CO, "REEL", 1);
    expect([after.publish!.board, after.publish!.status]).toEqual(["TODO", "NOT_STARTED"]);
    expect(after.publish!.finishedAt).toBeNull();
    expect(after.publish!.completedAt).toBeNull();
    expect(after.production!.board).toBe("DONE");
    // المونتاج منجز وتصويره منجز → بيضل منجزاً (كتلة «مونتاج بلا تصوير» ما بتلمسه)
    expect(after.edit!.board).toBe("DONE");
  });

  it("إلغاء قطعة (حذف كرت مولَّد): كل مراحلها CANCELED مثبّتة وبتضل هيك بعد توليدين، والأرقام ما بتتغيّر", async () => {
    const piece = await pieceCards(prisma, CO, "POST", 1);
    expect((await actions.deleteTasks([piece.production!.id])).ok).toBe(true);
    const canceled = await pieceCards(prisma, CO, "POST", 1);
    expect(canceled.all.length).toBe(2);
    for (const c of canceled.all) {
      expect(c.status, c.stage!).toBe("CANCELED");
      expect(c.isPinned, c.stage!).toBe(true);
    }
    await regenTwiceStable();
    const still = await pieceCards(prisma, CO, "POST", 1);
    expect(still.all.map((c) => c.status)).toEqual(["CANCELED", "CANCELED"]);
    const posts = (await autoCards(prisma, CO, Y, M)).filter((c) => c.type === "POST");
    expect([...new Set(posts.map((c) => c.pieceNo))].sort()).toEqual([1, 2, 3]);
    // بوست ٢ المنجز ما تأثّر بالإلغاء
    expect((await pieceCards(prisma, CO, "POST", 2)).production!.board).toBe("DONE");
  });

  it("حذف كرت يدوي بيمحيه نهائياً وإعادة التوليد ما بترجّعه؛ والكرت اليدوي المفتوح ما بينمسّ إلا بيوم شغله", async () => {
    const manual = await prisma.task.create({
      data: {
        id: "manual_states_1",
        kind: "ADHOC",
        title: "مهمة يدوية",
        companyId: CO,
        assigneeId: TEAM.designer.id,
        hours: 8,
        year: Y,
        month: M,
        isAuto: false,
        readyDate: D(2026, 9, 20),
        notes: "ملاحظة يدوية",
        brief: "وصف يدوي",
      },
    });
    await regenTwiceStable();
    const kept = await prisma.task.findUnique({ where: { id: manual.id } });
    expect(kept).not.toBeNull();
    expect([kept!.title, kept!.notes, kept!.brief, kept!.status]).toEqual([
      "مهمة يدوية",
      "ملاحظة يدوية",
      "وصف يدوي",
      "NOT_STARTED",
    ]);
    expect((await actions.deleteTasks([manual.id])).ok).toBe(true);
    expect(await prisma.task.findUnique({ where: { id: manual.id } })).toBeNull();
    await regenTwiceStable();
    expect(await prisma.task.findUnique({ where: { id: manual.id } })).toBeNull();
  });

  it("تعديل كرت (عنوان/تاريخ/مالك/أولوية/كمية) بيثبّته وبيصمد على توليدين", async () => {
    const { production: design } = await pieceCards(prisma, CO, "STORY", 1);
    const r = await actions.updateTaskDetails([design!.id], {
      title: "ستوري العرض الخاص",
      workDate: "2026-09-14",
      readyDate: "2026-09-15",
      assigneeId: TEAM.designer2.id,
      priority: "URGENT",
      quantity: 3,
    });
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    await regenTwiceStable();
    const kept = (await pieceCards(prisma, CO, "STORY", 1)).production!;
    expect(kept.isPinned).toBe(true);
    expect(kept.title).toBe("ستوري العرض الخاص");
    expect(day(kept.workDate)).toBe("2026-09-14");
    expect(day(kept.readyDate)).toBe("2026-09-15");
    expect(kept.assigneeId).toBe(TEAM.designer2.id);
    expect(kept.priority).toBe("URGENT");
    expect(kept.quantity).toBe(3);
  });

  it("«بدّل» مهام اليوم: manualDay بيصمد لأنه مثبّت", async () => {
    const { production: design } = await pieceCards(prisma, CO, "STORY", 2);
    expect((await actions.updateDailyTasks([design!.id], [], "2026-09-15")).ok).toBe(true);
    await regenTwiceStable();
    const kept = (await pieceCards(prisma, CO, "STORY", 2)).production!;
    expect(kept.isPinned).toBe(true);
    expect(day(kept.manualDay)).toBe("2026-09-15");
    expect(day(kept.workDate)).toBe("2026-09-15");
  });

  it("الوصف والملاحظات بيصمدوا بلا تثبيت (برّا المحرّك ومو مشتقّين)", async () => {
    const { production: design, publish } = await pieceCards(prisma, CO, "POST", 3);
    await prisma.task.update({ where: { id: design!.id }, data: { brief: "خطّاف البوست ٣", notes: "ملاحظة ١" } });
    await prisma.task.update({ where: { id: publish!.id }, data: { notes: "تأجيل بطلب الزبون" } });
    await regenTwiceStable();
    const after = await pieceCards(prisma, CO, "POST", 3);
    expect(after.production!.brief).toBe("خطّاف البوست ٣");
    expect(after.production!.notes).toBe("ملاحظة ١");
    expect(after.publish!.notes).toBe("تأجيل بطلب الزبون");
    expect(after.production!.isPinned).toBe(false);
  });

  it("رفع عدد البوستات ٣→٥: القديمة بحالتها برقمها، والجديدة بتولد نظيفة (حارس الصفوف المحجوزة)", async () => {
    const doneBefore = (await pieceCards(prisma, CO, "POST", 2)).production!;
    await prisma.company.update({ where: { id: CO }, data: { posts: 5 } });
    await regenTwiceStable(CO);
    const posts = (await autoCards(prisma, CO, Y, M)).filter((c) => c.type === "POST");
    expect([...new Set(posts.map((c) => c.pieceNo))].sort()).toEqual([1, 2, 3, 4, 5]);
    const p2 = (await pieceCards(prisma, CO, "POST", 2)).production!;
    expect([p2.board, p2.status]).toEqual(["DONE", "READY"]);
    expect(p2.finishedAt?.getTime()).toBe(doneBefore.finishedAt!.getTime());
    expect((await pieceCards(prisma, CO, "POST", 1)).all.every((c) => c.status === "CANCELED")).toBe(true);
    expect((await pieceCards(prisma, CO, "POST", 3)).production!.brief).toBe("خطّاف البوست ٣");
    for (const no of [4, 5]) {
      for (const c of (await pieceCards(prisma, CO, "POST", no)).all) {
        expect([c.board, c.status], `بوست ${no} ${c.stage}`).toEqual(["TODO", "NOT_STARTED"]);
        expect(c.startedAt ?? c.finishedAt ?? c.completedAt ?? c.brief ?? c.notes).toBeNull();
        expect(c.isPinned).toBe(false);
      }
    }
  });

  it("تنزيل العدد ٥→٣: القطع الزائدة بتختفي والباقي بحاله", async () => {
    await prisma.company.update({ where: { id: CO }, data: { posts: 3 } });
    await regenTwiceStable(CO);
    const posts = (await autoCards(prisma, CO, Y, M)).filter((c) => c.type === "POST");
    expect([...new Set(posts.map((c) => c.pieceNo))].sort()).toEqual([1, 2, 3]);
    expect((await pieceCards(prisma, CO, "POST", 2)).production!.board).toBe("DONE");
    expect((await pieceCards(prisma, CO, "POST", 1)).all.every((c) => c.status === "CANCELED")).toBe(true);
  });

  it("تغيير المصمّم: المنجز بيحتفظ بحالته وأختامه برقمه، والمفتوح غير المثبّت بينتقل للمصمّم الجديد", async () => {
    const doneBefore = (await pieceCards(prisma, CO, "POST", 2)).production!;
    await prisma.company.update({ where: { id: CO }, data: { defaultOwnerId: TEAM.designer2.id } });
    await regenTwiceStable();
    const done = (await pieceCards(prisma, CO, "POST", 2)).production!;
    expect([done.board, done.status]).toEqual(["DONE", "READY"]);
    expect(done.finishedAt?.getTime()).toBe(doneBefore.finishedAt!.getTime());
    expect(day(done.workDate)).toBe(day(doneBefore.workDate));
    const open = (await pieceCards(prisma, CO, "POST", 3)).production!;
    expect(open.assigneeId).toBe(TEAM.designer2.id);
    expect(open.brief).toBe("خطّاف البوست ٣");
  });

  it("زحزحة بداية العقد ٨ أيام (حادثة وصل ١٣/٧→٢١/٧): المنجز والملغى بيصمدوا برقمهم ولو تحرّكت كل المواعيد", async () => {
    const doneBefore = (await pieceCards(prisma, CO, "POST", 2)).production!;
    const openBefore = (await pieceCards(prisma, CO, "POST", 3)).publish!;
    const co = await prisma.company.findUniqueOrThrow({ where: { id: CO } });
    await prisma.company.update({
      where: { id: CO },
      data: {
        contractStartDate: addDays(co.contractStartDate!, 8),
        publishStartDate: addDays(co.publishStartDate!, 8),
      },
    });
    await regenTwiceStable();
    const done = (await pieceCards(prisma, CO, "POST", 2)).production!;
    expect([done.board, done.status]).toEqual(["DONE", "READY"]);
    expect(done.finishedAt?.getTime()).toBe(doneBefore.finishedAt!.getTime());
    expect(day(done.workDate)).toBe(day(doneBefore.workDate));
    expect((await pieceCards(prisma, CO, "POST", 1)).all.every((c) => c.status === "CANCELED")).toBe(true);
    const open = (await pieceCards(prisma, CO, "POST", 3)).publish!;
    expect(day(open.publishDate)! > day(openBefore.publishDate)!).toBe(true);
    // الكروت المفتوحة ما بتسبق بداية العقد الجديدة
    for (const c of await autoCards(prisma, CO, Y, M)) {
      if (c.board === "DONE" || c.isPinned || !c.workDate) continue;
      expect(day(c.workDate)! >= "2026-09-09", `${c.type}#${c.pieceNo} ${c.stage}`).toBe(true);
    }
  });
});
