/**
 * مدة المهمة الإضافية من معدّل الشخص + «يوم مستحيل» (المشرفة ٢٩/١٠): بتشرين ٤١ تصميم فونيتيك
 * لأيمن انكتبوا بـ٨ س لكل وحدة، ويوم ٨/١٠ لحاله ١١ كرت = ٨٨ س.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { adhocDaysFromRate, adhocOverloadDays, hoursOfDays, rateNote } from "@/lib/adhoc-effort";

const ayman = { name: "أيمن", rates: JSON.stringify({ POST: 6, STORY: 6, AI_REEL: 1 }), hoursPerDay: 8 };

describe("المدة من المعدّل", () => {
  it("تصميم واحد عند أيمن (٦/يوم) = ١.٣٣ س — متل قرار ١١/١٠ المكتوب على الكروت", () => {
    expect(hoursOfDays(adhocDaysFromRate(ayman, "DESIGN", 1)!)).toBe(1.33);
    expect(hoursOfDays(adhocDaysFromRate(ayman, "DESIGN", 6)!)).toBe(8);
    expect(adhocDaysFromRate(ayman, "AI_REEL", 1)).toBe(1);
  });

  it("«شغل تاني» ما إلو معدّل ← يدوي (null)، وبلا صاحب ← null", () => {
    expect(adhocDaysFromRate(ayman, "OTHER", 3)).toBeNull();
    expect(adhocDaysFromRate(undefined, "DESIGN", 3)).toBeNull();
  });

  it("سطر المصدر بيقول الحساب كامل", () => {
    expect(rateNote(ayman, "DESIGN", 3)).toBe("المدة من المعدّل: 3 تصميم ÷ 6/يوم (أيمن) = 4 س");
  });
});

describe("يوم مستحيل", () => {
  const wd = () => "[0,1,2,3,4]";
  const card = (iso: string, hours: number, o: Record<string, unknown> = {}) => ({
    assigneeId: "e_ayman", kind: "ADHOC", status: "READY", hours,
    workDate: new Date(`${iso}T00:00:00.000Z`), readyDate: new Date(`${iso}T00:00:00.000Z`), ...o,
  });

  it("حالة ٨/١٠ الحقيقية: ١١ كرت × ٨ س = ٨٨ س بيوم واحد", () => {
    const out = adhocOverloadDays(Array.from({ length: 11 }, () => card("2026-10-08", 8)), wd);
    expect(out).toEqual([{ personId: "e_ayman", dayISO: "2026-10-08", hours: 88, cards: 11 }]);
  });

  it("٦ تصاميم بالمعدّل (١.٣٣ س) = يوم كامل بالظبط — مو مستحيل", () => {
    expect(adhocOverloadDays(Array.from({ length: 6 }, () => card("2026-10-08", 1.3333)), wd)).toEqual([]);
  });

  it("كرت ٤ أيام بـ٣٢ س بيتوزّع ٨ س/يوم — مو مستحيل؛ الملغى ما بينحسب", () => {
    const long = card("2026-10-04", 32, { readyDate: new Date("2026-10-07T00:00:00.000Z") });
    expect(adhocOverloadDays([long, card("2026-10-05", 8, { status: "CANCELED" })], wd)).toEqual([]);
  });

  it("تخزين المرآة المحلية (٢١:٠٠Z من اليوم السابق) بيوقع على يوم دمشق الصح", () => {
    const local = { ...card("2026-10-08", 8), workDate: new Date("2026-10-07T21:00:00.000Z"), readyDate: new Date("2026-10-07T21:00:00.000Z") };
    const out = adhocOverloadDays([local, card("2026-10-08", 8)], wd);
    expect(out.map((o) => o.dayISO)).toEqual(["2026-10-08"]);
  });
});

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-adhoc-effort-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let tasks: typeof import("@/server/actions/tasks");
let empId = "";

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  tasks = await import("@/server/actions/tasks");
  empId = (await prisma.employee.create({ data: { name: "مصمّم-مدد", role: "designer", workDays: "[0,1,2,3,4]", rates: JSON.stringify({ POST: 6 }) } })).id;
});
afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("تنبيه الحفظ", () => {
  const input = (hours: number, title: string) =>
    ({ title, kind: "ADHOC", hours, days: hours / 8, priority: "NORMAL", status: "READY", readyDate: "2020-03-04", workDate: "2020-03-04", notes: null, brief: "وصف", assigneeId: empId, companyId: null, isPinned: false, month: 2, year: 2020 }) as never;

  it("مهمة ٨ س ← بلا تنبيه؛ التانية بنفس اليوم ← تنبيه باليوم والساعات وعدد الكروت", async () => {
    const a = await tasks.createTask(input(8, "تصميم ١"));
    expect(a.ok).toBe(true);
    expect("warning" in a ? a.warning : undefined).toBeUndefined();
    const b = await tasks.createTask(input(8, "تصميم ٢"));
    expect(b.ok).toBe(true);
    expect("warning" in b ? b.warning : "").toContain("4/3 (16 س · 2 كرت)");
  });

  it("تعديل المدة لـ١/٦ يوم بينخزّن ١.٣٣ س (مو ١.٣)", async () => {
    const row = await prisma.task.findFirstOrThrow({ where: { assigneeId: empId, title: "تصميم ٢" } });
    const r = await tasks.updateTaskDetails([row.id], { days: 1 / 6, expectedStatus: row.status as never });
    expect(r.ok).toBe(true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: row.id } })).hours).toBe(1.33);
  });
});
