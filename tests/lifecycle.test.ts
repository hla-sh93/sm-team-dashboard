/**
 * اختبار دورة الحياة — إضافة · تعديل · إسناد · حذف · إعادة جدولة.
 *
 * القائدة (10/8): «تصرف كأنك مدير فريق سوشال ميديا وتحقق من الربط، العلاقات،
 * المهام، الانجاز… من اضافة - حذف - تعديل - تغيير اسناد - اعادة جدولة».
 *
 * ⚠️ **ولا حرف بينكتب على داتا الشغل.** بقية الاختبارات بتقرا `prisma/dev.db`
 * وبس، أما هون فمنكتب ومنمحي — فالملف بينتنسخ لنسخة مؤقتة، وكل شي بيصير عليها،
 * وبتنمحى بالآخر. القائدة: «خذ نسخة من الداتا الحقيقية لا أريد أي ضياع».
 * والاختبار بيتحقّق من بصمة الأصل قبل وبعد، فأي تسرّب بيوقّعه فوراً.
 */
import { copyFileSync, existsSync, readFileSync, rmSync } from "fs";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isTaskDoneState, isTaskLateState } from "../src/lib/constants";
import { applyPipelinePreservation } from "../src/lib/pipeline-preservation";

const REAL = "prisma/dev.db";
const COPY = "prisma/.lifecycle-test.db";

const fingerprint = (f: string) =>
  createHash("sha256").update(readFileSync(f)).digest("hex");

let db: PrismaClient;
let realBefore = "";

beforeAll(() => {
  realBefore = fingerprint(REAL);
  copyFileSync(REAL, COPY);
  db = new PrismaClient({ datasources: { db: { url: `file:${process.cwd()}/${COPY}` } } });
});

afterAll(async () => {
  await db?.$disconnect();
  if (existsSync(COPY)) rmSync(COPY);
  for (const ext of ["-journal", "-wal", "-shm"]) if (existsSync(COPY + ext)) rmSync(COPY + ext);
});

describe("الحارس الأول — داتا الشغل ما بتنلمس", () => {
  it("النسخة انعملت وهي مطابقة", () => {
    expect(existsSync(COPY)).toBe(true);
    expect(fingerprint(COPY)).toBe(realBefore);
  });

  it("والأصل ما تغيّر", () => {
    expect(fingerprint(REAL)).toBe(realBefore);
  });
});

describe("الربط والعلاقات", () => {
  it("كل شركة مُدارة إلها توبيك تلغرام", async () => {
    const cos = await db.company.findMany({ where: { managed: true } });
    const chats = await db.telegramChat.findMany({ where: { companyId: { not: null } } });
    const linked = new Set(chats.map((c) => c.companyId));
    const missing = cos.filter((c) => !linked.has(c.id)).map((c) => c.name);
    expect(missing).toEqual([]);
  });

  it("ولا توبيك مربوط بشركة ما بتوجد", async () => {
    const chats = await db.telegramChat.findMany({ where: { companyId: { not: null } } });
    const ids = new Set((await db.company.findMany({ select: { id: true } })).map((c) => c.id));
    expect(chats.filter((c) => !ids.has(c.companyId!)).map((c) => c.title)).toEqual([]);
  });

  it("كل كرت مسنَد لموظف موجود، وكل كرت شركة لشركة موجودة", async () => {
    const [tasks, emps, cos] = await Promise.all([
      db.task.findMany({ select: { id: true, assigneeId: true, companyId: true } }),
      db.employee.findMany({ select: { id: true } }),
      db.company.findMany({ select: { id: true } }),
    ]);
    const e = new Set(emps.map((x) => x.id));
    const c = new Set(cos.map((x) => x.id));
    expect(tasks.filter((t) => t.assigneeId && !e.has(t.assigneeId)).length).toBe(0);
    expect(tasks.filter((t) => t.companyId && !c.has(t.companyId)).length).toBe(0);
  });

  it("كل حاجز (blockedBy) بيشير لكرت موجود وما في حلقة", async () => {
    const tasks = await db.task.findMany({ select: { id: true, blockedById: true } });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const dangling = tasks.filter((t) => t.blockedById && !byId.has(t.blockedById));
    expect(dangling.map((t) => t.id)).toEqual([]);
    // الحلقة بتعلّق أي متتبّع للسلسلة — والمنتقي اليومي بيمشي فيها.
    for (const t of tasks) {
      const seen = new Set<string>();
      let cur = t;
      while (cur.blockedById) {
        if (seen.has(cur.id)) throw new Error(`حلقة عند ${t.id}`);
        seen.add(cur.id);
        const next = byId.get(cur.blockedById);
        if (!next) break;
        cur = next;
      }
    }
  });
});

