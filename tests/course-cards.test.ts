/**
 * حساب كروت الدورات (`src/lib/course-cards.ts`) — خالص بلا قاعدة بيانات.
 *
 * القواعد المثبَّتة هون هي قواعد القائدة: النشر قبل الدورة بعشرة أيام وينزلق
 * لأقرب يوم دوام **قبله**؛ يوم التصميم قرارها وما بيوقع بعطلة المصمّم ولا بعد
 * النشر؛ وأقل من يومين بين التصميم والنشر = مستعجل.
 */
import { describe, expect, it } from "vitest";
import { courseCardBucket, planCourseCards } from "../src/lib/course-cards";
import { toISODate } from "../src/lib/dates";

const SUN_THU = [0, 1, 2, 3, 4];
const SAT_WED = [6, 0, 1, 2, 3];
const designer = { id: "d1", name: "المصمّمة", workDays: SUN_THU };
const publisher = { id: "p1", name: "الناشر", workDays: SUN_THU };

const item = (over: Partial<Parameters<typeof planCourseCards>[0]["items"][number]> = {}) => ({
  slug: "digital",
  title: "البرنامج التدريبي التحول الرقمي",
  start: "2026-10-11",
  end: "2026-10-15",
  details: "15 ساعة · أ. عيد تايه · 40 $",
  designOn: "2026-09-16",
  designHours: 2,
  ...over,
});

describe("كروت الدورات", () => {
  it("دورة الأحد ١١/١٠: النشر الخميس ١/١٠ والتصميم الأربعاء ١٦/٩ — كرتان بمعرّفين ثابتين", () => {
    const plan = planCourseCards({ publishDaysBefore: 10, items: [item()] }, designer, publisher);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.cards.map((c) => c.id)).toEqual(["course_digital_design", "course_digital_publish"]);
    const [design, publish] = plan.cards;
    expect(toISODate(design.workDate)).toBe("2026-09-16");
    expect(toISODate(design.readyDate)).toBe("2026-09-16");
    expect(design.publishDate).toBeNull();
    expect(design.assigneeId).toBe("d1");
    expect(design.hours).toBe(2);
    expect(design.priority).toBe("NORMAL");
    expect(design.title).toBe("تصميم إعلان: البرنامج التدريبي التحول الرقمي");
    expect(design.brief).toContain("تبدأ 2026-10-11 وتنتهي 2026-10-15");
    expect(design.brief).toContain("أ. عيد تايه");
    expect(toISODate(publish.publishDate!)).toBe("2026-10-01");
    expect(toISODate(publish.workDate)).toBe("2026-10-01");
    expect(publish.assigneeId).toBe("p1");
    expect(publish.hours).toBe(0.5);
    // الدلو من موعد الاستحقاق: التصميم بأيلول والنشر بتشرين الأول.
    expect(courseCardBucket(design)).toEqual({ month: 8, year: 2026, week: 3 });
    expect(courseCardBucket(publish)).toEqual({ month: 9, year: 2026, week: 1 });
  });

  it("«قبل الدورة بعشرة أيام» بيوقع بعطلة الناشر → بيرجع لأقرب يوم دوام قبله", () => {
    // ناشر بيداوم السبت→الأربعاء: ٢٠/٩ − ١٠ = الخميس ١٠/٩ → الأربعاء ٩/٩.
    const plan = planCourseCards(
      { publishDaysBefore: 10, items: [item({ start: "2026-09-20", end: undefined, designOn: "2026-09-06" })] },
      designer,
      { ...publisher, workDays: SAT_WED },
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(toISODate(plan.cards[1].publishDate!)).toBe("2026-09-09");
  });

  it("ورشة السبت ٣١/١٠ → النشر الأربعاء ٢١/١٠ (يوم دوام أصلاً، ما بينزلق)", () => {
    const plan = planCourseCards(
      { publishDaysBefore: 10, items: [item({ slug: "shop", start: "2026-10-31", end: undefined, designOn: "2026-09-17" })] },
      designer,
      publisher,
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(toISODate(plan.cards[1].publishDate!)).toBe("2026-10-21");
  });

  it("يوم تصميم بعطلة المصمّمة (الجمعة) → الحمولة مرفوضة باسمها", () => {
    const plan = planCourseCards({ publishDaysBefore: 10, items: [item({ designOn: "2026-09-18" })] }, designer, publisher);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain("ليس يوم دوام لـالمصمّمة");
  });

  it("تصميم بعد النشر أو يومه → مرفوض", () => {
    const plan = planCourseCards({ publishDaysBefore: 10, items: [item({ designOn: "2026-10-01" })] }, designer, publisher);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain("ليس قبل النشر 2026-10-01");
  });

  it("يوم واحد بين التصميم والنشر → الكرت مستعجل (قاعدة اليومين)", () => {
    const plan = planCourseCards({ publishDaysBefore: 10, items: [item({ designOn: "2026-09-30" })] }, designer, publisher);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.cards[0].priority).toBe("URGENT");
  });

  it("معرّف مكرّر أو نهاية قبل البداية → مرفوض بكل المشاكل دفعة وحدة", () => {
    const plan = planCourseCards(
      { publishDaysBefore: 10, items: [item(), item({ end: "2026-10-01" })] },
      designer,
      publisher,
    );
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain("معرّف دورة مكرّر");
    expect(plan.error).toContain("قبل بدايتها");
  });

  it("بوستر الشهر: كرت تصميم واحد بلا كرت نشر", () => {
    const plan = planCourseCards(
      {
        publishDaysBefore: 10,
        items: [item()],
        poster: { slug: "schedule-2026-10", title: "تصميم جدول برامج تشرين الأول — التدريب", designOn: "2026-09-17", hours: 3 },
      },
      designer,
      publisher,
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const poster = plan.cards.find((c) => c.id === "course_schedule-2026-10_design");
    expect(poster).toBeDefined();
    expect(poster!.stage).toBe("DESIGN");
    expect(poster!.hours).toBe(3);
    expect(poster!.title).toBe("تصميم جدول برامج تشرين الأول — التدريب");
    expect(plan.cards.filter((c) => c.id.includes("schedule-2026-10"))).toHaveLength(1);
  });
});
