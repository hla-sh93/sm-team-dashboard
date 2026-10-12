/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور telegram-reports: مسارات الكرون الأربعة والويبهوك.
 *
 * `tests/http-boundaries.test.ts` بيغطّي ٣ كرونات (البريف · المنجز · الأسبوعي)؛ هون
 * الرابع (`shoot-appointments`) + جدول قرار `?wave=` + رمز الحالة لما الإرسال يفشل،
 * + «ولا إرسال بلا توكن» على الخدمة الحقيقية مع `fetch` مستبدَل (ولا شبكة أبداً).
 *
 * المرجع: مدخل الهاندوف «CRON_SECRET … without it, all three protected Telegram
 * report routes fail closed with 503» (§10)، وPROJECT.md §14 (الويبهوك بالسرّ).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendDailyBrief: vi.fn(),
  sendDailyDoneReport: vi.fn(),
  sendWeeklyPublishDigest: vi.fn(),
  sendShootAppointments: vi.fn(),
}));

vi.mock("@/lib/telegram/service", () => mocks);

import { GET as dailyBrief } from "@/app/api/cron/daily-brief/route";
import { GET as doneReport } from "@/app/api/cron/done-report/route";
import { GET as weeklyDigest } from "@/app/api/cron/weekly-digest/route";
import { GET as shootAppointments } from "@/app/api/cron/shoot-appointments/route";

const req = (path: string, auth?: string) =>
  new Request(`http://localhost/api/cron/${path}`, auth ? { headers: { authorization: auth } } : undefined);

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockResolvedValue({ ok: true, sent: 1 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("كرون جرد مواعيد التصوير — نفس بوابة الكرونات التانية", () => {
  it("بلا CRON_SECRET → 503 وما بيبعت", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await shootAppointments(req("shoot-appointments"))).status).toBe(503);
    expect(mocks.sendShootAppointments).not.toHaveBeenCalled();
  });

  it("سرّ غلط أو بلا Bearer → 401 وما بيبعت", async () => {
    vi.stubEnv("CRON_SECRET", "qa-secret");
    for (const auth of [undefined, "Bearer wrong", "qa-secret", "bearer qa-secret"])
      expect((await shootAppointments(req("shoot-appointments", auth))).status).toBe(401);
    expect(mocks.sendShootAppointments).not.toHaveBeenCalled();
  });

  it("السرّ الصح → بيبعت مرّة وحدة و200", async () => {
    vi.stubEnv("CRON_SECRET", "qa-secret");
    expect((await shootAppointments(req("shoot-appointments", "Bearer qa-secret"))).status).toBe(200);
    expect(mocks.sendShootAppointments).toHaveBeenCalledTimes(1);
  });
});

describe("`?wave=` بكرون البريف — جدول قرار", () => {
  const cases: [string, string][] = [
    ["daily-brief?wave=general", "general"],
    ["daily-brief?wave=detail", "detail"],
    ["daily-brief", "all"],
    ["daily-brief?wave=genral", "all"], // غلطة مطبعية بـvercel.json ما بتضيّع موجة (تعليق الملف)
  ];
  for (const [path, wave] of cases) {
    it(`${path} → ${wave}`, async () => {
      vi.stubEnv("CRON_SECRET", "qa-secret");
      const res = await dailyBrief(req(path, "Bearer qa-secret"));
      expect(mocks.sendDailyBrief).toHaveBeenCalledWith(expect.any(Date), wave);
      expect((await res.json()).wave).toBe(wave);
    });
  }
});

describe("الإرسال فشل → 500 (حتى Vercel يسجّلها فشل)، والتخطّي المقصود → 200", () => {
  it("كل كرون بيرجّع 500 لما الخدمة ترجع ok:false", async () => {
    vi.stubEnv("CRON_SECRET", "qa-secret");
    for (const m of Object.values(mocks)) m.mockResolvedValue({ ok: false, error: "x" });
    for (const [route, path] of [[dailyBrief, "daily-brief"], [doneReport, "done-report"], [weeklyDigest, "weekly-digest"]] as const)
      expect((await route(req(path, "Bearer qa-secret"))).status).toBe(500);
  });

  it("عطلة الفريق (skipped) نجاح مو فشل", async () => {
    vi.stubEnv("CRON_SECRET", "qa-secret");
    mocks.sendDailyDoneReport.mockResolvedValue({ ok: true, sent: 0, skipped: "عطلة" });
    expect((await doneReport(req("done-report", "Bearer qa-secret"))).status).toBe(200);
  });
});
