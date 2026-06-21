"use client";

import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/badge";
import { MonthBar } from "@/components/MonthBar";
import {
  DONE_STATUSES,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  taskColor,
  type Status,
} from "@/lib/constants";
import { buildReelNumbers, cardLabelFor, groupTasksIntoCards } from "@/lib/cards";
import { WORK_DAY_HOURS, daysLabel } from "@/lib/capacity";
import { toISODate, fromISODate, formatDateCard, formatDateShort, ARABIC_DAYS } from "@/lib/dates";
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

  const empName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? "—";
  const empColor = (id: string | null) =>
    employees.find((e) => e.id === id)?.color ?? undefined;
  const coName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "";
  // "اليوم" panel: LIVE (not done) tasks on a reference day, grouped by person,
  // using the SAME labels as the task board (batched posts/stories, numbered
  // reels). Done tasks are excluded — they leave the live schedule. The
  // reference day is today if it has work, else the nearest later day with work.
  const reelNum = buildReelNumbers(tasks);
  const isDone = (t: Task) =>
    DONE_STATUSES.includes(t.status as Status) || t.board === "DONE";
  const todayISO = toISODate(new Date());
  const liveDated = tasks.filter((t) => t.workDate && !isDone(t));
  const dayTasks = (iso: string) =>
    liveDated.filter((t) => toISODate(new Date(t.workDate!)) === iso);
  const monthDayISOs = Array.from(
    new Set(liveDated.map((t) => toISODate(new Date(t.workDate!)))),
  ).sort();
  const refDay =
    dayTasks(todayISO).length > 0
      ? todayISO
      : monthDayISOs.find((d) => d >= todayISO) ??
        monthDayISOs[monthDayISOs.length - 1] ??
        todayISO;
  const refIsToday = refDay === todayISO;
  const dayByPerson = employees
    .map((e) => ({
      emp: e,
      cards: groupTasksIntoCards(dayTasks(refDay).filter((t) => t.assigneeId === e.id)),
    }))
    .filter((g) => g.cards.length > 0);

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
        <MonthBar year={year} month={month} showGenerate />
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
          <h2 className="display-font text-lg mb-4">أحمال الفريق</h2>
          <div className="flex flex-col gap-4">
            {workload.map((w) => (
              <div key={w.employee.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={w.employee.name} color={w.employee.color ?? undefined} size={26} />
                    <span className="text-sm font-medium">{w.employee.name}</span>
                    <span className="text-[10px] text-fg-muted">
                      {ROLE_LABELS[w.employee.role] ?? w.employee.role}
                    </span>
                    {w.overflowCount > 0 && (
                      <span className="text-warning text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {w.overflowCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-fg-dim tabular-nums">
                    مطلوب {w.committedDays} · منجز {w.doneDays} ·{" "}
                    <span className="text-accent font-semibold">{w.freeDays} متاح</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-bg-elev-2 overflow-hidden flex">
                  <div
                    className="h-full bg-success"
                    style={{
                      width: `${Math.min(100, (w.doneDays / (w.capacityDays || 1)) * 100)}%`,
                    }}
                  />
                  <div
                    className={
                      "h-full " +
                      (w.level === "over" ? "bg-danger" : w.level === "warn" ? "bg-warning" : "bg-accent")
                    }
                    style={{
                      width: `${Math.min(
                        100 - Math.min(100, (w.doneDays / (w.capacityDays || 1)) * 100),
                        (w.remainingDays / (w.capacityDays || 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {workload.length === 0 && (
              <p className="text-sm text-fg-muted">لا يوجد موظفون.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="display-font text-lg">مهام اليوم</h2>
            <span className="text-xs text-fg-dim">
              {refIsToday
                ? "اليوم"
                : `أقرب يوم عمل · ${ARABIC_DAYS[fromISODate(refDay).getDay()]} ${formatDateShort(fromISODate(refDay))}`}
            </span>
          </div>
          <div className="flex flex-col gap-4 max-h-[340px] overflow-y-auto">
            {dayByPerson.length === 0 && (
              <p className="text-sm text-fg-muted">لا توجد مهام مجدولة.</p>
            )}
            {dayByPerson.map(({ emp, cards }) => (
              <div key={emp.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar name={emp.name} color={emp.color ?? undefined} size={22} />
                  <span className="text-sm font-semibold">{emp.name}</span>
                  <span className="text-[10px] text-fg-muted">{cards.length} مهمة</span>
                </div>
                <div className="flex flex-col gap-1.5 pr-1">
                  {cards.map((card) => (
                    <div
                      key={card.key}
                      className="flex items-center gap-2 min-w-0 bg-bg-elev rounded-md px-2.5 py-1.5 border border-border-soft"
                      style={{ borderRight: `3px solid ${taskColor(card.repr.kind, card.repr.type)}` }}
                    >
                      {card.repr.overflow && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                      )}
                      <span className="text-xs truncate">
                        {cardLabelFor(card.repr, card.count, reelNum, coName)}
                      </span>
                    </div>
                  ))}
                </div>
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
                <th className="text-right font-medium pb-2">أيام العمل</th>
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
                  <td className="py-2 tabular-nums">{t.hours > 0 ? daysLabel(t.hours / WORK_DAY_HOURS) : "—"}</td>
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
