/**
 * «جاهز ولا بانتظار؟» (`lib/readiness.ts`) — القائدة ٢٩/١٠: «بدي الموظفين يشوفو اسم بانتظار».
 * اللوح كان بيقرا الحاجز المباشر بس؛ هون السلسلة كاملة + صاحب الحاجز + هل السيرفر بيقبل الإقفال.
 */
import { describe, it, expect, vi } from "vitest";
import { makeReadiness } from "@/lib/readiness";
import { makeBlockedPredicate } from "@/lib/daily-work";
import { isTaskDoneState } from "@/lib/constants";

const t = (id: string, o: Record<string, unknown> = {}) =>
  ({
    id,
    kind: "CONTENT",
    type: "REEL",
    stage: "DESIGN",
    status: "NOT_STARTED",
    board: "TODO",
    blockedById: null,
    assigneeId: `${id}-owner`,
    completedAt: null,
    finishedAt: null,
    ...o,
  }) as never;

const done = { status: "READY", board: "DONE" };

describe("makeReadiness", () => {
  it("بلا حاجز ← جاهز؛ منجز ← منجز", () => {
    const r = makeReadiness([t("a"), t("b", done)]);
    expect(r(t("a")).state).toBe("ready");
    expect(r(t("b", done)).state).toBe("done");
  });

  it("الحاجز المباشر منجز بس قبله مفتوح ← بانتظار **الأبعد** وصاحبه (اللوح القديم كان يقول جاهز)", () => {
    const write = t("w", { stage: "WRITE", ...done });
    const shoot = t("s", { stage: "SHOOT", blockedById: "w", assigneeId: "majed" });
    const edit = t("e", { stage: "EDIT", blockedById: "s", ...done, assigneeId: "lilas" });
    const publish = t("p", { stage: "PUBLISH", kind: "CONTENT", blockedById: "e", assigneeId: "omar" });
    const r = makeReadiness([write, shoot, edit, publish])(publish);
    expect(r.state).toBe("waiting");
    if (r.state === "waiting") {
      expect((r.blocker as { id: string }).id).toBe("s");
      expect(r.blockerOwnerId).toBe("majed");
      expect(r.canClose).toBe(true); // النشر دليل — السيرفر بيقبل إقفاله
    }
  });

  it("مونتاج ورا تصوير مفتوح ← ما بينسكّر (نفس رفض السيرفر)", () => {
    const shoot = t("s", { stage: "SHOOT" });
    const edit = t("e", { stage: "EDIT", blockedById: "s" });
    const r = makeReadiness([shoot, edit])(edit);
    expect(r).toMatchObject({ state: "waiting", canClose: false });
  });

  it("ورا كرت كتابة مفتوح ← بانتظار، بس الإقفال مسموح (§٦، OP-10)", () => {
    const write = t("w", { stage: "WRITE", kind: "CONTENT_WRITING" });
    const design = t("d", { stage: "DESIGN", blockedById: "w" });
    expect(makeReadiness([write, design])(design)).toMatchObject({ state: "waiting", canClose: true });
  });

  it("كتابة مفتوحة ورا مرحلة منجزة ما بتحجز (نفس firstOpenBlocker)", () => {
    const write = t("w", { stage: "WRITE" });
    const design = t("d", { stage: "DESIGN", blockedById: "w", ...done });
    const publish = t("p", { stage: "PUBLISH", blockedById: "d" });
    expect(makeReadiness([write, design, publish])(publish).state).toBe("ready");
  });

  it("حاجز ممحي ← جاهز؛ دورة بالداتا ما بتعلّق", () => {
    expect(makeReadiness([t("x", { blockedById: "gone" })])(t("x", { blockedById: "gone" })).state).toBe("ready");
    const a = t("a", { blockedById: "b", ...done });
    const b = t("b", { blockedById: "a", ...done });
    const c = t("c", { blockedById: "a" });
    expect(makeReadiness([a, b, c])(c).state).toBe("ready");
  });
});

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-readiness-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

describe.skipIf(!scratch.available)("مطابقة على كل كروت dev.db", () => {
  it("«بانتظار» = بالضبط «محجوز» تبع طابور اليوم والتأخير، لكل كرت مفتوح", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
    const prisma = new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } });
    try {
      const all = (await prisma.task.findMany()) as never[];
      const readiness = makeReadiness(all);
      const blocked = makeBlockedPredicate(all);
      let waiting = 0;
      for (const task of all) {
        const r = readiness(task);
        if (isTaskDoneState(task)) expect(r.state).toBe("done");
        else {
          expect(r.state === "waiting").toBe(blocked(task));
          if (r.state === "waiting") waiting++;
        }
      }
      expect(all.length).toBeGreaterThan(0);
      expect(waiting).toBeGreaterThanOrEqual(0);
    } finally {
      await prisma.$disconnect();
      const { rmSync, existsSync } = await import("node:fs");
      for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
    }
  });
});
