import { describe, expect, it } from "vitest";
import { groupTasksIntoPieces } from "@/lib/cards";
import type { Task } from "@/types";

/**
 * القطعة كوحدة عرض واحدة (قرار القائدة 2/8/2026). القياس وقتها: 386 قطعة موزّعة
 * على 886 كرت، 94٪ منها بمسؤول مختلف لكل مرحلة — فالتجميع لازم يوحّد العرض
 * بلا ما يخلط المسؤولين ولا التواريخ.
 */
const task = (o: Partial<Task> & { id: string }): Task =>
  ({
    kind: "CONTENT", type: "REEL", title: null, hours: 0, quantity: 1,
    priority: "NORMAL", status: "NOT_STARTED", board: "TODO", stage: "SHOOT",
    pipelineKey: "p1", companyId: "c", assigneeId: "a", blockedById: null,
    year: 2026, month: 7, week: 1, pieceNo: 1, isPinned: false, isAuto: true,
    workDate: null, readyDate: null, publishDate: null, manualDay: null,
    detKey: null, notes: null, brief: null, completedAt: null, startedAt: null,
    finishedAt: null, reviewedAt: null, reviewedById: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...o,
  }) as Task;

const isDone = (t: Task) => t.board === "DONE";

describe("تجميع مراحل القطعة بكرت واحد", () => {
  const shoot = task({ id: "s", stage: "SHOOT", assigneeId: "majed" });
  const edit = task({ id: "e", stage: "EDIT", assigneeId: "elissar", blockedById: "s" });
  const pub = task({ id: "p", stage: "PUBLISH", assigneeId: "omar", blockedById: "e" });

  it("تلات مراحل بتصير كرت واحد", () => {
    const cards = groupTasksIntoPieces([shoot, edit, pub], isDone);
    expect(cards).toHaveLength(1);
    expect(cards[0].ids).toEqual(["s", "e", "p"]);
  });

  it("المراحل مرتّبة بترتيب خط الإنتاج مهما وصلت مبعثرة", () => {
    const cards = groupTasksIntoPieces([pub, edit, shoot], isDone);
    expect(cards[0].stages.map((s) => s.task.stage)).toEqual(["SHOOT", "EDIT", "PUBLISH"]);
  });

  it("«الدور عليه» أول مرحلة مو منجزة", () => {
    const done = { ...shoot, board: "DONE" } as Task;
    const cards = groupTasksIntoPieces([done, edit, pub], isDone);
    expect(cards[0].active?.task.id).toBe("e");
    expect(cards[0].repr.id).toBe("e");
  });

  it("المرحلة المحجوزة معلّمة كمحجوزة", () => {
    const cards = groupTasksIntoPieces([shoot, edit, pub], isDone);
    expect(cards[0].stages.find((s) => s.task.id === "e")!.blocked).toBe(true);
    expect(cards[0].stages.find((s) => s.task.id === "s")!.blocked).toBe(false);
  });

  it("النشر منفصل عن مراحل الإنتاج", () => {
    const cards = groupTasksIntoPieces([shoot, edit, pub], isDone);
    expect(cards[0].production.map((s) => s.task.stage)).toEqual(["SHOOT", "EDIT"]);
    expect(cards[0].publish?.task.id).toBe("p");
  });

  it("القطعة منجزة لما تخلص كل مراحلها", () => {
    const all = [shoot, edit, pub].map((t) => ({ ...t, board: "DONE" }) as Task);
    const cards = groupTasksIntoPieces(all, isDone);
    expect(cards[0].done).toBe(true);
    expect(cards[0].active).toBeNull();
  });

  it("مهمة بلا قطعة بتضل كرت لحالها", () => {
    const solo = task({ id: "x", pipelineKey: null, kind: "ADHOC", title: "فلاير" });
    const cards = groupTasksIntoPieces([shoot, edit, solo], isDone);
    expect(cards).toHaveLength(2);
    expect(cards.find((c) => c.ids.includes("x"))!.ids).toEqual(["x"]);
  });

  it("ما بيخلط قطعتين لنفس الشركة", () => {
    const other = task({ id: "s2", pipelineKey: "p2", pieceNo: 2 });
    const cards = groupTasksIntoPieces([shoot, other], isDone);
    expect(cards).toHaveLength(2);
  });

  it("الكمية مجموع كميات المراحل", () => {
    const cards = groupTasksIntoPieces([{ ...shoot, quantity: 5 } as Task], isDone);
    expect(cards[0].count).toBe(5);
  });
});
