/**
 * المنطقة الزمنية بعملية فرعية حقيقية (TZ=UTC مقابل Asia/Damascus، وAmerica/New_York
 * كشاهد سلبي). الإنتاج بيشتغل على Vercel (UTC) والفريق بدمشق (UTC+3)، والقاعدة بتخزّن
 * المواعيد على منتصف ليل UTC. المطلوب: نفس الجدول بالأيام بالمنطقتين.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const WORKER = path.resolve(__dirname, "scheduler-core-tz-worker.ts");
type Out = { offsetMin: number; cycles: string[]; bwBucketAt0030Damascus: { year: number; month: number }; workdays: string; schedule: string[]; firstPublishInstant: string };
function runIn(tz: string): Out | null {
  const p = spawnSync(process.execPath, ["--import", "tsx", WORKER], { env: { ...process.env, TZ: tz }, encoding: "utf8", cwd: path.resolve(__dirname, "../.."), timeout: 120_000 });
  if (p.status !== 0) throw new Error(`worker ${tz} failed: ${p.stderr.slice(0, 400)}`);
  const line = p.stdout.trim().split("\n").pop()!;
  return JSON.parse(line) as Out;
}

describe("المنطقة الزمنية — عملية فرعية", () => {
  const utc = runIn("UTC");
  const dam = runIn("Asia/Damascus");
  const ny = runIn("America/New_York");
  const tzHonoured = utc?.offsetMin === 0 && dam?.offsetMin === -180 && ny?.offsetMin === 240;

  it.skipIf(!tzHonoured)("UTC ودمشق: نفس الدورات ونفس الجدول (دلوين) يوماً بيوم، ونفس حساب أيام العمل", () => {
    expect(dam!.cycles).toEqual(utc!.cycles);
    expect(dam!.schedule).toEqual(utc!.schedule);
    expect(dam!.workdays).toBe("2026-11-02");
    expect(utc!.workdays).toBe("2026-11-02");
  });

  it.skipIf(!tzHonoured)("[موثَّق SC-08] لحظة الخزن تابعة لمنطقة العملية: نفس اليوم بيطلع منتصف ليل UTC على Vercel و21:00Z من جهاز بدمشق؛ ونيويورك بتزيح كل الدورات يوم لورا", () => {
    expect(utc!.firstPublishInstant.endsWith("T00:00:00.000Z")).toBe(true);
    expect(dam!.firstPublishInstant.endsWith("T21:00:00.000Z")).toBe(true);
    expect(ny!.cycles).not.toEqual(utc!.cycles);
  });

  it.skipIf(!tzHonoured)("[موثَّق SC-12] حدّ اليوم = منتصف ليل الخادم: الساعة 00:30 بدمشق يوم بداية دورة BW (10/10)، خادم UTC لسا بيعتبرها دورة أيلول", () => {
    expect(dam!.bwBucketAt0030Damascus).toEqual({ year: 2026, month: 9 });
    expect(utc!.bwBucketAt0030Damascus).toEqual({ year: 2026, month: 8 });
  });
});
