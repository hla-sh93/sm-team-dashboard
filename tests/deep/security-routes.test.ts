/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: مسارات HTTP والميدلوير والترويسات.
 *
 * المراجع: QA-002/QA-003 بـ`docs/qa/FINAL_QA_REPORT.md` §6 (الويبهوك والكرونات
 * بتفشل مغلقة: بلا سرّ 503، بسرّ غلط 401)، تعليق `src/app/api/backup/export/route.ts`
 * («نفس سلوك الكرونات حرفياً… قراءة فقط، وما بيقبل إلا GET»)، `PROJECT.md` §2
 * (الميدلوير بيفحص وجود الكوكي بس، والتحقّق الحقيقي بالـlayout والأفعال)،
 * و§13 من التقرير النهائي (ترويسات الأمان).
 *
 * كل شي بالذاكرة: المرسِلات والقاعدة مزيّفة — ولا شبكة ولا كتابة.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  sendShootAppointments: vi.fn(),
  buildSnapshot: vi.fn(),
  ingestUpdate: vi.fn(),
  webhookSecret: vi.fn<() => string | null>(),
  jar: { value: undefined as string | undefined },
  db: {
    telegramMessage: { findMany: vi.fn(async () => []) },
    telegramChat: { findMany: vi.fn(async () => []) },
    company: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sm_admin" && mocks.jar.value !== undefined ? { name, value: mocks.jar.value } : undefined,
    set: () => {},
  }),
}));
vi.mock("@/lib/db", () => ({ prisma: mocks.db }));
vi.mock("@/lib/backup", () => ({ buildSnapshot: mocks.buildSnapshot }));
vi.mock("@/lib/telegram/client", () => ({ webhookSecret: mocks.webhookSecret }));
vi.mock("@/lib/telegram/ingest", () => ({ ingestUpdate: mocks.ingestUpdate }));
vi.mock("@/lib/telegram/service", () => ({ sendShootAppointments: mocks.sendShootAppointments }));

import * as shootRoute from "@/app/api/cron/shoot-appointments/route";
import * as backupRoute from "@/app/api/backup/export/route";
import * as webhookRoute from "@/app/api/telegram/webhook/route";
import * as planUpdateRoute from "@/app/admin/api/plan-update/route";
import { middleware, config as middlewareConfig } from "@/middleware";
import { NextRequest } from "next/server";
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match");
const nextConfig = require("../../next.config.js");

const SECRET = "qa-security-cron-secret";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "");
  vi.stubEnv("AUTH_SECRET", "routes-secret");
  mocks.sendShootAppointments.mockResolvedValue({ ok: true, sent: 1 });
  mocks.buildSnapshot.mockResolvedValue({ meta: { counts: {} }, employees: [], companies: [], tasks: [] });
  mocks.ingestUpdate.mockResolvedValue({ stored: false });
  mocks.webhookSecret.mockReturnValue(null);
  mocks.jar.value = undefined;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);

