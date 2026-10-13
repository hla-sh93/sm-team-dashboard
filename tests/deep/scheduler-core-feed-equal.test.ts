/**
 * مراجعة F–H (١٣/١٠): فيد = أيام النشر بالضبط كان يروح لفرع التنويع، و`round(i+0.5)`
 * بيزيح كل قطعة يوم لقدّام فآخرها بتنكبس على آخر يوم — قطعتين بيوم ويوم فاضي بلا إنذار.
 * الحدّ `⌈n ÷ الأيام⌉` = ١ بالضبط، وما في إنذار «أكتر من أيام النشر» لأنها مو أكتر.
 */
import { describe, expect, it } from "vitest";
import { buildSchedule } from "@/lib/scheduler";
import { toISODate } from "@/lib/dates";
import { cycleForBucket } from "@/lib/contract";
import { isPublishableDay } from "@/lib/constants";
import { team, company, D } from "./scheduler-core-fixture";

const perDay = (tasks: { publishDate?: unknown }[]) => {
  const m = new Map<string, number>();
  for (const t of tasks) {
    const k = toISODate(t.publishDate as Date);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};
const overflowWarnings = (r: { warnings: { message: string }[] }) =>
  r.warnings.filter((w) => /أكتر من أيام النشر/.test(w.message));

describe("فيد = أيام النشر بالضبط → قطعة وحدة بكل يوم", () => {
  it("دورة دافية: عدد البوستات = أيام النشر المتاحة → كل يوم قطعة، ولا يوم فاضي، ولا إنذار", () => {
    const probe = company("c", "C", { posts: 1, reels: 0, aiReels: 0, stories: 0 }, { publishStartDate: D("2026-08-10"), renewals: ["2026-09-10", "2026-10-10"] });
    const days = cycleForBucket(probe, 2026, 9)!.days.filter(isPublishableDay).map(toISODate);
    const co = company("c", "C", { posts: days.length, reels: 0, aiReels: 0, stories: 0 }, { publishStartDate: D("2026-08-10"), renewals: ["2026-09-10", "2026-10-10"] });
    const r = buildSchedule({ year: 2026, month: 9, employees: team(), companies: [co], adhoc: [] });
    const m = perDay(r.tasks.filter((t) => t.kind === "CONTENT" && t.type === "POST"));
    expect(Math.max(...m.values())).toBe(1);
    expect(days.filter((d) => !m.has(d))).toEqual([]);
    expect(overflowWarnings(r)).toEqual([]);
  });

  it("أول دورة: كل حجم فيد ما بيتجاوز أيام النشر → ما في يوم بقطعتين", () => {
    for (let n = 14; n <= 20; n++) {
      const co = company("c", "C", { posts: Math.ceil(n / 2), reels: Math.floor(n / 2), aiReels: 0, stories: 0 }, { publishStartDate: D("2026-10-01") });
      const r = buildSchedule({ year: 2026, month: 9, employees: team(), companies: [co], adhoc: [] });
      const feed = r.tasks.filter((t) => t.kind === "CONTENT" && t.type !== "STORY");
      const m = perDay(feed);
      if (overflowWarnings(r).length === 0) expect(Math.max(...m.values()), `n=${n}`).toBe(1);
    }
  });
});
