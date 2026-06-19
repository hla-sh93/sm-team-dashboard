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
import { resolveActiveMonth, monthLabel } from "@/lib/month";
import { computeWorkload } from "@/lib/workload";
import { prisma } from "@/lib/db";
import { CheckCircle2, Trophy } from "lucide-react";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const label = monthLabel({ year, month });

  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany(),
    prisma.task.findMany({ where: { year, month } }),
  ]);

  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const isDone = (s: string) => DONE_STATUSES.includes(s as Status);
  const done = tasks.filter((t) => isDone(t.status));
  const qty = (t: { quantity?: number }) => t.quantity ?? 1;
  const doneCount = done.reduce((a, t) => a + qty(t), 0);

  // Per-company plan completion (المنجَز مقابل المتبقّي من الخطة).
  const PLAN_TYPES: { type: string; label: string; key: "posts" | "reels" | "aiReels" | "stories" }[] = [
    { type: "POST", label: "بوست", key: "posts" },
    { type: "REEL", label: "ريل", key: "reels" },
    { type: "AI_REEL", label: "ريل AI", key: "aiReels" },
    { type: "STORY", label: "ستوري", key: "stories" },
  ];
  const companyPlan = companies
    .filter((c) => c.managed && c.status === "active")
    .sort((a, b) => a.priority - b.priority)
    .map((co) => {
      const rows = PLAN_TYPES.map((pt) => {
        const plan = co[pt.key] ?? 0;
        const d = tasks
          .filter((t) => t.companyId === co.id && t.kind === "CONTENT" && t.type === pt.type && isDone(t.status))
          .reduce((a, t) => a + qty(t), 0);
        return { ...pt, plan, done: d, remaining: Math.max(0, plan - d) };
      }).filter((r) => r.plan > 0 || r.done > 0);
      const totalPlan = rows.reduce((a, r) => a + r.plan, 0);
      const totalDone = rows.reduce((a, r) => a + Math.min(r.done, r.plan), 0);
      const pct = totalPlan > 0 ? Math.round((totalDone / totalPlan) * 100) : 0;
      return { co, rows, pct, totalPlan, totalDone };
    })
    .filter((x) => x.rows.length > 0);

  // Out-of-plan (ad-hoc) done work, grouped lightly for the summary.
  const outOfPlanDone = done
    .filter((t) => t.kind === "ADHOC")
    .reduce((a, t) => a + qty(t), 0);

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
              <div className="text-xs text-fg-muted">المنجز (شامل الكميات)</div>
              <div className="display-font text-2xl">{doneCount}</div>
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

      {/* المنجَز مقابل المتبقّي من خطة كل شركة */}
      {companyPlan.length > 0 && (
        <Card>
          <h2 className="display-font text-lg mb-4">إنجاز خطة الشركات — {label}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {companyPlan.map(({ co, rows, pct }) => (
              <div key={co.id} className="border border-border-soft rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ background: co.color ?? "#C8A84E" }}
                    />
                    <span className="font-semibold">{co.name}</span>
                  </div>
                  <span
                    className={
                      "text-sm display-font " +
                      (pct >= 100 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger")
                    }
                  >
                    {pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-bg-elev-2 overflow-hidden mb-2">
                  <div
                    className={"h-full " + (pct >= 100 ? "bg-success" : "bg-accent")}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {rows.map((r) => (
                    <div key={r.type} className="flex items-center justify-between">
                      <span className="text-fg-dim">{r.label}</span>
                      <span className="tabular-nums">
                        <span className={r.done >= r.plan ? "text-success" : ""}>{r.done}</span>
                        <span className="text-fg-muted">/{r.plan}</span>
                        {r.remaining > 0 && (
                          <span className="text-warning"> · باقي {r.remaining}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {outOfPlanDone > 0 && (
            <p className="text-xs text-fg-muted mt-3">
              + {outOfPlanDone} مهمة منجزة <strong>خارج الخطة</strong> (مفصّلة لكل شخص بالأسفل).
            </p>
          )}
        </Card>
      )}

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
                <div className="display-font text-2xl text-success">
                  {mine.reduce((a, t) => a + qty(t), 0)}
                </div>
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
                      {qty(t) > 1 && <span className="text-accent"> ×{qty(t)}</span>}
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
