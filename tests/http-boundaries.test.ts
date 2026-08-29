import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  webhookSecret: vi.fn<() => string | undefined>(),
  ingestUpdate: vi.fn(),
  sendDailyBrief: vi.fn(),
  sendDailyDoneReport: vi.fn(),
  sendWeeklyPublishDigest: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/telegram/client", () => ({ webhookSecret: mocks.webhookSecret }));
vi.mock("@/lib/telegram/ingest", () => ({ ingestUpdate: mocks.ingestUpdate }));
vi.mock("@/lib/telegram/service", () => ({
  sendDailyBrief: mocks.sendDailyBrief,
  sendDailyDoneReport: mocks.sendDailyDoneReport,
  sendWeeklyPublishDigest: mocks.sendWeeklyPublishDigest,
}));

import { POST as telegramPost } from "@/app/api/telegram/webhook/route";
import { GET as dailyBrief } from "@/app/api/cron/daily-brief/route";
import { GET as doneReport } from "@/app/api/cron/done-report/route";
import { GET as weeklyDigest } from "@/app/api/cron/weekly-digest/route";

const cronRoutes = [
  ["daily brief", dailyBrief, mocks.sendDailyBrief],
  ["done report", doneReport, mocks.sendDailyDoneReport],
  ["weekly digest", weeklyDigest, mocks.sendWeeklyPublishDigest],
] as const;

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "");
  mocks.webhookSecret.mockReturnValue(undefined);
  mocks.ingestUpdate.mockResolvedValue({ stored: false });
  mocks.sendDailyBrief.mockResolvedValue({ ok: true, sent: 1 });
  mocks.sendDailyDoneReport.mockResolvedValue({ ok: true, sent: 1 });
  mocks.sendWeeklyPublishDigest.mockResolvedValue({ ok: true, sent: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("cron HTTP authentication", () => {
  for (const [name, handler, sender] of cronRoutes) {
    it(`${name} fails closed when CRON_SECRET is missing`, async () => {
      const response = await handler(new Request(`http://localhost/api/cron/${name}`));
      expect(response.status).toBe(503);
      expect(sender).not.toHaveBeenCalled();
    });

    it(`${name} rejects a wrong bearer token`, async () => {
      vi.stubEnv("CRON_SECRET", "qa-cron-secret");
      const response = await handler(
        new Request(`http://localhost/api/cron/${name}`, {
          headers: { authorization: "Bearer wrong" },
        }),
      );
      expect(response.status).toBe(401);
      expect(sender).not.toHaveBeenCalled();
    });

    it(`${name} invokes its sender with the configured bearer token`, async () => {
      vi.stubEnv("CRON_SECRET", "qa-cron-secret");
      const response = await handler(
        new Request(`http://localhost/api/cron/${name}`, {
          headers: { authorization: "Bearer qa-cron-secret" },
        }),
      );
      expect(response.status).toBe(200);
      expect(sender).toHaveBeenCalledTimes(1);
    });
  }
});

describe("Telegram webhook authentication", () => {
  it("fails closed when the webhook secret is not configured", async () => {
    const response = await telegramPost(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({ update_id: 1 }),
      }),
    );
    expect(response.status).toBe(503);
    expect(mocks.ingestUpdate).not.toHaveBeenCalled();
  });

  it("rejects the wrong Telegram secret without ingesting", async () => {
    mocks.webhookSecret.mockReturnValue("qa-webhook-secret");
    const response = await telegramPost(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "wrong" },
        body: JSON.stringify({ update_id: 1 }),
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.ingestUpdate).not.toHaveBeenCalled();
  });

  it("accepts an authenticated update and keeps malformed JSON retry-safe", async () => {
    mocks.webhookSecret.mockReturnValue("qa-webhook-secret");
    const headers = { "x-telegram-bot-api-secret-token": "qa-webhook-secret" };

    const accepted = await telegramPost(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers,
        body: JSON.stringify({ update_id: 1 }),
      }),
    );
    expect(accepted.status).toBe(200);
    expect(mocks.ingestUpdate).toHaveBeenCalledTimes(1);

    mocks.ingestUpdate.mockClear();
    const malformed = await telegramPost(
      new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers,
        body: "{",
      }),
    );
    expect(malformed.status).toBe(200);
    expect(mocks.ingestUpdate).not.toHaveBeenCalled();
  });
});
