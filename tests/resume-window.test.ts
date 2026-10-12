/**
 * الرجوع من إيقاف — قرار القائدة ١٢/١٠/٢٠٢٦: «منتابع من مكان يلي وقفنا فيه مع جدولة
 * جديدة حسب تاريخ البدء الجديد للمهام الباقية والنشر»، والباقي «مو 30 يوم ولا باقي
 * أيام الدورة… نعمل نصف الخطة ويبقى نصفها, ف بترجع بنص… بشكل ديناميكي».
 *
 * الدالّتان النقيّتان: طول النافذة (`resumeWindowDays`)، وتوزيع المحرّك على النافذة
 * (`buildSchedule` مع `company.resume`).
 */
import { describe, expect, it } from "vitest";
import { resumeWindowDays } from "@/server/company-pause";
import { buildSchedule, type SchedulerState } from "@/lib/scheduler";
import { expandPipeline } from "@/lib/pipeline";
import { toISODate } from "@/lib/dates";
import { LEAD } from "@/lib/constants";
import { company, D, E, PLANS, team } from "./deep/scheduler-core-fixture";

describe("طول نافذة الرجوع (resumeWindowDays)", () => {
  it("نص الخطة باقي ⇒ نص دورة", () => {
    expect(resumeWindowDays({ cycleDays: 30, planned: 12, open: { POST: 3, STORY: 3 } })).toBe(15);
  });

  it("الخطة كلها باقية ⇒ دورة كاملة، وما بتتجاوزها", () => {
    expect(resumeWindowDays({ cycleDays: 30, planned: 12, open: { POST: 8, REEL: 4 } })).toBe(30);
  });

  it("قطعة وحدة باقية ⇒ الحدّ الأدنى: مهلة إنتاجها + يوم نشر", () => {
    const w = resumeWindowDays({ cycleDays: 30, planned: 20, open: { REEL: 1 } });
    expect(w).toBeGreaterThanOrEqual(LEAD.REEL + 3 + 1);
    expect(w).toBeLessThan(15);
  });

  it("ما في باقي ⇒ صفر", () => {
    expect(resumeWindowDays({ cycleDays: 30, planned: 12, open: {} })).toBe(0);
  });
});

