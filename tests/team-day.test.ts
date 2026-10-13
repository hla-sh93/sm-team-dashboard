/**
 * «اليوم» بتوقيت الفريق (دمشق) — نقطة واحدة (فحص ١٢/١٠: SC-12 · OP-13 · UI-09).
 *
 * الحساب بإزاحة ثابتة (UTC+3)، فالنتيجة ما بتتبع منطقة العملية: نفس الجواب على Vercel
 * (UTC) ومن جهاز بدمشق. الفحص بعملية فرعية حقيقية بـ`scheduler-core-tz.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dayKeyOf, teamDayStart, teamToday, teamTodayISO } from "@/lib/team-day";
import { dayKeyOf as periodDayKeyOf } from "@/lib/period-report";

describe("يوم الفريق", () => {
  it("٠٠:٣٠ دمشق (٢١:٣٠Z) = اليوم الجديد، و٢٣:٥٩ دمشق (٢٠:٥٩Z) لسا نفس اليوم", () => {
    expect(teamTodayISO(new Date("2026-10-11T21:30:00Z"))).toBe("2026-10-12");
    expect(teamTodayISO(new Date("2026-10-11T20:59:59Z"))).toBe("2026-10-11");
    expect(teamTodayISO(new Date("2026-10-11T21:00:00Z"))).toBe("2026-10-12");
  });

  it("teamToday = منتصف ليل يوم دمشق بتوقيت العملية (شكل fromISODate)", () => {
    const d = teamToday(new Date("2026-10-11T21:30:00Z"));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 12, 0, 0]);
  });

  it("teamDayStart = لحظة بداية يوم دمشق — لفلترة «رسائل اليوم»", () => {
    expect(teamDayStart(new Date("2026-10-11T21:30:00Z")).toISOString()).toBe("2026-10-11T21:00:00.000Z");
    expect(teamDayStart(new Date("2026-10-12T20:00:00Z")).toISOString()).toBe("2026-10-11T21:00:00.000Z");
  });

  it("dayKeyOf: حقل مخزَّن منتصف ليل UTC (الإنتاج) و٢١:٠٠Z (المرآة) = نفس اليوم؛ ونفس الدالة بتقرير الفترة", () => {
    expect(dayKeyOf(new Date("2026-10-12T00:00:00Z"))).toBe("2026-10-12");
    expect(dayKeyOf("2026-10-11T21:00:00.000Z")).toBe("2026-10-12");
    expect(periodDayKeyOf).toBe(dayKeyOf);
  });

  it("[OP-13] الصفحات الخادمية بتاخد «اليوم» من يوم الفريق — مو منتصف ليل الخادم", () => {
    const today = readFileSync("src/app/TodayView.tsx", "utf8");
    expect(today).toMatch(/const today = teamToday\(now\)/);
    expect(today).toMatch(/sentAt: \{ gte: teamDayStart\(now\) \}/);
    expect(today).toMatch(/todayISO=\{teamTodayISO\(now\)\}/);
    for (const file of [
      "src/app/TodayView.tsx",
      "src/app/OverviewView.tsx",
      "src/app/reports/page.tsx",
      "src/app/companies/page.tsx",
      "src/app/admin/finance/page.tsx",
      "src/lib/month.ts",
      "src/lib/live-tasks.ts",
      "src/server/actions/companies.ts",
      "src/server/actions/tasks.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      // «منتصف ليل الخادم»: اليوم من getters العملية على لحظة هلّق.
      expect(src, file).not.toMatch(/new Date\((now|today)\.getFullYear\(\), (now|today)\.getMonth\(\), (now|today)\.getDate\(\)\)/);
      expect(src, file).not.toMatch(/(latestCycleBucket|currentCycleBucket|archiveCompanyContract|recordPause)\([^)]*new Date\(\)\)/);
      expect(src, file).not.toMatch(/const now = new Date\(\);\s*const (tracked|rows|isPast|year)/);
    }
  });
});
