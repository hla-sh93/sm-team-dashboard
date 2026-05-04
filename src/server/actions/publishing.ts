"use server";

import { fromISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { generateMonthPublishingSchedule } from "@/lib/publishing";
import {
  publishingItemSchema,
  type PublishingItemInput,
} from "@/lib/schemas";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/publishing");
  revalidatePath("/calendar");
  revalidatePath("/tasks");
  revalidatePath("/reports");
}

export async function createPublishingItem(input: PublishingItemInput) {
  const parsed = publishingItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة",
    };
  }
  try {
    const publishDate = fromISODate(parsed.data.publishDate);
    const targetMonth = `${publishDate.getFullYear()}-${String(
      publishDate.getMonth() + 1,
    ).padStart(2, "0")}`;
    const isPublished = parsed.data.status === "published";
    const item = await prisma.publishingItem.create({
      data: {
        contentType: parsed.data.contentType,
        publishDate,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
        companyId: parsed.data.companyId,
        taskId: parsed.data.taskId ?? null,
        isAuto: false,
        targetMonth,
        publishedAt: isPublished ? new Date() : null,
      },
    });
    revalidateAll();
    return { ok: true as const, data: item };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "فشل إنشاء عنصر النشر" };
  }
}

export async function updatePublishingItem(
  id: string,
  input: PublishingItemInput,
) {
  const parsed = publishingItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة",
    };
  }
  try {
    const before = await prisma.publishingItem.findUnique({ where: { id } });
    if (!before) {
      return { ok: false as const, error: "العنصر غير موجود" };
    }
    const publishDate = fromISODate(parsed.data.publishDate);
    const targetMonth = `${publishDate.getFullYear()}-${String(
      publishDate.getMonth() + 1,
    ).padStart(2, "0")}`;
    const isPublished = parsed.data.status === "published";
    const wasPublished = before.status === "published";
    const item = await prisma.publishingItem.update({
      where: { id },
      data: {
        contentType: parsed.data.contentType,
        publishDate,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
        companyId: parsed.data.companyId,
        taskId: parsed.data.taskId ?? null,
        targetMonth,
        // Stamp/clear publishedAt to mirror the status transition.
        publishedAt: isPublished
          ? (before.publishedAt ?? new Date())
          : wasPublished
            ? null
            : before.publishedAt,
      },
    });
    revalidateAll();
    return { ok: true as const, data: item };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "فشل تحديث العنصر" };
  }
}

export async function deletePublishingItem(id: string) {
  try {
    await prisma.publishingItem.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: "فشل الحذف" };
  }
}

export async function updatePublishingItemStatus(id: string, status: string) {
  if (!["scheduled", "published"].includes(status)) {
    return { ok: false as const, error: "حالة غير صالحة" };
  }
  try {
    const before = await prisma.publishingItem.findUnique({ where: { id } });
    if (!before) return { ok: false as const, error: "العنصر غير موجود" };

    const isPublished = status === "published";
    const wasPublished = before.status === "published";

    await prisma.publishingItem.update({
      where: { id },
      data: {
        status,
        publishedAt: isPublished
          ? (before.publishedAt ?? new Date())
          : wasPublished
            ? null
            : before.publishedAt,
      },
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: "فشل تحديث الحالة" };
  }
}

/**
 * Auto-generate the publishing schedule for a target month.
 * Mirrors the production scheduler's preservation rules:
 *   - PENDING auto-items (scheduled) for this month are wiped and re-built.
 *   - Manual items (any status) and already-published items are preserved.
 *   - Published items count against the company's quota so we don't double-book.
 *
 * Each scheduled item is gated by the corresponding production task's end
 * date — i.e. we don't schedule "publish post #1 for Glamour" before the
 * designer is supposed to be done with it. The production tasks are fetched
 * here and passed to the algorithm.
 */
export async function autoSchedulePublishing(year: number, month: number) {
  try {
    const targetMonth = `${year}-${String(month + 1).padStart(2, "0")}`;

    await prisma.publishingItem.deleteMany({
      where: {
        isAuto: true,
        targetMonth,
        status: "scheduled",
      },
    });

    const companies = await prisma.company.findMany();

    // Pull production tasks targeting this month for all publishable types.
    // We use endDate as the gating signal regardless of task status — even
    // tasks still in_progress have a planned end date, and that's when the
    // publisher can plan to actually post.
    const productionTasks = await prisma.task.findMany({
      where: {
        targetMonth,
        type: { in: ["post", "reel_ai", "reel_video"] },
      },
      select: {
        id: true,
        companyId: true,
        type: true,
        endDate: true,
        status: true,
      },
    });

    const preservedDone = await prisma.publishingItem.findMany({
      where: {
        targetMonth,
        status: "published",
      },
      select: { companyId: true, contentType: true },
    });
    const preservedCounts: Record<
      string,
      { post: number; reel_ai: number; reel_video: number }
    > = {};
    for (const p of preservedDone) {
      const c =
        preservedCounts[p.companyId] ??
        (preservedCounts[p.companyId] = {
          post: 0,
          reel_ai: 0,
          reel_video: 0,
        });
      if (p.contentType === "post") c.post++;
      else if (p.contentType === "reel_ai") c.reel_ai++;
      else if (p.contentType === "reel_video") c.reel_video++;
    }

    const result = generateMonthPublishingSchedule(
      year,
      month,
      companies,
      productionTasks,
      preservedCounts,
    );

    if (result.items.length > 0) {
      await prisma.$transaction(
        result.items.map((it) =>
          prisma.publishingItem.create({
            data: {
              contentType: it.contentType,
              publishDate: it.publishDate,
              status: it.status,
              notes: it.notes,
              companyId: it.companyId,
              taskId: it.taskId,
              isAuto: it.isAuto,
              targetMonth: it.targetMonth,
            },
          }),
        ),
      );
    }

    revalidateAll();
    return {
      ok: true as const,
      stats: result.stats,
      warnings: result.warnings,
    };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "فشل توليد جدول النشر" };
  }
}

/**
 * Clear pending auto-generated publishing items for a month. Published items
 * are kept so the report stays accurate.
 */
export async function clearMonthPublishing(year: number, month: number) {
  const targetMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  try {
    const result = await prisma.publishingItem.deleteMany({
      where: {
        isAuto: true,
        targetMonth,
        status: "scheduled",
      },
    });
    revalidateAll();
    return { ok: true as const, count: result.count };
  } catch (e) {
    return { ok: false as const, error: "فشل الحذف" };
  }
}
