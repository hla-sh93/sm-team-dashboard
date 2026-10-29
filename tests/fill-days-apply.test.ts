/**
 * «تعبئة الأيام» على نسخة معزولة من dev.db (خطة التحسينات D). اليوم مزيَّف على ٥/٧/٢٠٢٦ (أحد)
 * لأن كروت الخطة المفتوحة بالنسخة المحلية بدلو تموز.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-fill-days-${process.pid}.db`);
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
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let fill: typeof import("@/server/actions/fill-days");
let engine: typeof import("@/server/schedule-engine");
const FROM = "2026-07-05";
const key = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

beforeAll(async () => {
  if (!scratch.available) return;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-05T07:00:00Z"));
  prisma = (await import("@/lib/db")).prisma as never;
  fill = await import("@/server/actions/fill-days");
  engine = await import("@/server/schedule-engine");
  // كروت النسخة المحلية قديمة (بلا أرقام قطع ولا مفاتيح المحرّك الحالي) — توليد أوّل شركة
  // شركة بيحوّلها لصفوف المحرّك متل الإنتاج، وبعدها منفحص.
  for (const c of await prisma.company.findMany({ select: { id: true } })) await engine.generateScheduleInternal(2026, 6, c.id);
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("تعبئة الأيام", () => {
  let preview: Extract<Awaited<ReturnType<typeof fill.previewFillDays>>, { ok: true }>;

  it("بلا إدارة ← رفض؛ بداية قبل اليوم ← رفض", async () => {
    auth.admin = false;
    expect((await fill.previewFillDays(FROM)).ok).toBe(false);
    expect((await fill.applyFillDays(FROM, "x")).ok).toBe(false);
    auth.admin = true;
    expect((await fill.previewFillDays("2026-07-01")).ok).toBe(false);
  });

  it("المعاينة: ولا يوم فوق الطاقة، والنقلات على كروت خطة إنتاج بس، وما في نقلة بعد التسليم", async () => {
    const r = await fill.previewFillDays(FROM);
    if (!r.ok) throw new Error(r.error);
    preview = r;
    expect(r.moves.length).toBeGreaterThan(0);
    expect(r.days.every((d) => d.load <= 1 + 1e-9)).toBe(true);
    const tasks = await prisma.task.findMany({ where: { id: { in: r.moves.map((m) => m.taskId) } } });
    for (const t of tasks) {
      expect(t.isAuto).toBe(true);
      expect(t.manualDay).toBeNull();
      expect(["DESIGN", "EDIT", "WRITE"].includes(t.stage ?? "") || t.kind === "CONTENT_WRITING").toBe(true);
    }
    for (const m of r.moves) {
      expect(m.startISO >= FROM).toBe(true);
      if (m.readyISO) expect(m.startISO <= m.readyISO).toBe(true);
      expect(new Date(`${m.startISO}T00:00:00Z`).getUTCDay()).not.toBe(5); // ولا جمعة
    }
  });

  it("بصمة قديمة ← رفض وما انكتب شي", async () => {
    const before = await prisma.task.findMany({ select: { id: true, updatedAt: true } });
    expect((await fill.applyFillDays(FROM, "stale")).ok).toBe(false);
    const after = await prisma.task.findMany({ select: { id: true, updatedAt: true } });
    expect(after).toEqual(before);
  });

  it("التطبيق بيكتب يوم البداية بس: التسليم والنشر والحالة ما تغيّروا لولا كرت", async () => {
    const before = await prisma.task.findMany({ orderBy: { id: "asc" } });
    const r = await fill.applyFillDays(FROM, preview.fingerprint);
    expect(r).toMatchObject({ ok: true, moved: preview.moves.length });
    const after = await prisma.task.findMany({ orderBy: { id: "asc" } });
    expect(after.length).toBe(before.length);
    const moved = new Map(preview.moves.map((m) => [m.taskId, m.startISO]));
    for (let i = 0; i < after.length; i++) {
      const [a, b] = [after[i], before[i]];
      expect([key(a.readyDate), key(a.publishDate), a.status, a.board, a.assigneeId]).toEqual([
        key(b.readyDate), key(b.publishDate), b.status, b.board, b.assigneeId,
      ]);
      if (moved.has(a.id)) {
        expect(key(a.workDate)).toBe(moved.get(a.id));
        expect(a.isPinned).toBe(true);
        expect(a.notes).toBe(b.notes); // يوم البداية خطة، مو دليل
      } else {
        expect(key(a.workDate)).toBe(key(b.workDate));
      }
    }
  });

  it("إعادة توليد دورة الشركة بعد التطبيق ما بترجّع أيام البداية", async () => {
    const rows = await prisma.task.findMany({ where: { id: { in: preview.moves.map((m) => m.taskId) } } });
    const moved = new Map(preview.moves.map((m) => [m.taskId, m.startISO]));
    let regenerated = 0;
    for (const companyId of new Set(rows.map((t) => t.companyId).filter((v): v is string => !!v))) {
      const built = await engine.generateScheduleInternal(2026, 6, companyId);
      // شركة بلا دورة بهالشهر (جدارات، المول بالنسخة المحلية) ما بتتولّد أصلاً — رفض مقصود.
      if (!built.ok && "error" in built && built.error.includes("ما في دورة تغطّي")) continue;
      expect(built, `${companyId}: ${JSON.stringify(built)}`).toMatchObject({ ok: true });
      regenerated++;
      const after = await prisma.task.findMany({ where: { companyId, id: { in: [...moved.keys()] } } });
      const drifted = after.filter((t) => key(t.workDate) !== moved.get(t.id));
      expect(drifted.map((t) => `${t.id}:${key(t.workDate)}≠${moved.get(t.id)}`)).toEqual([]);
    }
    expect(regenerated).toBeGreaterThan(0);
  });
});
