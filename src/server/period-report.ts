/**
 * تحميل بيانات تقرير الإنجاز الدوري — شوف `lib/period-report.ts` وWORK_RULES §١٠.
 *
 * بلا `"use server"` عن قصد: بتنادى من صفحة الأدمن المحمية بس، مو من المتصفح.
 * الكروت كلها (~١٥٠٠ صف) أرخص وأصدق من استعلام بنطاق: المتأخر المفتوح بيحتاج
 * كروتاً انسكّرت بعد الفترة، والمحجوز بيحتاج المرحلة يلي قبله.
 */
import { prisma } from "@/lib/db";
import { buildPeriodReport, type PeriodReport, type ReportPeriod } from "@/lib/period-report";
import { DELIVERY_MATCH_KINDS } from "@/lib/telegram/match";

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
        updatedAt: true,
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
      // تسليم انربط بكرته بس — مو ملف «من غير صاحب الكرت» محجوز للمراجعة (D3)،
      // ولا لقطة شاشة سكّرت كرت نشر.
      where: {
        taskId: { not: null },
        kind: { not: "TEXT" },
        confirmed: true,
        matchedBy: { in: DELIVERY_MATCH_KINDS },
      },
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