describe("توزيع المحرّك على نافذة الرجوع", () => {
  // دورة ١/٩ → ١/١٠ (دلو أيلول)، بوستات ٤ + ريلات ٢ + ستوري ٤. الإيقاف بعد ما خلص
  // بوست ١ و٢ وستوري ١ (منشورين)، وبوست ٣ ملغى. الرجوع ١/١١.
  const settledDates: Record<string, string> = { "POST|1": "2026-09-03", "POST|2": "2026-09-08", "POST|3": "2026-09-12", "STORY|1": "2026-09-04" };
  const pieces = [
    ...[1, 2, 3, 4].map((n) => ({ type: "POST" as const, n })),
    ...[1, 2].map((n) => ({ type: "REEL" as const, n })),
    ...[1, 2, 3, 4].map((n) => ({ type: "STORY" as const, n })),
  ].map(({ type, n }) => ({
    type,
    pieceNo: n,
    publishDate: settledDates[`${type}|${n}`] ? D(settledDates[`${type}|${n}`]) : D("2026-09-20"),
    settled: Boolean(settledDates[`${type}|${n}`]),
  }));
  const from = D("2026-11-01");
  const until = D("2026-11-20");
  const state: SchedulerState = {
    year: 2026,
    month: 8,
    employees: team(),
    adhoc: [],
    companies: [
      company("c", "راجعة", { ...PLANS.zero, posts: 4, reels: 2, stories: 4 }, {
        contractStartDate: D("2026-09-01"),
        publishStartDate: D("2026-09-01"),
        resume: { from, until, pieces },
      }),
    ],
  };
  const r = buildSchedule(state);
  const mine = r.tasks.filter((t) => t.companyId === "c");

  it("المحسوم بمكانه وبرقمه، وما بياكل يوماً من النافذة", () => {
    for (const [key, day] of Object.entries(settledDates)) {
      const [type, n] = key.split("|");
      const t = mine.find((x) => x.type === type && x.pieceNo === Number(n))!;
      expect(t, key).toBeTruthy();
      expect(t.settled).toBe(true);
      expect(toISODate(t.publishDate!)).toBe(day);
    }
  });

  it("الباقي كلّه جوّا [الرجوع + مهلة نوعه، نهاية النافذة)، بأرقامه القديمة بالترتيب", () => {
    const open = mine.filter((t) => !t.settled);
    expect(open.length).toBe(pieces.filter((p) => !p.settled).length);
    for (const t of open) {
      const lead = LEAD[t.type as keyof typeof LEAD] + (t.type === "REEL" ? 3 : 0);
      const floor = new Date(from);
      floor.setDate(floor.getDate() + lead);
      expect(t.publishDate!.getTime(), `${t.type}#${t.pieceNo}`).toBeGreaterThanOrEqual(floor.getTime());
      expect(t.publishDate!.getTime(), `${t.type}#${t.pieceNo}`).toBeLessThan(until.getTime());
      expect(t.publishDate!.getDay()).not.toBe(5); // لا جمعة
    }
    expect(open.filter((t) => t.type === "POST").map((t) => t.pieceNo).sort()).toEqual([4]);
    expect(open.filter((t) => t.type === "STORY").map((t) => t.pieceNo).sort()).toEqual([2, 3, 4]);
    const reels = open.filter((t) => t.type === "REEL").sort((a, b) => a.publishDate!.getTime() - b.publishDate!.getTime());
    expect(reels.map((t) => t.pieceNo)).toEqual([1, 2]);
  });

  it("الإنتاج والتصوير من يوم الرجوع، والجلسات للريلات الباقية بس", () => {
    for (const t of mine.filter((x) => !x.settled)) {
      if (t.workDate) expect(t.workDate.getTime(), `${t.type}#${t.pieceNo}`).toBeGreaterThanOrEqual(from.getTime());
    }
    for (const s of r.sessions.filter((x) => x.companyId === "c")) {
      expect(s.shootDate.getTime()).toBeGreaterThanOrEqual(from.getTime());
    }
  });

  it("expandPipeline بيحترم الأرقام المعطاة سلفاً ولو صار الموعد الجديد بعد محسوم أعلى منه", () => {
    const items = mine.map((t) => ({
      id: t.detKey,
      companyId: "c",
      type: t.type as "POST" | "REEL" | "AI_REEL" | "STORY",
      assigneeId: t.assigneeId,
      publishDate: toISODate(t.publishDate!),
      readyDate: t.readyDate ? toISODate(t.readyDate) : null,
      workDate: t.workDate ? toISODate(t.workDate) : null,
      week: t.week,
      status: "NOT_STARTED",
      pieceNo: t.pieceNo ?? null,
      settled: t.settled ?? false,
    }));
    const pipe = expandPipeline(items, {
      writerId: E.nawal.id,
      publisherId: E.omar.id,
      editorId: E.alisar.id,
      editorWorkDays: [0, 1, 2, 3, 4],
      year: 2026,
      month: 8,
      companyName: () => "راجعة",
      writerWorkDays: [0, 1, 2, 3, 4],
      publisherWorkDays: [0, 1, 2, 3, 4],
    });
    const numbers = (type: string) =>
      [...new Set(pipe.filter((t) => t.type === type && t.stage === "PUBLISH").map((t) => t.pieceNo))].sort((a, b) => a! - b!);
    expect(numbers("POST")).toEqual([1, 2, 3, 4]);
    expect(numbers("REEL")).toEqual([1, 2]);
    expect(numbers("STORY")).toEqual([1, 2, 3, 4]);
  });
});
