"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/badge";
import { MonthBar } from "@/components/MonthBar";
import Calendar, { type CalendarMode } from "@/components/calendar/Calendar";
import TaskForm from "@/components/forms/TaskForm";
import {
  CONTENT_TYPE_LABELS,
  TASK_KIND_LABELS,
  PHOTO_KIND_LABELS,
  PHOTO_STATUSES,
  PHOTO_STATUS_LABELS,
  STATUSES,
  STATUS_LABELS,
  taskColor,
} from "@/lib/constants";
import {
  updateTaskStatus,
  updatePhotoSessionStatus,
  reassignTask,
} from "@/server/actions/tasks";
import { formatDateShort } from "@/lib/dates";
import { toast } from "@/components/ui/toaster";
import type { Employee, Company, Task, PhotoSession } from "@/types";
import { AlertTriangle, Lock, Plus, Camera } from "lucide-react";
import { useRouter } from "next/navigation";

/** Unified calendar item: a production task OR a photographer session. */
type CalItem =
  | {
      kind: "task";
      id: string;
      date: Date | null;
      empId: string | null;
      companyId: string | null;
      task: Task;
    }
  | {
      kind: "session";
      id: string;
      date: Date;
      empId: string | null;
      companyId: string;
      session: PhotoSession;
    };

