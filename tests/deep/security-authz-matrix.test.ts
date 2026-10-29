/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: مصفوفة الصلاحيات لأفعال الخادم.
 *
 * القاعدة (PROJECT.md §2 + قرار القائدة المحفوظ بالذاكرة): منطقة الموظفين بلا
 * دخول **بالتصميم**؛ أفعال الإدارة (الشركات، الفريق، استيراد JSON، إعادة الجدولة،
 * تلغرام، تغيير كلمة المرور) لازم تتحقّق من الجلسة **جوّا الفعل نفسه**.
 *
 * المنهج: كل فعل إداري بيننده أربع مرّات — بلا كوكي، كوكي مزوّرة، كوكي منتهية،
 * كوكي صحيحة. «وصل للمنطق» بينقاس بعدد استعلامات Prisma (البوابة نفسها بلا أي
 * استعلام لأنّ `AUTH_SECRET` بالبيئة)، أو برسالة غير «غير مصرّح» للأفعال يلي
 * بتتحقّق من المدخل قبل القاعدة. والقاعدة كلها لازم ما تتغيّر بالمحاولات المرفوضة.
 *
 * القاعدة: نسخة `prisma/dev.db` → `prisma/test-deep-security-matrix-<pid>.db`؛
 * بلاها الفحوص يلي بدها قاعدة بتتخطّى. ولا اتصال شبكة (fetch محجوب، وتلغرام مزيّف).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
const q = vi.hoisted(() => ({ count: 0 }));
const scratch = vi.hoisted(() => ({ target: "", available: false }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sm_admin" && jar.value !== undefined ? { name, value: jar.value } : undefined,
    set: () => {},
  }),
}));
vi.mock("@/lib/telegram/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram/client")>()),
  getMe: async () => ({ ok: false, error: "stub" }),
  getWebhookInfo: async () => ({ ok: false, error: "stub" }),
  setWebhook: async () => ({ ok: false, error: "stub" }),
  sendMessage: async () => ({ ok: false, error: "stub" }),
  webhookSecret: () => null,
}));
vi.mock("@/lib/telegram/service", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram/service")>()),
  sendDailyBrief: async () => ({ ok: false, error: "stub" }),
}));
vi.mock("@/lib/db", async () => {
  const g = globalThis as any;
  if (!g.__secMatrixPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
    const { copyDevDb, fileUrl } = await import("./security-fixture");
    const copy = copyDevDb("matrix");
    scratch.target = copy.target;
    scratch.available = copy.available;
    const client = new PrismaClient({
      datasources: { db: { url: assertIsolatedTestDatabaseUrl(fileUrl(copy.target)) } },
      log: [{ emit: "event", level: "query" }],
    });
    (client as any).$on("query", () => {
      q.count += 1;
    });
    g.__secMatrixPrisma = client;
  }
  return { prisma: g.__secMatrixPrisma };
});

import { removeDb, signToken } from "./security-fixture";

const SECRET = "matrix-secret";
const CHAIN_INPUT = (who: string) => ({
  title: "فحص",
  brief: "فحص",
  companyId: null,
  priority: "NORMAL" as const,
  targetISO: "2099-01-05",
  steps: [{ stage: "DESIGN" as const, assigneeId: who, days: 1 }],
});
let prisma: any;
const skip = () => !scratch.available;

type Spec = {
  name: string;
  call: () => Promise<unknown>;
  /** كيف منعرف إنّ الكوكي الصحيحة مرّقت البوابة. */
  reached: "queries" | "message";
};
let specs: Spec[] = [];

async function fingerprint() {
  const tables = ["Task", "Company", "Employee", "Setting", "PhotoSession", "TelegramChat", "TelegramMessage"];
  const out: Record<string, string> = {};
  for (const t of tables) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      t === "TelegramMessage"
        ? `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(COALESCE(taskId,''))),0) || '-' || COALESCE(SUM(confirmed),0) AS m FROM "${t}"`
        : `SELECT COUNT(*) AS n, MAX(updatedAt) AS m FROM "${t}"`,
    );
    out[t] = `${rows[0].n}|${rows[0].m}`;
  }
  return out;
}

async function outcome(fn: () => Promise<unknown>) {
  q.count = 0;
  try {
    const r: any = await fn();
    return { threw: false, ok: r?.ok, error: r?.error as string | undefined, queries: q.count };
  } catch (e) {
    return { threw: true, ok: false, error: e instanceof Error ? e.message : String(e), queries: q.count };
  }
}

beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubGlobal("fetch", async () => {
    throw new Error("network blocked in security-authz-matrix");
  });
  prisma = (await import("@/lib/db")).prisma;
  if (skip()) return;
  const companies = await import("@/server/actions/companies");
  const employees = await import("@/server/actions/employees");
  const plans = await import("@/server/actions/plans");
  const schedule = await import("@/server/actions/schedule");
  const telegram = await import("@/server/actions/telegram");
  const auth = await import("@/server/actions/auth");
  const admins = await import("@/server/actions/admins");
  const lateResched = await import("@/server/actions/late-reschedule");
  const tgIdentity = await import("@/server/actions/telegram-identity");
  const taskChain = await import("@/server/actions/task-chain");
  const fillDays = await import("@/server/actions/fill-days");
  const unblockActions = await import("@/server/actions/unblock");
  const NOPE = "c_security_matrix_does_not_exist";
  specs = [
    { name: "createCompany", call: () => companies.createCompany({} as never), reached: "message" },
    { name: "updateCompany", call: () => companies.updateCompany(NOPE, {} as never), reached: "message" },
    { name: "deleteCompany", call: () => companies.deleteCompany(NOPE), reached: "queries" },
    { name: "renewContract", call: () => companies.renewContract(NOPE, "2026-11-01"), reached: "queries" },
    { name: "correctLatestRenewal", call: () => companies.correctLatestRenewal(NOPE, "2026-11-01"), reached: "queries" },
    { name: "removeLatestRenewal", call: () => companies.removeLatestRenewal(NOPE), reached: "queries" },
    { name: "endContract", call: () => companies.endContract(NOPE), reached: "queries" },
    { name: "archiveCompany", call: () => companies.archiveCompany(NOPE), reached: "queries" },
    { name: "reorderCompanies", call: () => companies.reorderCompanies([]), reached: "message" },
    { name: "pauseCompanyPublishing", call: () => companies.pauseCompanyPublishing(NOPE), reached: "queries" },
    { name: "resumeCompanyPublishing", call: () => companies.resumeCompanyPublishing(NOPE, "2026-11-01"), reached: "queries" },
    { name: "regenerateCompanyCurrentCycle", call: () => companies.regenerateCompanyCurrentCycle(NOPE), reached: "queries" },
    { name: "purgeOrphanCards", call: () => companies.purgeOrphanCards(NOPE), reached: "queries" },
    { name: "createEmployee", call: () => employees.createEmployee({} as never), reached: "message" },
    { name: "updateEmployee", call: () => employees.updateEmployee(NOPE, {} as never), reached: "message" },
    { name: "deleteEmployee", call: () => employees.deleteEmployee(NOPE), reached: "queries" },
    // «تسليم الشغل» (D4، ١٢/١٠) — بينقل كروت وحقول شركات من موظف لموظف.
    { name: "handoverEmployeeWork", call: () => employees.handoverEmployeeWork({ fromId: NOPE, toId: `${NOPE}-2`, fromDate: "2026-10-01" }), reached: "queries" },
    { name: "applyCompanyPlanUpdate", call: () => plans.applyCompanyPlanUpdate({ companyName: NOPE, year: 2026, month: 9, pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", evidence: "دليل للفحص" }] }), reached: "queries" },
    // التوليد بالكوكي الصحيحة مغطّى بـtests/schedule-authorization.test.ts — هون الرفض بس.
    { name: "generateSchedule", call: () => schedule.generateSchedule(2026, 9), reached: "queries" },
    { name: "generateCompanySchedule", call: () => schedule.generateCompanySchedule(NOPE, 2026, 9), reached: "queries" },
    { name: "linkChatToCompany", call: () => telegram.linkChatToCompany(NOPE, null), reached: "queries" },
    { name: "markChatAsTeam", call: () => telegram.markChatAsTeam(NOPE, true), reached: "queries" },
    { name: "setBriefRecipient", call: () => telegram.setBriefRecipient("not-a-chat-id"), reached: "message" },
    { name: "sendBriefNow", call: () => telegram.sendBriefNow(), reached: "message" },
    { name: "undoMatch", call: () => telegram.undoMatch(NOPE), reached: "queries" },
    { name: "registerWebhook", call: () => telegram.registerWebhook("https://example.test"), reached: "message" },
    { name: "telegramStatus", call: () => telegram.telegramStatus(), reached: "message" },
    { name: "changePasswordAction", call: () => auth.changePasswordAction("x", "y"), reached: "message" },
    // المسؤولون الإضافيون (٢٧/١٠) — للمالكة بس.
    { name: "addAdminAction", call: () => admins.addAdminAction({ name: "x", email: "bad", password: "x" }), reached: "message" },
    { name: "resetAdminPasswordAction", call: () => admins.resetAdminPasswordAction(NOPE, "x"), reached: "message" },
    { name: "removeAdminAction", call: () => admins.removeAdminAction(NOPE), reached: "queries" },
    // «إعادة جدولة المتأخر» (٢٧/١٠).
    { name: "previewLateReschedule", call: () => lateResched.previewLateReschedule("2026-10-27", []), reached: "queries" },
    { name: "applyLateReschedule", call: () => lateResched.applyLateReschedule("2026-10-27", [], "x"), reached: "queries" },
    // ربط تلغرام من صفحة الفريق (٢٩/١٠).
    { name: "linkTelegramSender", call: () => tgIdentity.linkTelegramSender(NOPE, "123456"), reached: "queries" },
    { name: "rematchSenderFiles", call: () => tgIdentity.rematchSenderFiles("123456", 0), reached: "queries" },
    { name: "sendTelegramTest", call: () => tgIdentity.sendTelegramTest(NOPE), reached: "queries" },
    // إشعار «صار جاهز إلك» (٢٩/١٠) — مطفي افتراضياً، بيفتحه المسؤول بس.
    { name: "setUnblockNotify", call: () => telegram.setUnblockNotify(true), reached: "queries" },
    // «سلسلة مراحل» (٢٩/١٠) — بتوزّع شغل على أكتر من شخص.
    { name: "previewTaskChain", call: () => taskChain.previewTaskChain(CHAIN_INPUT(NOPE)), reached: "queries" },
    { name: "createTaskChain", call: () => taskChain.createTaskChain(CHAIN_INPUT(NOPE), "x"), reached: "queries" },
    // «تعبئة الأيام» (٢٩/١٠) — بيكتب يوم البداية على كروت الخطة.
    { name: "previewFillDays", call: () => fillDays.previewFillDays("2099-01-04"), reached: "queries" },
    { name: "applyFillDays", call: () => fillDays.applyFillDays("2099-01-04", "x"), reached: "queries" },
    // «فكّ الحجز يدوياً» (٢٩/١٠).
    { name: "manualUnblock", call: () => unblockActions.manualUnblock(NOPE, "سبب للفحص"), reached: "queries" },
    { name: "undoManualUnblock", call: () => unblockActions.undoManualUnblock(NOPE), reached: "queries" },
  ];
});

afterAll(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  const g = globalThis as any;
  await prisma?.$disconnect();
  delete g.__secMatrixPrisma;
  if (scratch.target) removeDb(scratch.target);
});

