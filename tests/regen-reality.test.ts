/**
 * حارس دائم: **إعادة الجدولة ما بتغيّر الواقع المسجّل** (تدقيق 11/8).
 *
 * العلّتان يلي كشفهما deep-audit وأصلحناهما بـ`schedule-retime.ts`:
 *   • `snapPipelineWorkDatesToAssigneeWorkDays` كانت تسحب كرتاً **منجزاً** ليوم
 *     دوام صاحبه — ريلات البلسم المصوّرة فعلاً يوم الجمعة 31/7 صارت «29/7».
 *   • `retimeEditsAfterActualShoot` كانت تعيد تأريخ مونتاج **منجز** لليوم
 *     التالي للتصوير — مونتاج BW ريل 68 المنجز 10/8 صار «4/8».
 *
 * القسم الأول اختبارات وحدة اصطناعية (بتضل صالحة مهما تغيّرت الداتا)، والتاني
 * فحص واقع على نسخة من `dev.db`: توليدان متتاليان وكل الواقع المسجّل بيصمد.
 * نفس عقد `operations-e2e.test.ts`: نسخة معزولة، ولا حرف على الأصل.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  retimeEditsAfterActualShoot,
  snapPipelineWorkDatesToAssigneeWorkDays,
} from "@/lib/schedule-retime";
import type { PipelineTask } from "@/lib/pipeline";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-regen-reality-${process.pid}.db`);
  const available = existsSync(source);
  const fingerprint = available
    ? createHash("sha256").update(readFileSync(source)).digest("hex")
    : "";
  if (available) copyFileSync(source, target);
  return { source, target, available, fingerprint };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {},
  requireAdminPage: async () => {},
  isAuthenticated: async () => true,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return {
    prisma: new PrismaClient({ datasources: { db: { url } } }),
  };
});

/** كرت پايپلاين بالحدّ الأدنى — الحقول يلي بتقرأها الدالتان. */
const card = (over: Partial<PipelineTask>): PipelineTask =>
  ({
    id: "t",
    kind: "CONTENT",
    stage: "DESIGN",
    board: "TODO",
    type: "REEL",
    title: null,
    companyId: "c1",
    assigneeId: "e1",
    quantity: 1,
    pieceNo: 1,
    priority: "MEDIUM",
    status: "NOT_STARTED",
    publishDate: null,
    readyDate: null,
    workDate: null,
    manualDay: null,
    week: 1,
    blockedById: null,
    pipelineKey: "k1",
    isPinned: false,
    brief: null,
    notes: null,
    startedAt: null,
    finishedAt: null,
    completedAt: null,
    ...over,
  }) as PipelineTask;

// أيام دوام: الأحد–الخميس (بدون جمعة 5 وسبت 6).
const WEEKDAYS = [0, 1, 2, 3, 4];

describe("السند ليوم الدوام (snap)", () => {
  it("كرت منجز يوم الجمعة بيضل يوم الجمعة — الواقع مو خطة", () => {
    // 2026-07-31 جمعة: ماجد صوّر البلسم فيها فعلاً.
    const done = card({ stage: "SHOOT", board: "DONE", status: "READY", workDate: "2026-07-31" });
    snapPipelineWorkDatesToAssigneeWorkDays([done], [{ id: "e1", workDays: WEEKDAYS }]);
    expect(done.workDate).toBe("2026-07-31");
  });

  it("والكرت المفتوح بينسند ليوم دوام صاحبه متل ما كان", () => {
    const open = card({ workDate: "2026-07-31" }); // جمعة، مفتوح
    snapPipelineWorkDatesToAssigneeWorkDays([open], [{ id: "e1", workDays: WEEKDAYS }]);
    expect(open.workDate).not.toBe("2026-07-31");
    const d = new Date(`${open.workDate}T00:00:00`);
    expect(WEEKDAYS).toContain(d.getDay());
  });
});

