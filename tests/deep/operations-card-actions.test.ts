/**
 * الفحص العميق — العمليات · آلة حالات الكرت عبر أكشنات الخادم الحقيقية.
 *
 * NOT_STARTED → IN_PROGRESS → READY → PUBLISHED · إعادة فتح · حذف (يدوي/مولَّد)
 * · تعديل بيثبّت · تبديل مهام اليوم · تأكيد نشر يدوي — وبعد كل انتقال: ترتيب
 * الطوابع، فكّ الحجز، الدليل على الإقفال الآلي (§٢)، وصمود النتيجة أمام
 * إعادة التوليد (§٣).
 *
 * قاعدة معزولة: نسخة من `prisma/dev.db` بتنحذف بالآخر؛ الشركة والموظّفون
 * مصطنعون، والمحرّك بيولّد دورتهم وحدها (`onlyCompanyId`).
 *
 * الاصطلاح: `it.fails` = عطل مفتوح موثَّق بالتقرير ([OP-nn])؛ اقلبه لـ`it` لما ينصلح.
 * التقرير: `docs/qa/deep-test-2026-10-11/operations.md`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `.deep-operations-test-actions-${process.pid}.db`);
  const available = existsSync(source);
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
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

let prisma: any;
let actions: typeof import("@/server/actions/tasks");
let ops: typeof import("@/server/task-ops");
let engine: typeof import("@/server/schedule-engine");
let daily: typeof import("@/lib/daily-work");
let constants: typeof import("@/lib/constants");

const uniq = `deep-ops-actions-${process.pid}`;
const skip = () => !scratch.available;
const Y = 2026;
const M = 8; // دورة ١/٩ → ٣٠/٩

let designerId: string;
let photographerId: string;
let companyId: string;
let pausedCoId = "";

const cardsOf = async () => prisma.task.findMany({ where: { companyId }, orderBy: { id: "asc" } });
const find = async (stage: string, type?: string) =>
  prisma.task.findFirst({ where: { companyId, stage, ...(type ? { type } : {}), status: { not: "CANCELED" } } });
const regen = () => engine.generateScheduleInternal(Y, M, companyId);

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  actions = await import("@/server/actions/tasks");
  ops = await import("@/server/task-ops");
  engine = await import("@/server/schedule-engine");
  daily = await import("@/lib/daily-work");
  constants = await import("@/lib/constants");

  const designer = await prisma.employee.create({
    data: { name: `${uniq}-مصمم`, role: "designer", workDays: JSON.stringify([0, 1, 2, 3, 4]), rates: JSON.stringify({ POST: 6, STORY: 6 }), hoursPerDay: 8, isScheduled: true, isPhotographer: false },
  });
  const photographer = await prisma.employee.create({
    data: { name: `${uniq}-مصور`, role: "photographer", workDays: JSON.stringify([0, 1, 2, 3, 4]), rates: JSON.stringify({ REEL: 6 }), hoursPerDay: 8, isScheduled: true, isPhotographer: true },
  });
  designerId = designer.id;
  photographerId = photographer.id;
  const co = await prisma.company.create({
    data: {
      name: `${uniq}-شركة`,
      managed: true,
      posts: 1,
      reels: 1,
      contractStartDate: new Date(2026, 8, 1),
      publishStartDate: new Date(2026, 8, 1),
      postOwnerId: designerId,
      defaultOwnerId: designerId,
      photographerId,
      priority: 90,
    },
  });
  companyId = co.id;
  const r = await regen();
  if (!r.ok) throw new Error(`regen failed: ${(r as { error?: string }).error}`);
});

afterAll(async () => {
  if (!prisma) return;
  const coIds = [companyId, pausedCoId].filter(Boolean);
  await prisma.task.deleteMany({ where: { OR: [{ companyId: { in: coIds } }, { assigneeId: designerId }] } });
  await prisma.photoSession.deleteMany({ where: { companyId: { in: coIds } } });
  await prisma.company.deleteMany({ where: { id: { in: coIds } } });
  await prisma.employee.deleteMany({ where: { id: { in: [designerId, photographerId] } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("آلة الحالات — قطعة بوست", () => {
  it("المحرّك ولّد القطعتين بمراحلهن (تصميم+نشر للبوست، تصوير+مونتاج+نشر للريل)", async () => {
    if (skip()) return;
    const cards = await cardsOf();
    const stages = cards.filter((t: { isAuto: boolean }) => t.isAuto).map((t: { type: string | null; stage: string | null }) => `${t.type ?? "-"}/${t.stage}`).sort();
    expect(stages).toEqual(expect.arrayContaining(["POST/DESIGN", "POST/PUBLISH", "REEL/SHOOT", "REEL/EDIT", "REEL/PUBLISH"]));
  });

  it("NOT_STARTED → IN_PROGRESS → READY: الطوابع بالترتيب واللوح متطابق (وكتابة الدورة لسا مفتوحة)", async () => {
    if (skip()) return;
    const design = await find("DESIGN", "POST");
    const publish = await find("PUBLISH", "POST");
    expect(publish.blockedById).toBe(design.id);
    // الشركة مُدارة → التصميم واقف على كرت الدورة «كتابة بوستات وستوريز» (pipeline.ts).
    const write = await prisma.task.findUniqueOrThrow({ where: { id: design.blockedById } });
    expect(write.stage).toBe("WRITE");
    expect(write.status).toBe("NOT_STARTED");
    const blockedBefore = daily.makeBlockedPredicate(await cardsOf())(publish);
    expect(blockedBefore).toBe(true);

    expect((await actions.updateTaskStatus(design.id, "IN_PROGRESS")).ok).toBe(true);
    const doing = await prisma.task.findUniqueOrThrow({ where: { id: design.id } });
    expect(doing.board).toBe("DOING");
    expect(doing.startedAt).toBeTruthy();
    expect(doing.finishedAt).toBeNull();

    expect((await actions.updateTaskStatus(design.id, "READY")).ok).toBe(true);
    const done = await prisma.task.findUniqueOrThrow({ where: { id: design.id } });
    expect(done.board).toBe("DONE");
    expect(done.finishedAt.getTime()).toBeGreaterThanOrEqual(done.startedAt.getTime());
    expect(done.completedAt).toBeTruthy();
    expect(constants.isTaskDoneState(done)).toBe(true);
    // السلوك الحالي (موثَّق OP-10): التصميم خلص بس كرت النشر لسا «بانتظار» كتابة الدورة.
    const held = daily.makeHeldReason(await cardsOf(), "2026-09-15")(publish);
    expect(held?.blockedBy?.id).toBe(write.id);
  });

  it.fails("[OP-10] تصميم منجز + كتابة الدورة مفتوحة (حالة مشروعة §٦) → كرت النشر لازم ينفكّ؛ السلسلة بتعبر المنجز وبتحجزه — عطل مفتوح", async () => {
    if (skip()) throw new Error("skipped — it.fails needs a failure");
    const publish = await find("PUBLISH", "POST");
    expect(daily.makeBlockedPredicate(await cardsOf())(publish)).toBe(false);
  });

  it("لما تنسكّر كتابة الدورة، كرت النشر بينفكّ (الحجز المباشر وبالسلسلة)", async () => {
    if (skip()) return;
    const design = await find("DESIGN", "POST");
    expect((await ops.setStageDone(design.blockedById, true)).ok).toBe(true);
    const publish = await find("PUBLISH", "POST");
    expect(daily.makeBlockedPredicate(await cardsOf())(publish)).toBe(false);
    expect(daily.makeHeldReason(await cardsOf(), "2026-09-15")(publish)).toBeNull();
  });

  it("READY على كرت نشر بتتطبّع PUBLISHED؛ وإعادة الفتح بتمحي الطوابع كلّها", async () => {
    if (skip()) return;
    const publish = await find("PUBLISH", "POST");
    expect((await actions.updateTaskStatus(publish.id, "READY")).ok).toBe(true);
    const pub = await prisma.task.findUniqueOrThrow({ where: { id: publish.id } });
    expect(pub.status).toBe("PUBLISHED");
    expect(pub.board).toBe("DONE");
    expect((await actions.updateTaskStatus(publish.id, "NOT_STARTED")).ok).toBe(true);
    const reopened = await prisma.task.findUniqueOrThrow({ where: { id: publish.id } });
    expect(reopened.status).toBe("NOT_STARTED");
    expect(reopened.board).toBe("TODO");
    expect(reopened.startedAt).toBeNull();
    expect(reopened.finishedAt).toBeNull();
    expect(reopened.completedAt).toBeNull();
    expect(constants.isTaskDoneState(reopened)).toBe(false);
  });

  it("إعادة التوليد بتحافظ على المنجَز بطوابعه وعلى المفتوح مفتوحاً (§٣)", async () => {
    if (skip()) return;
    const before = await find("DESIGN", "POST");
    const r = await regen();
    expect(r.ok).toBe(true);
    const after = await prisma.task.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe("READY");
    expect(after.finishedAt?.getTime()).toBe(before.finishedAt.getTime());
    expect(after.startedAt?.getTime()).toBe(before.startedAt.getTime());
    const publish = await find("PUBLISH", "POST");
    expect(publish.status).toBe("NOT_STARTED");
  });
});

describe("إقفال آلي — النشر بيسكّر المراحل السابقة", () => {
  it("نشر الريل (moveCard DONE) بيسكّر التصوير والمونتاج المفتوحَين بطوابع", async () => {
    if (skip()) return;
    const publish = await find("PUBLISH", "REEL");
    expect((await actions.moveCard(publish.id, "DONE")).ok).toBe(true);
    const shoot = await find("SHOOT", "REEL");
    const edit = await find("EDIT", "REEL");
    for (const t of [shoot, edit]) {
      expect(t.status).toBe("READY");
      expect(t.board).toBe("DONE");
      expect(t.finishedAt).toBeTruthy();
    }
    const pub = await prisma.task.findUniqueOrThrow({ where: { id: publish.id } });
    expect(pub.status).toBe("PUBLISHED");
  });

  it("[OP-06 مُصلَح] الإقفال الآلي للمراحل السابقة بيحمل سطر دليل على notes (§٢)", async () => {
    if (skip()) return;
    const shoot = await find("SHOOT", "REEL");
    const edit = await find("EDIT", "REEL");
    expect(shoot.notes ?? "").not.toBe("");
    expect(edit.notes ?? "").not.toBe("");
  });
});

describe("تعديل الكرت (updateTaskDetails) — دايماً مثبّت", () => {
  it("تعديل العنوان بيثبّت الكرت وبيصمد أمام إعادة التوليد", async () => {
    if (skip()) return;
    const publish = await find("PUBLISH", "POST");
    expect((await actions.updateTaskDetails([publish.id], { title: `${uniq}-عنوان` })).ok).toBe(true);
    await regen();
    const after = await prisma.task.findUniqueOrThrow({ where: { id: publish.id } });
    expect(after.isPinned).toBe(true);
    expect(after.title).toBe(`${uniq}-عنوان`);
  });

  it("[OP-07 مُصلَح] وسم الكرت منجزاً من نموذج التعديل ما بيختمه بالمستقبل ولو تاريخ الجهوزية بالمستقبل", async () => {
    if (skip()) return;
    const design = await find("DESIGN", "POST");
    await ops.setStageDone(design.id, false); // رجّعه مفتوحاً
    const r = await actions.updateTaskDetails([design.id], { status: "READY", readyDate: "2026-12-01" });
    expect(r.ok).toBe(true);
    const after = await prisma.task.findUniqueOrThrow({ where: { id: design.id } });
    expect(after.status).toBe("READY");
    // طابع الإنجاز ما بيصير بالمستقبل: «ما بيخلص شي قبل ما يبلّش» (§٤) و«منجَز اليوم» بيعتمد عليه.
    expect(after.finishedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("الحذف (§6.1)", () => {
  it("حذف تصميم مولَّد بيلغي قطعته كلّها (النشر معه) مثبّتةً، وبتضل ملغاة بعد إعادة التوليد", async () => {
    if (skip()) return;
    const design = await find("DESIGN", "POST");
    const publish = await find("PUBLISH", "POST");
    expect((await actions.deleteTasks([design.id])).ok).toBe(true);
    for (const id of [design.id, publish.id]) {
      const t = await prisma.task.findUniqueOrThrow({ where: { id } });
      expect(t.status).toBe("CANCELED");
      expect(t.isPinned).toBe(true);
    }
    await regen();
    expect((await prisma.task.findUniqueOrThrow({ where: { id: publish.id } })).status).toBe("CANCELED");
    // الخطة ما تغيّرت: ما انولّد بديل بنفس الدلو.
    expect(await prisma.task.count({ where: { companyId, type: "POST", status: { not: "CANCELED" } } })).toBe(0);
  });

  it("[OP-08 مُصلَح] إلغاء القطعة بالحذف بيحمل سطر دليل على notes (§٢)", async () => {
    if (skip()) return;
    const canceled = await prisma.task.findMany({ where: { companyId, type: "POST", status: "CANCELED" } });
    expect(canceled.length).toBeGreaterThan(0);
    for (const t of canceled) expect(t.notes ?? "").not.toBe("");
  });

  it("المهمة اليدوية بتنحذف فعلياً، والكرت يلي كان محجوزاً خلفها ما عاد محجوزاً", async () => {
    if (skip()) return;
    const a = await prisma.task.create({ data: { id: `${uniq}-manual-a`, kind: "ADHOC", title: "أ", hours: 4, year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId } });
    const b = await prisma.task.create({ data: { id: `${uniq}-manual-b`, kind: "ADHOC", title: "ب", hours: 4, year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId, blockedById: a.id } });
    expect(daily.makeBlockedPredicate([a, b])(b)).toBe(true);
    expect((await actions.deleteTasks([a.id])).ok).toBe(true);
    expect(await prisma.task.count({ where: { id: a.id } })).toBe(0);
    const bAfter = await prisma.task.findUniqueOrThrow({ where: { id: b.id } });
    expect(bAfter.blockedById).toBe(a.id); // مرجع معلّق — ما بينضّف
    expect(daily.makeBlockedPredicate([bAfter])(bAfter)).toBe(false);
  });
});

describe("تبديل مهام اليوم (updateDailyTasks)", () => {
  const TODAY = "2026-09-17"; // الخميس → يوم الدوام التالي الأحد ٢٠/٩
  let m1: string;
  let m2: string;

  it("الترقية بتثبّت على اليوم، والتنزيل بيروح ليوم دوام صاحب الكرت التالي (الخميس → الأحد)", async () => {
    if (skip()) return;
    m1 = (await prisma.task.create({ data: { id: `${uniq}-m1`, kind: "ADHOC", title: "م١", hours: 4, year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId, workDate: new Date(2026, 8, 22), readyDate: new Date(2026, 8, 22) } })).id;
    m2 = (await prisma.task.create({ data: { id: `${uniq}-m2`, kind: "ADHOC", title: "م٢", hours: 4, year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId, workDate: new Date(2026, 8, 17), readyDate: new Date(2026, 8, 17) } })).id;
    expect((await actions.updateDailyTasks([m1], [m2], TODAY)).ok).toBe(true);
    const a = await prisma.task.findUniqueOrThrow({ where: { id: m1 } });
    const b = await prisma.task.findUniqueOrThrow({ where: { id: m2 } });
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect([iso(a.manualDay), iso(a.workDate), a.isPinned]).toEqual([TODAY, TODAY, true]);
    expect([iso(b.manualDay), iso(b.workDate), b.isPinned]).toEqual(["2026-09-20", "2026-09-20", true]);
  });

  it("إعادة الحفظ بنفس الاختيار متكافئة", async () => {
    if (skip()) return;
    const before = await prisma.task.findMany({ where: { id: { in: [m1, m2] } }, orderBy: { id: "asc" } });
    expect((await actions.updateDailyTasks([m1], [m2], TODAY)).ok).toBe(true);
    const after = await prisma.task.findMany({ where: { id: { in: [m1, m2] } }, orderBy: { id: "asc" } });
    expect(after.map((t: { manualDay: Date; workDate: Date }) => [t.manualDay.getTime(), t.workDate.getTime()])).toEqual(
      before.map((t: { manualDay: Date; workDate: Date }) => [t.manualDay.getTime(), t.workDate.getTime()]),
    );
  });

  it("الطابور بيقدّم المُرقّى وبيفسّر المُنزَّل بيومه؛ وإعادة التوليد ما بتلمس التثبيت", async () => {
    if (skip()) return;
    const designer = await prisma.employee.findUniqueOrThrow({ where: { id: designerId } });
    const today = new Date(2026, 8, 17, 9);
    const mine = await prisma.task.findMany({ where: { assigneeId: designerId, status: { not: "CANCELED" } } });
    const w = daily.selectDailyWork({ employee: designer, tasks: mine, allTasks: mine, companies: [], today });
    expect(w.queue[0]?.id).toBe(m1);
    expect(w.queue.map((t) => t.id)).not.toContain(m2);
    const held = daily.makeHeldReason(mine, TODAY)(mine.find((t: { id: string }) => t.id === m2));
    expect(held?.parkedUntil).toBe("2026-09-20");
    await regen();
    const b = await prisma.task.findUniqueOrThrow({ where: { id: m2 } });
    expect(b.manualDay?.getDate()).toBe(20);
    expect(b.workDate?.getDate()).toBe(20);
  });
});

describe("تأكيد نشر يدوي (markPiecesPublished)", () => {
  it("بيختم بتاريخ النشر الفعلي وبيكتب الدليل، والنداء التاني ما بيكرّر شي", async () => {
    if (skip()) return;
    const pub = await prisma.task.create({ data: { id: `${uniq}-pub-manual`, kind: "PUBLISH", stage: "PUBLISH", type: "STORY", year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId, publishDate: new Date(2026, 8, 20) } });
    const r1 = await ops.markPiecesPublished([pub.id], "2026-09-25");
    expect(r1.ok).toBe(true);
    const a = await prisma.task.findUniqueOrThrow({ where: { id: pub.id } });
    expect(a.status).toBe("PUBLISHED");
    expect(a.finishedAt.getDate()).toBe(25);
    expect(a.notes).toContain("تأكيد نشر يدوي");
    expect(a.isPinned).toBe(true);
    const r2 = await ops.markPiecesPublished([pub.id], "2026-09-28");
    expect(r2.ok).toBe(true);
    const b = await prisma.task.findUniqueOrThrow({ where: { id: pub.id } });
    expect(b.finishedAt.getTime()).toBe(a.finishedAt.getTime());
    expect(b.notes).toBe(a.notes);
  });
});

describe("[OP-09] نشر بتاريخ سابق من نموذج التعديل — الإقفال المتسلسل بيختم «هلّق»", () => {
  let designId: string;
  let publishId: string;

  it("[OP-09 مُصلَح] نموذج التعديل على كرت نشر (status=PUBLISHED + publishDate ماضي): النشر بينختم بيومه والتصميم المفتوح بينسكّر بنفس اليوم", async () => {
    if (skip()) return;
    designId = (await prisma.task.create({ data: { id: `${uniq}-op09-d`, kind: "CONTENT", stage: "DESIGN", type: "POST", title: "بوست يدوي", hours: 0, year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId, workDate: new Date(2026, 8, 8), readyDate: new Date(2026, 8, 8), publishDate: new Date(2026, 8, 10) } })).id;
    publishId = (await prisma.task.create({ data: { id: `${uniq}-op09-p`, kind: "PUBLISH", stage: "PUBLISH", type: "POST", title: "نشر بوست يدوي", hours: 0, year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId, blockedById: designId, readyDate: new Date(2026, 8, 10), publishDate: new Date(2026, 8, 10) } })).id;
    // TaskForm بيبعت publishDate دايماً لكرت النشر (isPublishCard) — نفس النداء.
    const r = await actions.updateTaskDetails([publishId], { status: "PUBLISHED", publishDate: "2026-09-10" });
    expect(r.ok).toBe(true);
    const pub = await prisma.task.findUniqueOrThrow({ where: { id: publishId } });
    const design = await prisma.task.findUniqueOrThrow({ where: { id: designId } });
    expect(pub.status).toBe("PUBLISHED");
    expect(pub.finishedAt.getDate()).toBe(10);
    expect(design.status).toBe("READY");
    expect(design.finishedAt.getDate()).toBe(10);
    // ما صار «منجَز اليوم» للمصمّم — ما بياكل من سعة يومه الحقيقي.
    const { toISODate } = await import("@/lib/dates");
    expect(daily.isFinishedOnDay(design, toISODate(new Date()))).toBe(false);
  });

  it("[OP-09 مُصلَح] المرحلة السابقة بتنختم ≤ تاريخ النشر («ما بينشر شي قبل ما يخلص» §٤)", async () => {
    if (skip()) return;
    const pub = await prisma.task.findUniqueOrThrow({ where: { id: publishId } });
    const design = await prisma.task.findUniqueOrThrow({ where: { id: designId } });
    expect(design.finishedAt.getTime()).toBeLessThanOrEqual(pub.finishedAt.getTime());
  });
});

describe("[OP-14] تعديل جماعي (updateTaskDetails بأكتر من معرّف) — الحالة بلا طوابع", () => {
  let aId: string;
  let bId: string;

  it("[OP-14 مُصلَح] إرجاع كرتين لـ«لم يبدأ» دفعة وحدة: الكرت التاني بياخد الحالة وطوابعها", async () => {
    if (skip()) return;
    aId = (await prisma.task.create({ data: { id: `${uniq}-op14-a`, kind: "ADHOC", title: "أ", hours: 4, year: Y, month: M, status: "NOT_STARTED", board: "TODO", isAuto: false, assigneeId: designerId, companyId } })).id;
    const at = new Date(2026, 8, 9, 12);
    bId = (await prisma.task.create({ data: { id: `${uniq}-op14-b`, kind: "ADHOC", title: "ب", hours: 4, year: Y, month: M, status: "READY", board: "DONE", isAuto: false, assigneeId: designerId, companyId, startedAt: at, finishedAt: at, completedAt: at } })).id;
    expect((await actions.updateTaskDetails([aId, bId], { status: "NOT_STARTED" })).ok).toBe(true);
    const b = await prisma.task.findUniqueOrThrow({ where: { id: bId } });
    expect([b.status, b.board]).toEqual(["NOT_STARTED", "TODO"]);
    expect(b.finishedAt).toBeNull();
    expect(b.completedAt).toBeNull();
  });

  it("[OP-14 مُصلَح] الكرت المُعاد فتحه دفعة بيطلع مفتوحاً بكل المصنِّفات (isTaskDoneState)", async () => {
    if (skip()) return;
    const b = await prisma.task.findUniqueOrThrow({ where: { id: bId } });
    expect(constants.isTaskDoneState(b)).toBe(false);
  });
});

describe("[OP-15 مُصلَح] «أوقف النشر» بيخفي ولا بيمحي، و«رجّع النشر» بيكمّل الباقي (قرار القائدة ١٢/١٠)", () => {
  let doneId = "";
  let openId = "";

  it("الإيقاف: المنجَز والمفتوح (بوصفه وطابع بدئه) محفوظين، وتاريخ البدء باقي، والكروت مخفيّة عن القوائم", async () => {
    if (skip()) return;
    const companiesActions = await import("@/server/actions/companies");
    const co = await prisma.company.create({
      data: {
        name: `${uniq}-موقوفة`,
        managed: true,
        posts: 2,
        contractStartDate: new Date(2026, 8, 1),
        publishStartDate: new Date(2026, 8, 1),
        postOwnerId: designerId,
        defaultOwnerId: designerId,
        priority: 91,
      },
    });
    pausedCoId = co.id;
    expect((await engine.generateScheduleInternal(Y, M, co.id)).ok).toBe(true);
    const designs = await prisma.task.findMany({ where: { companyId: co.id, stage: "DESIGN", type: "POST" }, orderBy: { pieceNo: "asc" } });
    expect(designs.length).toBe(2);
    const at = new Date(2026, 8, 5, 12);
    doneId = designs[0].id;
    openId = designs[1].id;
    await prisma.task.update({ where: { id: doneId }, data: { status: "READY", board: "DONE", startedAt: at, finishedAt: at, completedAt: at } });
    await prisma.task.update({ where: { id: openId }, data: { brief: "وصف كتبته القائدة للبوست ٢", status: "IN_PROGRESS", board: "DOING", startedAt: at } });

    const r = await companiesActions.pauseCompanyPublishing(co.id);
    expect(r.ok).toBe(true);
    expect(await prisma.task.count({ where: { id: { in: [doneId, openId] } } })).toBe(2);
    const open = await prisma.task.findUniqueOrThrow({ where: { id: openId } });
    expect([open.status, open.brief]).toEqual(["IN_PROGRESS", "وصف كتبته القائدة للبوست ٢"]);
    const after = await prisma.company.findUniqueOrThrow({ where: { id: co.id } });
    expect(after.status).toBe("paused");
    expect(after.publishStartDate).not.toBeNull();
    const { hideDormantCompanyWork } = await import("@/lib/company-visibility");
    const rows: { companyId: string | null; status: string; board: string | null; completedAt: Date | null; finishedAt: Date | null }[] =
      await prisma.task.findMany({ where: { companyId: co.id } });
    const live = hideDormantCompanyWork(rows, [after]);
    expect(live.filter((t) => !constants.isTaskDoneState(t))).toEqual([]);
  });

  it("الرجوع بتاريخ: الباقي بس بيتجدول منه (بوصفه وحالته ورقمه)، والمنجز بمكانه", async () => {
    if (skip()) return;
    const companiesActions = await import("@/server/actions/companies");
    const before = await prisma.task.findUniqueOrThrow({ where: { id: doneId } });
    const r = await companiesActions.resumeCompanyPublishing(pausedCoId, "2026-11-01");
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    // «باقي» = قطعة نشرها مو منجز: بوست ١ تصميمه خالص بس لسا ما انتشر.
    expect((r as { remaining?: number }).remaining).toBe(2);
    const co = await prisma.company.findUniqueOrThrow({ where: { id: pausedCoId } });
    expect(co.status).toBe("active");
    const pieces: { pieceNo: number | null; stage: string | null; status: string; brief: string | null; workDate: Date | null; publishDate: Date | null }[] =
      await prisma.task.findMany({ where: { companyId: pausedCoId, type: "POST" }, orderBy: [{ pieceNo: "asc" }, { stage: "asc" }] });
    const done = pieces.find((t) => t.pieceNo === 1 && t.stage === "DESIGN")!;
    expect([done.status, done.workDate?.getTime()]).toEqual(["READY", before.workDate?.getTime()]);
    const open = pieces.find((t) => t.pieceNo === 2 && t.stage === "DESIGN")!;
    expect([open.status, open.brief]).toEqual(["IN_PROGRESS", "وصف كتبته القائدة للبوست ٢"]);
    for (const no of [1, 2]) {
      const pub = pieces.find((t) => t.pieceNo === no && t.stage === "PUBLISH")!;
      expect(pub.publishDate!.getTime(), `بوست ${no}`).toBeGreaterThanOrEqual(new Date(2026, 10, 1).getTime());
    }
    expect(open.workDate!.getTime()).toBeGreaterThanOrEqual(new Date(2026, 10, 1).getTime());
  });
});
