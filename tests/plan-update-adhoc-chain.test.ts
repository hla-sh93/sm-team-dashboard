/**
 * «سلسلة مراحل» بحمولة «استيراد خطة JSON» (خطة B، ٢٩/١٠): `adhocCards[].after`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-adhoc-chain-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({ assertAdmin: async () => {}, requireAdminPage: async () => {}, isAuthenticated: async () => true }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: any;
let apply: (input: unknown) => Promise<any>;
const uniq = `سلسلة-حمولة-${process.pid}`;
const companyName = `${uniq} شركة`;
const designer = `${uniq} مصمّمة`;
const publisher = `${uniq} ناشر`;
const P = `c${process.pid}`;
const card = (slug: string, over: Record<string, unknown>) => ({
  slug: `${P}-${slug}`, title: `كرت ${slug}`, assignee: designer, stage: "DESIGN", hours: 1.33,
  workDate: "2026-09-20", readyDate: "2026-09-21", evidence: "قرار المشرفة للفحص", ...over,
});
const payload = (cards: unknown[]) => ({ companyName, year: 2026, month: 8, adhocCards: cards });
const skip = () => !scratch.available;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply } = await import("@/server/plan-update"));
  await prisma.employee.createMany({
    data: [
      { name: designer, role: "designer", workDays: "[0,1,2,3,4]" },
      { name: publisher, role: "ناشر", workDays: "[0,1,2,3,4,6]" },
    ],
  });
  await prisma.company.create({ data: { name: companyName, posts: 0, contentSupplied: true } });
});
afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync } = await import("node:fs");
    for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
  }
});

describe("adhocCards.after", () => {
  it.skipIf(skip())("تصميم ← نشر: النشر محجوز ورا التصميم، والتنين بنفس مفتاح السلسلة", async () => {
    const r = await apply(payload([
      card("design", {}),
      card("publish", { stage: "PUBLISH", assignee: publisher, hours: 0.5, workDate: "2026-09-23", readyDate: "2026-09-23", after: `${P}-design` }),
    ]));
    expect(r.ok, r.error).toBe(true);
    const d = await prisma.task.findUnique({ where: { id: `adhoc_${P}-design` } });
    const p = await prisma.task.findUnique({ where: { id: `adhoc_${P}-publish` } });
    expect(p.blockedById).toBe(d.id);
    expect(d.pipelineKey).toBe(`chain_adhoc_${P}-design`);
    expect(p.pipelineKey).toBe(d.pipelineKey);
  });

  it.skipIf(skip())("بحمولة لاحقة: كرت ورا كرت موجود بياخد مفتاحه", async () => {
    const r = await apply(payload([card("report", { stage: "WRITE", workDate: "2026-09-24", readyDate: "2026-09-24", after: `${P}-publish` })]));
    expect(r.ok, r.error).toBe(true);
    const x = await prisma.task.findUnique({ where: { id: `adhoc_${P}-report` } });
    expect(x.blockedById).toBe(`adhoc_${P}-publish`);
    expect(x.pipelineKey).toBe(`chain_adhoc_${P}-design`);
  });

  it.skipIf(skip())("رفض بلا كتابة: معرّف مجهول · بيبلّش قبل ما يخلص يلي قبله · حلقة", async () => {
    const before = await prisma.task.count();
    const unknown = await apply(payload([card("x1", { after: `${P}-nothing` })]));
    expect(unknown.ok).toBe(false);
    const early = await apply(payload([card("a1", { readyDate: "2026-09-25", workDate: "2026-09-20" }), card("b1", { workDate: "2026-09-22", readyDate: "2026-09-26", after: `${P}-a1` })]));
    expect(early.ok).toBe(false);
    expect(early.error).toContain("قبل ما يخلص");
    const loop = await apply(payload([card("l1", { after: `${P}-l2` }), card("l2", { after: `${P}-l1` })]));
    expect(loop.ok).toBe(false);
    expect(await prisma.task.count()).toBe(before);
  });
});
