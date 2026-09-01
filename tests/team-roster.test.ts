/**
 * مين بيظهر بقوائم الشغل — قرار القائدة (١/٩): التيم الأساسي بس يلي عم
 * يتولّدله مهام؛ السيلز والمصوّر الفريلانس برّا.
 */
import { describe, expect, it } from "vitest";
import { isProductionMember, isSalesRole, workRoster } from "@/lib/team";
import { WORK_WEEK, weeks } from "@/lib/dates";
import { expandPipeline } from "@/lib/pipeline";
import {
  WORKDAYS_DEFAULT,
  WORKDAYS_PHOTO,
  PUBLISH_WEEK_DAYS,
  isPublishableDay,
} from "@/lib/constants";

const P = (o: Partial<{ id: string; role: string; isScheduled: boolean; isPhotographer: boolean }>) => ({
  id: o.id ?? "x",
  role: o.role ?? "designer",
  isScheduled: o.isScheduled ?? true,
  isPhotographer: o.isPhotographer ?? false,
});

describe("قوام الفريق", () => {
  it("السيلز مو أعضاء إنتاج مهما كانت إعداداتهم", () => {
    expect(isSalesRole("sales")).toBe(true);
    expect(isProductionMember(P({ role: "sales" }))).toBe(false);
    expect(isProductionMember(P({ role: "sales", isScheduled: true }))).toBe(false);
  });

  it("المصوّر الفريلانس برّا لحدّ ما ينشغّل", () => {
    expect(isProductionMember(P({ role: "photographer", isPhotographer: true, isScheduled: false }))).toBe(false);
    expect(isProductionMember(P({ role: "مصور", isPhotographer: true, isScheduled: true }))).toBe(true);
  });

  it("الناشر والكاتبة أعضاء حتى لو مو داخلين بالمحرّك التلقائي", () => {
    expect(isProductionMember(P({ role: "publisher", isScheduled: false }))).toBe(true);
    expect(isProductionMember(P({ role: "كاتبة محتوى", isScheduled: false }))).toBe(true);
  });

  it("مين ماسك شغل مفتوح بيضل ظاهر — ما في كرت بيضيع بصمت", () => {
    const team = [
      P({ id: "sara", role: "sales" }),
      P({ id: "michael", role: "sales" }),
      P({ id: "albert", role: "photographer", isPhotographer: true, isScheduled: false }),
      P({ id: "ayman", role: "designer" }),
    ];
    const roster = workRoster(team, new Set(["sara"]));
    expect(roster.map((e) => e.id)).toEqual(["sara", "ayman"]);
    // وبمجرّد ما ينسكّر كرتها، بتختفي لحالها.
    expect(workRoster(team, new Set()).map((e) => e.id)).toEqual(["ayman"]);
  });
});

describe("أسبوع العمل — عطلة الجمعة والسبت (قرار القائدة ١/٩)", () => {
  it("الدوام من الأحد للخميس، ومصدره واحد", () => {
    expect(WORK_WEEK).toEqual([0, 1, 2, 3, 4]);
    expect(WORK_WEEK).not.toContain(5); // الجمعة
    expect(WORK_WEEK).not.toContain(6); // السبت
    // كل افتراضيات **الإنتاج** بتقرا من نفس المصدر.
    expect(WORKDAYS_DEFAULT).toBe(WORK_WEEK);
    expect(WORKDAYS_PHOTO).toBe(WORK_WEEK);
  });

  // قرار القائدة (١/٩): «السبت مسموح للنشر بس، مو للإنتاج». المنشور بيتجهّز
  // قبله وبينجدول مسبقاً، فتقويم العميل ما بيتحرّك — أمّا شغل الإنتاج فلأ.
  it("النشر بيمرق يوم السبت، والإنتاج لأ", () => {
    expect(PUBLISH_WEEK_DAYS).toContain(6); // السبت
    expect(WORK_WEEK).not.toContain(6);
    expect(isPublishableDay(new Date(2026, 8, 5))).toBe(true); // السبت
    expect(isPublishableDay(new Date(2026, 8, 4))).toBe(false); // الجمعة
    for (const d of WORK_WEEK) expect(PUBLISH_WEEK_DAYS).toContain(d);
  });

  it("أسابيع التوزيع بتوقع كلها على أيام دوام", () => {
    for (const month of [6, 7, 8]) {
      for (const week of weeks(2026, month)) {
        for (const day of week) {
          expect(WORK_WEEK).toContain(day.getDay());
        }
      }
    }
  });
});

describe("النشر يوم السبت — الكرت بينجهّز بيوم دوام", () => {
  it("قطعة نشرها السبت بتضل نشرها السبت، وشغل الناشر بيوم دوام", () => {
    const cards = expandPipeline(
      [
        {
          companyId: "c",
          type: "POST",
          assigneeId: "designer",
          publishDate: "2026-09-05", // السبت
          readyDate: "2026-09-03",
          workDate: "2026-09-03",
          week: 1,
          status: "NOT_STARTED",
        },
      ],
      {
        writerId: null,
        publisherId: "publisher",
        year: 2026,
        month: 8,
        companyName: () => "شركة",
        writerWorkDays: WORK_WEEK,
        publisherWorkDays: WORK_WEEK,
      },
    );
    const publish = cards.find((t) => t.stage === "PUBLISH")!;
    expect(publish.publishDate).toBe("2026-09-05"); // تقويم العميل ما تحرّك
    const workDay = new Date(`${publish.workDate}T00:00:00`).getDay();
    expect(WORK_WEEK).toContain(workDay); // والشغل نزل على يوم دوام
    expect(publish.workDate).toBe("2026-09-03"); // الخميس
  });
});
