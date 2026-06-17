import { describe, it, expect } from "vitest";
import { toCSV, BOM } from "@/lib/csv";

describe("§9 criterion 12 — CSV export", () => {
  it("prefixes a UTF-8 BOM so Excel renders Arabic", () => {
    const csv = toCSV(["الاسم", "ساعات"], [["أيمن", 6]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain("أيمن");
  });

  it("escapes commas, quotes and newlines", () => {
    const csv = toCSV(["a"], [['x,y'], ['he said "hi"'], ["line\nbreak"]]);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"he said ""hi"""');
    expect(csv).toContain('"line\nbreak"');
  });

  it("uses CRLF row separators", () => {
    const csv = toCSV(["a", "b"], [["1", "2"]]);
    expect(csv).toContain("\r\n");
  });
});
