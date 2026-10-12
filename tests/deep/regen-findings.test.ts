/**
 * الفحص العميق — محرّك إعادة التوليد · **العلل المثبتة** (`it.fails` بمعرّفها)
 *
 * كل حالة هون تكرار حتمي أدنى لعلّة بتخالف قاعدة موثّقة، على قاعدة SQLite
 * معزولة تنبنى من الـschema (بلا `prisma/dev.db`). الاختبار بيكتب **السلوك
 * الصحيح**، فبيفشل اليوم و`it.fails` بيخلّيه أخضر؛ يوم تنصلح العلّة بيصير
 * أحمر — شيل `.fails` وقتها. التفاصيل والدليل والإصلاح المقترح:
 * `docs/qa/deep-test-2026-10-11/regen-engine.md`.
 *
 * كل سيناريو بدلو (سنة/شهر) لحاله: موضع الشركة بين شركات الدلو بيزحزح
 * مواعيدها (`offset = coIdx*2` بـ`scheduler.ts`)، فالعزل شرط للحتمية.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { resolve } = await import("node:path");
  return { target: resolve(process.cwd(), "prisma", `test-deep-regen-findings-${process.pid}.db`) };
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

import { createSchema, seedTeam, makeCompany, removeDb, TEAM, D, day, autoCards, pieceCards } from "./regen-fixture";

type Prisma = import("@prisma/client").PrismaClient;
let prisma: Prisma;
let gen: (y: number, m: number, only: string | null) => Promise<{ ok: boolean; error?: string }>;
let actions: typeof import("@/server/actions/tasks");
let ops: typeof import("@/server/task-ops");
let companies: typeof import("@/server/actions/companies");

async function genOk(y: number, m: number, only: string | null = null) {
  const r = await gen(y, m, only);
  expect(r.ok, r.error).toBe(true);
}

const iso = (y: number, m1: number, d: number) =>
  `${y}-${String(m1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

beforeAll(async () => {
  prisma = (await import("@/lib/db")).prisma;
  await createSchema(prisma);
  await seedTeam(prisma);
  ({ generateScheduleInternal: gen } = (await import("@/server/schedule-engine")) as never);
  actions = await import("@/server/actions/tasks");
  ops = await import("@/server/task-ops");
  companies = await import("@/server/actions/companies");
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeDb(scratch.target);
});

// ═══════════════════════════════════════════════════════════════════════════
// RG-01 · P0 — إلغاء قطعة بيتسرّب لقطعة تانية (ولو منجزة) بعد إعادة توقيت
// ═══════════════════════════════════════════════════════════════════════════
/**
 * شركة لحالها بدلوها: ٤ بوستات، ١ و٢ منجزين، ٣ ملغى (حذف كرت مولَّد = إلغاء
 * مثبّت، PROJECT §6.1). بعدين زحزحة بداية العقد/النشر `shift` يوم وإعادة توليد.
 * بيرجّع حالة كرت التصميم لكل رقم.
 */
async function cancelLeakScenario(k: number, shift: number) {
  const y = 2040 + Math.floor(k / 12);
  const m = k % 12;
  const id = `c_leak_${k}`;
  await makeCompany(prisma, id, {
    posts: 4,
    reels: 0,
    stories: 0,
    contractStartDate: D(y, m + 1, 1),
    publishStartDate: D(y, m + 1, 1),
  });
  await genOk(y, m, id);
  for (const n of [1, 2]) {
    const p = await pieceCards(prisma, id, "POST", n);
    expect((await actions.updateTaskStatus(p.production!.id, "READY")).ok).toBe(true);
  }
  const p3 = await pieceCards(prisma, id, "POST", 3);
  expect((await actions.deleteTasks([p3.production!.id])).ok).toBe(true);
  if (shift > 0) {
    await prisma.company.update({
      where: { id },
      data: { contractStartDate: D(y, m + 1, 1 + shift), publishStartDate: D(y, m + 1, 1 + shift) },
    });
  }
  await genOk(y, m, id);
  const designs = (await autoCards(prisma, id)).filter((c) => c.stage === "DESIGN");
  return new Map(designs.map((c) => [c.pieceNo!, `${c.board}/${c.status}`]));
}

