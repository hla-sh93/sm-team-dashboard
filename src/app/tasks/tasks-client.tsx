"use client";

import { useMemo, useState, useTransition } from "react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/badge";
import { MonthBar } from "@/components/MonthBar";
import Calendar, { type CalendarMode } from "@/components/calendar/Calendar";
import KanbanBoard from "@/components/KanbanBoard";
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
import { WORK_DAY_HOURS, daysLabel } from "@/lib/capacity";
import { Pill, PriorityPill, LatePill, daysLateOf } from "@/components/ui/pills";
import {
  updateTaskStatus,
  updatePhotoSessionStatus,
  deleteTasks,
} from "@/server/actions/tasks";
import { formatDateShort } from "@/lib/dates";
import { toast } from "@/components/ui/toaster";
import type { Employee, Company, Task, PhotoSession } from "@/types";
import {
  AlertTriangle,
  CalendarDays,
  Lock,
  Plus,
  Camera,
  Pencil,
  Trash2,
} from "lucide-react";
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
  initialPerson = "all",
  initialCompany = "all",
}: {
  year: number;
  month: number;
  employees: Employee[];
  companies: Company[];
  tasks: Task[];
  sessions: PhotoSession[];
  // Deep-linked initial filter from the server page's searchParams (e.g. the home
  // page's "عرض في البورد" → /tasks?person=<id>). Passed as props rather than read
  // via useSearchParams to avoid opting the whole route into a client bail-out.
  initialPerson?: string;
  initialCompany?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<CalendarMode | "board">("board");
  const [person, setPerson] = useState<string>(initialPerson);
  const [company, setCompany] = useState<string>(initialCompany);
  const [groupBy, setGroupBy] = useState<"company" | "type" | "person" | "none">("company");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ task: Task; ids: string[]; label: string } | null>(
    null,
  );
  const [, startTransition] = useTransition();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (task: Task, ids: string[], label: string) => {
    setEditing({ task, ids, label });
    setFormOpen(true);
  };
  const onDelete = (ids: string[], label: string) => {
    const isAuto = tasks.some((t) => ids.includes(t.id) && t.isAuto);

    if (isAuto) {
      Swal.fire({
        title: "حذف من الشهر الجاري",
        text: "هذه المهمة مضافة تلقائياً من خطة الشركة. الموافقة ستحذفها من دورة هذا الشهر فقط. لإزالتها نهائياً من كل الشهور، يرجى تعديل خطة الشركة في صفحة الشركات.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "نعم، احذفها هذا الشهر",
        cancelButtonText: "تراجع",
      }).then((result) => {
        if (!result.isConfirmed) return;
        startTransition(async () => {
          const r = await deleteTasks(ids);
          if (r.ok) {
            toast("تم حذف المهمة");
            router.refresh();
          } else toast(r.error, "error");
        });
      });
      return;
    }

    Swal.fire({
      title: "تأكيد الحذف",
      text: `حذف «${label}»؟`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، احذف",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (!result.isConfirmed) return;
      startTransition(async () => {
        const r = await deleteTasks(ids);
        if (r.ok) {
          toast("تم حذف المهمة");
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  const photographer = employees.find((e) => e.isPhotographer);
  const empName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? "—";
  const empColor = (id: string | null) =>
    employees.find((e) => e.id === id)?.color ?? undefined;
  const coName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "";

  // Build calendar items: PRODUCTION tasks by workDate. We exclude:
  //  - REEL content (the photographer's production unit is the shoot session),
  //  - PUBLISH cards (publishing runs 7 days/week incl. days off — it lives on
  //    the النشر calendar, not the production schedule).
  // …so the production calendar only ever shows real work on people's workdays.
  const allItems = useMemo<CalItem[]>(() => {
    const taskItems: CalItem[] = tasks
      .filter((t) => t.type !== "REEL" && t.kind !== "PUBLISH")
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        date: t.workDate ? new Date(t.workDate) : null,
        empId: t.assigneeId,
        companyId: t.companyId,
        task: t,
      }));
    const sessionItems: CalItem[] = sessions.map((s) => {
      const co = companies.find((c) => c.id === s.companyId);
      return {
        kind: "session" as const,
        id: s.id,
        date: new Date(s.shootDate),
        empId: co?.photographerId ?? photographer?.id ?? null,
        companyId: s.companyId,
        session: s,
      };
    });
    return [...taskItems, ...sessionItems];
  }, [tasks, sessions, companies, photographer?.id]);

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
    const t = it.kind === "task" ? it.task : null;
    const late = t ? isLate(t) : false;
    return (
      <div
        className="rounded-md border border-border-soft bg-bg-elev px-2.5 py-2 flex flex-col gap-2"
        style={{ borderRightColor: color, borderRightWidth: 3 }}
      >
        {/* title row */}
        <div className="flex items-center gap-1.5 min-w-0">
          {it.kind === "session" && (
            <Camera className="w-3.5 h-3.5 shrink-0" style={{ color }} />
          )}
          {t?.overflow && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
          {t?.isPinned && <Lock className="w-3 h-3 text-accent shrink-0" />}
          <span className="text-xs font-semibold truncate flex-1">{itemLabel(it)}</span>
          {it.kind === "task" && (
            <>
              <button
                type="button"
                onClick={() => openEdit(it.task, [it.task.id], itemLabel(it))}
                title="تعديل"
                className="shrink-0 text-fg-muted hover:text-accent transition"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete([it.task.id], itemLabel(it))}
                title="حذف"
                className="shrink-0 text-fg-muted hover:text-danger transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* owner (read-only — change it from تعديل) */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <Avatar name={empName(it.empId)} color={empColor(it.empId)} size={18} />
          <span className="truncate text-fg-dim">{empName(it.empId)}</span>
        </div>

        {/* meta pills: duration · deadline · priority · late */}
        <div className="flex items-center gap-1 flex-wrap">
          {t && t.hours > 0 && (
            <Pill>{daysLabel(t.hours / WORK_DAY_HOURS)}</Pill>
          )}
          {it.kind === "session" && (
            <Pill>
              {PHOTO_KIND_LABELS[it.session.kind as keyof typeof PHOTO_KIND_LABELS]}
              {it.session.reelCount > 0 ? ` (${it.session.reelCount})` : ""}
            </Pill>
          )}
          {t?.readyDate && (
            <Pill icon={<CalendarDays className="w-3 h-3" />}>
              تسليم {formatDateShort(new Date(t.readyDate))}
            </Pill>
          )}
          {t && <PriorityPill priority={t.priority} />}
          {late && t && <LatePill days={daysLateOf(t)} />}
        </div>

        {/* status quick-control */}
        {it.kind === "task" ? (
          <Select
            className="w-full h-7 text-[11px] py-0.5"
            value={it.task.status}
            onChange={(e) => onStatus(it.id, e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
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
      <Button size="sm" variant="ghost" onClick={openCreate} className="w-full">
        <Plus className="w-4 h-4" /> إضافة مهمة إضافية
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
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> مهمة إضافية
          </Button>
          <MonthBar year={year} month={month} />
        </div>
      </header>

      {/* View toggle + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-bg-elev border border-border rounded-lg p-1 w-fit">
          {(["board", "monthly", "weekly", "daily"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                "px-4 py-1.5 rounded-md text-sm font-medium transition " +
                (view === v ? "bg-info text-bg" : "text-fg-dim hover:text-fg")
              }
            >
              {v === "board"
                ? "بورد"
                : v === "monthly"
                  ? "شهري"
                  : v === "weekly"
                    ? "أسبوعي"
                    : "يومي"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === "board" && (
            <Select
              className="h-9 w-36 text-sm"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              title="تجميع كروت البورد"
            >
              <option value="company">تجميع: شركة</option>
              <option value="type">تجميع: نوع</option>
              <option value="person">تجميع: شخص</option>
              <option value="none">بدون تجميع</option>
            </Select>
          )}
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

      {view === "board" ? (
        <KanbanBoard
          tasks={tasks.filter(
            (t) =>
              (person === "all" || t.assigneeId === person) &&
              (company === "all" || t.companyId === company),
          )}
          allTasks={tasks}
          employees={employees}
          companies={companies}
          groupBy={groupBy}
          onEdit={openEdit}
          onDelete={onDelete}
        />
      ) : (
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
      )}

      <TaskForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        task={editing?.task ?? null}
        ids={editing?.ids}
        displayLabel={editing?.label}
        employees={employees}
        companies={companies}
        year={year}
        month={month}
      />
    </div>
  );
}
