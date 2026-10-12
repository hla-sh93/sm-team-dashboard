/**
 * الفحص العميق — محرّك إعادة التوليد · ثوابت على مرآة الإنتاج (`prisma/dev.db`)
 *
 * بس الثوابت الحقيقية — أي شي لازم يصحّ على **أي** لقطة:
 *   • توليد شركة وحدة (`onlyCompanyId`) ما بيغيّر ولا صفّ لشركة تانية (كل
 *     الأعمدة والمعرّفات) ولا جلساتها.
 *   • التوليد متكافئ: الجولة التانية فوق الأولى على كل الدلاء الشغّالة = صفر فرق.
 *
 * الملاحظات المرتبطة بلقطة معيّنة (أي كرت تحرّك بأول توليد وليش) بالتقرير:
 * `docs/qa/deep-test-2026-10-11/regen-engine.md`. بينسخ `dev.db` لملف معزول
 * فيه `test` وما بيلمس الأصل؛ بيتخطّى بنسخة نظيفة بلا مرآة.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-regen-snapshot-${process.pid}.db`);
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

import { removeDb } from "./regen-fixture";

type Prisma = import("@prisma/client").PrismaClient;
let prisma: Prisma;
let gen: (y: number, m: number, only: string | null) => Promise<{ ok: boolean; error?: string }>;

async function fullTable() {
  const rows = await prisma.task.findMany({ orderBy: { id: "asc" } });
  const m = new Map<string, { companyId: string | null; v: string }>();
  for (const r of rows) {
    const { createdAt: _c, updatedAt: _u, ...rest } = r;
    m.set(r.id, { companyId: r.companyId, v: JSON.stringify(rest) });
  }
  const sessions = await prisma.photoSession.findMany({ orderBy: { id: "asc" } });
  const s = new Map(
    sessions.map((x) => [`${x.year}/${x.month}|${x.companyId}|${x.kind}|${x.no}`, { companyId: x.companyId, v: `${x.status}|${x.shootDate.toISOString()}|${x.detKey}` }]),
  );
  return { tasks: m, sessions: s };
}

function changed(
  a: Map<string, { companyId: string | null; v: string }>,
  b: Map<string, { companyId: string | null; v: string }>,
  skipCompany?: string,
) {
  const out: string[] = [];
  for (const [k, x] of a) {
    if (skipCompany && x.companyId === skipCompany) continue;
    const y = b.get(k);
    if (!y) out.push(`${k}: انمحى`);
    else if (y.v !== x.v) out.push(`${k}: تغيّر`);
  }
  for (const [k, y] of b) if (!a.has(k) && (!skipCompany || y.companyId !== skipCompany)) out.push(`${k}: جديد`);
  return out;
}

describe.skipIf(!scratch.available)("مرآة الإنتاج — ثوابت إعادة التوليد", () => {
  beforeAll(async () => {
    prisma = (await import("@/lib/db")).prisma;
    ({ generateScheduleInternal: gen } = (await import("@/server/schedule-engine")) as never);
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    removeDb(scratch.target);
  });

  it("توليد كل شركة نشطة لحالها بدلاء دوراتها: صفر صفّ متغيّر عند غيرها", async () => {
    const active = await prisma.company.findMany({
      where: { managed: true, status: "active", contractEndedAt: null },
      select: { id: true },
    });
    const buckets = await prisma.task.groupBy({
      by: ["companyId", "year", "month"],
      where: { isAuto: true, companyId: { in: active.map((c) => c.id) }, year: 2026, month: { gte: 7 } },
    });
    expect(buckets.length).toBeGreaterThan(0);
    for (const b of buckets) {
      const before = await fullTable();
      const r = await gen(b.year, b.month, b.companyId!);
      if (!r.ok) continue; // دلو بلا دورة: الحارس بيرفض بصوت وما بيكتب شي
      const after = await fullTable();
      const label = `${b.companyId} ${b.year}/${b.month}`;
      expect(changed(before.tasks, after.tasks, b.companyId!), label).toEqual([]);
      expect(changed(before.sessions, after.sessions, b.companyId!), label).toEqual([]);
    }
  }, 120_000);

  it("التوليد متكافئ: جولة تانية على كل الدلاء الشغّالة (7، 8، 9) = صفر فرق", async () => {
    for (const m of [7, 8, 9]) expect((await gen(2026, m, null)).ok).toBe(true);
    const first = await fullTable();
    for (const m of [7, 8, 9]) expect((await gen(2026, m, null)).ok).toBe(true);
    const second = await fullTable();
    expect(changed(first.tasks, second.tasks)).toEqual([]);
    expect(changed(first.sessions, second.sessions)).toEqual([]);
  }, 120_000);
});
