import { Avatar } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReportActions, type ReportRow, type TaskRow } from "@/components/ReportActions";
import { MonthBar } from "@/components/MonthBar";
import {
  CONTENT_TYPE_LABELS,
  DONE_STATUSES,
  ROLE_LABELS,
  STATUS_LABELS,
  WEEKDAY_LABELS,
  type Status,
} from "@/lib/constants";
import { formatDateShort, toISODate } from "@/lib/dates";
import { resolveMonth, monthLabel } from "@/lib/month";
import { computeWorkload } from "@/lib/workload";
import { prisma } from "@/lib/db";
import { CheckCircle2, Trophy } from "lucide-react";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = resolveMonth(searchParams);
  const label = monthLabel({ year, month });

  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany(),
    prisma.task.findMany({ where: { year, month } }),
  ]);

  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const isDone = (s: string) => DONE_STATUSES.includes(s as Status);
  const done = tasks.filter((t) => isDone(t.status));

  const workload = computeWorkload(
    employees.filter((e) => e.isScheduled),
    tasks,
    year,
    month,
  );

  const byAssignee = new Map<string, typeof tasks>();
  for (const t of done) {
    const arr = byAssignee.get(t.assigneeId ?? "") ?? [];
    arr.push(t);
    byAssignee.set(t.assigneeId ?? "", arr);
  }

  const teamRows: ReportRow[] = employees.map((e) => {
    const w = workload.find((x) => x.employee.id === e.id);
    return {
      employee: e.name,
      role: ROLE_LABELS[e.role] ?? e.role,
      totalHours: w?.totalHours ?? 0,
      busyDays: w?.busyDays ?? 0,
      freeDays: w?.freeDays ?? 0,
      done: (byAssignee.get(e.id) ?? []).length,
    };
  });

  const taskRows: TaskRow[] = tasks
    .filter((t) => t.workDate)
    .sort((a, b) => new Date(a.workDate!).getTime() - new Date(b.workDate!).getTime())
    .map((t) => ({
      date: toISODate(new Date(t.workDate!)),
      weekday: WEEKDAY_LABELS[new Date(t.workDate!).getDay()] ?? "",
      employee: employees.find((e) => e.id === t.assigneeId)?.name ?? "",
      type:
        t.kind === "CONTENT" && t.type
          ? CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]
          : t.title ?? "مهمة",
      target: coName(t.companyId) || (t.title ?? ""),
      hours: t.hours,
      publishDate: t.publishDate ? toISODate(new Date(t.publishDate)) : "",
      status: STATUS_LABELS[t.status as Status] ?? t.status,
    }));

  const contributors = employees.filter((e) => (byAssignee.get(e.id) ?? []).length > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">التقارير</h1>
          <p className="text-sm text-fg-dim">إنجاز {label}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ReportActions teamRows={teamRows} taskRows={taskRows} monthLabel={label} />
          <MonthBar year={year} month={month} showGenerate={false} />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">المهام المنجزة</div>
              <div className="display-font text-2xl">{done.length}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">المساهمون</div>
              <div className="display-font text-2xl">
                {contributors.length} / {employees.length}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 text-info flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">إجمالي المهام بالشهر</div>
              <div className="display-font text-2xl">{tasks.length}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {employees.map((e) => {
          const mine = byAssignee.get(e.id) ?? [];
          if (mine.length === 0) return null;
          return (
            <Card key={e.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} color={e.color ?? undefined} size={40} />
                  <div>
                    <div className="font-semibold">{e.name}</div>
                    <div className="text-xs text-fg-muted">{ROLE_LABELS[e.role] ?? e.role}</div>
                  </div>
                </div>
                <div className="display-font text-2xl text-success">{mine.length}</div>
              </div>
              <div className="space-y-1.5">
                {mine.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 text-sm py-1.5 border-b border-border-soft last:border-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    <span className="flex-1 truncate">
                      {t.kind === "CONTENT" && t.type
                        ? `${CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]} · ${coName(t.companyId)}`
                        : t.title}
                    </span>
                    <span className="text-xs text-fg-muted shrink-0">
                      {t.publishDate ? formatDateShort(new Date(t.publishDate)) : ""}
                    </span>
                    <span className="text-xs text-fg-dim shrink-0">
                      {STATUS_LABELS[t.status as Status] ?? t.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        {contributors.length === 0 && (
          <Card className="text-center py-10 text-fg-muted">
            لا توجد مهام منجزة في {label} بعد.
          </Card>
        )}
      </div>
    </div>
  );
}
