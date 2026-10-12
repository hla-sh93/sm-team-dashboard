/**
 * حدود التواريخ (`lib/dates.ts`, `lib/constants.ts`): أواخر الشهور، رأس
 * السنة، أسبوع السبت-أولاً، نافذة التصوير لكل يوم نشر، وخطر المنطقة الزمنية
 * (بعملية فرعية حتى ما نلوّث TZ تبع الـworker).
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  toISODate,
  fromISODate,
  addWorkdaysFor,
  addWorkingDays,
  backWorkday,
  forwardWorkday,
  weeks,
  periodDays,
  packingWindowDays,
  batchSizes,
  split4,
  clampDayToMonth,
  parseWorkDays,
  getWeekDays,
  ARABIC_WEEK_ORDER,
  WORK_WEEK,
  cycleWeekOf,
} from "@/lib/dates";
import {
  LEAD,
  SHOOT_BEFORE_MONTAGE,
  FOOTAGE_BEFORE_MONTAGE,
  PUBLISH_WEEK_DAYS,
  WEEKDAY_ORDER,
  isPublishableDay,
  montageDay,
  shootWindow,
  footageDeadline,
  isTaskLateState,
  daysLateOfState,
} from "@/lib/constants";
import { D, iso, addDays, dayDiff } from "./scheduler-core-fixture";

describe("توقيت محلّي: ISO ↔ Date", () => {
  it("toISODate(fromISODate(x)) = x لكل يوم 2026→2028، والساعة صفر محلياً", () => {
    for (let d = new Date(2026, 0, 1); d < new Date(2029, 0, 1); d.setDate(d.getDate() + 1)) {
      const s = toISODate(d);
      const back = fromISODate(s);
      expect(toISODate(back)).toBe(s);
      expect(back.getHours()).toBe(0);
      expect(back.getTime()).toBe(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
    }
  });

  it("[موثَّق SC-08] سلسلة ISO بلا وقت بتنقرا UTC: بمنطقة سالبة اليوم بينزاح ليوم قبل، وبدمشق/UTC لا — وقيمة 21:00Z (منتصف ليل دمشق) بتنقرا يوم قبل على UTC", () => {
    const probe = (tz: string) =>
      spawnSync(process.execPath, ["-e", "const d=new Date('2026-10-11');const m=new Date(d.getFullYear(),d.getMonth(),d.getDate());const z=new Date('2026-10-10T21:00:00.000Z');console.log(JSON.stringify([m.getDate(),z.getDate(),new Date(2026,9,11).getTimezoneOffset()]))"], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
    const read = (tz: string) => {
      const p = probe(tz);
      if (p.status !== 0 || !p.stdout.trim()) return null;
      return JSON.parse(p.stdout.trim()) as [number, number, number];
    };
    const utc = read("UTC");
    const dam = read("Asia/Damascus");
    const ny = read("America/New_York");
    if (!utc || !dam || !ny || utc[2] !== 0 || dam[2] !== -180 || ny[2] !== 240) return; // TZ غير محترم بهالبيئة — ما في شي ينفحص
    expect([utc[0], dam[0], ny[0]]).toEqual([11, 11, 10]);
    expect([utc[1], dam[1], ny[1]]).toEqual([10, 11, 10]);
  });

  it("التأخير بيوم الخادم المحلي: الموعد 10/10 ما بيصير متأخراً إلا بعد منتصف ليل الخادم (لا منتصف ليل دمشق) — قياس بدون TZ", () => {
    const due = { readyDate: D("2026-10-10"), status: "NOT_STARTED" };
    expect(isTaskLateState(due, new Date(2026, 9, 10, 23, 59))).toBe(false);
    expect(isTaskLateState(due, new Date(2026, 9, 11, 0, 0))).toBe(true);
    expect(daysLateOfState(due, new Date(2026, 9, 11, 0, 0))).toBe(1);
    expect(daysLateOfState(due, new Date(2026, 9, 13, 12, 0))).toBe(3);
    expect(isTaskLateState({ ...due, isPinned: true, workDate: D("2026-10-14") }, D("2026-10-12"))).toBe(false);
    expect(isTaskLateState({ ...due, status: "READY" }, D("2026-10-20"))).toBe(false);
  });
});

describe("أيام العمل عبر حدود الشهر والسنة", () => {
  it("addWorkdaysFor/addWorkingDays بيقفزوا الجمعة والسبت وبيعبروا الشهر ورأس السنة", () => {
    expect(iso(addWorkdaysFor(D("2026-10-29"), 2, WORK_WEEK))).toBe("2026-11-02"); // خميس +٢ = الاثنين
    expect(iso(addWorkdaysFor(D("2026-10-30"), 0, WORK_WEEK))).toBe("2026-11-01"); // جمعة → الأحد
    expect(iso(addWorkingDays(D("2026-12-31"), 1))).toBe("2027-01-03"); // خميس ٣١/١٢ → الأحد ٣/١
    expect(iso(addWorkingDays(D("2028-02-28"), 3))).toBe("2028-03-02"); // الاثنين ٢٨/٢ (كبيسة) → الخميس ٢/٣
    expect(iso(addWorkingDays(D("2026-10-11"), 0))).toBe("2026-10-11");
    expect(iso(addWorkdaysFor(D("2026-10-11"), 1, [1, 2, 3]))).toBe("2026-10-13"); // أحد → الاثنين (n=0) → الثلاثاء
  });

  it("backWorkday/forwardWorkday: سبت→خميس، جمعة→خميس، جمعة→أحد؛ وبأسبوع يوم واحد بيلفّوا أسبوعاً كاملاً", () => {
    expect(iso(backWorkday(D("2026-10-31"), WORK_WEEK))).toBe("2026-10-29");
    expect(iso(backWorkday(D("2026-10-30"), WORK_WEEK))).toBe("2026-10-29");
    expect(iso(forwardWorkday(D("2026-10-30"), WORK_WEEK))).toBe("2026-11-01");
    expect(iso(forwardWorkday(D("2026-12-31"), [1]))).toBe("2027-01-04");
    expect(iso(backWorkday(D("2027-01-01"), [4]))).toBe("2026-12-31");
  });

  it("parseWorkDays: فاضي/غير صالح/كسري → الأسبوع الافتراضي أو التقريب؛ الجمعة مقبولة لو مخزّنة (مسؤولية الإدخال)", () => {
    expect(parseWorkDays("[]")).toEqual(WORK_WEEK);
    expect(parseWorkDays("[7,9]")).toEqual(WORK_WEEK);
    expect(parseWorkDays("junk")).toEqual(WORK_WEEK);
    expect(parseWorkDays([0.5, 1.9, 6.2])).toEqual([0, 1]);
    expect(parseWorkDays("[5]")).toEqual([5]);
    expect(parseWorkDays([3, 3, 0])).toEqual([3, 0]);
  });

  it("أسبوع النشر بيبلّش بأول يوم من أسبوع العمل، ٤ أسابيع × ٥ أيام، وفترة الجدولة ٣٣ يوماً لأي شهر", () => {
    for (let m = 0; m < 24; m++) {
      const y = 2026 + Math.floor(m / 12);
      const ws = weeks(y, m % 12);
      expect(ws).toHaveLength(4);
      for (const w of ws) {
        expect(w).toHaveLength(5);
        expect(w[0].getDay()).toBe(WORK_WEEK[0]);
        w.forEach((d, i) => expect(dayDiff(w[0], d)).toBe(i));
      }
      expect(periodDays(y, m % 12)).toHaveLength(7 + 3 * 7 + 4 + 1);
      const pw = packingWindowDays(y, m % 12, addDays(ws[3][4], 20));
      expect(pw[pw.length - 1].getTime()).toBe(addDays(ws[3][4], 20).getTime());
    }
  });

  it("الأسبوع العربي سبت-أولاً: getWeekDays ٧ أيام من السبت، والترتيبان متطابقان", () => {
    const w = getWeekDays(D("2026-10-14"));
    expect(w.map((d) => d.getDay())).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(iso(w[0])).toBe("2026-10-10");
    expect([...ARABIC_WEEK_ORDER]).toEqual([...WEEKDAY_ORDER]);
    expect([...PUBLISH_WEEK_DAYS].sort()).toEqual([0, 1, 2, 3, 4, 6]);
    expect(isPublishableDay(D("2026-10-16"))).toBe(false); // جمعة
    expect(isPublishableDay(D("2026-10-17"))).toBe(true); // سبت
  });

  it("cycleWeekOf: ٤ أرباع على طول الدورة فعلياً، واليوم خارج الدورة بيرجع ١", () => {
    const days = Array.from({ length: 30 }, (_, i) => addDays(D("2026-10-10"), i));
    expect(cycleWeekOf(D("2026-10-10"), days)).toBe(1);
    expect(cycleWeekOf(D("2026-10-17"), days)).toBe(1);
    expect(cycleWeekOf(D("2026-10-18"), days)).toBe(2);
    expect(cycleWeekOf(D("2026-11-08"), days)).toBe(4);
    expect(cycleWeekOf(D("2026-12-01"), days)).toBe(1);
    expect(cycleWeekOf(D("2026-12-01"), [])).toBe(1);
  });
});

describe("التقسيمات: split4 و batchSizes", () => {
  it("split4: المجموع = n، الباقي للأسابيع الأولى، ولا أسبوع بيزيد عن غيره بأكتر من ١", () => {
    for (let n = 0; n <= 60; n++) {
      const s = split4(n);
      expect(s.reduce((a, b) => a + b, 0)).toBe(n);
      expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1);
      for (let i = 1; i < 4; i++) expect(s[i - 1]).toBeGreaterThanOrEqual(s[i]);
    }
  });
  it("batchSizes: المجموع = n، لا نزلة منفردة لما n ≥ 2، وكل نزلة ٢–٣", () => {
    expect(batchSizes(0)).toEqual([]);
    expect(batchSizes(1)).toEqual([1]);
    for (let n = 2; n <= 60; n++) {
      const b = batchSizes(n);
      expect(b.reduce((a, x) => a + x, 0)).toBe(n);
      for (const x of b) { expect(x).toBeGreaterThanOrEqual(2); expect(x).toBeLessThanOrEqual(3); }
    }
    expect(batchSizes(4)).toEqual([2, 2]);
    expect(batchSizes(8)).toEqual([3, 3, 2]);
  });
  it("clampDayToMonth على الحدود", () => {
    expect(clampDayToMonth(2027, 1, 31)).toBe(28);
    expect(clampDayToMonth(2028, 1, 30)).toBe(29);
    expect(clampDayToMonth(2026, 3, 31)).toBe(30);
    expect(clampDayToMonth(2026, 0, 0)).toBe(1);
    expect(clampDayToMonth(2026, 0, -5)).toBe(1);
  });
});

describe("نافذة التصوير والمونتاج لكل يوم نشر (constants)", () => {
  it("لكل يوم نشر مسموح على مدى سنة: المونتاج على يوم دوام المونتيرة ≤ النشر−٢، النافذة = المونتاج−٣..−٢، واللقطات ≤ المونتاج−١ على يوم دوام", () => {
    const ed = WORK_WEEK;
    for (let d = D("2026-10-01"); d < D("2027-10-01"); d = addDays(d, 1)) {
      if (!isPublishableDay(d)) continue;
      const m = montageDay(d, ed);
      expect(ed.includes(m.getDay()), `montage ${iso(m)} for ${iso(d)}`).toBe(true);
      expect(dayDiff(m, d), `lead ${iso(d)}`).toBeGreaterThanOrEqual(LEAD.REEL);
      expect(dayDiff(m, d)).toBeLessThanOrEqual(LEAD.REEL + 2); // سبت/جمعة بيزيحوه يومين كحدّ أقصى
      const w = shootWindow(d, ed);
      expect(dayDiff(w.earliest, m)).toBe(SHOOT_BEFORE_MONTAGE.max);
      expect(dayDiff(w.latest, m)).toBe(SHOOT_BEFORE_MONTAGE.min);
      const f = footageDeadline(d, ed);
      expect(ed.includes(f.getDay())).toBe(true);
      expect(dayDiff(f, m)).toBeGreaterThanOrEqual(FOOTAGE_BEFORE_MONTAGE);
      expect(f.getTime()).toBeLessThan(m.getTime());
    }
  });

  it("مثال القائدة: نشر الاثنين → مونتاج السبت؟ لأ — السبت عطلة المونتيرة فالمونتاج الخميس والتصوير الاثنين/الثلاثاء", () => {
    const mon = D("2026-10-12");
    expect(iso(montageDay(mon, WORK_WEEK))).toBe("2026-10-08");
    const w = shootWindow(mon, WORK_WEEK);
    expect([iso(w.earliest), iso(w.latest)]).toEqual(["2026-10-05", "2026-10-06"]);
    expect(iso(footageDeadline(mon, WORK_WEEK))).toBe("2026-10-07");
    // بلا أيام دوام (مونتيرة غير معروفة) النافذة حسابية صرفة
    expect(iso(montageDay(mon))).toBe("2026-10-10");
    expect(iso(shootWindow(mon).latest)).toBe("2026-10-08");
  });
});
