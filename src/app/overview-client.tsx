"use client";

import TaskForm from "@/components/forms/TaskForm";
import { Avatar, CompanyChip, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { ROLE_LABELS, type Role, TaskStatus } from "@/lib/constants";
import {
  ARABIC_DAYS,
  ARABIC_MONTHS,
  formatDateShort,
  formatMonthLabel,
  toISODate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { calculateMonthlyWorkload } from "@/lib/workload";
import { autoScheduleMonth } from "@/server/actions/tasks";
import type { Company, Task, TeamMember } from "@/types";
import { Plus, Wand2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

interface OverviewClientProps {
  team: TeamMember[];
  companies: Company[];
  tasks: Task[];
}

export default function OverviewClient({
  team,
  companies,
  tasks,
}: OverviewClientProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isScheduling, startScheduling] = useTransition();

  const today = new Date();
  const currentMonth = new Date();
  currentMonth.setDate(1);
  const yr = currentMonth.getFullYear();
  const mo = currentMonth.getMonth();

  const monthTasks = useMemo(() => {
    const monthStart = new Date(yr, mo, 1);
    const monthEnd = new Date(yr, mo + 1, 1);
    const targetMonthKey = `${yr}-${String(mo + 1).padStart(2, "0")}`;
    return tasks.filter((t) => {
      const start = new Date(t.startDate);
      const end = new Date(t.endDate);
      // Overlaps the month OR is an auto-task targeting this month
      // (so writer plans scheduled in the prior month still count).
      const overlaps = start < monthEnd && end >= monthStart;
      const isTargetedHere = t.isAuto && t.targetMonth === targetMonthKey;
      return overlaps || isTargetedHere;
    });
  }, [tasks, yr, mo]);

  const workload = useMemo(
    () => calculateMonthlyWorkload(team, tasks, yr, mo),
    [team, tasks, yr, mo],
  );

  const inProgress = monthTasks.filter(
    (t) => t.status === "in_progress",
  ).length;
  const review = monthTasks.filter((t) => t.status === "review").length;
  const ready = monthTasks.filter((t) => t.status === "ready").length;
  const published = monthTasks.filter((t) => t.status === "published").length;
  const totalContent = companies
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + c.posts + c.reelAi + c.reelVideo, 0);

  // Upcoming this week
  const todayISO = toISODate(today);
  const weekLater = new Date();
  weekLater.setDate(today.getDate() + 7);
  const upcoming = tasks
    .filter((t) => {
      const start = new Date(t.startDate);
      return (
        start >= today &&
        start <= weekLater &&
        t.status !== "published" &&
        t.status !== "ready"
      );
    })
    .slice(0, 8);

  const handleAutoSchedule = () => {
    startScheduling(async () => {
      const result = await autoScheduleMonth(yr, mo);
      if (result.ok) {
        toast(
          `تم توليد ${result.stats.totalGenerated} مهمة لـ ${formatMonthLabel(currentMonth)}`,
        );
        if (result.warnings.length > 0) {
          result.warnings.forEach((w) =>
            toast(w.message, w.level === "error" ? "error" : "warning"),
          );
        }
      } else {
        toast(result.error, "error");
      }
    });
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="display-font text-3xl font-semibold leading-tight">
            نظرة عامة
          </h1>
          <p className="text-fg-dim mt-1.5">
            {ARABIC_DAYS[today.getDay()]} {today.getDate()}{" "}
            {ARABIC_MONTHS[today.getMonth()]} {today.getFullYear()}
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Button onClick={() => setShowTaskForm(true)}>
            <Plus className="w-4 h-4" />
            تاسك إضافية
          </Button>
          <Button
            variant="primary"
            onClick={handleAutoSchedule}
            disabled={isScheduling}
          >
            <Wand2 className="w-4 h-4" />
            {isScheduling ? "جاري التوليد..." : "توليد جدول الشهر"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <KpiCard
          label="إجمالي تاسكات الشهر"
          value={monthTasks.length}
          meta={`${ARABIC_MONTHS[mo]} ${yr}`}
        />
        <KpiCard
          label="المحتوى المخطط"
          value={totalContent}
          meta={`${companies.filter((c) => c.status === "active").length} شركات نشطة`}
        />
        <KpiCard
          label="قيد العمل"
          value={inProgress}
          meta={`${review} للمراجعة`}
          metaColor="text-success"
        />
        <KpiCard
          label="منشور هذا الشهر"
          value={published}
          meta={`${ready} جاهز للنشر`}
          metaColor="text-success"
        />
      </div>

      {/* Workload + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 mb-5">
        <Card>
          <CardTitle>أحمال العمل الشهرية</CardTitle>
          <CardDescription>
            نسبة استخدام كل موظف من الأيام المتاحة
          </CardDescription>
          <div className="space-y-1 mt-4">
            {workload.map((w) => (
              <div
                key={w.member.id}
                className="grid grid-cols-[140px_1fr_80px] gap-4 items-center py-3 border-b border-border-soft last:border-b-0"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={w.member.name} />
                  <div>
                    <div className="font-semibold text-sm">{w.member.name}</div>
                    <div className="text-xs text-fg-muted">
                      {ROLE_LABELS[w.member.role as Role]}
                    </div>
                  </div>
                </div>
                <div className="h-2.5 bg-bg-elev-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      w.level === "over" &&
                        "bg-gradient-to-l from-danger to-orange-500",
                      w.level === "warn" &&
                        "bg-gradient-to-l from-warning to-orange-400",
                      w.level === "normal" &&
                        "bg-gradient-to-l from-success to-accent",
                    )}
                    style={{ width: `${Math.min(w.pct, 100)}%` }}
                  />
                </div>
                <div
                  className={cn(
                    "display-font font-bold text-base text-left",
                    w.level === "over" && "text-danger",
                    w.level === "warn" && "text-warning",
                  )}
                >
                  {w.pct}%
                </div>
              </div>
            ))}
            {workload.length === 0 && (
              <div className="text-center py-8 text-fg-muted">لا يوجد فريق</div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>حسب المرحلة</CardTitle>
          <CardDescription>توزيع التاسكات على مراحل سير العمل</CardDescription>
          <div className="space-y-1 mt-4">
            <StatusBar
              label="قيد العمل"
              count={inProgress}
              total={monthTasks.length}
              color="bg-info"
            />
            <StatusBar
              label="للمراجعة"
              count={review}
              total={monthTasks.length}
              color="bg-warning"
            />
            <StatusBar
              label="جاهز للنشر"
              count={ready}
              total={monthTasks.length}
              color="bg-success"
            />
            <StatusBar
              label="منشور"
              count={published}
              total={monthTasks.length}
              color="bg-fg-muted"
            />
          </div>
        </Card>
      </div>

      {/* Upcoming */}
      <Card>
        <CardTitle>المهام القادمة (هذا الأسبوع)</CardTitle>
        <CardDescription>
          التاسكات المجدولة للأيام السبعة القادمة
        </CardDescription>
        <div className="mt-4">
          {upcoming.length === 0 ? (
            <div className="text-center py-8 text-fg-muted">
              لا توجد تاسكات قادمة
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {upcoming.map((t) => {
                    const co = companies.find((c) => c.id === t.companyId);
                    const m = team.find((tm) => tm.id === t.assigneeId);
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border-soft last:border-b-0"
                      >
                        <td className="py-3 px-2">
                          <div className="font-semibold text-sm">{t.title}</div>
                        </td>
                        <td className="py-3 px-2">
                          {co ? (
                            <CompanyChip name={co.name} color={co.color} />
                          ) : (
                            <span className="text-xs text-fg-muted">داخلي</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {m && (
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={m.name}
                                size={28}
                                color={co?.color}
                              />
                              <span className="text-sm">{m.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-sm text-fg-dim">
                          {formatDateShort(new Date(t.startDate))}
                        </td>
                        <td className="py-3 px-2">
                          <StatusBadge status={t.status as TaskStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        team={team}
        companies={companies}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  meta,
  metaColor,
}: {
  label: string;
  value: number;
  meta?: string;
  metaColor?: string;
}) {
  return (
    <div className="bg-bg-card border border-border-soft rounded-[14px] p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-l from-transparent via-accent to-transparent opacity-60" />
      <div className="text-xs text-fg-dim tracking-wider font-semibold uppercase mb-2">
        {label}
      </div>
      <div className="display-font text-3xl font-bold leading-none">
        {value}
      </div>
      {meta && (
        <div className={cn("text-xs text-fg-muted mt-2", metaColor)}>
          {meta}
        </div>
      )}
    </div>
  );
}

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="grid grid-cols-[110px_1fr_50px] gap-3 items-center py-2.5">
      <div className="text-sm">{label}</div>
      <div className="h-2.5 bg-bg-elev-2 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="display-font font-bold text-base text-left">{count}</div>
    </div>
  );
}
