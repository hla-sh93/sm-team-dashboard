/**
 * أرشفة الشركة يلي ما جدّدت — وإقفال كروتها تلقائياً.
 *
 * قرار القائدة (١٥/٩/٢٠٢٦): «كل شركة لم تجدّد تنحطّ بقسم الأرشيف، ما تنحطّ مع
 * الشركات النشطة، وكروتها تلقائياً بتتسكر. ما في داعي لأوقف النشر أو رجّع
 * النشر — هي تلقائياً واقفة».
 *
 * الإقفال هون **إلغاء** (`CANCELED`) لا إنجاز: الكرت ما انعمل، فوسمه منجزاً
 * بينفخ حصيلة أصحابه وتقارير «المنشور» (قاعدة الكلمتين). الإلغاء بيشيله من
 * كل قائمة حيّة وتأخير وعدّاد، وبيثبّته حتى ما ترجّعه إعادة الجدولة — نفس
 * ما بيصير لما ينحذف كرت مولَّد. وسطر الدليل بيقول ليش، فبيرجع ينفتح بسكربت
 * لو انضغط «لم يُجدد» بالغلط.
 *
 * بلا `"use server"` عن قصد: الدوال هون بتنادى من الأكشنات المحروسة ومن صفحة
 * الإدارة، مو من المتصفح.
 */
import { prisma } from "@/lib/db";
import { DONE_STATUSES } from "@/lib/constants";
import { formatDateShort } from "@/lib/dates";
import { contractHasEnded } from "@/lib/company-visibility";

export function contractEndedEvidence(endedAt: Date): string {
  return `أُغلق تلقائياً: لم يُجدَّد العقد (${formatDateShort(endedAt)}) — غير منجَز ولا يُحتسب تأخيراً.`;
}

function withLine(notes: string | null, line: string): string {
  const kept = (notes ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!kept.includes(line)) kept.push(line);
  return kept.join("\n");
}

/**
 * بيقفل كل كرت مفتوح للشركة (مولَّد أو يدوي) وبيشيل جلسات التصوير الآلية يلي
 * ما بلّشت. المنجَز والمنشور والملغى أصلاً ما بينلمسوا.
 */
export async function closeOpenWorkForEndedContract(companyId: string, endedAt: Date) {
  const open = await prisma.task.findMany({
    where: {
      companyId,
      status: { notIn: [...DONE_STATUSES, "CANCELED"] },
      board: { not: "DONE" },
    },
    select: { id: true, notes: true },
  });
  const line = contractEndedEvidence(endedAt);
  if (open.length) {
    await prisma.$transaction(
      open.map((t) =>
        prisma.task.update({
          where: { id: t.id },
          data: { status: "CANCELED", isPinned: true, notes: withLine(t.notes, line) },
        }),
      ),
    );
  }
  const sessions = await prisma.photoSession.deleteMany({
    where: { companyId, isAuto: true, status: "NOT_STARTED" },
  });
  return { closedTasks: open.length, removedSessions: sessions.count };
}

/**
 * الأرشفة نفسها من أي طريق: «لم يُجدد»، زرّ الأرشفة، أو حقل الحالة بالنموذج.
 * `endedAt` هو تاريخ القرار؛ لو الشركة أصلاً عليها تاريخ انتهاء بيضل هو.
 */
export async function archiveCompanyContract(companyId: string, endedAt: Date) {
  const co = await prisma.company.findUnique({
    where: { id: companyId },
    select: { contractEndedAt: true },
  });
  const ended = co?.contractEndedAt ?? endedAt;
  await prisma.company.update({
    where: { id: companyId },
    data: { status: "archived", contractEndedAt: ended },
  });
  return closeOpenWorkForEndedContract(companyId, ended);
}

/**
 * مصالحة تلقائية: أي شركة عليها قرار «لم يُجدد» ساري وحالتها غير مؤرشفة
 * (القرار القديم كان يوقفها بدل ما يؤرشفها) بتنقل للأرشيف وكروتها بتنقفل.
 * متكافئة — التشغيل الثاني ما بيغيّر شي.
 */
export async function archiveEndedContracts(today: Date = new Date()) {
  const candidates = await prisma.company.findMany({
    where: { contractEndedAt: { not: null }, status: { not: "archived" } },
    select: { id: true, name: true, contractEndedAt: true },
  });
  const done: { id: string; name: string; closedTasks: number }[] = [];
  for (const co of candidates) {
    if (!contractHasEnded(co, today)) continue;
    const r = await archiveCompanyContract(co.id, co.contractEndedAt!);
    done.push({ id: co.id, name: co.name, closedTasks: r.closedTasks });
  }
  return done;
}
