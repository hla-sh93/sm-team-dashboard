/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: شو بيوصل لمتصفّح الزائر المجهول.
 *
 * القاعدة (PROJECT.md §2): «Admin‑only routes physically live only under /admin →
 * an employee hitting /finance, /team, etc. gets a 404 (salaries/contracts are
 * unreachable)». ومنطقة الموظفين بلا دخول.
 *
 * بـApp Router، أي prop بينعطى لمكوّن `"use client"` بيتسلسل كلّه بحمولة RSC
 * وبيوصل للمتصفّح — حتى لو الشاشة ما بتعرضه. فالفحص بيستدعي مكوّنات الخادم
 * لصفحات الموظفين (`/` · `/tasks` · `/today` · `/publishing`) على نسخة من لقطة
 * الإنتاج، وبيقرأ props المكوّن العميل مباشرةً.
 *
 * القاعدة: `prisma/test-deep-security-rsc-<pid>.db` (قراءة بس)؛ بلا `prisma/dev.db`
 * الجزء الديناميكي بيتخطّى والجزء الثابت بيضل شغّال.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const HAS_DB = existsSync("prisma/dev.db");

const scratch = vi.hoisted(() => ({ target: "", available: false }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/db", async () => {
  const g = globalThis as any;
  if (!g.__secRscPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
    const { copyDevDb, fileUrl } = await import("./security-fixture");
    const copy = copyDevDb("rsc");
    scratch.target = copy.target;
    scratch.available = copy.available;
    g.__secRscPrisma = new PrismaClient({
      datasources: { db: { url: assertIsolatedTestDatabaseUrl(fileUrl(copy.target)) } },
    });
  }
  return { prisma: g.__secRscPrisma };
});

import { removeDb } from "./security-fixture";

const EMPLOYEE_SECRET_KEYS = ["salary", "costPerReel"];
const COMPANY_SECRET_KEYS = ["contractValue"];

type Captured = { clientIsUseClient: boolean; props: Record<string, any> };
const captured = new Map<string, Captured>();
const skip = () => !scratch.available;
let prisma: any;

function isUseClient(path: string) {
  return /^["']use client["']/.test(readFileSync(path, "utf8").trimStart());
}

beforeAll(async () => {
  prisma = (await import("@/lib/db")).prisma;
  if (skip()) return;
  const views: [string, () => Promise<any>, string, () => Promise<any>][] = [
    ["/", async () => (await import("@/app/OverviewView")).default({ searchParams: {} }), "src/app/overview-client.tsx", async () => (await import("@/app/overview-client")).default],
    ["/tasks", async () => (await import("@/app/tasks/TasksView")).default({ searchParams: {} }), "src/app/tasks/tasks-client.tsx", async () => (await import("@/app/tasks/tasks-client")).default],
    ["/today", async () => (await import("@/app/TodayView")).default(), "src/app/today/today-client.tsx", async () => (await import("@/app/today/today-client")).default],
    ["/publishing", async () => (await import("@/app/publishing/page")).default({ searchParams: Promise.resolve({}) }), "src/app/publishing/publishing-client.tsx", async () => (await import("@/app/publishing/publishing-client")).default],
  ];
  for (const [route, render, clientFile, clientExport] of views) {
    const element = await render();
    const ClientComponent = await clientExport();
    expect(element.type, route).toBe(ClientComponent);
    captured.set(route, { clientIsUseClient: isUseClient(clientFile), props: element.props });
  }
}, 120_000);

afterAll(async () => {
  const g = globalThis as any;
  await prisma?.$disconnect();
  delete g.__secRscPrisma;
  if (scratch.target) removeDb(scratch.target);
});

function leakedKeys(props: Record<string, any>) {
  const emp = (props.employees ?? []) as Record<string, unknown>[];
  const cos = (props.companies ?? []) as Record<string, unknown>[];
  return {
    employees: EMPLOYEE_SECRET_KEYS.filter((k) => emp.some((e) => Object.prototype.hasOwnProperty.call(e, k))),
    companies: COMPANY_SECRET_KEYS.filter((k) => cos.some((c) => Object.prototype.hasOwnProperty.call(c, k))),
    nonZeroSalaries: emp.filter((e) => Number(e.salary) > 0).length,
    nonZeroContracts: cos.filter((c) => Number(c.contractValue) > 0).length,
  };
}

describe("[SA-01] صفحات الموظفين بتسلّم المكوّن العميل صفوف الموظفين والشركات كاملة", () => {
  for (const route of ["/", "/tasks", "/today", "/publishing"]) {
    it.skipIf(!HAS_DB).fails(`[SA-01] ${route}: props المكوّن العميل لازم ما تحمل الرواتب ولا قيم العقود`, () => {
      const c = captured.get(route)!;
      expect(c.clientIsUseClient).toBe(true);
      const leak = leakedKeys(c.props);
      expect(leak.employees).toEqual([]);
      expect(leak.companies).toEqual([]);
    });
  }

  it("(دليل) الأرقام نفسها موجودة بالـprops — مو بس أسماء حقول فاضية", () => {
    if (skip()) return;
    const leak = leakedKeys(captured.get("/publishing")!.props);
    expect(leak.nonZeroSalaries).toBeGreaterThan(0);
    expect(leak.nonZeroContracts).toBeGreaterThan(0);
  });
});

describe("المقارنة: صفحة الشركات عند الموظفين بتنقّي الحقول (نظيف)", () => {
  it("/companies بتبعت صفوف مختصرة بلا contractValue ولا renewals", async () => {
    if (skip()) return;
    const element = await (await import("@/app/companies/page")).default();
    const rows = element.props.rows as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toHaveProperty("contractValue");
      expect(r).not.toHaveProperty("renewals");
    }
    for (const e of element.props.employees as Record<string, unknown>[]) {
      expect(Object.keys(e).sort()).toEqual(["id", "name"]);
    }
  });
});

describe("ثابت (بلا قاعدة): مكوّنات خادم الموظفين بتجيب الموظفين والشركات بلا select", () => {
  it.fails("[SA-01] كل findMany للموظفين/الشركات بصفحات الموظفين لازم يكون فيه select", () => {
    const files = ["src/app/OverviewView.tsx", "src/app/tasks/TasksView.tsx", "src/app/TodayView.tsx", "src/app/publishing/page.tsx"];
    const unselected: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/prisma\.(employee|company)\.findMany\(([^)]*)\)/g)) {
        if (!/select\s*:/.test(m[2])) unselected.push(`${f}: prisma.${m[1]}.findMany(${m[2].trim()})`);
      }
    }
    expect(unselected).toEqual([]);
  });
});
