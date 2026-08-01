"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  Inbox,
  Send,
  Undo2,
  Video,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { updateTaskStatus } from "@/server/actions/tasks";
import { undoMatch } from "@/server/actions/telegram";
import {
  CONTENT_TYPE_COLORS,
  CONTENT_TYPE_LABELS,
  daysLateOfState,
  isTaskDoneState,
  type ContentType,
} from "@/lib/constants";
import { ARABIC_DAYS, toISODate } from "@/lib/dates";
import { assetNameForTask, companySlug } from "@/lib/asset-name";
import { buildContentNumbers } from "@/lib/cards";
import type { Company, Employee, Task, TelegramMessage } from "@/types";

/** Publish dates within this many days count as "about to slip". */
const AT_RISK_DAYS = 2;
/** How many overdue cards a company shows before collapsing to a tail count. */
const OVERDUE_PREVIEW = 5;

const iso = (d: Date | string | null | undefined): string | null =>
  d == null ? null : toISODate(d instanceof Date ? d : new Date(d));

const KIND_ICON: Record<string, typeof Video> = {
  VIDEO: Video,
  PHOTO: ImageIcon,
  DOCUMENT: FileText,
  AUDIO: FileText,
  TEXT: FileText,
};

export default function TodayClient({
  todayISO,
  employees,
  companies,
  tasks,
  deliveries,
}: {
  todayISO: string;
  employees: Employee[];
  companies: Company[];
  tasks: Task[];
  deliveries: TelegramMessage[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [onlyActive, setOnlyActive] = useState(true);

  const today = useMemo(() => {
    const [y, m, d] = todayISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [todayISO]);

  const numbers = useMemo(() => buildContentNumbers(tasks), [tasks]);
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "غير مُسند";
  const coById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const open = useMemo(
    () => tasks.filter((t) => !isTaskDoneState(t) && t.status !== "CANCELED"),
    [tasks],
  );

  /** Still-open production siblings of a piece — what makes it "not ready". */
  const blockersOf = useMemo(() => {
    const byPipeline = new Map<string, Task[]>();
    for (const t of open) {
      if (!t.pipelineKey) continue;
      const arr = byPipeline.get(t.pipelineKey) ?? [];
      arr.push(t);
      byPipeline.set(t.pipelineKey, arr);
    }
    return (t: Task): Task[] =>
      (t.pipelineKey ? (byPipeline.get(t.pipelineKey) ?? []) : []).filter(
        (s) => s.id !== t.id && s.stage !== "PUBLISH",
      );
  }, [open]);

  const label = (t: Task): string => {
    const co = t.companyId ? coById.get(t.companyId) : null;
    const asset = assetNameForTask(co, t, numbers);
    const kind = CONTENT_TYPE_LABELS[t.type as ContentType] ?? "مهمة";
    if (asset) return `${asset} · ${kind}`;
    const n = numbers.get(t.id);
    return n ? `${kind}-${n}` : (t.title?.trim() || kind);
  };

  const horizonISO = useMemo(() => {
    const h = new Date(today);
    h.setDate(h.getDate() + AT_RISK_DAYS);
    return toISODate(h);
  }, [today]);

  const deadlineOf = (t: Task): string | null =>
    t.stage === "PUBLISH" ? (iso(t.publishDate) ?? iso(t.readyDate)) : (iso(t.readyDate) ?? iso(t.publishDate));

  // ---------------------------------------------------------------- per company
  const rows = useMemo(() => {
    return companies
      .filter((c) => c.managed && c.status === "active")
      .map((co) => {
        const mine = open.filter((t) => t.companyId === co.id);
        const publishing = mine.filter((t) => t.stage === "PUBLISH" && iso(t.publishDate) === todayISO);
        const delivering = mine.filter((t) => t.stage !== "PUBLISH" && deadlineOf(t) === todayISO);
        const overdue = mine
          .filter((t) => {
            const d = deadlineOf(t);
            return d != null && d < todayISO;
          })
          .sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
        const atRisk = mine.filter((t) => {
          if (t.stage !== "PUBLISH") return false;
          const pd = iso(t.publishDate);
          if (!pd || pd <= todayISO || pd > horizonISO) return false;
          return blockersOf(t).length > 0;
        });
        const arrived = deliveries.filter((d) => d.companyId === co.id);
        return { co, publishing, delivering, overdue, atRisk, arrived };
      })
      .filter((r) =>
        onlyActive
          ? r.publishing.length || r.delivering.length || r.overdue.length || r.atRisk.length || r.arrived.length
          : true,
      );
  }, [companies, open, deliveries, todayISO, horizonISO, onlyActive, today, blockersOf]);

  const unlinked = useMemo(() => deliveries.filter((d) => d.companyId == null), [deliveries]);
  const unmatched = useMemo(
    () => deliveries.filter((d) => d.companyId != null && d.taskId == null && d.kind !== "TEXT"),
    [deliveries],
  );

  const totals = useMemo(
    () => ({
      publishing: rows.reduce((n, r) => n + r.publishing.length, 0),
      delivering: rows.reduce((n, r) => n + r.delivering.length, 0),
      overdue: rows.reduce((n, r) => n + r.overdue.length, 0),
      atRisk: rows.reduce((n, r) => n + r.atRisk.length, 0),
    }),
    [rows],
  );

  const markPublished = (id: string) =>
    start(async () => {
      const r = await updateTaskStatus(id, "PUBLISHED");
      if (r.ok) {
        toast("تم تسجيل النشر");
        router.refresh();
      } else toast(r.error, "error");
    });

  const undo = (id: string) =>
    start(async () => {
      const r = await undoMatch(id);
      if (r.ok) {
        toast("تم التراجع عن المطابقة");
        router.refresh();
      } else toast(r.error, "error");
    });

  const dayName = ARABIC_DAYS[today.getDay()];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between flex-wrap gap-3 border-t-4 border-accent pt-3 -mt-3 rounded">
        <div>
          <h1 className="display-font text-2xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
            متابعة اليوم — {dayName} {today.getDate()}/{today.getMonth() + 1}
          </h1>
          <p className="text-sm text-fg-dim">
            شركة شركة: شو لازم ينزل، شو جاهز فعلاً، وشو وصل على تلغرام
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-dim cursor-pointer">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            className="accent-accent"
          />
          إخفاء الشركات الفاضية اليوم
        </label>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="ينزل اليوم" value={totals.publishing} icon={Send} tone="accent" />
        <Kpi label="تسليم اليوم" value={totals.delivering} icon={Clock} tone="info" />
        <Kpi label="معرّض للتأخير" value={totals.atRisk} icon={AlertTriangle} tone="warning" />
        <Kpi label="متأخر" value={totals.overdue} icon={AlertTriangle} tone="danger" />
      </div>

      {unlinked.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
          <Inbox className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {unlinked.length} رسالة وصلت من مجموعات غير مربوطة بشركة — اربطها من صفحة «تلغرام».
          </span>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-center text-fg-muted py-10">ما في شي مستحق اليوم.</p>
      )}

      <div className="flex flex-col gap-4">
        {rows.map(({ co, publishing, delivering, overdue, atRisk, arrived }) => (
          <section
            key={co.id}
            className="rounded-lg border border-border bg-bg-elev overflow-hidden"
            style={{ borderTopColor: co.color ?? "#0a8fa3", borderTopWidth: 3 }}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-soft flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold truncate">{co.name}</span>
                <span className="text-[10px] text-fg-muted font-mono">{companySlug(co)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                {publishing.length > 0 && <Tag tone="accent">ينزل {publishing.length}</Tag>}
                {delivering.length > 0 && <Tag tone="info">تسليم {delivering.length}</Tag>}
                {atRisk.length > 0 && <Tag tone="warning">خطر {atRisk.length}</Tag>}
                {overdue.length > 0 && <Tag tone="danger">متأخر {overdue.length}</Tag>}
              </div>
            </div>

            <div className="p-3 grid md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-3">
                {publishing.length > 0 && (
                  <Block title="🚀 ينزل اليوم">
                    {publishing.map((t) => {
                      const blockers = blockersOf(t);
                      const ready = blockers.length === 0;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 rounded-md border border-border-soft px-2 py-1.5"
                        >
                          <span
                            className="w-1.5 h-6 rounded-full shrink-0"
                            style={{
                              background: CONTENT_TYPE_COLORS[t.type as ContentType] ?? "#0a8fa3",
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{label(t)}</div>
                            <div className="text-[10px] text-fg-muted truncate">
                              {ready ? (
                                <span className="text-success">جاهز — {empName(t.assigneeId)}</span>
                              ) : (
                                <span className="text-warning">
                                  الإنتاج لسا مفتوح · {blockers.map((b) => empName(b.assigneeId)).join("، ")}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            disabled={busy}
                            onClick={() => markPublished(t.id)}
                            className="text-[10px] px-2 py-1 rounded border border-success/40 text-success hover:bg-success/10 shrink-0 disabled:opacity-50"
                          >
                            تم النشر
                          </button>
                        </div>
                      );
                    })}
                  </Block>
                )}

                {delivering.length > 0 && (
                  <Block title="🎬 تسليم اليوم">
                    {delivering.map((t) => (
                      <Line
                        key={t.id}
                        text={label(t)}
                        sub={empName(t.assigneeId)}
                        type={t.type as ContentType}
                        brief={t.brief}
                      />
                    ))}
                  </Block>
                )}

                {atRisk.length > 0 && (
                  <Block title="⚠️ معرّض للتأخير">
                    {atRisk.map((t) => (
                      <Line
                        key={t.id}
                        text={label(t)}
                        sub={`ينزل ${iso(t.publishDate)?.slice(5)} · الإنتاج لسا (${blockersOf(t)
                          .map((b) => empName(b.assigneeId))
                          .join("، ")})`}
                        type={t.type as ContentType}
                        tone="warning"
                      />
                    ))}
                  </Block>
                )}

                {overdue.length > 0 && (
                  // The backlog can be hundreds of cards; showing them all buries
                  // today's actual work. Oldest first, capped, with an honest tail
                  // count so nothing is silently hidden.
                  <Block title={`⏰ متأخر (${overdue.length})`}>
                    {overdue.slice(0, OVERDUE_PREVIEW).map((t) => (
                      <Line
                        key={t.id}
                        text={label(t)}
                        sub={`متأخر ${daysLateOfState(t, today)} يوم · ${empName(t.assigneeId)}`}
                        type={t.type as ContentType}
                        tone="danger"
                      />
                    ))}
                    {overdue.length > OVERDUE_PREVIEW && (
                      <p className="text-[10px] text-fg-muted">
                        و{overdue.length - OVERDUE_PREVIEW} غيرها — شوفيها بجدول المهام
                      </p>
                    )}
                  </Block>
                )}
              </div>

              {/* What actually landed in the group today */}
              <Block title="📥 وصل على المجموعة اليوم">
                {arrived.length === 0 && (
                  <p className="text-[11px] text-fg-muted">ما وصل شي بعد.</p>
                )}
                {arrived.map((d) => {
                  const Icon = KIND_ICON[d.kind] ?? FileText;
                  const matched = d.taskId ? tasks.find((t) => t.id === d.taskId) : null;
                  return (
                    <div
                      key={d.id}
                      className="flex items-start gap-2 rounded-md border border-border-soft px-2 py-1.5"
                    >
                      <Icon className="w-3.5 h-3.5 mt-0.5 text-fg-muted shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] truncate">
                          {d.fileName || d.caption?.slice(0, 40) || "بدون اسم"}
                        </div>
                        <div className="text-[10px] text-fg-muted truncate">
                          {d.senderName ?? "—"} ·{" "}
                          {new Date(d.sentAt).toLocaleTimeString("ar", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {matched ? (
                            <span className="text-success">
                              {" "}
                              · طابق {label(matched)}
                              {d.matchedBy === "TYPE" ? " (حسب النوع)" : ""}
                            </span>
                          ) : d.kind !== "TEXT" ? (
                            <span className="text-warning"> · ما طابق شي</span>
                          ) : null}
                        </div>
                      </div>
                      {d.taskId && (
                        <button
                          disabled={busy}
                          onClick={() => undo(d.id)}
                          title="مو هي — تراجع عن المطابقة"
                          className="text-fg-muted hover:text-danger shrink-0 disabled:opacity-50"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </Block>
            </div>
          </section>
        ))}
      </div>

      {unmatched.length > 0 && (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <h2 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> وصل ولم يُطابق ({unmatched.length})
          </h2>
          <p className="text-[11px] text-fg-muted mb-2">
            غالباً ما في قطعة مفتوحة من هالنوع، أو الاسم مو حسب الصيغة{" "}
            <span className="font-mono">Agalia 7-1</span>.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unmatched.map((d) => (
              <div key={d.id} className="text-[11px] rounded border border-border-soft bg-bg-elev px-2 py-1.5">
                <div className="truncate">{d.fileName || d.caption?.slice(0, 40) || "بدون اسم"}</div>
                <div className="text-[10px] text-fg-muted truncate">
                  {companies.find((c) => c.id === d.companyId)?.name} · {d.senderName ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- small bits

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Send;
  tone: "accent" | "info" | "warning" | "danger";
}) {
  const color = {
    accent: "text-accent",
    info: "text-info",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-bg-elev px-3 py-2 flex items-center gap-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-[11px] text-fg-muted truncate">{label}</div>
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: string }) {
  const cls = {
    accent: "bg-accent/10 text-accent border-accent/30",
    info: "bg-info/10 text-info border-info/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
  }[tone];
  return <span className={`rounded border px-1.5 py-0.5 ${cls}`}>{children}</span>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-semibold text-fg-dim">{title}</h3>
      {children}
    </div>
  );
}

function Line({
  text,
  sub,
  type,
  tone,
  brief,
}: {
  text: string;
  sub: string;
  type?: ContentType;
  tone?: "warning" | "danger";
  /** What the piece has to say — expandable so the row stays scannable. */
  brief?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const subColor = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-fg-muted";
  return (
    <div className="rounded-md border border-border-soft px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-6 rounded-full shrink-0"
          style={{ background: (type && CONTENT_TYPE_COLORS[type]) || "#0a8fa3" }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{text}</div>
          <div className={`text-[10px] truncate ${subColor}`}>{sub}</div>
        </div>
        {brief ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border text-fg-dim hover:text-accent hover:border-accent shrink-0"
          >
            {open ? "إخفاء" : "المطلوب"}
          </button>
        ) : (
          tone === undefined && <CheckCircle2 className="w-3.5 h-3.5 text-fg-muted/40" />
        )}
      </div>
      {open && brief && (
        <pre className="mt-1.5 text-[11px] whitespace-pre-wrap font-sans text-fg-dim bg-bg border border-border-soft rounded p-2 max-h-48 overflow-y-auto leading-relaxed">
          {brief}
        </pre>
      )}
    </div>
  );
}
