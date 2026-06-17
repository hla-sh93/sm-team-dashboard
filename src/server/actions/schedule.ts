"use server";

import { prisma } from "@/lib/db";
import { buildSchedule } from "@/lib/scheduler";
import { loadState } from "@/lib/schedule-data";
import {
  applyPreservedTasks,
  applyPreservedSessions,
  indexPreservedTasks,
  indexPreservedSessions,
} from "@/lib/persistence";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  for (const p of [
    "/",
    "/tasks",
    "/calendar",
    "/publishing",
    "/workload",
    "/reports",
  ]) {
    revalidatePath(p);
  }
}

/**
 * Generate + persist the month schedule (§5). Content tasks are regenerated
 * deterministically; status / completedAt / manual locks are preserved across
 * regenerations via the deterministic key (§9 criterion 10). Ad-hoc tasks are
 * never recreated — only their computed workDate/overflow are written back.
 */
export async function generateSchedule(year: number, month: number) {
  try {
    const state = await loadState(year, month);
    const result = buildSchedule(state);

    // Snapshot existing CONTENT tasks + auto sessions to preserve status/locks.
    const [existingContent, existingSessions] = await Promise.all([
      prisma.task.findMany({
        where: { kind: "CONTENT", year, month },
        select: {
          detKey: true,
          status: true,
          completedAt: true,
          isPinned: true,
          workDate: true,
        },
      }),
      prisma.photoSession.findMany({
        where: { isAuto: true, year, month },
        select: { detKey: true, status: true },
      }),
    ]);
    const preservedTasks = indexPreservedTasks(existingContent);
    const preservedSessions = indexPreservedSessions(existingSessions);

    const contentTasks = result.tasks.filter((t) => t.kind === "CONTENT");
    const adhocTasks = result.tasks.filter((t) => t.kind === "ADHOC");
    const mergedContent = applyPreservedTasks(contentTasks, preservedTasks);
    const mergedSessions = applyPreservedSessions(
      result.sessions,
      preservedSessions,
    );

    await prisma.$transaction(async (tx) => {
      // Replace content tasks and auto sessions for the month.
      await tx.task.deleteMany({ where: { kind: "CONTENT", year, month } });
      await tx.photoSession.deleteMany({ where: { isAuto: true, year, month } });

      if (mergedContent.length > 0) {
        await tx.task.createMany({
          data: mergedContent.map((t) => ({
            kind: "CONTENT",
            type: t.type,
            title: t.title,
            hours: t.hours,
            priority: t.priority,
            status: t.status,
            publishDate: t.publishDate,
            readyDate: t.readyDate,
            workDate: t.workDate,
            week: t.week,
            overflow: t.overflow,
            month: t.month,
            year: t.year,
            isPinned: t.isPinned,
            isAuto: true,
            detKey: t.detKey,
            companyId: t.companyId,
            assigneeId: t.assigneeId,
          })),
        });
      }

      if (mergedSessions.length > 0) {
        await tx.photoSession.createMany({
          data: mergedSessions.map((s) => ({
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

      // Write back ad-hoc placement (workDate / overflow) computed by the engine.
      for (const a of adhocTasks) {
        if (!a.sourceId) continue;
        await tx.task.update({
          where: { id: a.sourceId },
          data: { workDate: a.workDate, overflow: a.overflow },
        });
      }
    });

    revalidateAll();
    return {
      ok: true as const,
      stats: result.stats,
      warnings: result.warnings,
    };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "فشل توليد الجدول" };
  }
}

/** Clear generated content + auto sessions for a month (keeps ad-hoc tasks). */
export async function clearMonthSchedule(year: number, month: number) {
  try {
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { kind: "CONTENT", year, month } }),
      prisma.photoSession.deleteMany({ where: { isAuto: true, year, month } }),
    ]);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل الحذف" };
  }
}