describe("إعادة تأريخ المونتاج بعد التصوير الفعلي (retime)", () => {
  const shoot = () =>
    card({
      id: "s",
      stage: "SHOOT",
      board: "DONE",
      status: "READY",
      workDate: "2026-08-03",
      finishedAt: new Date(2026, 7, 3, 20, 0), // انصوّر فعلاً 3/8
    });

  it("مونتاج منجز بتاريخ صادق (بعد التصوير) سجلّه بيثبت", () => {
    // مونتاج BW ريل 68: انجز 10/8 والتصوير 3/8 — «اليوم التالي للتصوير» كان بيرجّعه 4/8.
    const edit = card({
      id: "e",
      stage: "EDIT",
      board: "DONE",
      status: "READY",
      workDate: "2026-08-10",
      readyDate: "2026-08-10",
      finishedAt: new Date(2026, 7, 10),
    });
    retimeEditsAfterActualShoot([shoot(), edit], WEEKDAYS);
    expect(edit.workDate).toBe("2026-08-10");
    expect(edit.board).toBe("DONE");
  });

  it("مونتاج منجز مؤرّخ قبل وجود المادة بينصلّح — هاد مستحيل مو واقع", () => {
    const edit = card({
      id: "e",
      stage: "EDIT",
      board: "DONE",
      status: "READY",
      workDate: "2026-08-01", // قبل التصوير (3/8)
      readyDate: "2026-08-01",
      finishedAt: new Date(2026, 7, 1),
    });
    retimeEditsAfterActualShoot([shoot(), edit], WEEKDAYS);
    expect(edit.workDate! > "2026-08-03").toBe(true);
  });

  it("والمونتاج المفتوح بيلحق التصوير الفعلي متل ما كان", () => {
    const edit = card({
      id: "e",
      stage: "EDIT",
      board: "TODO",
      status: "NOT_STARTED",
      workDate: "2026-06-02", // خطة قديمة قبل التصوير بشهرين
      readyDate: "2026-06-02",
    });
    retimeEditsAfterActualShoot([shoot(), edit], WEEKDAYS);
    expect(edit.workDate! > "2026-08-03").toBe(true);
  });

  it("مونتاج قطعة منشورة مؤرّخ بعد نشرها بينحصر بيوم النشر (حالة استيراد حزيران)", () => {
    const lateImportedShoot = shoot();
    lateImportedShoot.finishedAt = new Date(2026, 7, 20);
    const pub = card({
      id: "p",
      stage: "PUBLISH",
      board: "DONE",
      status: "PUBLISHED",
      publishDate: "2026-08-05",
    });
    const edit = card({
      id: "e",
      stage: "EDIT",
      board: "DONE",
      status: "READY",
      workDate: "2026-08-20", // ختم استيراد متأخر — بعد النشر
      readyDate: "2026-08-20",
      publishDate: "2026-08-05",
      finishedAt: new Date(2026, 7, 20),
    });
    retimeEditsAfterActualShoot([lateImportedShoot, pub, edit], WEEKDAYS);
    expect(edit.workDate).toBe("2026-08-05");
  });
});

/**
 * فحص الواقع الكامل: على نسخة من داتا الشغل الحقيقية، توليدان متتاليان —
 * وكل يلي انعمل وانثبّت بيطلع منهما متل ما فات.
 */
