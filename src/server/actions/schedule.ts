"use server";

import { prisma } from "@/lib/db";
import { buildSchedule } from "@/lib/scheduler";
import { expandPipeline, type PipelineTask } from "@/lib/pipeline";
import { loadState } from "@/lib/schedule-data";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  for (const p of ["/", "/tasks", "/publishing", "/workload", "/reports"]) {
    revalidatePath(p);
  }
}

const D = (s: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Reported achievements per month → done counts per (companyId|type). June 2026
// = the team's reported progress; later months start empty (all TODO).
const JUNE_2026_DONE: Record<string, number> = {
  "c_bw|POST": 4, "c_bw|REEL": 3,
  "c_phoenitech|POST": 4, "c_phoenitech|REEL": 4,
  "c_noor|POST": 6, "c_noor|REEL": 1,
  "c_pro|REEL": 6,
  "c_mall|REEL": 2,
  "c_jadarat|POST": 6, "c_jadarat|AI_REEL": 3,
  "c_training|POST": 6,
};
function achievementsFor(year: number, month: number): Record<string, number> {
  return year === 2026 && month === 5 ? JUNE_2026_DONE : {};
}

/** Mark the first `done` design/shoot cards of each (company,type) as DONE, and
 *  their write card DONE — reflecting reported achievements. */
function applyAchievements(pipe: PipelineTask[], done: Record<string, number>) {
  const groups = new Map<string, PipelineTask[]>();
  for (const c of pipe) {
    if (c.stage === "DESIGN" || c.stage === "SHOOT") {
      const k = `${c.companyId}|${c.type}`;
      const arr = groups.get(k) ?? [];
      arr.push(c);
      groups.set(k, arr);
    }
  }
  const doneScopes = new Set<string>();
  for (const [k, arr] of groups) {
    arr.sort(
      (a, b) =>
        (a.publishDate ?? "").localeCompare(b.publishDate ?? "") ||
        a.id.localeCompare(b.id),
    );
    let acc = 0;
    const need = done[k] ?? 0;
    for (const c of arr) {
      if (acc < need) {
        c.board = "DONE";
        c.status = "READY";
        acc += c.quantity;
        doneScopes.add(`${c.companyId}|${c.stage === "SHOOT" ? "SHOOT" : "DESIGN"}`);
      }
    }
  }
  for (const c of pipe) {
    if (c.stage === "WRITE") {
      const scope = (c.pipelineKey ?? "").split("|")[1];
      if (doneScopes.has(`${c.companyId}|${scope}`)) {
        c.board = "DONE";
        c.status = "READY";
      }
    }
  }
}

/**
 * Auto-generate the month's full pipeline (كتابة → تصميم/تصوير → نشر) from the
 * companies' plans, apply reported achievements, and PRESERVE any manual board
 * moves from a previous run (matched by pipelineKey+stage). Ad-hoc tasks are
 * kept; only their computed workDate/overflow are written back. Re-run anytime
 * after adding/editing tasks, companies or plans — it reschedules everyone.
 */
export async function generateSchedule(year: number, month: number) {
  try {
    const state = await loadState(year, month);
    const result = buildSchedule(state);

    const writerId = state.employees.find((e) => /كات|writer/i.test(e.role))?.id ?? null;
    const publisherId =
      state.employees.find((e) => /ناشر|نشر|publisher/i.test(e.role))?.id ?? null;
    const coName = (id: string) => state.companies.find((c) => c.id === id)?.name ?? "";
    const iso = (d: Date | null) =>
      d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : null;

    const items = result.tasks
      .filter((t) => t.kind === "CONTENT" && t.companyId && t.type)
      .map((t) => ({
        companyId: t.companyId!,
        type: t.type as "POST" | "REEL" | "AI_REEL" | "STORY",
        assigneeId: t.assigneeId,
        publishDate: iso(t.publishDate),
        readyDate: iso(t.readyDate),
        workDate: iso(t.workDate),
        week: t.week,
        status: t.status,
      }));

    const pipe = expandPipeline(items, {
      writerId,
      publisherId,
      year,
      month,
      companyName: coName,
      idPrefix: `${year}_${month}_`, // namespace ids per month (avoid PK clashes)
    });
    applyAchievements(pipe, achievementsFor(year, month));

    // Preserve manual board/status edits from a prior run (deterministic keys).
    const existing = await prisma.task.findMany({
      where: { isAuto: true, year, month },
      select: { pipelineKey: true, stage: true, board: true, status: true },
    });
    const snap = new Map(existing.map((e) => [`${e.pipelineKey}|${e.stage}`, e]));
    for (const c of pipe) {
      const s = snap.get(`${c.pipelineKey}|${c.stage}`);
      if (s) {
        c.board = s.board as PipelineTask["board"];
        c.status = s.status;
      }
    }

    const adhocTasks = result.tasks.filter((t) => t.kind === "ADHOC");

    await prisma.$transaction(async (tx) => {
      // Replace generated cards + auto sessions (keep ad-hoc, isAuto=false).
      await tx.task.deleteMany({ where: { isAuto: true, year, month } });
      await tx.photoSession.deleteMany({ where: { isAuto: true, year, month } });

      await tx.task.createMany({
        data: pipe.map((t) => ({
          id: t.id,
          kind: t.kind,
          stage: t.stage,
          board: t.board,
          type: t.type,
          title: t.title,
          companyId: t.companyId,
          assigneeId: t.assigneeId,
          hours: 0,
          quantity: t.quantity,
          priority: t.priority,
          status: t.status,
          publishDate: D(t.publishDate),
          readyDate: D(t.readyDate),
          workDate: D(t.workDate),
          week: t.week,
          blockedById: t.blockedById,
          pipelineKey: t.pipelineKey,
          overflow: false,
          isAuto: true,
          completedAt: t.board === "DONE" ? new Date() : null,
          month,
          year,
        })),
      });

      if (result.sessions.length > 0) {
        await tx.photoSession.createMany({
          data: result.sessions.map((s) => ({
            no: s.no,
            kind: s.kind,
            shootDate: s.shootDate,
            deliverBy: s.deliverBy,
            reelCount: s.reelCount,
            status: s.status,
            month: s.month,
            year: s.year,
            isAuto: true,
            detKey: s.detKey,
            companyId: s.companyId,
          })),
        });
      }

      for (const a of adhocTasks) {
        if (!a.sourceId) continue;
        await tx.task.update({
          where: { id: a.sourceId },
          data: { workDate: a.workDate, overflow: a.overflow },
        });
      }
    });

    revalidateAll();
    const stages = {
      write: pipe.filter((p) => p.stage === "WRITE").length,
      design: pipe.filter((p) => p.stage === "DESIGN").length,
      shoot: pipe.filter((p) => p.stage === "SHOOT").length,
      publish: pipe.filter((p) => p.stage === "PUBLISH").length,
    };
    return { ok: true as const, stages, warnings: result.warnings };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "فشل توليد الجدول" };
  }
}

/** Clear generated cards + auto sessions for a month (keeps ad-hoc tasks). */
export async function clearMonthSchedule(year: number, month: number) {
  try {
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { isAuto: true, year, month } }),
      prisma.photoSession.deleteMany({ where: { isAuto: true, year, month } }),
    ]);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل الحذف" };
  }
}