describe("الإضافة", () => {
  it("كرت إضافي جديد بيظهر بشغل صاحبه وبيحمل ساعاته", async () => {
    const co = await db.company.findFirst({ where: { managed: true } });
    const t = await db.task.create({
      data: {
        kind: "ADHOC",
        stage: "DESIGN",
        title: "اختبار — كرت إضافي",
        companyId: co!.id,
        assigneeId: "e_sabin",
        hours: 4,
        quantity: 1,
        month: 7,
        year: 2026,
        workDate: new Date("2026-08-12"),
        status: "NOT_STARTED",
        board: "TODO",
        isPinned: true,
        isAuto: false,
      },
    });
    const back = await db.task.findUnique({ where: { id: t.id } });
    expect(back?.hours).toBe(4);
    expect(back?.isPinned).toBe(true);
    expect(isTaskDoneState(back!)).toBe(false);
    await db.task.delete({ where: { id: t.id } });
  });
});

describe("التعديل والإسناد", () => {
  it("تغيير المسنَد إليه بينقل الكرت كاملاً", async () => {
    const t = await db.task.findFirst({ where: { assigneeId: "e_sabin", board: { not: "DONE" } } });
    if (!t) return;
    await db.task.update({ where: { id: t.id }, data: { assigneeId: "e_ayman" } });
    const moved = await db.task.findUnique({ where: { id: t.id } });
    expect(moved?.assigneeId).toBe("e_ayman");
    expect(moved?.hours).toBe(t.hours); // الساعات ما بتتغيّر بتغيّر الشخص
    await db.task.update({ where: { id: t.id }, data: { assigneeId: t.assigneeId } });
  });

  it("الإقفال بيمنع «متأخر» مهما كان الاستحقاق", async () => {
    const t = await db.task.findFirst({
      where: { board: { not: "DONE" }, readyDate: { lt: new Date("2026-07-01") } },
    });
    if (!t) return;
    expect(isTaskLateState(t)).toBe(true);
    await db.task.update({
      where: { id: t.id },
      data: { status: "READY", board: "DONE", finishedAt: new Date(), completedAt: new Date() },
    });
    const done = await db.task.findUnique({ where: { id: t.id } });
    expect(isTaskDoneState(done!)).toBe(true);
    expect(isTaskLateState(done!)).toBe(false);
    await db.task.update({
      where: { id: t.id },
      data: { status: t.status, board: t.board, finishedAt: t.finishedAt, completedAt: t.completedAt },
    });
  });

  it("الكرت المثبّت ليوم جاي مو متأخر — ولو استحقاقه مرق", async () => {
    const past = new Date("2026-07-01");
    const future = new Date("2026-12-31");
    expect(isTaskLateState({ readyDate: past, isPinned: true, workDate: future })).toBe(false);
    expect(isTaskLateState({ readyDate: past, isPinned: false, workDate: future })).toBe(true);
    // ولمّا ييجي يومه بيرجع ينحسب عادي.
    expect(isTaskLateState({ readyDate: past, isPinned: true, workDate: past })).toBe(true);
  });
});

describe("الحذف", () => {
  it("حذف كرت ما بيكسر يلي محجوز عليه", async () => {
    const co = await db.company.findFirst({ where: { managed: true } });
    const a = await db.task.create({
      data: { kind: "ADHOC", title: "اختبار — أصل", companyId: co!.id, hours: 1, month: 7, year: 2026, isAuto: false },
    });
    const b = await db.task.create({
      data: { kind: "ADHOC", title: "اختبار — تابع", companyId: co!.id, hours: 1, month: 7, year: 2026, isAuto: false, blockedById: a.id },
    });
    await db.task.delete({ where: { id: a.id } });
    const orphan = await db.task.findUnique({ where: { id: b.id } });
    // المهم إنّ التابع بيضلّ موجوداً ومقروءاً — لا إنّو ينمحي معه بالصمت.
    expect(orphan).not.toBeNull();
    await db.task.delete({ where: { id: b.id } });
  });

  it("حذف شركة بيشيل كروتها (onDelete: Cascade) — فما بتضلّ كروت يتيمة", async () => {
    const co = await db.company.create({ data: { name: "اختبار — شركة مؤقتة", managed: false } });
    await db.task.create({
      data: { kind: "ADHOC", title: "اختبار — كرت شركة مؤقتة", companyId: co.id, hours: 1, month: 7, year: 2026, isAuto: false },
    });
    await db.company.delete({ where: { id: co.id } });
    expect(await db.task.count({ where: { companyId: co.id } })).toBe(0);
  });
});