describe("كرون جرد التصوير (ناقص من http-boundaries.test.ts)", () => {
  it("بلا CRON_SECRET → 503 وما بينبعت شي", async () => {
    const r = await shootRoute.GET(req("/api/cron/shoot-appointments"));
    expect(r.status).toBe(503);
    expect(mocks.sendShootAppointments).not.toHaveBeenCalled();
  });
  it("سرّ غلط / بلا Bearer / حروف صغيرة / مسافتين → 401", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    // (المسافة بالطرفين بتنقصّ حسب مواصفة Fetch، فمو حالة.)
    for (const auth of ["Bearer wrong", SECRET, `bearer ${SECRET}`, `Bearer  ${SECRET}`, ""]) {
      const r = await shootRoute.GET(req("/api/cron/shoot-appointments", { headers: { authorization: auth } }));
      expect(r.status, JSON.stringify(auth)).toBe(401);
    }
    expect(mocks.sendShootAppointments).not.toHaveBeenCalled();
  });
  it("السرّ الصحيح → 200 ومرّة وحدة", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const r = await shootRoute.GET(req("/api/cron/shoot-appointments", { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(r.status).toBe(200);
    expect(mocks.sendShootAppointments).toHaveBeenCalledTimes(1);
  });
  it("الكرونات GET بس: ما في POST مصدَّر (Next بيرد 405)", () => {
    expect(Object.keys(shootRoute).filter((k) => /^(POST|PUT|PATCH|DELETE)$/.test(k))).toEqual([]);
  });
});

describe("تصدير النسخة الاحتياطية /api/backup/export", () => {
  it("بلا CRON_SECRET → 503، بسرّ غلط → 401، وما بتنبنى لقطة", async () => {
    expect((await backupRoute.GET(req("/api/backup/export"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await backupRoute.GET(req("/api/backup/export", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
    expect(mocks.buildSnapshot).not.toHaveBeenCalled();
  });
  it("بالسرّ → 200 مع cache-control: no-store؛ وGET بس", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const r = await backupRoute.GET(req("/api/backup/export", { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(Object.keys(backupRoute).filter((k) => /^(POST|PUT|PATCH|DELETE)$/.test(k))).toEqual([]);
  });
  it("[SA-12 مُصلَح] فشل التصدير ما بيرجّع نصّ الخطأ الداخلي بالجواب", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mocks.buildSnapshot.mockRejectedValue(new Error("Can't reach database server at `db-internal.example:5432` user=app_owner"));
    const r = await backupRoute.GET(req("/api/backup/export", { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(r.status).toBe(500);
    expect(await r.text()).not.toMatch(/db-internal|app_owner/);
  });
});

describe("ويبهوك تلغرام", () => {
  it("بلا السرّ: ما بينقرا الجسم أصلاً (حتى لو ضخم أو مكسور) → 401", async () => {
    mocks.webhookSecret.mockReturnValue("tg-secret");
    const big = "x".repeat(5 * 1024 * 1024);
    const r = await webhookRoute.POST(req("/api/telegram/webhook", { method: "POST", body: big }));
    expect(r.status).toBe(401);
    expect(mocks.ingestUpdate).not.toHaveBeenCalled();
  });
  it("قراءة التشخيص GET: بلا سرّ 401، وhours مقصوصة ≤ ١٦٨ وما بتنهار على قيم غريبة", async () => {
    mocks.webhookSecret.mockReturnValue("tg-secret");
    expect((await webhookRoute.GET(req("/api/telegram/webhook?hours=24"))).status).toBe(401);
    for (const h of ["-5", "abc", "1e9", "Infinity", ""]) {
      const r = await webhookRoute.GET(
        req(`/api/telegram/webhook?hours=${h}`, { headers: { "x-telegram-bot-api-secret-token": "tg-secret" } }),
      );
      expect(r.status, h).toBe(200);
      const body = await r.json();
      expect(body.sinceHours, h).toBeLessThanOrEqual(168);
    }
  });
});

describe("مسار الإدارة /admin/api/plan-update", () => {
  it("بلا كوكي → مرفوض «غير مصرّح» قبل أي منطق", async () => {
    const r = await planUpdateRoute.POST(req("/admin/api/plan-update", { method: "POST", body: JSON.stringify({}) }));
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe("غير مصرّح");
  });
  it("[SA-12 مُصلَح] الرفض لعدم الصلاحية بيرجع 401/403 مو 400", async () => {
    const r = await planUpdateRoute.POST(req("/admin/api/plan-update", { method: "POST", body: JSON.stringify({}) }));
    expect([401, 403]).toContain(r.status);
  });
});

describe("الميدلوير (فحص وجود الكوكي — بالتصميم)", () => {
  it("بلا كوكي → تحويل لـ/login?from=…؛ بأي كوكي → بيمرق (التحقّق الحقيقي بالـlayout والأفعال)", () => {
    const anon = middleware(new NextRequest("http://localhost/admin/companies?x=1"));
    expect([307, 308]).toContain(anon.status);
    expect(anon.headers.get("location")).toBe("http://localhost/login?from=%2Fadmin%2Fcompanies");
    const withCookie = middleware(
      new NextRequest("http://localhost/admin/companies", { headers: { cookie: "sm_admin=anything" } }),
    );
    expect(withCookie.headers.get("x-middleware-next")).toBe("1");
  });
  it("المطابِق بيغطّي /admin وكل ما تحته — و/api/* برّا (بتحمي حالها بأسرارها)", () => {
    expect(middlewareConfig.matcher).toEqual(["/admin", "/admin/:path*"]);
    const m = middlewareConfig.matcher.map((p: string) => getPathMatch(p));
    const covered = (path: string) => m.some((fn: (p: string) => unknown) => fn(path) !== false);
    expect(covered("/admin")).toBe(true);
    expect(covered("/admin/api/plan-update")).toBe(true);
    expect(covered("/api/backup/export")).toBe(false);
  });
});

describe("ترويسات الأمان (next.config.js)", () => {
  it("الخمسة موجودة وبتنطبق على كل المسارات بما فيها / و/api و/admin/api", async () => {
    const rules = await nextConfig.headers();
    expect(rules).toHaveLength(1);
    const [rule] = rules;
    const match = getPathMatch(rule.source);
    for (const p of ["/", "/tasks", "/api/cron/daily-brief", "/admin/api/plan-update", "/login"]) {
      expect(match(p), p).not.toBe(false);
    }
    const h = Object.fromEntries(rule.headers.map((x: { key: string; value: string }) => [x.key.toLowerCase(), x.value]));
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["strict-transport-security"]).toMatch(/max-age=31536000/);
  });
  it("[SA-13 مُصلَح] في Content-Security-Policy (أقلّه frame-ancestors/object-src/base-uri)", async () => {
    const [rule] = await nextConfig.headers();
    const keys = rule.headers.map((x: { key: string }) => x.key.toLowerCase());
    expect(keys).toContain("content-security-policy");
  });
});

describe("مقارنة الأسرار (ثابت)", () => {
  it("[SA-13 مُصلَح] مقارنة CRON_SECRET وسرّ الويبهوك ثابتة الزمن", () => {
    const files = [
      "src/app/api/backup/export/route.ts",
      "src/app/api/cron/daily-brief/route.ts",
      "src/app/api/cron/done-report/route.ts",
      "src/app/api/cron/shoot-appointments/route.ts",
      "src/app/api/cron/weekly-digest/route.ts",
      "src/app/api/telegram/webhook/route.ts",
    ];
    const naive = files.filter((f) => /!==\s*`Bearer|!==\s*secret/.test(readFileSync(f, "utf8")));
    expect(naive).toEqual([]);
  });
});
