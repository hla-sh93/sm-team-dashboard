/**
 * عدد كروت الكتابة لكل (شخص، شركة، دورة) — نفس المقسوم عليه يلي بيستعمله طابور اليوم
 * (`selectDailyWork` ← `writeScopeCounts` على كروت الصفحة غير الملغاة). بلاه، حمل الدلاء
 * التانية ودفتر السلسلة كانوا يعدّوا كل كرت خطة يوم كامل: كرتين لنفس الشركة = ٤ أيام بدل ٢
 * (فحص ٣٠/١٠).
 *
 * بلا `"use server"`: بيناديه السيرفر بس.
 */
import type { Task } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeScopeCounts } from "@/lib/daily-work";

export async function loadWriteScopeCounts(assigneeIds: string[]): Promise<Map<string, number>> {
  if (!assigneeIds.length) return new Map();
  const rows = await prisma.task.findMany({
    where: {
      assigneeId: { in: assigneeIds },
      status: { not: "CANCELED" },
      OR: [{ stage: "WRITE" }, { kind: "CONTENT_WRITING" }],
    },
    select: { stage: true, kind: true, assigneeId: true, companyId: true, year: true, month: true },
  });
  return writeScopeCounts(rows as unknown as Task[]);
}
