/**
 * الجمعة والسبت ما فيهن تقارير مهام، وجرد التصوير بيوصل الأحد.
 *
 * وصل بريف «تفاصيل السبت ٥/٩» فيه شغل لسبع أشخاص كلهم بعطلة. السبب: موجة ٧:٤٥
 * عندها فلتر أيام الدوام، وموجة ٨:٠٠ ما كان عندها، ولا تقرير المساء.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isTeamOffDay } from "@/lib/work-week";
import { buildShootAppointments } from "@/lib/telegram/shoot-appointments";
import { prisma } from "@/lib/db";

const SUN_THU = JSON.stringify([0, 1, 2, 3, 4]);

describe("عطلة الفريق مشتقّة من أيام الدوام", () => {
  const team = [{ workDays: SUN_THU }, { workDays: SUN_THU }];

  it("الجمعة والسبت عطلة، وباقي الأسبوع لأ", () => {
    // 2026-09-04 جمعة · 2026-09-05 سبت · 2026-09-06 أحد
    expect(isTeamOffDay(team, new Date(2026, 8, 4))).toBe(true);
    expect(isTeamOffDay(team, new Date(2026, 8, 5))).toBe(true);
    expect(isTeamOffDay(team, new Date(2026, 8, 6))).toBe(false);
    expect(isTeamOffDay(team, new Date(2026, 8, 10))).toBe(false);
  });

  it("بيتبع الداتا: لو حدا دوامه السبت، السبت مو عطلة", () => {
    const withSaturday = [...team, { workDays: JSON.stringify([6, 0, 1, 2, 3]) }];
    expect(isTeamOffDay(withSaturday, new Date(2026, 8, 5))).toBe(false);
  });

  it("جدول موظفين فاضي مو «الكل بعطلة»", () => {
    // وإلا أول خطأ بقراءة الجدول بيسكّت كل التقارير بصمت.
    expect(isTeamOffDay([], new Date(2026, 8, 5))).toBe(false);
  });

  it("كل الفريق فعلياً أحد→خميس", async () => {
    const team = await prisma.employee.findMany({ select: { name: true, workDays: true } });
    const working = team.filter((e) => !isTeamOffDay([e], new Date(2026, 8, 5)));
    expect(working.map((e) => e.name)).toEqual([]);
  });
});

describe("التقارير بتحترم العطلة", () => {
  const src = readFileSync("src/lib/telegram/service.ts", "utf8");

  it("البريف اليومي وتقرير المساء وجرد التصوير كلهن بيفحصوا العطلة", () => {
    for (const fn of ["sendDailyBrief", "sendDailyDoneReport", "sendShootAppointments"]) {
      const start = src.indexOf(`export async function ${fn}`);
      expect(start, `${fn} مفقودة`).toBeGreaterThan(-1);
      const next = src.indexOf("\nexport async function", start + 1);
      const body = src.slice(start, next === -1 ? src.length : next);
      expect(body, `${fn} ما بتفحص العطلة`).toContain("isTeamOffDay");
    }
  });

  it("الحارس قبل بناء الرسالة، مو بعدها", () => {
    const start = src.indexOf("export async function sendDailyBrief");
    const body = src.slice(start, src.indexOf("\nexport async function", start + 1));
    expect(body.indexOf("isTeamOffDay")).toBeLessThan(body.indexOf("buildTodayBrief"));
  });
});

describe("جرد مواعيد التصوير", () => {
  const companies = [
    { id: "c1", name: "عبادة", managed: true, status: "active" },
    { id: "c2", name: "موقوفة", managed: true, status: "paused" },
  ] as never as Parameters<typeof buildShootAppointments>[1];
  const team = [
    { id: "e1", name: "ماجد", role: "مصور", workDays: SUN_THU },
    { id: "e2", name: "أليسار", role: "مونتيرة", workDays: SUN_THU },
  ] as never as Parameters<typeof buildShootAppointments>[3];
  const reel = (id: string, companyId: string, publishDate: Date | null) =>
    ({
      id,
      companyId,
      stage: "SHOOT",
      type: "REEL",
      status: "NOT_STARTED",
      board: "TODO",
      publishDate,
    }) as never;

  it("بيجمع ريلات الشركة بسطر واحد مع يوم الطلب", () => {
    const r = buildShootAppointments(
      new Date(2026, 8, 6),
      companies,
      [reel("a", "c1", new Date(2026, 8, 17)), reel("b", "c1", new Date(2026, 8, 20))] as never,
      team,
    );
    expect(r.needs).toHaveLength(1);
    expect(r.needs[0]).toMatchObject({ company: "عبادة", reels: 2, overdue: false });
    expect(r.text).toContain("عبادة: 2 ريل");
    expect(r.text).toContain("اطلبي الموعد");
  });

  it("الشركة الموقوفة ما بتطلع", () => {
    const r = buildShootAppointments(
      new Date(2026, 8, 6),
      companies,
      [reel("a", "c2", new Date(2026, 8, 17))] as never,
      team,
    );
    expect(r.text).toBeNull();
  });

  it("يوم الطلب يلي مرق بينوسم متأخر وبيطلع أول", () => {
    const r = buildShootAppointments(
      new Date(2026, 8, 20),
      [...(companies as never as Record<string, unknown>[]), { id: "c3", name: "لاحقة", managed: true, status: "active" }] as never,
      [reel("a", "c1", new Date(2026, 8, 21)), reel("b", "c3", new Date(2026, 9, 10))] as never,
      team,
    );
    expect(r.needs[0].company).toBe("عبادة");
    expect(r.needs[0].overdue).toBe(true);
    expect(r.text).toContain("متأخر");
  });

  it("ريل بلا تاريخ نشر بينعدّ وما بينخترعله موعد", () => {
    const r = buildShootAppointments(
      new Date(2026, 8, 6),
      companies,
      [reel("a", "c1", null)] as never,
      team,
    );
    expect(r.needs[0]).toMatchObject({ reels: 1, askBy: null, shootBy: null });
    expect(r.text).toContain("بلا تاريخ نشر بعد");
  });
});

describe("جدول الكرونات", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons: { path: string; schedule: string }[];
  };
  const at = (path: string) => vercel.crons.find((c) => c.path.startsWith(path))?.schedule;

  it("جرد التصوير يوم الأحد", () => {
    // كرون: الحقل الأخير يوم الأسبوع، و0 = الأحد.
    expect(at("/api/cron/shoot-appointments")?.split(" ")[4]).toBe("0");
  });

  it("تقرير المساء ٥ المسا بتوقيتنا (UTC+3)", () => {
    const [, hour] = at("/api/cron/done-report")!.split(" ");
    expect((Number(hour) + 3) % 24).toBe(17);
  });
});
