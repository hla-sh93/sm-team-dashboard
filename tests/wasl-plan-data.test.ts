import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plan = JSON.parse(
  readFileSync("scripts/data/wasl-plan-2026-09.json", "utf8"),
) as {
  items: Array<{ type: string; pieceNo: number; brief: string }>;
  prepareOn: { date: string; items: Array<{ type: string; pieceNo: number }> };
  publishOn: { date: string; item: { type: string; pieceNo: number } };
};

describe("Wasl September plan payload", () => {
  it("matches the verified plan quantities with no blank or duplicate piece", () => {
    const count = (type: string) => plan.items.filter((item) => item.type === type).length;
    expect(count("REEL")).toBe(8);
    expect(count("POST")).toBe(15);
    expect(count("STORY")).toBe(20);
    expect(plan.items.every((item) => item.brief.trim().length > 0)).toBe(true);
    const keys = plan.items.map((item) => `${item.type}|${item.pieceNo}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("pins exactly the six requested Ayman designs and the first publication date", () => {
    expect(plan.prepareOn.date).toBe("2026-08-30");
    expect(plan.prepareOn.items).toEqual([
      { type: "POST", pieceNo: 1 },
      { type: "POST", pieceNo: 2 },
      { type: "POST", pieceNo: 3 },
      { type: "STORY", pieceNo: 1 },
      { type: "STORY", pieceNo: 2 },
      { type: "STORY", pieceNo: 3 },
    ]);
    expect(plan.publishOn).toEqual({
      date: "2026-09-01",
      item: { type: "POST", pieceNo: 1 },
    });
  });
});
