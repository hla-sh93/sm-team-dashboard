/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — بوابة الأدمن على «استيراد خطة JSON» (`applyCompanyPlanUpdate`).
 *
 * بلا كوكي، كوكي مزوّرة، كوكي منتهية، كوكي صحيحة — مع قاعدة معزولة وسرّ HMAC معروف
 * (`AUTH_SECRET`) مشان نوقّع بنفسنا. وتوثيق إنّ رفع ملف Word (`applyCompanyPlanDocx`)
 * بلا بوابة عن قصد (قرار القائدة: منطقة الموظفين مفتوحة).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-pu-auth-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "sm_admin" && jar.value !== undefined ? { name, value: jar.value } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

const SECRET = "deep-test-secret";
let prisma: any;
let applyGuarded: (input: unknown) => Promise<any>;
let applyDocxAction: (input: { companyId: string; fileBase64: string; fileName: string }) => Promise<any>;
const skip = () => !scratch.available;
const sign = (exp: string) => createHmac("sha256", SECRET).update(exp).digest("hex");
const payload = { companyName: "شركة-غير-موجودة-للفحص", year: 2026, month: 9, pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", evidence: "دليل كافٍ" }] };

beforeAll(async () => {
  process.env.AUTH_SECRET = SECRET;
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyCompanyPlanUpdate: applyGuarded, applyCompanyPlanDocx: applyDocxAction } = await import("@/server/actions/plans"));
});

afterAll(async () => {
  delete process.env.AUTH_SECRET;
  if (!prisma) return;
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe("بوابة الأدمن", () => {
  it("بلا كوكي → «غير مصرّح» وولا صف", async () => {
    if (skip()) return;
    jar.value = undefined;
    const n = await prisma.task.count();
    const r = await applyGuarded(payload);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("غير مصرّح");
    expect(await prisma.task.count()).toBe(n);
  });
  it("كوكي مزوّرة (توقيع غلط / بلا نقطة / منتهية) → «غير مصرّح»", async () => {
    if (skip()) return;
    const future = String(Date.now() + 60_000);
    for (const forged of [`${future}.deadbeef`, "garbage", `${future}.${sign("other")}`, `${String(Date.now() - 1000)}.${sign(String(Date.now() - 1000))}`]) {
      jar.value = forged;
      const r = await applyGuarded(payload);
      expect(r.error, forged).toBe("غير مصرّح");
    }
  });
  it("كوكي صحيحة → البوابة بتمرّق والمنطق هو يلي بيردّ (الشركة غير موجودة)", async () => {
    if (skip()) return;
    const exp = String(Date.now() + 60_000);
    jar.value = `${exp}.0.qa0session.${sign(`${exp}.0.qa0session`)}`;
    const r = await applyGuarded(payload);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("الشركة غير موجودة");
  });
  it("رفع ملف Word بلا بوابة عن قصد (PU-18، توثيق): بلا كوكي بيوصل للمنطق", async () => {
    if (skip()) return;
    jar.value = undefined;
    const r = await applyDocxAction({ companyId: "c_لا_وجود", fileBase64: "AAAA", fileName: "x.docx" });
    expect(r.ok).toBe(false);
    expect(r.error).not.toBe("غير مصرّح");
    expect(r.error).toBe("الشركة غير موجودة");
  });
});
