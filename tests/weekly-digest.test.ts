import { describe, expect, it } from "vitest";
import { buildWeeklyPublishDigest } from "../src/lib/telegram/weekly";
import { toISODate } from "../src/lib/dates";
import type { Company, Task } from "../src/types";

const co = (id: string, name: string) => ({ id, name, managed: true }) as unknown as Company;

const task = (o: Omit<Partial<Task>, "publishDate"> & { publishDate: string }) =>
  ({
    id: `t_${o.publishDate}_${o.type}_${o.companyId}_${o.pieceNo ?? 1}`,
    kind: "CONTENT",
    stage: "PUBLISH",
    status: "NOT_STARTED",
    board: "TODO",
    type: "POST",
    month: 7,
    year: 2026,
    pieceNo: 1,
    ...o,
    publishDate: new Date(o.publishDate),
  }) as unknown as Task;

const COS = [co("c1", "أغاليا"), co("c2", "برو")];

describe("الملخّص الأسبوعي للنشر", () => {
  it("بيجمّع حسب اليوم ثم الشركة", () => {
    // 2026-08-08 سبت — أول أسبوع العمل.
    const d = buildWeeklyPublishDigest(new Date("2026-08-08"), COS, [
      task({ publishDate: "2026-08-08", companyId: "c1", type: "POST", pieceNo: 3 }),
      task({ publishDate: "2026-08-08", companyId: "c2", type: "REEL", pieceNo: 2 }),
      task({ publishDate: "2026-08-10", companyId: "c1", type: "STORY", pieceNo: 5 }),
    ]);
    expect(d.count).toBe(3);
    const text = d.text!;
    expect(text).toContain("جدول النشر");
    // اليومان بالترتيب، وكل شركة سطر واحد تحت يومها.
    expect(text.indexOf("أغاليا")).toBeLessThan(text.indexOf("برو"));
    expect(text.indexOf("8/8")).toBeLessThan(text.indexOf("10/8"));
  });

  it("بتتجاهل المنجز — الملخّص عن الجاي", () => {
    const d = buildWeeklyPublishDigest(new Date("2026-08-08"), COS, [
      task({ publishDate: "2026-08-09", companyId: "c1", status: "PUBLISHED", board: "DONE" }),
    ]);
    expect(d.count).toBe(0);
    expect(d.text).toBeNull();
  });

  it("بتتجاهل غير كروت النشر", () => {
    const d = buildWeeklyPublishDigest(new Date("2026-08-08"), COS, [
      task({ publishDate: "2026-08-09", companyId: "c1", stage: "DESIGN" }),
    ]);
    expect(d.count).toBe(0);
  });

  it("الأسبوع بيبلّش السبت ومهما كان اليوم يلي منسأل فيه", () => {
    // الأربعاء 12/8 لازم يعطي نفس أسبوع السبت 8/8.
    const wed = buildWeeklyPublishDigest(new Date("2026-08-12"), COS, []);
    expect(wed.from.getDay()).toBe(6);
    expect(toISODate(wed.from)).toBe("2026-08-08");
    // والخميس 13/8 هو آخر يوم — الجمعة برّا.
    expect(toISODate(wed.to)).toBe("2026-08-13");
  });

  it("الجمعة ما بتنطبع إطلاقاً — ما في نشر فيها", () => {
    const d = buildWeeklyPublishDigest(new Date("2026-08-08"), COS, [
      task({ publishDate: "2026-08-14", companyId: "c1" }), // جمعة
    ]);
    expect(d.count).toBe(0);
  });

  it("«next» بيعطي الأسبوع الجاي — حتى تنبعت يوم الخميس", () => {
    const d = buildWeeklyPublishDigest(new Date("2026-08-08"), COS, [], { next: true });
    expect(toISODate(d.from)).toBe("2026-08-15");
  });
});