const UNAUTH = new Set(["غير مصرّح", "يلزم تسجيل الدخول", "فشل حذف الشركة", "فشل أرشفة الشركة", "فشل حذف الموظف", "فشلت إعادة الجدولة", "غير مصرّح — إدارة المسؤولين للمالكة فقط"]);

describe("أفعال الإدارة: بلا جلسة صحيحة ما في ولا استعلام ولا كتابة", () => {
  const forged = () => [
    { label: "بلا كوكي", value: undefined },
    { label: "توقيع غلط", value: `${Date.now() + 60_000}.${"ab".repeat(32)}` },
    { label: "سرّ غلط", value: signToken("not-the-secret", Date.now() + 60_000) },
    { label: "منتهية", value: signToken(SECRET, Date.now() - 1_000) },
    { label: "قمامة", value: "garbage" },
  ];

  it("كل فعل إداري × ٥ كوكيز مزوّرة → مرفوض، صفر استعلامات بعد البوابة، والقاعدة ما تغيّرت", async () => {
    if (skip()) return;
    const before = await fingerprint();
    const leaks: string[] = [];
    for (const spec of specs) {
      for (const c of forged()) {
        jar.value = c.value;
        const r = await outcome(spec.call);
        const refused = r.ok === false && (r.threw || UNAUTH.has(r.error ?? ""));
        if (!refused || r.queries !== 0) leaks.push(`${spec.name} [${c.label}] → ${JSON.stringify(r)}`);
      }
    }
    expect(leaks).toEqual([]);
    expect(await fingerprint()).toEqual(before);
  }, 60_000);

  it("بالكوكي الصحيحة كل فعل بيمرق البوابة (وصل للمنطق)", async () => {
    if (skip()) return;
    jar.value = signToken(SECRET, Date.now() + 60_000);
    const blocked: string[] = [];
    for (const spec of specs) {
      if (spec.name === "generateSchedule" || spec.name === "generateCompanySchedule") continue;
      const r = await outcome(spec.call);
      const passed = spec.reached === "queries" ? r.queries > 0 : !UNAUTH.has(r.error ?? "") && !r.threw;
      if (!passed) blocked.push(`${spec.name} → ${JSON.stringify(r)}`);
    }
    expect(blocked).toEqual([]);
  }, 120_000);
});

