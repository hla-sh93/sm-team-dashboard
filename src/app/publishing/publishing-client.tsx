"use client";

import { cycleSpanLabel, isCarryoverFromPastCycle } from "@/lib/contract";
import { makeLateClassifier } from "@/lib/late";
import { teamTodayISO } from "@/lib/team-day";
import { makeHeldReason } from "@/lib/daily-work";
import { isDormantCompany } from "@/lib/company-visibility";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { MonthBar } from "@/components/MonthBar";
import Calendar, { type CalendarMode } from "@/components/calendar/Calendar";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  STAGE_LABELS,
  STATUS_LABELS,
  isTaskDoneState,
  type ContentType,
  type Stage,
  type Status,
} from "@/lib/constants";
import { updateTaskStatus } from "@/server/actions/tasks";
import { ensureActor } from "@/lib/actor-client";
import { toast } from "@/components/ui/toaster";
import { buildReelNumbers, comparePieceSequence, publishTypeLabel } from "@/lib/cards";
import { calendarPublishItems, publishesInMonth } from "@/lib/publish-calendar";
import { ARABIC_MONTHS, formatDateShort, toISODate } from "@/lib/dates";
import { CyclePill } from "@/components/ui/pills";
import type { Company, Employee, Task, PublicEmployee, PublicCompany } from "@/types";
import { cardAssetName } from "@/lib/asset-name";
import { AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react";

const PUBLISH_STATUSES: Status[] = ["NOT_STARTED", "IN_PROGRESS", "PUBLISHED"];

export default function PublishingClient({
  year,
  month,
  employees,
  companies,
  tasks,
  chainTasks = [],
}: {
  year: number;
  month: number;
  employees: PublicEmployee[];
  companies: PublicCompany[];
  tasks: Task[];
  /** الكروت الحاجزة لكروت النشر — للحساب بس (`loadBlockerChain`). */
  chainTasks?: Task[];
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
  /** «13/7 → 12/8» — دورة الشركة الحقيقية، مو اسم الشهر التقويمي. */
  const cycleLabelFor = (companyId: string | null, y: number, m: number) => {
    // كرت بلا شركة (مهمة إضافية) دورتها الشهر التقويمي — بس بتنكتب مدى كمان،
    // ما بيصير سطر يقول «دورة تموز» وجنبو «دورة 13/7 → 12/8».
    const co = (companyId ? companies.find((c) => c.id === companyId) : null) ?? {
      contractStartDate: null,
    };
    return cycleSpanLabel(co, y, m);
  };
  const managed = companies.filter((c) => c.managed && !isDormantCompany(c));

  // Publishing items = the actual PUBLISH pipeline cards. Updating these cards
  // is what advances company progress; production cards stay owned by designers.
  const pubTasks = useMemo(
    () => tasks.filter((t) => t.stage === "PUBLISH" && t.publishDate),
    [tasks],
  );
  // Calendar + plan validation stay scoped to THIS bucket's schedule…
  const bucketPub = useMemo(
    () => pubTasks.filter((t) => t.year === year && t.month === month),
    [pubTasks, year, month],
  );
  // …while every still-open card past its publish date — including carryover
  // from earlier cycles — surfaces in the «متأخر النشر» strip below, so the
  // publisher's own screen finally shows his overdue queue.
  const todayISO = teamTodayISO();
  /** كرت ما إلو خانة بالشبكة: لا من دورة هالشهر ولا يوم نشره جوّاه. */
  const offGrid = (t: Task) =>
    !(t.year === year && t.month === month) && !publishesInMonth(t, year, month);
  // «متأخر» بتعريف كل الشاشات (`lib/late.ts`) — والقطعة يلي فات موعدها وهي **محجوزة**
  // خلف مرحلة مفتوحة بتطلع «بانتظار <المرحلة> — <صاحبها>»، مش «انشريها»: كان الشريط
  // يطلب من عمر ينشر ريل مونتاجه لسا مفتوح (فحص ١٢/١٠، OP-12).
  const withChain = useMemo(() => [...tasks, ...chainTasks], [tasks, chainTasks]);
  const lateClass = useMemo(() => makeLateClassifier(withChain, companies), [withChain, companies]);
  const heldReason = useMemo(() => makeHeldReason(withChain, todayISO), [withChain, todayISO]);
  const overdue = useMemo(
    () =>
      pubTasks
        .filter((t) => {
          if (isTaskDoneState(t)) return false;
          if (lateClass(t) != null) return true;
          const due = toISODate(new Date(t.publishDate!));
          // مستحقّ **اليوم** وجاي من دورة سابقة = ما إلو خانة بالشبكة ولا بيحقّق
          // شرط «تجاوز موعده»، فكان بيختفي من الصفحة كلها. صار فعلاً: خمس قطع
          // بلسم من بكت آب أُعيد تأريخ نشرها لـ٢١/٩ فما ظهرت لا بالشبكة ولا هون،
          // بينما تقرير الصباح بيقول «نشر: مركز البلسم». (القائدة ٢١/٩/٢٠٢٦)
          return due === todayISO && offGrid(t);
        })
        .sort(
          (a, b) =>
            new Date(a.publishDate!).getTime() - new Date(b.publishDate!).getTime() ||
            // نفس اليوم: بالتسلسل الرقمي للقطع، مو بالمعرّف العشوائي (١٥/٩).
            comparePieceSequence(a, b) ||
            a.id.localeCompare(b.id),
        ),
    // `offGrid` بيتبع year/month بس، وهنّي بالقائمة.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pubTasks, todayISO, year, month, lateClass],
  );
  const waitingCount = overdue.filter((t) => lateClass(t) === "waiting").length;

  // الشبكة بتعرض كل قطعة يوم نشرها بهالشهر — من أي دورة — مش بس كروت دورة
  // الشهر. شوف `calendarPublishItems`.
  const items = useMemo(
    () =>
      calendarPublishItems(pubTasks, year, month).filter(
        (t) =>
          (company === "all" || t.companyId === company) &&
          (type === "all" || t.type === type),
      ),
    [pubTasks, year, month, company, type],
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
      const rows = bucketPub.filter((t) => t.companyId === co.id);
      if (rows.length === 0) continue;
      const missing = [1, 2, 3, 4].filter(
        (w) => !rows.some((r) => r.week === w),
      );
      if (missing.length) out.push(`${co.name} (أسبوع ${missing.join("، ")})`);
    }
    return out;
  }, [managed, bucketPub]);

  const onStatus = async (id: string, status: string) => {
    if (!(await ensureActor(employees))) return router.refresh();
    start(async () => {
      const r = await updateTaskStatus(id, status);
      if (r.ok) {
        toast("تم تحديث الحالة");
        router.refresh();
      } else toast(r.error, "error");
    });
  };

  const typeColor = (t: Task) =>
    CONTENT_TYPE_COLORS[(t.type as ContentType) ?? "POST"] ?? "#C8A84E";
  const typeLabel = (t: Task) => publishTypeLabel(t);
  const assetLabel = (t: Task) =>
    cardAssetName(t.companyId ? companies.find((c) => c.id === t.companyId) : null, t, seqOf);

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
        {/* اسم الملف — الناشر لازم يعرف أي ملف بينشر، مو بس «بوست-٣». نفس دالة
            اللوح والقالب، فما بيفترقوا. كان موجوداً على /tasks و/today وناقصاً
            هون بالضبط عند الشخص يلي بيرفع الملف. */}
        {assetLabel(t) && (
          <span dir="ltr" className="text-[10px] font-mono tracking-tight text-fg-dim truncate">
            {assetLabel(t)}
          </span>
        )}
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

      {/* متأخر النشر — every open card past its publish date, INCLUDING pieces
          carried over from earlier cycles (their dates sit outside this month's
          grid, so without this strip they were invisible right here). */}
      {overdue.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-danger" />
            <span className="text-sm font-semibold text-danger">
              متأخر النشر ومستحقّ اليوم · {overdue.length - waitingCount}
              {waitingCount > 0 ? ` · ${waitingCount} بانتظار مرحلة قبلها` : ""}
            </span>
            <span className="text-[11px] text-fg-muted">
              كل قطعة مفتوحة تجاوزت موعد نشرها، ومعها المستحقّ اليوم من دورة سابقة —
              انشريها أو عدّلي موعدها
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-1">
            {overdue.map((t) => (
              <div
                key={t.id}
                className="rounded-md border border-danger/30 bg-bg-elev px-2.5 py-2 flex flex-col gap-1.5"
                style={{ borderRightColor: typeColor(t), borderRightWidth: 3 }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-semibold truncate flex-1">
                    {seqLabel(t)} · {coName(t.companyId)}
                  </span>
                  {(t.year !== year || t.month !== month) && (
                    <CyclePill
                      carryover={isCarryoverFromPastCycle(
                        t.companyId ? companies.find((c) => c.id === t.companyId) : null,
                        t.year,
                        t.month,
                      )}
                      cycleLabel={cycleLabelFor(t.companyId, t.year, t.month)}
                      late={lateClass(t) === "late"}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  {toISODate(new Date(t.publishDate!)) === todayISO ? (
                    <span className="text-fg font-semibold">موعدها اليوم</span>
                  ) : (
                    <span
                      className={
                        lateClass(t) === "waiting" ? "text-fg-muted" : "text-danger font-semibold"
                      }
                    >
                      موعدها {formatDateShort(new Date(t.publishDate!))}
                    </span>
                  )}
                  <span className="text-fg-muted">· {empName(t.assigneeId)}</span>
                </div>
                {lateClass(t) === "waiting" &&
                  (() => {
                    const on = heldReason(t)?.blockedBy;
                    return (
                      <div className="text-[10px] text-warning">
                        بانتظار {on?.stage ? (STAGE_LABELS[on.stage as Stage] ?? "مرحلة قبلها") : "مرحلة قبلها"}
                        {on ? ` — ${empName(on.assigneeId)}` : ""}
                      </div>
                    );
                  })()}
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
            ))}
          </div>
        </div>
      )}

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