export default function TasksClient({
  year,
  month,
  employees,
  companies,
  tasks,
  sessions,
}: {
  year: number;
  month: number;
  employees: Employee[];
  companies: Company[];
  tasks: Task[];
  sessions: PhotoSession[];
}) {
  const router = useRouter();
  const [view, setView] = useState<CalendarMode>("monthly");
  const [person, setPerson] = useState<string>("all");
  const [company, setCompany] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [, startTransition] = useTransition();

  const photographer = employees.find((e) => e.isPhotographer);
  const empName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? "—";
  const empColor = (id: string | null) =>
    employees.find((e) => e.id === id)?.color ?? undefined;
  const coName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "";

  // Build calendar items: production tasks by workDate (REEL excluded — the
  // photographer's production unit is the shoot session, not the reel itself),
  // plus photographer sessions by shootDate.
  const allItems = useMemo<CalItem[]>(() => {
    const taskItems: CalItem[] = tasks
      .filter((t) => t.type !== "REEL")
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        date: t.workDate ? new Date(t.workDate) : null,
        empId: t.assigneeId,
        companyId: t.companyId,
        task: t,
      }));
    const sessionItems: CalItem[] = sessions.map((s) => ({
      kind: "session" as const,
      id: s.id,
      date: new Date(s.shootDate),
      empId: photographer?.id ?? null,
      companyId: s.companyId,
      session: s,
    }));
    return [...taskItems, ...sessionItems];
  }, [tasks, sessions, photographer?.id]);

  const items = useMemo(
    () =>
      allItems.filter(
        (it) =>
          (person === "all" || it.empId === person) &&
          (company === "all" || it.companyId === company),
      ),
    [allItems, person, company],
  );

  const onStatus = (id: string, status: string) =>
    startTransition(async () => {
      const r = await updateTaskStatus(id, status);
      if (r.ok) {
        toast("تم تحديث الحالة");
        router.refresh();
      } else toast(r.error, "error");
    });
  const onSessionStatus = (id: string, status: string) =>
    startTransition(async () => {
      const r = await updatePhotoSessionStatus(id, status);
      if (r.ok) {
        toast("تم تحديث حالة النزلة");
        router.refresh();
      } else toast(r.error, "error");
    });
  const onReassign = (id: string, assigneeId: string) =>
    startTransition(async () => {
      const r = await reassignTask(id, assigneeId);
      if (r.ok) {
        toast("تم تحويل المهمة");
        router.refresh();
      } else toast(r.error, "error");
    });

  // A task is late if it finished after its deadline, or it's past the deadline
  // and still not done.
  const isLate = (t: Task) => {
    if (!t.readyDate) return false;
    const due = new Date(t.readyDate).getTime();
    if (t.finishedAt) return new Date(t.finishedAt).getTime() > due;
    return !["READY", "PUBLISHED"].includes(t.status) && Date.now() > due;
  };

  // ---- renderers ----
  const itemLabel = (it: CalItem) =>
    it.kind === "session"
      ? `تصوير · ${coName(it.companyId)}`
      : it.task.kind === "CONTENT" && it.task.type
        ? `${CONTENT_TYPE_LABELS[it.task.type as keyof typeof CONTENT_TYPE_LABELS]} · ${coName(it.task.companyId)}`
        : (it.task.title ?? TASK_KIND_LABELS[it.task.kind as keyof typeof TASK_KIND_LABELS] ?? "مهمة");

  const itemColor = (it: CalItem) =>
    it.kind === "session"
      ? "#AD3D5B"
      : taskColor(it.task.kind, it.task.type);

  const renderChip = (it: CalItem) => (
    <div
      className="flex items-center gap-1 text-[10px] rounded px-1 py-0.5 truncate"
      style={{ background: `${itemColor(it)}22`, color: itemColor(it) }}
      title={`${itemLabel(it)} — ${empName(it.empId)}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: itemColor(it) }}
      />
      <span className="truncate">{itemLabel(it)}</span>
    </div>
  );

  const renderCard = (it: CalItem) => {
    const color = itemColor(it);
    return (
      <div
        className="rounded-lg border border-border-soft bg-bg-elev px-2.5 py-2 flex flex-col gap-1.5"
        style={{ borderInlineStartColor: color, borderInlineStartWidth: 3 }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {it.kind === "session" && (
            <Camera className="w-3.5 h-3.5 shrink-0" style={{ color }} />
          )}
          {it.kind === "task" && it.task.overflow && (
            <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
          )}
          {it.kind === "task" && it.task.isPinned && (
            <Lock className="w-3 h-3 text-accent shrink-0" />
          )}
          <span className="text-xs font-medium truncate">{itemLabel(it)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-fg-muted">
          <Avatar name={empName(it.empId)} color={empColor(it.empId)} size={16} />
          <span className="truncate">{empName(it.empId)}</span>
          {it.kind === "task" && it.task.hours > 0 && (
            <span className="shrink-0">· {it.task.hours}س</span>
          )}
          {it.kind === "session" && (
            <span className="shrink-0">
              · {PHOTO_KIND_LABELS[it.session.kind as keyof typeof PHOTO_KIND_LABELS]}
              {it.session.reelCount > 0 ? ` (${it.session.reelCount})` : ""}
            </span>
          )}
        </div>
        {it.kind === "task" ? (
          <>
            <div className="flex items-center gap-1.5">
              <Select
                className="flex-1 h-7 text-[11px] py-0.5"
                value={it.task.status}
                onChange={(e) => onStatus(it.id, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
              {/* Reassign to another person */}
              <Select
                className="flex-1 h-7 text-[11px] py-0.5"
                value={it.empId ?? ""}
                onChange={(e) => onReassign(it.id, e.target.value)}
                title="تحويل لشخص آخر"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
            {(it.task.startedAt || it.task.finishedAt || isLate(it.task)) && (
              <div className="flex items-center gap-2 text-[10px] text-fg-muted flex-wrap">
                {it.task.startedAt && (
                  <span>بدأ {formatDateShort(new Date(it.task.startedAt))}</span>
                )}
                {it.task.finishedAt && (
                  <span>· انتهى {formatDateShort(new Date(it.task.finishedAt))}</span>
                )}
                {isLate(it.task) && (
                  <span className="text-danger font-medium">⚠ متأخر</span>
                )}
              </div>
            )}
          </>
        ) : (
          <Select
            className="w-full h-7 text-[11px] py-0.5"
            value={it.session.status}
            onChange={(e) => onSessionStatus(it.id, e.target.value)}
          >
            {PHOTO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PHOTO_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        )}
      </div>
    );
  };

  const renderDrawer = (date: Date, dayItems: CalItem[]) => (
    <div className="flex flex-col gap-3">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setFormOpen(true)}
        className="w-full"
      >
        <Plus className="w-4 h-4" /> إضافة مهمة مستعجلة
      </Button>
      {dayItems.length === 0 && (
        <p className="text-sm text-fg-muted text-center py-4">لا مهام في هذا اليوم.</p>
      )}
      {dayItems.map((it) => (
        <div key={it.id}>{renderCard(it)}</div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3 border-t-4 border-info pt-3 -mt-3 rounded">
        <div>
          <h1 className="display-font text-2xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-info inline-block" />
            جدول مهام الفريق
          </h1>
          <p className="text-sm text-fg-dim">مَن ينفّذ ومتى — حسب يوم التنفيذ (workDate)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4" /> مهمة مستعجلة
          </Button>
          <MonthBar year={year} month={month} />
        </div>
      </header>

      {/* View toggle + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-bg-elev border border-border rounded-lg p-1 w-fit">
          {(["monthly", "weekly", "daily"] as CalendarMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                "px-4 py-1.5 rounded-md text-sm font-medium transition " +
                (view === v ? "bg-info text-bg" : "text-fg-dim hover:text-fg")
              }
            >
              {v === "monthly" ? "شهري" : v === "weekly" ? "أسبوعي" : "يومي"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="h-9 w-40 text-sm"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="all">كل الأشخاص</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
          <Select
            className="h-9 w-40 text-sm"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="all">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Calendar<CalItem>
        mode={view}
        year={year}
        month={month}
        items={items}
        getDate={(it) => it.date}
        renderChip={renderChip}
        renderCard={renderCard}
        renderDrawer={renderDrawer}
        accent="var(--info, #3b82f6)"
        emptyLabel="لا مهام"
      />

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={null}
        employees={employees}
        companies={companies}
        year={year}
        month={month}
      />
    </div>
  );
}