describe("توليدان على نسخة الداتا الحقيقية — الواقع المسجّل بيصمد", () => {
  const skip = () => {
    if (!scratch.available) console.warn("prisma/dev.db missing — regen reality check skipped");
    return !scratch.available;
  };

  type Reality = Map<string, string>;
  let prisma: any;
  let generateSchedule: (y: number, m: number) => Promise<unknown>;
  let generateCompanySchedule: (
    id: string,
    y: number,
    m: number,
  ) => Promise<{ ok: boolean; error?: string }>;

  const day = (d: Date | null) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate(),
        ).padStart(2, "0")}`
      : "·";

  /** نفس عقد بصمة deep-audit — الواقع يلي ما بيحق للتوليد يمسّه. */
  const snapshotReality = async (): Promise<Reality> => {
    const rows = await prisma.task.findMany({ orderBy: { id: "asc" } });
    const published = new Set(
      rows
        .filter((t: any) => t.stage === "PUBLISH" && (t.board === "DONE" || t.status === "PUBLISHED"))
        .map((t: any) => t.pipelineKey),
    );
    const m: Reality = new Map();
    for (const t of rows) {
      const settled = t.board === "DONE" || t.isPinned;
      let workDay = settled ? day(t.workDate) : "~";
      // التصحيح الوحيد المسموح للتوليد على المحسوم: مونتاج قطعة **منشورة**
      // مؤرّخ بعد نشرها بينحصر بيوم النشر — القص صار قبل النزول بالضرورة
      // (كروت حزيران أخدت ختم يوم الاستيراد). البصمة بتشوف القيمة المصحّحة
      // من الجهتين فبتقبل التصحيح مرة وبتلقط أي تلاعب غيره.
      if (
        t.stage === "EDIT" && settled && t.pipelineKey &&
        published.has(t.pipelineKey) && t.publishDate && t.workDate
      ) {
        const pubDay = day(t.publishDate);
        if (workDay > pubDay) workDay = pubDay;
      }
      m.set(t.id, [t.status, t.board, t.assigneeId, t.pieceNo, t.isPinned,
        t.brief?.length ?? 0, t.notes?.length ?? 0, day(t.finishedAt),
        workDay,
        t.board === "DONE" ? day(t.publishDate) : "~"].join("|"));
    }
    return m;
  };

  beforeAll(async () => {
    if (skip()) return;
    prisma = (await import("@/lib/db")).prisma;
    ({ generateSchedule, generateCompanySchedule } = await import(
      "@/server/actions/schedule"
    ));
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    const { rmSync, existsSync, readFileSync } = await import("node:fs");
    const { createHash } = await import("node:crypto");
    if (scratch.available) {
      // الأصل ما انلمس — عقد القائدة: «لا أريد أي ضياع داتا».
      const after = createHash("sha256").update(readFileSync(scratch.source)).digest("hex");
      expect(after).toBe(scratch.fingerprint);
    }
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      if (existsSync(`${scratch.target}${suffix}`)) rmSync(`${scratch.target}${suffix}`, { force: true });
    }
  });

  it("توليد أول: ولا كرت منجز/مثبّت تغيّر يومه أو حالته أو بريفه", async () => {
    if (skip()) return;
    const before = await snapshotReality();
    const res = (await generateSchedule(2026, 7)) as { ok: boolean };
    expect(res.ok).toBe(true);
    const after = await snapshotReality();
    const broken: string[] = [];
    for (const [id, was] of before) {
      const now = after.get(id);
      if (now == null) broken.push(`${id}: الكرت انمحى (${was})`);
      else if (now !== was) broken.push(`${id}:\n   قبل ${was}\n   بعد ${now}`);
    }
    expect(broken, broken.slice(0, 10).join("\n")).toEqual([]);
  });

  it("وتوليد تاني فوقه مستقر تماماً", async () => {
    if (skip()) return;
    const before = await snapshotReality();
    const res = (await generateSchedule(2026, 7)) as { ok: boolean };
    expect(res.ok).toBe(true);
    const after = await snapshotReality();
    expect([...after.entries()]).toEqual([...before.entries()]);
  });

  /**
   * التوليد المحصور على شركة وحدة بيستبدل نطاق الحذف كلّه بـ«هالشركة»، فبيسقط
   * معه استثناء الشركات الراكدة. والمحرّك ما بيخطّط للراكدة — فالحذف بيصير
   * والبديل بيرجع فاضي، ومنخسر كروتها بلا ولا رسالة. هاد يلي صار مع Siizen
   * (٢٦ كرت)، والمول الصيني اليوم مؤرشفة وعندها ٥٨ كرت وعندها تجديدات يعني
   * بتوصل لمسار تصحيح التجديد يلي بينادي التوليد المحصور.
   */
  const dormancyGuard = async (
    field: "status" | "managed",
    value: string | boolean,
  ) => {
    const row = await prisma.task.findFirst({
      where: { isAuto: true, year: 2026, month: 7, companyId: { not: null } },
      select: { companyId: true },
    });
    const companyId: string | null = row?.companyId ?? null;
    if (!companyId) return; // ما في كروت مولّدة — ما في شي نحرسه

    const scope = { isAuto: true, year: 2026, month: 7, companyId };
    const before = await prisma.task.count({ where: scope });
    expect(before).toBeGreaterThan(0);

    const original = await prisma.company.findUnique({ where: { id: companyId } });
    await prisma.company.update({ where: { id: companyId }, data: { [field]: value } });
    try {
      const res = await generateCompanySchedule(companyId, 2026, 7);
      expect(res.ok).toBe(false);
      expect(await prisma.task.count({ where: scope })).toBe(before); // ولا كرت انمحى
    } finally {
      await prisma.company.update({
        where: { id: companyId },
        data: { [field]: (original as never)[field] },
      });
    }
  };

  it("شركة موقوفة: التوليد المحصور بينرفض وكروتها بتضل كما هي", async () => {
    if (skip()) return;
    await dormancyGuard("status", "paused");
  });

  it("وغير المُدارة كمان — الإدارة شرط متل الحالة", async () => {
    if (skip()) return;
    await dormancyGuard("managed", false);
  });
});
