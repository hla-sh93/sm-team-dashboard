import { describe, expect, it } from "vitest";
import { buildContentNumbers } from "@/lib/cards";
import type { Task } from "@/types";

const piece = (
  id: string,
  month: number,
  publishDay: number,
  over: Partial<Task> = {},
): Task =>
  ({
    id,
    kind: "CONTENT",
    stage: "DESIGN",
    type: "AI_REEL",
    companyId: "c_jadarat",
    assigneeId: "e_ayman",
    pipelineKey: id,
    publishDate: new Date(2026, month, publishDay),
    quantity: 1,
    status: "NOT_STARTED",
    board: "TODO",
    year: 2026,
    month,
    ...over,
  }) as unknown as Task;

describe("buildContentNumbers — per-cycle numbering", () => {
  it("a stored pieceNo ALWAYS wins: the last open piece of a cycle keeps its number", () => {
    // June cycle had 6 stories; 5 published (archived — not loaded). The lone
    // open survivor carries pieceNo=6 from generation and must read ستوري-6,
    // NEVER be renumbered to 1 by the loaded-subset fallback.
    const survivor = piece("jun_last", 5, 30, { pieceNo: 6 } as never);
    const julyPlan = [1, 2, 3].map((i) => piece(`jul_${i}`, 6, 2 * i));
    const num = buildContentNumbers([survivor, ...julyPlan]);

    expect(num.get("jun_last")).toBe(6);
    expect(julyPlan.map((t) => num.get(t.id))).toEqual([1, 2, 3]);
  });

  it("restarts at 1 for each cycle bucket instead of counting across months", () => {
    // June leftovers (cycle bucket month=5) shown TOGETHER with July's plan
    // (month=6) — exactly the carryover view. A 6-piece July plan must read
    // AI-1..AI-6, never AI-7..AI-12.
    const june = [1, 2, 3].map((i) => piece(`jun_${i}`, 5, 10 + i));
    const july = [1, 2, 3, 4, 5, 6].map((i) => piece(`jul_${i}`, 6, 3 * i));
    const num = buildContentNumbers([...june, ...july]);

    expect(june.map((t) => num.get(t.id))).toEqual([1, 2, 3]);
    expect(july.map((t) => num.get(t.id))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("still shares one number across a piece's design and publish cards", () => {
    const design = piece("d1", 6, 9, { pipelineKey: "pk1" });
    const publish = piece("p1", 6, 9, { pipelineKey: "pk1", stage: "PUBLISH" });
    const other = piece("d2", 6, 15, { pipelineKey: "pk2" });
    const num = buildContentNumbers([design, publish, other]);

    expect(num.get("d1")).toBe(1);
    expect(num.get("p1")).toBe(1);
    expect(num.get("d2")).toBe(2);
  });
});
