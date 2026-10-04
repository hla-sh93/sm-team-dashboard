/**
 * تحميل بيانات تقرير الإنجاز الدوري — شوف `lib/period-report.ts` وWORK_RULES §١٠.
 *
 * بلا `"use server"` عن قصد: بتنادى من صفحة الأدمن المحمية بس، مو من المتصفح.
 * الكروت كلها (~١٥٠٠ صف) أرخص وأصدق من استعلام بنطاق: المتأخر المفتوح بيحتاج
 * كروتاً انسكّرت بعد الفترة، والمحجوز بيحتاج المرحلة يلي قبله.
 */
import { prisma } from "@/lib/db";
import { buildPeriodReport, type PeriodReport, type ReportPeriod } from "@/lib/period-report";

export async function loadPeriodReport(period: ReportPeriod, now: Date = new Date()): Promise<PeriodReport> {
  const [employees, companies, tasks, deliveries] = await Promise.all([
    prisma.employee.findMany({
      select: { id: true, name: true, role: true, isPhotographer: true, isScheduled: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.company.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        photographerId: true,
        lateExemptReason: true,
        contractStartDate: true,
        publishStartDate: true,
        renewals: true,
        contractEndedAt: true,
      },
    }),
    prisma.task.findMany({
      where: { status: { not: "CANCELED" } },
      select: {
        id: true,
        kind: true,
        type: true,
        stage: true,
        title: true,
        pieceNo: true,
        status: true,
        board: true,
        assigneeId: true,
        companyId: true,
        year: true,
        month: true,
        publishDate: true,
        readyDate: true,
        workDate: true,
        manualDay: true,
        isPinned: true,
        blockedById: true,
        finishedAt: true,
        completedAt: true,
        notes: true,
      },
    }),
    prisma.telegramMessage.findMany({
      where: { taskId: { not: null }, kind: { not: "TEXT" } },
      select: { taskId: true, sentAt: true },
    }),
  ]);

  return buildPeriodReport({
    period,
    tasks,
    employees,
    companies,
    deliveries: deliveries.map((d) => ({ taskId: d.taskId as string, sentAt: d.sentAt })),
    now,
  });
}
