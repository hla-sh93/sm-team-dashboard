import { prisma } from "@/lib/db";
import { publicCompanySelect, publicEmployeeSelect } from "@/server/public-rows";
import { resolvePublishMonth, monthContinuationWhere, openCarryoverWhere } from "@/lib/month";
import { keepOtherCycleCard } from "@/lib/publish-calendar";
import { hideDormantCompanyWork } from "@/lib/company-visibility";
import { loadBlockerChain } from "@/lib/late";
import PublishingClient from "./publishing-client";

export default async function PublishingPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { year, month } = await resolvePublishMonth(await searchParams);
  const [employees, companies, bucketTasks, continuationRaw, carryover] = await Promise.all([
    prisma.employee.findMany({ select: publicEmployeeSelect }),
    prisma.company.findMany({ select: publicCompanySelect, orderBy: { priority: "asc" } }),
    prisma.task.findMany({
      where: { year, month, stage: "PUBLISH", status: { not: "CANCELED" } },
    }),
    // Publishing must see the SAME live work as the tasks board/overview: the
    // open publish tails of other cycles landing in this calendar month, plus
    // ALL still-unpublished cards from earlier buckets. Without these, the
    // publisher's own screen was the only one hiding his overdue queue (June
    // pieces awaiting نشر simply vanished from the July calendar).
    prisma.task.findMany({ where: { ...monthContinuationWhere(year, month), stage: "PUBLISH" } }),
    prisma.task.findMany({ where: { ...openCarryoverWhere(year, month), stage: "PUBLISH" } }),
  ]);

  // شوف `keepOtherCycleCard`: المفتوح دايماً، والمنجز لما يكون يوم نشره بالشهر.
  const continuation = continuationRaw.filter((t) => keepOtherCycleCard(t, year, month));
  const seen = new Set(bucketTasks.map((t) => t.id));
  const extras = [...continuation, ...carryover].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // الشركة الموقوفة/المؤرشفة ما بيطلع من كروتها شي — ولا بقائمة «متأخر النشر»
  // (قرار القائدة ١٥/٩: جدارات موقوفة وكانت ١٢ كرت نشر إلها بتطلع هون).
  const tasks = hideDormantCompanyWork([...bucketTasks, ...extras], companies);
  // المراحل يلي حاجزة كروت النشر (مونتاج، تصميم، تصوير…) — بلاها المحجوز بيطلع «متأخر»
  // وعمر مطلوب منه ينشر شي لسا ما خلص (مراجعة F–H، OP-12). للحساب بس، ما بتنعرض.
  const chainTasks = await loadBlockerChain(tasks, (ids) =>
    prisma.task.findMany({ where: { id: { in: ids } } }),
  );

  return (
    <PublishingClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
      chainTasks={chainTasks}
    />
  );
}
