/**
 * المسمّيات (خطة التحسينات E، ٢٩/١٠): «ما عنا قائد، عنا مسؤول أو مشرف … خليها user friendly».
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BOARD_LABELS, ROLE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { LEAD_TITLE, isLeadRole } from "@/lib/labels";

describe("المسمّيات", () => {
  it("دور المسؤولة من مكان واحد، والمحفوظ بالمفتاح بيضل يتعرّف عليه", () => {
    expect(ROLE_LABELS.lead).toBe(LEAD_TITLE);
    expect(isLeadRole("lead")).toBe(true);
    expect(isLeadRole(LEAD_TITLE)).toBe(true); // لو انكتب المسمّى نصّاً بسكربت
    expect(Object.values(ROLE_LABELS).join(" ")).not.toMatch(/ليدر|قائد/);
  });

  it("عمود «لم تبدأ» ما بيلتبس مع «بانتظار مرحلة سابقة»", () => {
    expect(BOARD_LABELS.TODO).not.toMatch(/انتظار/);
    expect(STATUS_LABELS.NOT_STARTED).toBe(BOARD_LABELS.TODO);
  });

  it("ولا شاشة بتقول «القائد/ة» أو «تيم ليدر» للناس (التعليقات والدليل المخزّن مستثنين)", () => {
    const files = [
      "src/app/today/today-client.tsx",
      "src/components/reports/PeriodReportView.tsx",
      "src/lib/telegram/brief.ts",
      "src/components/Sidebar.tsx",
    ];
    for (const f of files) {
      const code = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
        .join("\n");
      expect(code, f).not.toMatch(/القائدة?(?![\s\d٠-٩]*\/)|تيم ليدر/);
    }
  });
});
