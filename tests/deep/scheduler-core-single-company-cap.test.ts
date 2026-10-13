/**
 * مراجعة F–H (١٣/١٠): توليد شركة وحدة (`onlyCompanyId` — تجديد، عقد جديد، تصحيح تجديد)
 * كان يحطّ نزلاتها حول نسخة **بالذاكرة** من نزلات الشركات التانية بنفس الدلو، وهيدي ما
 * بتنكتب — فالمحفوظ صار ٦ ريلات بيوم والسقف ٣، بلا إنذار. هلّق الشركة المحصورة بتنحطّ
 * حول المحفوظ (`savedBucketBookings`).
 */
import { describe, expect, it } from "vitest";
import { buildSchedule } from "@/lib/scheduler";
import { toISODate } from "@/lib/dates";
import { team, company, D, E } from "./scheduler-core-fixture";

const CAP = 3;
const emps = team().map((e) => (e.id === E.majed.id ? { ...e, rates: JSON.stringify({ REEL: CAP }) } : e));
const plan = { posts: 0, reels: 6, aiReels: 0, stories: 0 };
type S = { kind: string; companyId: string; shootDate: Date; reelCount: number };
const reelSessions = (r: { sessions: S[] }, id: string) =>
  r.sessions.filter((s) => s.kind === "REELS" && s.companyId === id && s.reelCount > 0);

describe("توليد شركة وحدة بيحترم نزلات الشركات التانية المحفوظة بنفس الدلو", () => {
  it("تجديد شركة أولويتها أعلى بدلو فيه نزلات محفوظة لغيرها → المحفوظ ما بيتجاوز السقف", () => {
    const C = company("c_C", "C", plan, { priority: 5, publishStartDate: D("2026-09-01"), renewals: ["2026-10-01"] });
    const before = company("c_A", "A", plan, { priority: 1, publishStartDate: D("2026-09-01"), renewals: [] });
    const after = { ...before, renewals: ["2026-10-01"] };

    // دلو تشرين محفوظ قبل ما A تتجدّد: نزلات C بس.
    const saved = buildSchedule({ year: 2026, month: 9, employees: emps, companies: [before, C], adhoc: [] });
    const savedC = reelSessions(saved, "c_C");
    expect(savedC.length).toBeGreaterThan(0);

    // تجديد A = توليد محصور عليها؛ المحرّك بيكتب نزلات A بس.
    const regen = buildSchedule({
      year: 2026, month: 9, employees: emps, companies: [after, C], adhoc: [],
      reelPlacementFor: "c_A",
      savedBucketBookings: savedC.map((s) => ({ companyId: s.companyId, shootDate: s.shootDate, reelCount: s.reelCount })),
    });
    const writtenA = reelSessions(regen, "c_A");
    expect(writtenA.reduce((n, s) => n + s.reelCount, 0)).toBe(6);

    const perDay = new Map<string, number>();
    for (const s of [...savedC, ...writtenA]) perDay.set(toISODate(s.shootDate), (perDay.get(toISODate(s.shootDate)) ?? 0) + s.reelCount);
    expect([...perDay].filter(([, n]) => n > CAP)).toEqual([]);
  });
});
