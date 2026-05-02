import { Avatar, CompanyChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ROLE_LABELS,
  type Role,
  STATUS_LABELS,
  TYPE_LABELS,
  type TaskStatus,
  type TaskType,
} from "@/lib/constants";
import { ARABIC_MONTHS, formatDateShort } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { CheckCircle2, Trophy } from "lucide-react";

interface ReportsPageProps {
  searchParams?: { y?: string; m?: string };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const now = new Date();
  const yr = Number(searchParams?.y) || now.getFullYear();
  const mo =
    searchParams?.m !== undefined ? Number(searchParams.m) : now.getMonth();

  const monthStart = new Date(yr, mo, 1);
  const monthEnd = new Date(yr, mo + 1, 1);

  // One-time backfill: legacy ready/published rows that pre-date the
  // completedAt column won't show in any monthly report otherwise. Stamp
  // them with updatedAt (the closest signal we have for "when this changed
  // last", which for completed tasks is usually the moment they were marked
  // done) so they bucket into a real month.
  const orphans = await prisma.task.findMany({
    where: {
      status: { in: ["ready", "published"] },
      completedAt: null,
    },
    select: { id: true, updatedAt: true },
  });
  if (orphans.length > 0) {
    await prisma.$transaction(
      orphans.map((t) =>
        prisma.task.update({
          where: { id: t.id },
          data: { completedAt: t.updatedAt },
        }),
      ),
    );
  }

  const [team, companies, tasks] = await Promise.all([
    prisma.teamMember.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany(),
    prisma.task.findMany({
      where: {
        status: { in: ["ready", "published"] },
        completedAt: { gte: monthStart, lt: monthEnd },
      },
      orderBy: [{ completedAt: "asc" }, { endDate: "asc" }],
    }),
  ]);

  const byAssignee = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const arr = byAssignee.get(t.assigneeId) ?? [];
    arr.push(t);
    byAssignee.set(t.assigneeId, arr);
  }

  const totalDone = tasks.length;
  const activeMembers = team.filter(
    (m) => (byAssignee.get(m.id) ?? []).length > 0,
  );

  // Month picker options (last 6 months)
  const monthOptions: { y: number; m: number; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      y: d.getFullYear(),
      m: d.getMonth(),
      label: `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="display-font text-3xl font-semibold">
            تقرير الإنجاز الشهري
          </h1>
          <p className="text-fg-dim mt-1.5">
            كل التاسكات التي أُنجزت (جاهزة أو منشورة) في {ARABIC_MONTHS[mo]}{" "}
            {yr}
          </p>
        </div>
        <form
          method="GET"
          action="/reports"
          className="flex items-center gap-2"
        >
          <label className="text-xs text-fg-dim font-semibold">الشهر:</label>
          <select
            name="y"
            defaultValue={String(yr)}
            className="bg-bg-elev border border-border rounded-lg px-2 py-2 text-fg text-sm"
          >
            {Array.from(new Set(monthOptions.map((o) => o.y))).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            name="m"
            defaultValue={String(mo)}
            className="bg-bg-elev border border-border rounded-lg px-2 py-2 text-fg text-sm"
          >
            {ARABIC_MONTHS.map((label, idx) => (
              <option key={idx} value={idx}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-accent/10 text-accent border border-accent/30 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-accent/15"
          >
            عرض
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">إجمالي المهام المنجزة</div>
              <div className="display-font text-2xl font-bold">{totalDone}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">
                أعضاء الفريق المساهمون
              </div>
              <div className="display-font text-2xl font-bold">
                {activeMembers.length} / {team.length}
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
              <div className="text-xs text-fg-muted">معدل لكل عضو نشط</div>
              <div className="display-font text-2xl font-bold">
                {activeMembers.length > 0
                  ? (totalDone / activeMembers.length).toFixed(1)
                  : "0"}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {team.map((m) => {
          const memberTasks = byAssignee.get(m.id) ?? [];
          if (memberTasks.length === 0) return null;

          const breakdown: Record<string, number> = {};
          for (const t of memberTasks) {
            breakdown[t.type] = (breakdown[t.type] ?? 0) + 1;
          }

          return (
            <Card key={m.id}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} size={48} />
                  <div>
                    <div className="font-bold text-base">{m.name}</div>
                    <div className="text-xs text-fg-muted">
                      {ROLE_LABELS[m.role as Role]}
                    </div>
                  </div>
                </div>
                <div className="display-font text-3xl font-bold text-success">
                  {memberTasks.length}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(breakdown).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-bg-elev border border-border"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {v} {TYPE_LABELS[k as TaskType]}
                  </span>
                ))}
              </div>

              <div className="border-t border-border-soft pt-3">
                <div className="text-xs text-fg-muted font-semibold mb-2">
                  قائمة المهام:
                </div>
                <div className="space-y-1.5">
                  {memberTasks.map((t) => {
                    const co = companies.find((c) => c.id === t.companyId);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 text-sm py-1.5 border-b border-border-soft last:border-b-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                        <span className="flex-1 truncate">{t.title}</span>
                        {co && <CompanyChip name={co.name} color={co.color} />}
                        <span className="text-xs text-fg-muted">
                          {TYPE_LABELS[t.type as TaskType]}
                        </span>
                        <span className="text-xs text-fg-muted min-w-[80px] text-left">
                          {formatDateShort(new Date(t.endDate))}
                        </span>
                        <span className="text-xs text-fg-dim min-w-[70px] text-left">
                          {STATUS_LABELS[t.status as TaskStatus]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}

        {activeMembers.length === 0 && (
          <Card>
            <div className="text-center py-12 text-fg-muted">
              لا توجد مهام منجزة في هذا الشهر بعد.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
