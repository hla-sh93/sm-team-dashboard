/**
 * «فكّ الحجز يدوياً» (خطة A، ٢٩/١٠) — قرار المشرفة بسبب مكتوب، سطر دليل على الكرت.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { isManuallyUnblocked, makeBlockedPredicate } from "@/lib/daily-work";
import { makeReadiness } from "@/lib/readiness";

const t = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, kind: "CONTENT", type: "POST", stage: "DESIGN", status: "NOT_STARTED", board: "TODO", blockedById: null, assigneeId: "a", notes: null, ...o }) as never;

describe("الحجز اليدوي — نقي", () => {
  it("سطر «فكّ الحجز يدوياً» بيخلّي الكرت جاهز بكل مكان (الطابور واللوح)", () => {
    const write = t("w", { stage: "WRITE" });
    const design = t("d", { blockedById: "w", notes: "سطر قديم\nفكّ الحجز يدوياً (المشرفة 2026-10-29): الوصف وصل شفهياً" });
    expect(isManuallyUnblocked(design)).toBe(true);
    expect(makeBlockedPredicate([write, design])(design)).toBe(false);
    expect(makeReadiness([write, design])(design).state).toBe("ready");
  });
  it("بلا السطر ← محجوز متل قبل", () => {
    const write = t("w", { stage: "WRITE" });
    const design = t("d", { blockedById: "w", notes: "فكّ الحجز لاحقاً؟" });
    expect(makeBlockedPredicate([write, design])(design)).toBe(true);
  });
});

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-manual-unblock-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
const auth = vi.hoisted(() => ({ admin: true }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  assertAdmin: async () => {
    if (!auth.admin) throw new Error("no");
  },
  currentAdmin: async () => ({ kind: "owner" }),
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let unblock: typeof import("@/server/actions/unblock");
let tasks: typeof import("@/server/actions/tasks");
const ids = { shoot: "", edit: "" };

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  unblock = await import("@/server/actions/unblock");
  tasks = await import("@/server/actions/tasks");
  const base = { kind: "CONTENT", type: "REEL", year: 2026, month: 9, isAuto: true, status: "NOT_STARTED", board: "TODO" };
  ids.shoot = (await prisma.task.create({ data: { ...base, stage: "SHOOT", title: "تصوير فكّ" } as never })).id;
  ids.edit = (await prisma.task.create({ data: { ...base, stage: "EDIT", title: "مونتاج فكّ", blockedById: ids.shoot, notes: "سُلّم سابقاً" } as never })).id;
});
afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("فكّ الحجز من الواجهة", () => {
  it("بلا إدارة ← رفض؛ بلا سبب ← رفض؛ كرت مو محجوز ← رفض", async () => {
    auth.admin = false;
    expect((await unblock.manualUnblock(ids.edit, "سبب كافي")).ok).toBe(false);
    auth.admin = true;
    expect((await unblock.manualUnblock(ids.edit, " ")).ok).toBe(false);
    expect((await unblock.manualUnblock(ids.shoot, "سبب كافي")).ok).toBe(false);
  });

  it("مونتاج قبل تصويره: مرفوض ← فكّ بسبب ← بينسكّر، والملاحظات القديمة محفوظة", async () => {
    expect((await tasks.moveCard(ids.edit, "DONE")).ok).toBe(false);
    expect((await unblock.manualUnblock(ids.edit, "المادة وصلت من الزبون مباشرة")).ok).toBe(true);
    const row = await prisma.task.findUniqueOrThrow({ where: { id: ids.edit } });
    expect(row.notes).toMatch(/^سُلّم سابقاً\nفكّ الحجز يدوياً \(الإدارة \d{4}-\d{2}-\d{2}\): المادة وصلت من الزبون مباشرة$/);
    expect((await tasks.moveCard(ids.edit, "DONE")).ok).toBe(true);
  });

  it("رجّع الحجز بيشيل السطر بس", async () => {
    expect((await unblock.undoManualUnblock(ids.edit)).ok).toBe(true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: ids.edit } })).notes).toBe("سُلّم سابقاً");
  });
});
