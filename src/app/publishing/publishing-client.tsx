"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { MonthBar } from "@/components/MonthBar";
import Calendar, { type CalendarMode } from "@/components/calendar/Calendar";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  STATUS_LABELS,
  type ContentType,
  type Status,
} from "@/lib/constants";
import { updateTaskStatus } from "@/server/actions/tasks";
import { toast } from "@/components/ui/toaster";
import { buildReelNumbers } from "@/lib/cards";
import type { Company, Employee, Task } from "@/types";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const PUBLISH_STATUSES: Status[] = ["NOT_STARTED", "IN_PROGRESS", "PUBLISHED"];

export default function PublishingClient({
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
  const [view, setView] = useState<CalendarMode>("monthly");
  const [company, setCompany] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [, start] = useTransition();

  const empName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? "—";
  const coName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "";
  const managed = companies.filter((c) => c.managed && c.status === "active");

  // Publishing items = the actual PUBLISH pipeline cards. Updating these cards
  // is what advances company progress; production cards stay owned by designers.
  const pubTasks = useMemo(
    () => tasks.filter((t) => t.stage === "PUBLISH" && t.publishDate),
    [tasks],
  );

  const items = useMemo(
    () =>
      pubTasks.filter(
        (t) =>
          (company === "all" || t.companyId === company) &&
          (type === "all" || t.type === type),
      ),
    [pubTasks, company, type],
  );

  const seqOf = useMemo(() => buildReelNumbers(pubTasks), [pubTasks]);
  const seqLabel = (t: Task) => {
    const n = seqOf.get(t.id);
    return n ? `${typeLabel(t)}-${n}` : `${typeLabel(t)}`;
  };

  // No-interruption check (§4.4): each managed company must have ≥1 publish in
  // every one of the 4 weeks.
  const gaps = useMemo(() => {
    const out: string[] = [];
    for (const co of managed) {
      const rows = pubTasks.filter((t) => t.companyId === co.id);
      if (rows.length === 0) continue;
      const missing = [1, 2, 3, 4].filter(
        (w) => !rows.some((r) => r.week === w),
      );
      if (missing.length) out.push(`${co.name} (أسبوع ${missing.join("، ")})`);
    }
    return out;
  }, [managed, pubTasks]);

  const onStatus = (id: string, status: string) =>
    start(async () => {
      const r = await updateTaskStatus(id, status);
      if (r.ok) {
        toast("تم تحديث الحالة");
        router.refresh();
      } else toast(r.error, "error");
    });

  const typeColor = (t: Task) =>
    CONTENT_TYPE_COLORS[(t.type as ContentType) ?? "POST"] ?? "#C8A84E";
  const typeLabel = (t: Task) =>
    CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS] ?? t.type;

  const renderChip = (t: Task) => (
    <div
      className="flex items-center gap-1 text-[10px] rounded px-1 py-0.5 truncate"
      style={{ background: `${typeColor(t)}22`, color: typeColor(t) }}
      title={`${seqLabel(t)} · ${coName(t.companyId)}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: typeColor(t) }}
      />
      <span className="truncate">
        {seqLabel(t)} · {coName(t.companyId)}
      </span>
    </div>
  );

  const renderCard = (t: Task) => {
    const color = typeColor(t);
    return (
      <div
        className="rounded-sm border border-border-soft bg-bg-elev px-2.5 py-2 flex flex-col gap-1.5"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-xs font-semibold truncate">{coName(t.companyId)}</span>
          <span
            className="text-[10px] rounded px-1.5 py-0.5 shrink-0"
            style={{ background: `${color}22`, color }}
          >
            {seqLabel(t)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-fg-muted">
          <span>أسبوع {t.week}</span>
          <span>· {empName(t.assigneeId)}</span>
        </div>
        <Select
          className="w-full h-7 text-[11px] py-0.5"
          value={t.status === "READY" ? "PUBLISHED" : t.status}
          onChange={(e) => onStatus(t.id, e.target.value)}
        >
          {PUBLISH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
    );
  };

  const renderDrawer = (date: Date, dayItems: Task[]) => (
    <div className="flex flex-col gap-2">
      {dayItems.length === 0 && (
        <p className="text-sm text-fg-muted text-center py-4">لا منشورات في هذا اليوم.</p>
      )}
      {dayItems.map((t) => (
        <div key={t.id}>{renderCard(t)}</div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3 border-t-4 border-accent pt-3 -mt-3 rounded">
        <div>
          <h1 className="display-font text-2xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
            جدول النشر للشركات
          </h1>
          <p className="text-sm text-fg-dim">متى يُنشر المحتوى — حسب موعد النشر (publishDate)</p>
        </div>
        <MonthBar year={year} month={month} />
      </header>

      {/* No-interruption banner (§4.4) */}
      {pubTasks.length > 0 &&
        (gaps.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4" /> لا انقطاع نشر — كل شركة لها محتوى
            في كل أسبوع.
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>انقطاع نشر في: {gaps.join(" · ")}</span>
          </div>
        ))}

      {/* View toggle + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-bg-elev border border-border rounded-lg p-1 w-fit">
          {(["monthly", "weekly", "daily"] as CalendarMode[]).map((v) => (
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
        <div className="flex items-center gap-2">
          <Select
            className="h-9 w-40 text-sm"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="all">كل الشركات</option>
            {managed.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            className="h-9 w-36 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">كل الأنواع</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Type legend */}
      <div className="flex gap-3 flex-wrap text-[11px] text-fg-dim -mt-2">
        {CONTENT_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded inline-block"
              style={{ background: CONTENT_TYPE_COLORS[t] }}
            />
            {CONTENT_TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <Calendar<Task>
        mode={view}
        year={year}
        month={month}
        items={items}
        getDate={(t) => (t.publishDate ? new Date(t.publishDate) : null)}
        renderChip={renderChip}
        renderCard={renderCard}
        renderDrawer={renderDrawer}
        accent="var(--accent, #C8A84E)"
        emptyLabel="لا منشورات"
      />

      {pubTasks.length === 0 && (
        <div className="text-center py-10 text-fg-muted">
          لا يوجد جدول نشر لهذا الشهر — اضغط «توليد الجدول» أو انتقل لشهر آخر.
        </div>
      )}
    </div>
  );
}