describe("أفعال الموظف: مفتوحة بقرار القائدة (توصيف، مو باغ)", () => {
  it("بلا أي كوكي: updateTaskStatus بيكتب على الكرت (و«togglePin» ما عاد نقطة نهاية — SA-08)", async () => {
    if (skip()) return;
    jar.value = undefined;
    const tasks = await import("@/server/actions/tasks");
    expect((tasks as Record<string, unknown>).togglePin).toBeUndefined();
    const card = await prisma.task.findFirst({ where: { isAuto: true, status: "NOT_STARTED" } });
    expect(card).toBeTruthy();
    const status = await tasks.updateTaskStatus(card.id, "IN_PROGRESS");
    expect(status.ok).toBe(true);
    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(after.status).toBe("IN_PROGRESS");
  });
});

/** ثابت: أي تصدير من ملف "use server" = نقطة نهاية. */
function useServerExports() {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const full = join(dir, n);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(full) ? [full] : [];
    });
  const all = walk("src");
  const isServer = (f: string) => /^["']use server["'];?$/.test(readFileSync(f, "utf8").split("\n")[0].trim());
  const isClient = (f: string) => /^["']use client["'];?$/.test(readFileSync(f, "utf8").split("\n")[0].trim());
  const clientSources = all.filter(isClient).map((f) => readFileSync(f, "utf8"));
  const out: { file: string; name: string; guarded: boolean; clientUsed: boolean }[] = [];
  for (const file of all.filter(isServer)) {
    const src = readFileSync(file, "utf8");
    const hits = [...src.matchAll(/export async function (\w+)/g)];
    hits.forEach((m, k) => {
      const body = src.slice(m.index!, k + 1 < hits.length ? hits[k + 1].index! : src.length);
      const guarded = /assertAdmin\(\)|await guard\(\)/.test(body);
      const clientUsed = clientSources.some((s) => new RegExp(`\\b${m[1]}\\b`).test(s));
      out.push({ file: file.split("\\").join("/"), name: m[1], guarded, clientUsed });
    });
  }
  return out;
}

describe("خريطة التصديرات (ثابت)", () => {
  it("المحروس = بالضبط أفعال الإدارة المتوقّعة", () => {
    const guarded = useServerExports().filter((e) => e.guarded).map((e) => e.name).sort();
    expect(guarded).toEqual(
      [
        "addAdminAction", "applyCompanyPlanUpdate", "applyLateReschedule", "archiveCompany", "changePasswordAction", "correctLatestRenewal",
        "createCompany", "createEmployee", "deleteCompany", "deleteEmployee", "endContract",
        "generateCompanySchedule", "generateSchedule", "handoverEmployeeWork", "linkChatToCompany", "linkTelegramSender", "markChatAsTeam",
        "pauseCompanyPublishing", "previewLateReschedule", "previewTaskChain", "createTaskChain", "previewFillDays", "applyFillDays", "manualUnblock", "undoManualUnblock", "purgeOrphanCards", "regenerateCompanyCurrentCycle",
        "registerWebhook", "rematchSenderFiles", "removeAdminAction", "removeLatestRenewal", "resetAdminPasswordAction", "renewContract", "reorderCompanies",
        "resumeCompanyPublishing", "sendBriefNow", "sendTelegramTest", "setBriefRecipient", "setUnblockNotify", "telegramStatus",
        "undoMatch", "updateCompany", "updateEmployee",
      ].sort(),
    );
  });

  it("[SA-08 مُصلَح] كل تصدير مفتوح من ملف \"use server\" مستعمَل من شاشة", () => {
    const orphans = useServerExports()
      .filter((e) => !e.guarded && !e.clientUsed)
      .map((e) => e.name)
      .sort();
    expect(orphans).toEqual([]);
  });
});
