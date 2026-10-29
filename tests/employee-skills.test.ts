/**
 * المرحلة C (٢٩/١٠) بلا schema: «أليسار بينتهي عقدها ب1/11 ف رح تاخد مهامها ليلاس كتصوير ومونتاج سوا.
 * كيف هي منحلها بلا تدخل برمجي؟»
 *  - معدّل تصوير ومونتاج منفصلين بسجلّ الشخص (`SHOOT`/`EDIT` بـ`rates`)، وبلاهن متل قبل حرفياً؛
 *  - المحرّك بيقول بصوت لما ما في مونتيرة بدل ما يختفي المونتاج؛
 *  - شارة «سلّم شغله لـ…» من سجلّ التسليم.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { cardDurationDays, rateKeyFor, ratePerDay } from "@/lib/capacity";

describe("معدّل التصوير والمونتاج", () => {
  const lilas = { rates: JSON.stringify({ REEL: 6, SHOOT: 6, EDIT: 3 }), hoursPerDay: 8 };
  const alissar = { rates: JSON.stringify({ REEL: 3 }), hoursPerDay: 8 };

  it("بلا SHOOT/EDIT ← نفس رقم الريل (ولا تغيير للموجودين)", () => {
    expect(ratePerDay(alissar, "EDIT")).toBe(3);
    expect(ratePerDay(alissar, "SHOOT")).toBe(3);
    expect(ratePerDay({ rates: null }, "EDIT")).toBe(3); // الافتراضي
    expect(cardDurationDays(alissar, { type: "REEL", stage: "EDIT" })).toBeCloseTo(1 / 3);
  });

  it("ليلاس: ريل تصوير = ٦/يوم، ريل مونتاج = ٣/يوم", () => {
    expect(cardDurationDays(lilas, { type: "REEL", stage: "SHOOT" })).toBeCloseTo(1 / 6);
    expect(cardDurationDays(lilas, { type: "REEL", stage: "EDIT" })).toBeCloseTo(1 / 3);
  });

  it("مفتاح المعدّل: ريل بمرحلته، والباقي نوعه (النشر والتصميم ما بيتأثّروا)", () => {
    expect(rateKeyFor({ type: "REEL", stage: "EDIT" })).toBe("EDIT");
    expect(rateKeyFor({ type: "REEL", stage: "SHOOT" })).toBe("SHOOT");
    expect(rateKeyFor({ type: "REEL", stage: "PUBLISH" })).toBe("REEL");
    expect(rateKeyFor({ type: "POST", stage: "DESIGN" })).toBe("POST");
  });
});

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-employee-skills-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  assertAdmin: async () => {},
  isOwnerSession: async () => true,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let engine: typeof import("@/server/schedule-engine");
let employees: typeof import("@/server/actions/employees");
let handover: typeof import("@/server/handover");
const Y = 2026;
const M = 10; // تشرين التاني

beforeAll(async () => {
  if (!scratch.available) return;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T08:00:00Z"));
  prisma = (await import("@/lib/db")).prisma as never;
  engine = await import("@/server/schedule-engine");
  employees = await import("@/server/actions/employees");
  handover = await import("@/server/handover");
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

const run = async () => {
  const r = await engine.generateScheduleInternal(Y, M, null);
  if (!r.ok) throw new Error("error" in r ? r.error : "stale");
  return r;
};
const editCards = () => prisma.task.findMany({ where: { year: Y, month: M, isAuto: true, stage: "EDIT" } });

describe.skipIf(!scratch.available)("مرحلة بلا صاحب ما بتختفي بصمت", () => {
  let editorId = "";
  let heirId = "";

  it("بلا مونتيرة بالفريق والريلات مخطّطة ← إنذار، وولا كرت مونتاج", async () => {
    await prisma.employee.updateMany({ where: { role: { contains: "مونت" } }, data: { role: "مصمم" } });
    await prisma.company.updateMany({ where: { managed: true, status: "active" }, data: { reels: 2 } });
    const r = await run();
    expect(r.warnings.map((w) => w.message).join("\n")).toMatch(/ما في مونتير/);
    expect(await editCards()).toHaveLength(0);
  });

  it("مونتيرة بالفريق ← الإنذار بيروح وكروت المونتاج باسمها", async () => {
    editorId = (await prisma.employee.create({ data: { name: "مونتيرة-فحص", role: "مونتيرة", workDays: "[0,1,2,3,4]" } })).id;
    const r = await run();
    expect(r.warnings.map((w) => w.message).join("\n")).not.toMatch(/ما في مونتير/);
    const edits = await editCards();
    expect(edits.length).toBeGreaterThan(0);
    expect(new Set(edits.map((t) => t.assigneeId))).toEqual(new Set([editorId]));
  });

  it("تسليم الشغل لخلفها (مصوّرة ومونتيرة) ← المونتاج الجاي لخلفها والإنذار بيروح، والشارة بتعرف التاريخ", async () => {
    heirId = (await prisma.employee.create({
      data: { name: "ليلاس-مهارات", role: "مصورة", isPhotographer: true, workDays: "[0,1,2,3,4]", rates: JSON.stringify({ REEL: 6 }) },
    })).id;
    const probe = await employees.handoverEmployeeWork({ fromId: editorId, toId: heirId, fromDate: "2026-11-01" });
    if (!probe.ok || !("total" in probe)) throw new Error("probe");
    expect((await employees.handoverEmployeeWork({ fromId: editorId, toId: heirId, fromDate: "2026-11-01", confirm: probe.total })).ok).toBe(true);
    const r = await run();
    expect(r.warnings.map((w) => w.message).join("\n")).not.toMatch(/ما في مونتير/);
    const open = (await editCards()).filter((t) => t.board !== "DONE");
    expect(open.length).toBeGreaterThan(0);
    expect(new Set(open.map((t) => t.assigneeId))).toEqual(new Set([heirId]));
    const rec = (await handover.loadHandovers()).find((h) => h.fromId === editorId);
    expect(rec).toMatchObject({ toId: heirId, fromDate: "2026-11-01" });
  });

  it("نموذج الموظف بيحفظ معدّل التصوير والمونتاج المنفصلين وما بيمحي الريل", async () => {
    const r = await employees.updateEmployee(heirId, {
      name: "ليلاس-مهارات",
      role: "مصورة",
      hoursPerDay: 8,
      workDays: [0, 1, 2, 3, 4],
      isScheduled: true,
      isPhotographer: true,
      rates: { REEL: 6, SHOOT: 6, EDIT: 3 },
    } as never);
    expect(r.ok).toBe(true);
    const e = await prisma.employee.findUniqueOrThrow({ where: { id: heirId } });
    expect(JSON.parse(e.rates!)).toEqual({ REEL: 6, SHOOT: 6, EDIT: 3 });
  });
});