describe("RG-01 · الإلغاء بيتسرّب بعد إعادة التوقيت (applyCanceledPieces بلا حارس الصفوف المحجوزة)", () => {
  it("الإعداد سليم: بلا زحزحة، الملغى بيضل ملغى برقمه والمنجز منجز", async () => {
    const s = await cancelLeakScenario(0, 0);
    expect([...s.entries()].sort()).toEqual([
      [1, "DONE/READY"],
      [2, "DONE/READY"],
      [3, "TODO/CANCELED"],
      [4, "TODO/NOT_STARTED"],
    ]);
  });

  it.fails(
    "[RG-01] زحزحة العقد ١…١٤ يوم: ولا قطعة غير الملغاة بتتغيّر حالتها (اليوم: زحزحة ٥ بتلغي بوست ٢ المنجز)",
    async () => {
      const leaks: string[] = [];
      for (let shift = 1; shift <= 14; shift++) {
        const s = await cancelLeakScenario(shift, shift);
        const want = new Map([
          [1, "DONE/READY"],
          [2, "DONE/READY"],
          [3, "TODO/CANCELED"],
          [4, "TODO/NOT_STARTED"],
        ]);
        for (const [no, st] of want)
          if (s.get(no) !== st) leaks.push(`shift ${shift}: بوست ${no} ${st} → ${s.get(no)}`);
      }
      expect(leaks).toEqual([]);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// RG-02 · P0 — تقليل العدد من نموذج الشركة بيمحي قطعاً منجزة بأول إعادة توليد
// ═══════════════════════════════════════════════════════════════════════════
describe("RG-02 · نموذج الشركة بيقلّل العدد بلا حارس §٩، والتوليد بيمحي المنجز", () => {
  const CO = "c_form_cut";
  const Y = 2032;
  const M = 2;
  let doneId = "";

  it("الإعداد: بوست ٣ منجز وعليه وصف، ونموذج الشركة بيقبل posts 3→2 بلا اعتراض", async () => {
    await makeCompany(prisma, CO, {
      posts: 3,
      reels: 0,
      stories: 0,
      contractStartDate: D(Y, M + 1, 1),
      publishStartDate: D(Y, M + 1, 1),
    });
    await genOk(Y, M, CO);
    const p3 = (await pieceCards(prisma, CO, "POST", 3)).production!;
    doneId = p3.id;
    await prisma.task.update({ where: { id: p3.id }, data: { brief: "خطة الزبون — بوست ٣" } });
    expect((await actions.updateTaskStatus(p3.id, "READY")).ok).toBe(true);
    const co = await prisma.company.findUniqueOrThrow({ where: { id: CO } });
    const r = await companies.updateCompany(CO, {
      name: co.name,
      managed: true,
      posts: 2,
      reels: 0,
      aiReels: 0,
      stories: 0,
      contractStartDate: iso(Y, M + 1, 1),
      publishStartDate: iso(Y, M + 1, 1),
      preferredShootDay: null,
      contentSupplied: false,
      color: "#C8A84E",
      priority: co.priority,
      status: "active",
      defaultOwnerId: TEAM.designer.id,
      photographerId: TEAM.photographer.id,
    } as never);
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    // حمولة planCounts نفسها كانت رح ترفض: «تقليل … يحذف قطعاً عليها شغل أو وصف»
  });

  it.fails("[RG-02] أول إعادة توليد بعد الحفظ (أي تعديل كرت بالدلو) ما بتمحي بوست ٣ المنجز ووصفه", async () => {
    await genOk(Y, M, null);
    const kept = await prisma.task.findFirst({
      where: { companyId: CO, type: "POST", stage: "DESIGN", board: "DONE", brief: "خطة الزبون — بوست ٣" },
    });
    expect(kept, `الكرت المنجز ${doneId} انمحى مع وصفه`).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RG-03 · P1 — مونتاج منجز ومثبّت بيتحرّك لأنّ يوم النشر **على كرته** قديم
// ═══════════════════════════════════════════════════════════════════════════
/**
 * نسخة اصطناعية من عبادة REEL#1 (دلو 2026/7، مرآة ١٢:٤٩): تصوير منجز ١٦/٩،
 * مونتاج منجز مثبّت ٢٧/٩ (ملف أليسار)، نشر منجز ٢٨/٩ — قصة متّسقة. بس كرت
 * المونتاج لسا حامل `publishDate` ٢٢/٩ من قبل التأجيل، و`retimeEditsAfterActualShoot`
 * بيقارن بيوم النشر **على كرت المونتاج** لا بكرت النشر، فبيشوف «مونتاج بعد
 * النشر» وبيسحبه لأول دوام بعد التصوير: ١٧/٩.
 */
describe("RG-03 · عبادة ريل ١: مونتاج منجز مثبّت متّسق بينسحب ٢٧/٩ → ١٧/٩", () => {
  const CO = "c_obada_like";
  const Y = 2026;
  const M = 8;
  const at = (s: string) => new Date(`${s}T09:00:00`);
  let editId = "";

  it("الإعداد: نفس حقول المرآة (تصوير ١٦/٩ · مونتاج ٢٧/٩ ونشره على كرته ٢٢/٩ · نشر ٢٨/٩)", async () => {
    await makeCompany(prisma, CO, { posts: 0, stories: 0, reels: 2 });
    await genOk(Y, M, CO);
    const r = await pieceCards(prisma, CO, "REEL", 1);
    editId = r.edit!.id;
    const set = (id: string, work: string, pub: string, status: string, fin: string) =>
      prisma.task.update({
        where: { id },
        data: {
          board: "DONE",
          status,
          isPinned: true,
          workDate: new Date(`${work}T00:00:00`),
          readyDate: new Date(`${work}T00:00:00`),
          publishDate: new Date(`${pub}T00:00:00`),
          startedAt: at(fin),
          finishedAt: at(fin),
          completedAt: at(fin),
        },
      });
    await set(r.production!.id, "2026-09-15", "2026-09-22", "READY", "2026-09-16");
    await set(r.edit!.id, "2026-09-27", "2026-09-22", "READY", "2026-09-27");
    await set(r.publish!.id, "2026-09-28", "2026-09-28", "PUBLISHED", "2026-09-28");
    expect(day((await prisma.task.findUniqueOrThrow({ where: { id: editId } })).workDate)).toBe("2026-09-27");
  });

  it.fails("[RG-03] إعادة التوليد ما بتحرّك المونتاج المنجز المثبّت عن ٢٧/٩ (اليوم: ١٧/٩)", async () => {
    await genOk(Y, M, null);
    const edit = (await pieceCards(prisma, CO, "REEL", 1)).edit!;
    expect(edit.board).toBe("DONE");
    expect(day(edit.workDate)).toBe("2026-09-27");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RG-04 · P1 — المعرّف موضعي بالدلو كله، فإعادة التوليد بتفلت روابط تلغرام
// ═══════════════════════════════════════════════════════════════════════════
/**
 * المعرّف `${y}_${m}_d_${co}_${type}_${seq}` و`seq` عدّاد على **كل** قطع الدلو
 * (`expandPipeline`). أي قطعة زيادة عند شركة قبلها بالترتيب بتزحزح معرّفات
 * الشركة يلي بعدها، و`TelegramMessage.taskId` (دليل التسليم) ما بيتحدّث: بيضل
 * يأشّر على المعرّف القديم — يلي صار لقطعة **تانية**.
 */
describe("RG-04 · رابط ملف تلغرام بينتقل لقطعة تانية بعد إعادة توليد", () => {
  const Y = 2034;
  const M = 2;
  const X = "c_tg_first";
  const YY = "c_tg_second";
  let linkedTo = "";

  it("الإعداد: ملف «بوست ٢» مربوط بكرت تصميم بوست ٢ عند الشركة التانية", async () => {
    for (const id of [X, YY])
      await makeCompany(prisma, id, {
        reels: 0,
        stories: 0,
        contractStartDate: D(Y, M + 1, 1),
        publishStartDate: D(Y, M + 1, 1),
      });
    await genOk(Y, M, null);
    const target = (await pieceCards(prisma, YY, "POST", 2)).production!;
    linkedTo = target.id;
    await prisma.telegramMessage.create({
      data: {
        id: "chat:1",
        chatId: "chat",
        messageId: 1,
        sentAt: D(Y, M + 1, 10),
        kind: "PHOTO",
        fileName: "second-post-2.jpg",
        companyId: YY,
        taskId: target.id,
        matchedBy: "NAME",
      },
    });
    // الشركة الأولى زادت بوستاً (حمولة planCounts أو نموذج الشركة) → إعادة توليد الدلو
    await prisma.company.update({ where: { id: X }, data: { posts: 4 } });
    await genOk(Y, M, null);
  });

  it.fails("[RG-04] الملف بيضل مربوطاً بتصميم بوست ٢ نفسه (اليوم: بيأشّر على بوست ١)", async () => {
    const msg = await prisma.telegramMessage.findUniqueOrThrow({ where: { id: "chat:1" } });
    const t = msg.taskId ? await prisma.task.findUnique({ where: { id: msg.taskId } }) : null;
    expect(t ? `${t.companyId} ${t.type}#${t.pieceNo} ${t.stage}` : `معلّق (${linkedTo})`).toBe(
      `${YY} POST#2 DESIGN`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RG-07 · P3 — `reviewedAt`/`reviewedById` ما بيمرقوا بأماكن الحفظ (§٣)
// ═══════════════════════════════════════════════════════════════════════════
describe("RG-07 · مراجعة القائدة (setPieceReviewed) بتنمحى بأول إعادة توليد", () => {
  const CO = "c_review";
  const Y = 2035;
  const M = 2;
  let publishId = "";

  it("الإعداد: setPieceReviewed بيكتب الختم على كرت النشر", async () => {
    await makeCompany(prisma, CO, {
      reels: 0,
      stories: 0,
      contractStartDate: D(Y, M + 1, 1),
      publishStartDate: D(Y, M + 1, 1),
    });
    await genOk(Y, M, null);
    publishId = (await pieceCards(prisma, CO, "POST", 1)).publish!.id;
    expect((await ops.setPieceReviewed(publishId, true, TEAM.publisher.id)).ok).toBe(true);
    const t = await prisma.task.findUniqueOrThrow({ where: { id: publishId } });
    expect(t.reviewedAt).not.toBeNull();
    expect(t.reviewedById).toBe(TEAM.publisher.id);
  });

  it.fails("[RG-07] الختم بيصمد على إعادة التوليد", async () => {
    await genOk(Y, M, null);
    const t = await prisma.task.findUniqueOrThrow({ where: { id: publishId } });
    expect(t.reviewedAt).not.toBeNull();
  });
});
