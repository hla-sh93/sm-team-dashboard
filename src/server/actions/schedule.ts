"use server";

import { prisma } from "@/lib/db";
import { buildSchedule } from "@/lib/scheduler";
import { expandPipeline, type PipelineTask } from "@/lib/pipeline";
import { applyPipelinePreservation } from "@/lib/pipeline-preservation";
import { isTrainerSuppliedContentCompany } from "@/lib/content-source";
import { loadState } from "@/lib/schedule-data";
import { companyCycle, contractDayOf, formatDateShort, parseWorkDays } from "@/lib/dates";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/", "layout");
}

const D = (s: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Reported June 2026 reality (per company|type), in PIECE order by publish date:
//   published → the piece is published (publish card DONE),
//   review    → produced, awaiting approval (design/shoot in REVIEW),
//   doing     → in progress, e.g. reels shot but not yet delivered (DOING).
// Anything beyond these counts stays TODO. Later months start empty (all TODO).
type JuneState = { published?: number; review?: number; doing?: number };
const JUNE_2026: Record<string, JuneState> = {
  "c_phoenitech|POST": { published: 4 }, // فوني تيك — كله منجز
  "c_phoenitech|REEL": { published: 2 }, // 2 منشورة · 2 بانتظار التصوير
  "c_training|POST": { published: 7 }, // التدريب — منجز
  "c_noor|POST": { published: 6 }, // المخبر — كل البوستات منشورة
  "c_noor|REEL": { published: 3 }, // 3 ريل منشورة · 3 بانتظار التصوير (TODO)
  "c_bw|POST": { published: 4 },
  "c_bw|REEL": { published: 2, doing: 2 }, // 2 منشورة · 2 مصوّرة لم تُسلّم
  "c_mall|POST": { published: 2 }, // المول — 2 بوست منجز
  "c_mall|REEL": { published: 2 }, // 2 ريل منجز
  "c_pro|POST": { published: 1 }, // برو — بوست 1 منشور · 2 متبقّي (TODO)
  "c_pro|STORY": { published: 1 }, // ستوري 1 منشور · 11 متبقّي (TODO)
  "c_pro|REEL": { published: 6, doing: 1 }, // 6 منشورة · 1 مصوّر لم يُسلّم · 1 بانتظار
  "c_jadarat|POST": { review: 6 }, // جدارات — التصاميم بانتظار المراجعة
  "c_jadarat|AI_REEL": { review: 3 }, // أول 3 ريلات بانتظار المراجعة
};
function achievementsFor(year: number, month: number): Record<string, JuneState> {
  return year === 2026 && month === 5 ? JUNE_2026 : {};
}

/**
 * Stamp reported reality onto the pipeline: for each (company,type), the first
 * `published` pieces become DONE (and their PUBLISH card PUBLISHED), the next
 * `review` go to REVIEW (awaiting approval), the next `doing` go to DOING
 * (in progress). Writer cards stay independent and must be completed explicitly.
 */
function applyAchievements(pipe: PipelineTask[], state: Record<string, JuneState>) {
  const publishByKey = new Map<string, PipelineTask>();
  for (const c of pipe) {
    if (c.stage === "PUBLISH" && c.pipelineKey) publishByKey.set(c.pipelineKey, c);
  }
  const groups = new Map<string, PipelineTask[]>();
  for (const c of pipe) {
    if (c.stage === "DESIGN" || c.stage === "SHOOT") {
      const k = `${c.companyId}|${c.type}`;
      const arr = groups.get(k) ?? [];
      arr.push(c);
      groups.set(k, arr);
    }
  }
  for (const [k, arr] of groups) {
    const st = state[k];
    if (!st) continue;
    arr.sort(
      (a, b) =>
        (a.publishDate ?? "").localeCompare(b.publishDate ?? "") || a.id.localeCompare(b.id),
    );
    let i = 0;
    for (let n = st.published ?? 0; n > 0 && i < arr.length; n--, i++) {
      const c = arr[i];
      c.board = "DONE";
      c.status = "READY";
      const p = publishByKey.get(c.pipelineKey ?? "");
      if (p) {
        p.board = "DONE";
        p.status = "PUBLISHED";
      }
    }
    for (let n = st.review ?? 0; n > 0 && i < arr.length; n--, i++) {
      arr[i].board = "REVIEW";
      arr[i].status = "AWAITING_APPROVAL";
    }
    for (let n = st.doing ?? 0; n > 0 && i < arr.length; n--, i++) {
      arr[i].board = "DOING";
      arr[i].status = "IN_PROGRESS";
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
    const writerWorkDays = parseWorkDays(
      state.employees.find((e) => e.id === writerId)?.workDays as string | number[]
    );
    const publisherId =
      state.employees.find((e) => /ناشر|نشر|publisher/i.test(e.role))?.id ?? null;
    const coName = (id: string) => state.companies.find((c) => c.id === id)?.name ?? "";
    const trainerSuppliedContent = (id: string) =>
      isTrainerSuppliedContentCompany(state.companies.find((c) => c.id === id));
    // Contract-cycle label for the writer's plan card (e.g. "دورة 20 حزيران – 19
    // تموز"). end is exclusive, so the last shown day is end − 1.
    const cycleLabel = (id: string) => {
      const co = state.companies.find((c) => c.id === id);
      if (!co) return null;
      const { start, end } = companyCycle(year, month, contractDayOf(co.contractStartDate));
      const last = new Date(end);
      last.setDate(last.getDate() - 1);
      return `دورة ${formatDateShort(start)} – ${formatDateShort(last)}`;
    };
    const iso = (d: Date | null) =>
      d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : null;

    const items = result.tasks
      .filter((t) => t.kind === "CONTENT" && t.companyId && t.type)
      .map((t) => ({
        id: t.detKey,
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
      cycleLabel,
      writerWorkDays,
      idPrefix: `${year}_${month}_`, // namespace ids per month (avoid PK clashes)
      skipWritingForCompany: trainerSuppliedContent,
    });
    applyAchievements(pipe, achievementsFor(year, month));

    // Preserve manual edits from a prior run (matched by pipelineKey+stage).
    // Board/status are always kept; for cards the user PINNED (manual edit via
    // the card's تعديل) we also keep their title / dates / owner / priority so
    // hitting إعادة الجدولة never throws the edit away.
    const existing = await prisma.task.findMany({
      where: { isAuto: true, year, month },
      select: {
        pipelineKey: true,
        stage: true,
        board: true,
        status: true,
        isPinned: true,
        title: true,
        workDate: true,
        readyDate: true,
        assigneeId: true,
        priority: true,
        quantity: true,
        companyId: true,
        type: true,
        publishDate: true,
        kind: true,
      },
    });
    applyPipelinePreservation(pipe, existing);

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
          isPinned: t.isPinned ?? false,
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

    }, {
      // The atomic replace above is only a few queries (deleteMany + createMany),
      // but give it generous head-room so a slow connection (e.g. Neon) can't trip
      // Prisma's default 5s interactive-transaction limit → "Transaction not found".
      maxWait: 15000,
      timeout: 30000,
    });

    // Stamp ad-hoc tasks' computed workDate/overflow AFTER the transaction. These
    // are independent best-effort updates (ad-hoc rows are isAuto=false, untouched
    // by the replace); keeping the per-row loop OUT of the interactive transaction
    // is what prevents it from timing out when there are many of them.
    for (const a of adhocTasks) {
      if (!a.sourceId) continue;
      await prisma.task.update({
        where: { id: a.sourceId },
        data: { workDate: a.workDate, overflow: a.overflow },
      });
    }

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
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: `فشل توليد الجدول — ${detail}` };
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
