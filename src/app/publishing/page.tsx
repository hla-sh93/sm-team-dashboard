import { prisma } from "@/lib/db";
import { resolvePublishMonth, monthContinuationWhere, openCarryoverWhere } from "@/lib/month";
import { isTaskDoneState } from "@/lib/constants";
import PublishingClient from "./publishing-client";

export default async function PublishingPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolvePublishMonth(searchParams);
  const [employees, companies, bucketTasks, continuationRaw, carryover] = await Promise.all([
    prisma.employee.findMany(),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
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

  const continuation = continuationRaw.filter((t) => !isTaskDoneState(t));
  const seen = new Set(bucketTasks.map((t) => t.id));
  const extras = [...continuation, ...carryover].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  return (
    <PublishingClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={[...bucketTasks, ...extras]}
    />
  );
}