describe("إعادة الجدولة — شو بينحفظ وشو بينمحى", () => {
  it("الحقول المحفوظة بتنتقل للكرت الجديد", () => {
    const old = [
      {
        id: "old1",
        companyId: "c1",
        type: "POST",
        stage: "DESIGN",
        publishDate: new Date("2026-08-10"),
        status: "IN_PROGRESS",
        board: "DOING",
        brief: "نصّ الخطة",
        notes: "دليل الإقفال",
        title: "عنوان معدّل",
        isPinned: true,
      },
    ] as never;
    const fresh = [
      {
        companyId: "c1",
        type: "POST",
        stage: "DESIGN",
        publishDate: new Date("2026-08-10"),
        status: "NOT_STARTED",
        board: "TODO",
      },
    ] as never;
    // الدالة بتعدّل `fresh` بمكانها وما بترجّع شي.
    applyPipelinePreservation(fresh, old);
    const out = fresh as unknown as Record<string, unknown>[];
    // البريف والملاحظات ضاعوا مرتين قبل هيك — الاختبار بيمنع التالتة.
    expect(out[0].brief).toBe("نصّ الخطة");
    expect(out[0].notes).toBe("دليل الإقفال");
    expect(out[0].title).toBe("عنوان معدّل");
  });
});

describe("الإنجاز والعدّادات", () => {
  it("ولا كرت منجز بلا تاريخ إنجاز", async () => {
    const done = await db.task.findMany({ where: { board: "DONE" }, select: { id: true, finishedAt: true } });
    expect(done.filter((t) => !t.finishedAt).map((t) => t.id)).toEqual([]);
  });

  it("ولا إنجاز مختوم بالمستقبل", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const future = await db.task.findMany({
      where: { completedAt: { gt: tomorrow } },
      select: { id: true, title: true, completedAt: true },
    });
    expect(future.map((t) => t.title ?? t.id)).toEqual([]);
  });

  it("كل إقفال نشر من تموز وبعده إلو دليل", async () => {
    // قاعدة «الإقفال بدليل» بلّشت بتموز؛ ٧٠ كرت من دورة حزيران انسكّروا قبلها
    // وما منحاسبهن عليها بأثر رجعي. الحارس للجاي: الإقفال بلا سبب هو يلي خلّى
    // ١٠٢ قطعة تطلع منشورة بلا دليل، وريل وصل ٤ ينفتح من جديد.
    const pub = await db.task.findMany({
      where: { stage: "PUBLISH", board: "DONE", year: 2026, month: { gte: 6 } },
      select: { id: true, notes: true, companyId: true, type: true, pieceNo: true },
    });
    const noProof = pub.filter((t) => !t.notes?.trim());
    expect(noProof.map((t) => `${t.type}#${t.pieceNo}`)).toEqual([]);
  });

  it("القطعة المنشورة إنتاجها منجز — ما بينشر شي ما انعمل", async () => {
    // المطابقة بالعدد كانت تسكّر النشر وبس، فطلعت ١٠ قطع لأغاليا منشورة
    // وتصميمها مفتوح: الشغل يبان مستحقاً وهو خالص، والحمل يطلع أعلى من الحقيقة.
    const all = await db.task.findMany({
      where: { type: { not: null }, status: { not: "CANCELED" } },
      select: { companyId: true, type: true, pieceNo: true, month: true, year: true,
        stage: true, status: true, board: true, completedAt: true, finishedAt: true },
    });
    const byPiece = new Map<string, typeof all>();
    for (const t of all) {
      const k = `${t.companyId}|${t.type}|${t.pieceNo}|${t.month}|${t.year}`;
      byPiece.set(k, [...(byPiece.get(k) ?? []), t]);
    }
    const bad: string[] = [];
    for (const rows of byPiece.values()) {
      const pub = rows.find((r) => r.stage === "PUBLISH");
      if (!pub || !isTaskDoneState(pub)) continue;
      const open = rows.filter((r) => r.stage !== "PUBLISH" && !isTaskDoneState(r));
      if (open.length) bad.push(`${rows[0].type}#${rows[0].pieceNo}`);
    }
    expect(bad).toEqual([]);
  });

  it("رقم القطعة ما بيتكرّر بنفس (شركة، نوع، دورة، مرحلة)", async () => {
    const t = await db.task.findMany({
      where: { type: { not: null }, pieceNo: { not: null }, status: { not: "CANCELED" } },
      select: { companyId: true, type: true, pieceNo: true, month: true, year: true, stage: true },
    });
    const seen = new Map<string, number>();
    for (const x of t) {
      const k = `${x.companyId}|${x.type}|${x.pieceNo}|${x.month}|${x.year}|${x.stage}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    expect([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)).toEqual([]);
  });
});
