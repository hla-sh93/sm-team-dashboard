/**
 * طابور واحد للشخص عبر الدلاء (خطة D، ٢٩/١٠) — `SchedulerState.externalLoad`.
 * الحشر بيبلّش من ساعات شغل الشخص المفتوح بالدلاء التانية، فدورتان متقاطعتان ما بيحمّلوا نفس
 * اليوم فوق طاقته.
 */
import { describe, it, expect } from "vitest";
import { buildSchedule, type SchedulerState } from "@/lib/scheduler";
import { toISODate } from "@/lib/dates";
import { team, productionCompanies, E } from "./deep/scheduler-core-fixture";

const state = (externalLoad?: SchedulerState["externalLoad"]): SchedulerState => ({
  year: 2026,
  month: 9, // تشرين الأول — دورات الإنتاج (لقطة ١١/١٠) بتغطّيه
  employees: team(),
  companies: productionCompanies(),
  adhoc: [],
  ...(externalLoad ? { externalLoad } : {}),
});
const aymanDays = (r: ReturnType<typeof buildSchedule>) =>
  r.tasks.filter((t) => t.assigneeId === E.ayman.id && t.type !== "REEL" && t.workDate).map((t) => ({ d: toISODate(t.workDate!), h: t.hours, o: t.overflow }));

describe("externalLoad", () => {
  it("بلاه أو فاضي ← نفس الناتج حرفياً (ولا تغيير على يلي ما عنده شغل بدلاء تانية)", () => {
    const a = buildSchedule(state());
    const b = buildSchedule(state({}));
    const c = buildSchedule(state({ [E.sabin.id]: {} }));
    const key = (r: ReturnType<typeof buildSchedule>) => r.tasks.map((t) => `${t.detKey}:${t.workDate ? toISODate(t.workDate) : ""}`).join("|");
    expect(key(b)).toBe(key(a));
    expect(key(c)).toBe(key(a));
  });

  it("يوم أيمن المحجوز كامل بدلو تاني ← ولا كرت من هالدلو بينحشر عليه (إلا overflow معلَن)", () => {
    const base = aymanDays(buildSchedule(state()));
    expect(base.length).toBeGreaterThan(0);
    const busiest = [...base.reduce((m, x) => m.set(x.d, (m.get(x.d) ?? 0) + x.h), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0][0];
    const after = aymanDays(buildSchedule(state({ [E.ayman.id]: { [busiest]: 8 } })));
    expect(after.filter((x) => x.d === busiest && !x.o)).toEqual([]);
    expect(after.length).toBe(base.length); // نفس الكروت، بس بأيام تانية
  });

  it("حمل جزئي (نص يوم) بيخلّي مطرح لنص يوم بس", () => {
    const base = aymanDays(buildSchedule(state()));
    const day = base[0].d;
    const after = aymanDays(buildSchedule(state({ [E.ayman.id]: { [day]: 4 } })));
    const onDay = after.filter((x) => x.d === day && !x.o).reduce((s, x) => s + x.h, 0);
    expect(onDay).toBeLessThanOrEqual(4 + 1e-9);
  });
});
