"use client";

import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/badge";
import { MonthBar } from "@/components/MonthBar";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { toISODate, formatDateCard } from "@/lib/dates";
import type { Employee, Company, Task } from "@/types";
import type { WorkloadEntry } from "@/lib/workload";
import { AlertTriangle, Building2, Send, Users, Zap } from "lucide-react";

export default function OverviewClient({
  year,
  month,
  employees,
  companies,
  tasks,
  workload,
}: {
  year: number;
  month: number;
  employees: Employee[];
  companies: Company[];
  tasks: Task[];
  workload: WorkloadEntry[];
}) {
  const managed = companies.filter((c) => c.managed && c.status === "active");
  const designers = employees.filter((e) => e.isScheduled && !e.isPhotographer);
  const content = tasks.filter((t) => t.kind === "CONTENT");
  const openUrgent = tasks.filter(
    (t) =>
      (t.priority === "URGENT" || t.kind === "ADHOC") &&
      t.status !== "READY" &&
      t.status !== "PUBLISHED",
  );

  const todayISO = toISODate(new Date());
  const todayTasks = tasks.filter(
    (t) =>
      t.workDate &&
      toISODate(new Date(t.workDate)) === todayISO &&
      t.status !== "PUBLISHED",
  );

  const empName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? "—";
  const coName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "";

  const kpis = [
    { label: "الشركات المُدارة", value: managed.length, icon: Building2 },
    { label: "منشورات الشهر", value: content.length, icon: Send },
    { label: "المصممون", value: designers.length, icon: Users },
    { label: "مهام مستعجلة مفتوحة", value: openUrgent.length, icon: Zap },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">نظرة عامة</h1>
          <p className="text-sm text-fg-dim">لوحة إدارة فريق السوشال ميديا</p>
        </div>
        <MonthBar year={year} month={month} />
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl display-font">{k.value}</div>
                  <div className="text-xs text-fg-dim mt-1">{k.label}</div>
                </div>
                <Icon className="w-8 h-8 text-accent/40" />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="display-font text-lg mb-4">أحمال المصممين</h2>
          <div className="flex flex-col gap-4">
            {workload.map((w) => (
              <div key={w.employee.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={w.employee.name} color={w.employee.color ?? undefined} size={26} />
                    <span className="text-sm font-medium">{w.employee.name}</span>
                    {w.overflowCount > 0 && (
                      <span className="text-warning text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {w.overflowCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-fg-dim tabular-nums">
                    {w.totalHours}/{w.capacityHours}س · {w.busyDays} مشغول · {w.freeDays} فاضي
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-bg-elev-2 overflow-hidden">
                  <div
                    className={
                      "h-full rounded-full " +
                      (w.level === "over"
                        ? "bg-danger"
                        : w.level === "warn"
                          ? "bg-warning"
                          : "bg-success")
                    }
                    style={{ width: `${Math.min(100, w.pct)}%` }}
                  />
                </div>
              </div>
            ))}
            {workload.length === 0 && (
              <p className="text-sm text-fg-muted">لا يوجد موظفون مجدولون.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="display-font text-lg mb-4">مهام اليوم</h2>
          <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto">
            {todayTasks.length === 0 && (
              <p className="text-sm text-fg-muted">لا توجد مهام مجدولة لليوم.</p>
            )}
            {todayTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-bg-elev rounded-lg px-3 py-2 border border-border-soft"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {t.overflow && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
                  <span className="text-sm truncate">{t.title}</span>
                </div>
                <span className="text-xs text-fg-dim shrink-0">{empName(t.assigneeId)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="display-font text-lg mb-4">المهام المستعجلة</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-fg-dim text-xs border-b border-border-soft">
                <th className="text-right font-medium pb-2">العنوان</th>
                <th className="text-right font-medium pb-2">الشركة</th>
                <th className="text-right font-medium pb-2">المسؤول</th>
                <th className="text-right font-medium pb-2">الساعات</th>
                <th className="text-right font-medium pb-2">الأولوية</th>
                <th className="text-right font-medium pb-2">الحالة</th>
                <th className="text-right font-medium pb-2">يوم التنفيذ</th>
              </tr>
            </thead>
            <tbody>
              {openUrgent.map((t) => (
                <tr key={t.id} className="border-b border-border-soft/50">
                  <td className="py-2">{t.title}</td>
                  <td className="py-2 text-fg-dim">{coName(t.companyId)}</td>
                  <td className="py-2 text-fg-dim">{empName(t.assigneeId)}</td>
                  <td className="py-2 tabular-nums">{t.hours}س</td>
                  <td className="py-2">
                    {PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS] ?? t.priority}
                  </td>
                  <td className="py-2 text-fg-dim">
                    {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] ?? t.status}
                  </td>
                  <td className="py-2 text-fg-dim">
                    <span className="flex items-center gap-1">
                      {t.overflow && <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                      {t.workDate ? formatDateCard(new Date(t.workDate)) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {openUrgent.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-fg-muted">
                    لا مهام مستعجلة مفتوحة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
