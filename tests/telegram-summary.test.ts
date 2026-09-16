/**
 * جملة «الشركة والعدد والنوع» المشتركة بين رسالة الصباح وتقرير المساء (١٦/٩).
 */
import { describe, expect, it } from "vitest";
import { countByCompany, kindWordOf, lateByCompanyLine, typesByCompany } from "../src/lib/telegram/summary";
import type { Task } from "../src/types";

const t = (o: Record<string, unknown>) => ({ kind: "CONTENT", status: "NOT_STARTED", companyId: "c1", ...o }) as unknown as Task;
const name = (x: Task) => ({ c1: "وصل", c2: "التوظيف", c3: "التدريب" })[x.companyId as string] ?? "—";

describe("كلمة النوع", () => {
  it("القطعة بنوعها، واليدوي بعنوانه، والمتابعة عند الناشر «متابعة»", () => {
    expect(kindWordOf(t({ type: "POST" }))).toBe("بوست");
    expect(kindWordOf(t({ kind: "ADHOC", type: null, stage: null, title: "تصميم بوست-1 · Phoenitech" }))).toBe("بوست");
    expect(kindWordOf(t({ kind: "ADHOC", type: null, stage: "DESIGN", title: "ستوري-9-1 · وصل" }))).toBe("ستوري");
    expect(kindWordOf(t({ kind: "ADHOC", type: null, stage: "DESIGN", title: "تصميم إعلان: التحول الرقمي" }))).toBe("تصميم");
    expect(kindWordOf(t({ kind: "ADHOC", type: null, stage: "PUBLISH", title: "Outreach 10 شركات" }))).toBe("متابعة");
    expect(kindWordOf(t({ kind: "ADHOC", type: null, stage: "WRITE", title: "كتابة الخطة" }))).toBe("كتابة");
  });
});

describe("التجميع", () => {
  it("بالشركة ثم العدد بالنوع، الأكثر أولاً، وسقف الشركات", () => {
    const list = [
      t({ type: "POST" }), t({ type: "POST", companyId: "c2" }), t({ type: "POST", companyId: "c2" }),
      t({ type: "STORY", companyId: "c2" }), t({ kind: "ADHOC", type: null, stage: "DESIGN", companyId: "c3", title: "تصميم إعلان" }),
      t({ kind: "ADHOC", type: null, stage: "DESIGN", companyId: null, title: "متابعة مهام التصوير · —" }),
    ];
    expect(countByCompany(list, name)).toBe("التوظيف 2 بوست و1 ستوري · وصل 1 بوست · التدريب 1 تصميم · متابعة مهام التصوير");
    expect(countByCompany(list, name, 2)).toBe("التوظيف 2 بوست و1 ستوري · وصل 1 بوست · وغيرها");
  });

  it("النشر بالشركة ونوع المحتوى فقط", () => {
    const list = [t({ type: "POST" }), t({ type: "STORY" }), t({ type: "POST" }), t({ type: "REEL", companyId: "c2" })];
    expect(typesByCompany(list, name)).toBe("وصل (بوست، ستوري) · التوظيف (ريل)");
  });

  it("المتأخر بالعدد بالشركة", () => {
    const list = [t({}), t({}), t({ companyId: "c2" })];
    expect(lateByCompanyLine(list, name)).toBe("3 — وصل 2 · التوظيف 1");
  });
});
