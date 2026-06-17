"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { MonthBar } from "@/components/MonthBar";
import TaskForm from "@/components/forms/TaskForm";
import {
  CONTENT_TYPE_LABELS,
  DONE_STATUSES,
  STATUSES,
  STATUS_LABELS,
  WEEKDAY_LABELS,
  type Status,
} from "@/lib/constants";
import {
  parseWorkDays,
  periodDays,
  toISODate,
  formatDateCard,
  weeks,
} from "@/lib/dates";
import { updateTaskStatus } from "@/server/actions/tasks";
import { toast } from "@/components/ui/toaster";
import type { Employee, Company, Task } from "@/types";
import { AlertTriangle, Plus, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

type View = "monthly" | "weekly" | "daily";

const isDone = (s: string) => DONE_STATUSES.includes(s as Status);

export default function TasksClient({
  year,
  month,
  employees,
  companies,
  tasks,
}: {
  year: number;
  month: number;
  employees: Employee[];
  companies: Company[];
  tasks: Task[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("monthly");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  const scheduled = employees.filter(
    (e) =>
      e.isScheduled ||
      tasks.some((t) => t.assigneeId === e.id && !isDone(t.status)),
  );
  const coName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "";

  const live = tasks.filter((t) => !isDone(t.status) && t.type !== "REEL");
  const days = useMemo(() => periodDays(year, month), [year, month]);

  const taskLabel = (t: Task) =>
    t.kind === "CONTENT" && t.type
      ? `${CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]} · ${coName(t.companyId)}`
      : t.title ?? "مهمة";

  const onStatus = (id: string, status: string) =>
    startTransition(async () => {
      const r = await updateTaskStatus(id, status);
      if (r.ok) {
        toast("تم تحديث الحالة");
        router.refresh();
      } else toast(r.error, "error");
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">جدول المهام</h1>
          <p className="text-sm text-fg-dim">مهام الموظفين حسب يوم التنفيذ</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            مهمة مستعجلة
          </Button>
          <MonthBar year={year} month={month} />
        </div>
      </header>

      <div className="flex gap-1 bg-bg-elev border border-border rounded-lg p-1 w-fit">
        {(["monthly", "weekly", "daily"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              "px-4 py-1.5 rounded-md text-sm font-medium transition " +
              (view === v ? "bg-accent text-bg" : "text-fg-dim hover:text-fg")
            }
          >
            {v === "monthly" ? "شهري" : v === "weekly" ? "أسبوعي" : "يومي"}
          </button>
        ))}
      </div>

      {view === "monthly" && (
        <MonthlyMatrix days={days} employees={scheduled} tasks={live} />
      )}

      {view !== "monthly" && (
        <div className="flex flex-col gap-5">
          {scheduled.map((emp) => {
            const wd = parseWorkDays(emp.workDays);
            const scopeISO = new Set(
              view === "weekly"
                ? weeks(year, month).flat().map(toISODate)
                : [toISODate(new Date())],
            );
            const mine = live
              .filter((t) => t.assigneeId === emp.id && t.workDate)
              .filter((t) => scopeISO.has(toISODate(new Date(t.workDate!))))
              .sort(
                (a, b) =>
                  new Date(a.workDate!).getTime() -
                  new Date(b.workDate!).getTime(),
              );
            if (view === "daily" && mine.length === 0) return null;
            return (
              <Card key={emp.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Avatar name={emp.name} color={emp.color ?? undefined} size={28} />
                  <span className="font-semibold">{emp.name}</span>
                  <span className="text-xs text-fg-muted">
                    ({wd.map((d) => WEEKDAY_LABELS[d]).join("، ")})
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {mine.length === 0 && (
                    <p className="text-sm text-fg-muted">لا مهام في هذه الفترة.</p>
                  )}
                  {mine.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between bg-bg-elev rounded-lg px-3 py-2 border border-border-soft gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {t.overflow && (
                          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                        )}
                        {t.isPinned && <Lock className="w-3.5 h-3.5 text-accent shrink-0" />}
                        <span className="text-sm truncate">{taskLabel(t)}</span>
                        <span className="text-xs text-fg-muted shrink-0">{t.hours}س</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-fg-dim">
                          {t.workDate ? formatDateCard(new Date(t.workDate)) : ""}
                          {t.publishDate
                            ? ` · نشر ${formatDateCard(new Date(t.publishDate))}`
                            : ""}
                        </span>
                        <Select
                          className="w-32 h-8 text-xs py-1"
                          value={t.status}
                          onChange={(e) => onStatus(t.id, e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        employees={employees}
        companies={companies}
        year={year}
        month={month}
      />
    </div>
  );
}

function MonthlyMatrix({
  days,
  employees,
  tasks,
}: {
  days: Date[];
  employees: Employee[];
  tasks: Task[];
}) {
  return (
    <Card className="p-0 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky right-0 bg-bg-card z-10 p-2 text-right font-semibold border-b border-border-soft">
              الموظف
            </th>
            {days.map((d) => (
              <th
                key={toISODate(d)}
                className="p-1 text-center font-medium border-b border-border-soft text-fg-dim min-w-[34px]"
              >
                <div>{d.getDate()}</div>
                <div className="text-[9px] text-fg-muted">
                  {WEEKDAY_LABELS[d.getDay()]?.slice(0, 3)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const wd = parseWorkDays(emp.workDays);
            const cap = emp.hoursPerDay;
            return (
              <tr key={emp.id}>
                <td className="sticky right-0 bg-bg-card z-10 p-2 font-medium border-b border-border-soft whitespace-nowrap">
                  {emp.name}
                </td>
                {days.map((d) => {
                  const iso = toISODate(d);
                  const isWork = wd.includes(d.getDay());
                  const dayTasks = tasks.filter(
                    (t) =>
                      t.assigneeId === emp.id &&
                      t.workDate &&
                      toISODate(new Date(t.workDate)) === iso,
                  );
                  const hours = dayTasks.reduce((a, t) => a + t.hours, 0);
                  const over = hours > cap + 1e-9 || dayTasks.some((t) => t.overflow);
                  let bg = "bg-transparent";
                  let text = "";
                  if (!isWork) bg = "bg-bg-elev-2/40";
                  else if (hours === 0) bg = "bg-success/5";
                  else if (over) {
                    bg = "bg-danger/20";
                    text = "text-danger";
                  } else if (hours >= cap - 1e-9) bg = "bg-warning/20";
                  else bg = "bg-warning/10";
                  return (
                    <td
                      key={iso}
                      title={`${emp.name} · ${iso} · ${hours}/${cap}س`}
                      className={`text-center border-b border-border-soft/40 ${bg} ${text}`}
                    >
                      {isWork && hours > 0 ? (
                        <span className="tabular-nums">
                          {over && "⚠️"}
                          {hours}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex gap-4 p-3 text-[11px] text-fg-dim border-t border-border-soft flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-success/20 inline-block" /> فاضي
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-warning/20 inline-block" /> مشغول/ممتلئ
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-danger/20 inline-block" /> تجاوز سعة ⚠️
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-bg-elev-2 inline-block" /> عطلة
        </span>
      </div>
    </Card>
  );
}
