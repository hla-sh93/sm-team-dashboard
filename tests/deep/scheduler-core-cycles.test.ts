/**
 * حساب الدورات (`lib/contract.ts`) على حدود التقويم: كل يوم بداية بين
 * 2026-01-01 و2028-12-31 (شباط الكبيسة 2028، رأس السنة، 28/29/30/31)،
 * التجديد المبكر والمكرّر، قرار «لم يُجدد»، وحدود الدلو شاملة/حصرية.
 */
import { describe, expect, it } from "vitest";
import {
  cyclesOf,
  cycleForBucket,
  naturalCycleEnd,
  currentCycle,
  currentCycleBucket,
  latestCycleBucket,
  cycleSpanLabel,
  contractStateOf,
  contractModeOf,
} from "@/lib/contract";
import { buildSchedule } from "@/lib/scheduler";
import { companyCycle, clampDayToMonth, toISODate } from "@/lib/dates";
import { team, company, PLANS, D, iso, addDays } from "./scheduler-core-fixture";

describe("الدورات — سلسلة تجديدات متّصلة من كل يوم بداية 2026→2028", () => {
  it("سبع دورات متلاصقة: نهاية كل وحدة = بداية التالية، طولها 28–31 يوم، كلها دافئة إلا الأولى، وكل وحدة بتملك دلو شهر بدايتها", () => {
    const bad: string[] = [];
    for (let d = new Date(2026, 0, 1); d < new Date(2029, 0, 1); d.setDate(d.getDate() + 1)) {
      const start = new Date(d);
      const starts = [start];
      for (let i = 0; i < 6; i++) starts.push(naturalCycleEnd(starts[starts.length - 1]));
      const co = { publishStartDate: start, renewals: starts.slice(1).map(toISODate), contractEndedAt: null };
      const cs = cyclesOf(co);
      if (cs.length !== 7) { bad.push(`${iso(start)}: ${cs.length} دورات`); continue; }
      cs.forEach((c, i) => {
        if (c.days.length < 28 || c.days.length > 31) bad.push(`${iso(start)} #${i} طول ${c.days.length}`);
        if (i > 0 && cs[i - 1].end.getTime() !== c.start.getTime()) bad.push(`${iso(start)} فجوة/تداخل بين ${i - 1} و${i}`);
        if ((i === 0) !== c.coldStart) bad.push(`${iso(start)} #${i} coldStart=${c.coldStart}`);
        if (c.days[0].getTime() !== c.start.getTime() || addDays(c.days[c.days.length - 1], 1).getTime() !== c.end.getTime()) bad.push(`${iso(start)} #${i} days[]`);
        const got = cycleForBucket(co, c.start.getFullYear(), c.start.getMonth());
        if (!got || got.start.getTime() !== c.start.getTime()) bad.push(`${iso(start)} #${i} الدلو`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("حدود الدورة: أول يوم شامل، آخر يوم شامل، ويوم النهاية بيتبع الدورة التالية (حصري)", () => {
    const bad: string[] = [];
    for (let d = new Date(2026, 0, 1); d < new Date(2029, 0, 1); d.setDate(d.getDate() + 3)) {
      const start = new Date(d);
      const next = naturalCycleEnd(start);
      const co = { publishStartDate: start, renewals: [toISODate(next)], contractEndedAt: null };
      const b = (x: Date) => `${currentCycleBucket(co, x).year}-${currentCycleBucket(co, x).month}`;
      const own = `${start.getFullYear()}-${start.getMonth()}`;
      const nxt = `${next.getFullYear()}-${next.getMonth()}`;
      if (b(start) !== own) bad.push(`${iso(start)} أول يوم`);
      if (b(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59)) !== own) bad.push(`${iso(start)} أول يوم 23:59`);
      if (b(addDays(next, -1)) !== own) bad.push(`${iso(start)} آخر يوم ${iso(addDays(next, -1))}`);
      if (b(next) !== nxt) bad.push(`${iso(start)} يوم النهاية ${iso(next)} لازم للدورة التالية`);
    }
    expect(bad).toEqual([]);
  });

  it("شباط: 31/1 → 28/2 (2027) و 29/2 (2028)، ورأس السنة 15/12 → 15/1", () => {
    expect(iso(naturalCycleEnd(D("2027-01-31")))).toBe("2027-02-28");
    expect(iso(naturalCycleEnd(D("2028-01-31")))).toBe("2028-02-29");
    expect(iso(naturalCycleEnd(D("2028-02-29")))).toBe("2028-03-29");
    expect(iso(naturalCycleEnd(D("2026-12-15")))).toBe("2027-01-15");
    expect(cyclesOf({ publishStartDate: D("2027-12-31"), renewals: null, contractEndedAt: null })[0].days).toHaveLength(31);
    expect(cycleForBucket({ publishStartDate: D("2026-12-15"), renewals: null, contractEndedAt: null }, 2027, 0)).toBeNull();
    expect(cycleForBucket({ publishStartDate: D("2026-12-15"), renewals: null, contractEndedAt: null }, 2026, 11)?.days).toHaveLength(31);
  });

  it("[موثَّق SC-11] انزياح اليوم: عقد 31 بيصير 28 بعد شباط وبيضل 28 — الصيغة القديمة الشهرية كانت ترجّعه لـ31", () => {
    let cur = D("2027-01-31");
    const chain = [iso(cur)];
    for (let i = 0; i < 4; i++) { cur = naturalCycleEnd(cur); chain.push(iso(cur)); }
    expect(chain).toEqual(["2027-01-31", "2027-02-28", "2027-03-28", "2027-04-28", "2027-05-28"]);
    const old = companyCycle(2027, 2, 31);
    expect([iso(old.start), iso(old.end)]).toEqual(["2027-03-31", "2027-04-30"]);
    expect(clampDayToMonth(2028, 1, 31)).toBe(29);
  });

  it("تجديد مبكر بيقصّ الدورة السابقة، والمكرّر بينشال، والنهاية الطبيعية بتضل للباقي", () => {
    const cs = cyclesOf({ publishStartDate: D("2026-10-13"), renewals: '["2026-10-20","2026-10-20","2026-11-20"]', contractEndedAt: null });
    expect(cs.map((c) => `${iso(c.start)}→${iso(c.end)}`)).toEqual(["2026-10-13→2026-10-20", "2026-10-20→2026-11-20", "2026-11-20→2026-12-20"]);
    expect(cs.map((c) => c.coldStart)).toEqual([true, false, false]);
    // دورتان بنفس الدلو: الأولى (الأطول) بتملك الدلو — حدّ معروف (PROJECT §12)
    expect(iso(cycleForBucket({ publishStartDate: D("2026-10-13"), renewals: '["2026-10-20"]', contractEndedAt: null }, 2026, 9)!.start)).toBe("2026-10-13");
  });

  it("«لم يُجدد»: يساوي بداية التجديد → التجديد بيسقط؛ جوّا الدورة → بتنقصّ؛ يساوي البداية الأولى → ولا دورة", () => {
    const a = cyclesOf({ publishStartDate: D("2026-10-13"), renewals: '["2026-11-13"]', contractEndedAt: D("2026-11-13") });
    expect(a.map((c) => `${iso(c.start)}→${iso(c.end)}`)).toEqual(["2026-10-13→2026-11-13"]);
    expect(contractStateOf({ publishStartDate: D("2026-10-13"), renewals: '["2026-11-13"]', contractEndedAt: D("2026-11-13") }, D("2026-11-20")).state).toBe("ended");
    const b = cyclesOf({ publishStartDate: D("2026-10-13"), renewals: null, contractEndedAt: D("2026-10-25") });
    expect(b[0].days).toHaveLength(12);
    expect(cyclesOf({ publishStartDate: D("2026-10-13"), renewals: null, contractEndedAt: D("2026-10-13") })).toHaveLength(0);
    expect(cycleForBucket({ publishStartDate: D("2026-10-13"), renewals: null, contractEndedAt: D("2026-10-13") }, 2026, 9)).toBeNull();
    // المحرّك: ولا كرت بعد يوم «لم يُجدد»
    const r = buildSchedule({ year: 2026, month: 9, employees: team(), companies: [company("c", "c", PLANS.bw, { publishStartDate: D("2026-09-13"), renewals: ["2026-10-13"], contractEndedAt: D("2026-10-25") })], adhoc: [] });
    expect(r.tasks.length).toBeGreaterThan(0);
    for (const t of r.tasks) expect(t.publishDate!.getTime()).toBeLessThan(D("2026-10-25").getTime());
  });

  it("ثلاثة أنماط عقد: نشر → دورات؛ موقّع بلا بدء نشر → لا دورة ولا كرت؛ بلا عقد → شهر التقويم كله ودافئ", () => {
    expect(contractModeOf({ publishStartDate: D("2026-10-01") })).toBe("publishing");
    expect(contractModeOf({ contractStartDate: D("2026-10-01"), publishStartDate: null })).toBe("signed_not_publishing");
    expect(contractModeOf({})).toBe("no_contract");
    const signed = buildSchedule({ year: 2026, month: 9, employees: team(), companies: [company("c", "c", PLANS.phx, { contractStartDate: D("2026-10-01") })], adhoc: [] });
    expect(signed.tasks).toHaveLength(0);
    expect(signed.sessions).toHaveLength(0);
    const cal = cycleForBucket({}, 2028, 1)!;
    expect([iso(cal.start), iso(cal.end), cal.days.length, cal.coldStart]).toEqual(["2028-02-01", "2028-03-01", 29, false]);
    const r = buildSchedule({ year: 2028, month: 1, employees: team(), companies: [company("c", "c", PLANS.phx)], adhoc: [] });
    for (const t of r.tasks) expect(iso(t.publishDate)!.startsWith("2028-02")).toBe(true);
  });

  it("تسميات الدورة ودلو اليوم: BW 10/9→9/10 ثم 10/10→9/11؛ بعد آخر دورة الدلو الجاري = شهر اليوم والإنجاز = آخر دورة", () => {
    const bw = { publishStartDate: D("2026-09-10"), renewals: '["2026-10-10"]', contractEndedAt: null };
    expect(cycleSpanLabel(bw, 2026, 8)).toBe("10/9 → 9/10");
    expect(cycleSpanLabel(bw, 2026, 9)).toBe("10/10 → 9/11");
    expect(currentCycleBucket(bw, D("2026-10-09"))).toEqual({ year: 2026, month: 8 });
    expect(currentCycleBucket(bw, D("2026-10-10"))).toEqual({ year: 2026, month: 9 });
    expect(currentCycleBucket(bw, D("2026-11-09"))).toEqual({ year: 2026, month: 9 });
    expect(currentCycle(bw, new Date(2026, 10, 10, 0, 0))).toBeNull();
    expect(currentCycleBucket(bw, D("2026-11-10"))).toEqual({ year: 2026, month: 10 });
    expect(latestCycleBucket(bw, D("2026-11-10"))).toEqual({ year: 2026, month: 9 });
    expect(cycleSpanLabel({ contractStartDate: D("2026-10-01"), publishStartDate: null }, 2026, 9)).toBe("لسا ما بلّش النشر");
    expect(cycleSpanLabel({}, 2028, 1)).toBe("1/2 → 29/2");
  });

  it("[SC-10] دلو بلا دورة لشركة إلها دورات ما بياخد تسمية شهر التقويم — «بانتظار التجديد» وأخواتها", () => {
    const bw = { publishStartDate: D("2026-09-10"), renewals: '["2026-10-10"]', contractEndedAt: null };
    expect(cycleForBucket(bw, 2026, 10)).toBeNull();
    expect(cycleSpanLabel(bw, 2026, 10)).toBe("بانتظار التجديد");
    expect(cycleSpanLabel(bw, 2026, 9)).toBe("10/10 → 9/11");
    expect(cycleSpanLabel(bw, 2026, 7)).toBe("قبل بداية العقد");
    expect(cycleSpanLabel({ ...bw, contractEndedAt: D("2026-11-09") }, 2026, 10)).toBe("لم تجدّد");
    // فجوة: تجديد متأخّر بشهرين بيترك دلو تشرين التاني بلا دورة بالنص.
    const gap = { publishStartDate: D("2026-09-10"), renewals: '["2026-12-10"]', contractEndedAt: null };
    expect(cycleSpanLabel(gap, 2026, 10)).toBe("بلا دورة بهالشهر");
    // شركة بلا عقد = الشهر التقويمي متل قبل.
    expect(cycleSpanLabel({}, 2026, 10)).toBe("1/11 → 30/11");
  });

  it("[موثَّق SC-14] تجديد مسجَّل قبل تاريخ بدء النشر بيصير هو الدورة الأولى", () => {
    const co = { publishStartDate: D("2026-10-13"), renewals: '["2026-09-13"]', contractEndedAt: null };
    expect(cyclesOf(co).map((c) => iso(c.start))).toEqual(["2026-09-13", "2026-10-13"]);
  });
});
