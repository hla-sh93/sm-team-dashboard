/**
 * Morning brief (§14) — what the lead receives at 07:45 Damascus every day.
 *
 * The lead explicitly does NOT want the bot writing into client groups: every
 * message below is delivered to her private chat, one Telegram message each, so
 * she can forward the ones she wants. Nothing here sends anything — this module
 * is pure text assembly and is unit-tested as such.
 *
 * Two messages, in this order, by her instruction:
 *   1. جدول المهام — one line per person: name + headline, NO detail.
 *   2. التفصيلي    — today's publishing and today's deliveries, piece by piece.
 * Then the per-company sheets she forwards, and her own risk report.
 *
 * Pieces are named with the canonical «Agalia 7-1» so the brief, the dashboard
 * and the delivered file all say the same thing.
 */
import type { Company, Employee, Task } from "@/types";
import {
  CONTENT_TYPE_LABELS,
  daysLateOfState,
  isTaskDoneState,
  isTaskLateState,
  type ContentType,
} from "@/lib/constants";
import { ARABIC_DAYS, parseWorkDays, toISODate } from "@/lib/dates";
import { assetNameForTask } from "@/lib/asset-name";
import { buildContentNumbers } from "@/lib/cards";
import { selectDailyWorkTasks } from "@/lib/daily-work";

export type BriefMessage = {
  /** Stable key — "schedule" / "detail" / companyId / "lead". */
  key: string;
  /** Who or what it is about, for the dashboard preview list. */
  title: string;
  text: string;
};

export type DailyBrief = {
  dateLabel: string;
  /** Message 1 — the headline schedule, no detail. */
  schedule: BriefMessage;
  /** Message 2 — today's publishing and deliveries, piece by piece. */
  detail: BriefMessage;
  companies: BriefMessage[];
  employees: BriefMessage[];
  lead: BriefMessage;
};

export type DeliveryStats = { matched: number; unmatched: number };

/** Publish dates within this many days count as "about to slip". */
const AT_RISK_DAYS = 2;
/** How much of a piece's content brief to inline in a personal message. */
const BRIEF_LINES = 6;
/**
 * Editing starts the DAY AFTER the shoot, and the editor gets through this many
 * reels a day — the lead's rule, and the only way ماجد's shooting turns into a
 * concrete list of what أليسار opens each morning.
 */
const EDIT_STARTS_AFTER_DAYS = 1;
const EDITS_PER_DAY = 3;

const dISO = (d: Date | string | null | undefined): string | null =>
  d == null ? null : toISODate(d instanceof Date ? d : new Date(d));

function dayLabel(d: Date): string {
  return `${ARABIC_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** "اليوم" / "بكرا" / "الأحد 3/8" — how a deadline reads in a message. */
function relativeDayLabel(target: Date, today: Date): string {
  const t = dISO(target)!;
  const t0 = dISO(today)!;
  if (t === t0) return "اليوم";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (t === dISO(tomorrow)) return "بكرا";
  return dayLabel(target);
}

const typeLabel = (t: Task): string =>
  CONTENT_TYPE_LABELS[t.type as ContentType] ?? (t.stage === "WRITE" ? "كتابة" : "مهمة");

/** Deadline that matters for this card: publish date for نشر, ready date else. */
function deadlineOf(t: Task): Date | null {
  const raw = t.stage === "PUBLISH" ? (t.publishDate ?? t.readyDate) : (t.readyDate ?? t.publishDate);
  return raw ? new Date(raw) : null;
}

const isPublisher = (e: Employee) => /ناشر|publish/i.test(e.role);
const isPhotographer = (e: Employee) => e.isPhotographer || /مصور/.test(e.role);
const isEditor = (e: Employee) => /مونتير|مونتاج|editor/i.test(e.role);
/** Freelancers carry no daily schedule — they only appear when assigned work. */
const isFreelance = (e: Employee) => !e.isScheduled && e.salary === 0;

export function buildDailyBrief({
  today = new Date(),
  companies,
  employees,
  tasks,
  deliveries,
}: {
  today?: Date;
  companies: Company[];
  employees: Employee[];
  tasks: Task[];
  deliveries?: DeliveryStats;
}): DailyBrief {
  const todayISO = toISODate(today);
  const numbers = buildContentNumbers(tasks);
  const coById = new Map(companies.map((c) => [c.id, c]));
  const empById = new Map(employees.map((e) => [e.id, e]));
  const dateLabel = dayLabel(today);

  /** «Agalia 7-3 · بوست» — falls back to the Arabic card label when unnamed. */
  const pieceLabel = (t: Task): string => {
    const co = t.companyId ? coById.get(t.companyId) : null;
    const asset = assetNameForTask(co, t, numbers);
    const kind = typeLabel(t);
    if (asset) return `${asset} · ${kind}`;
    const n = numbers.get(t.id);
    return n ? `${kind}-${n}` : (t.title?.trim() || kind);
  };
  const coName = (t: Task): string =>
    (t.companyId ? coById.get(t.companyId)?.name : null) ?? "—";
  const who = (t: Task): string =>
    (t.assigneeId ? empById.get(t.assigneeId)?.name : null) ?? "غير مُسند";

  const open = tasks.filter((t) => !isTaskDoneState(t) && t.status !== "CANCELED");
  const late = open.filter((t) => isTaskLateState(t, today));
  const publishingToday = open.filter(
    (t) => t.stage === "PUBLISH" && dISO(t.publishDate) === todayISO,
  );

  /**
   * What the editor opens today: reels shot at least a day ago whose edit is
   * still outstanding, oldest shoot first, capped at a day's throughput.
   */
  const editQueue = (() => {
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - EDIT_STARTS_AFTER_DAYS);
    const shot = tasks
      .filter(
        (t) =>
          (t.type === "REEL" || t.type === "AI_REEL") &&
          t.stage !== "PUBLISH" &&
          isTaskDoneState(t) &&
          t.finishedAt != null &&
          new Date(t.finishedAt) <= cutoff,
      )
      .filter((t) => {
        // Not yet published → the cut still has to go out.
        const pub = tasks.find((p) => p.pipelineKey === t.pipelineKey && p.stage === "PUBLISH");
        return pub != null && !isTaskDoneState(pub);
      })
      .sort((a, b) => new Date(a.finishedAt!).getTime() - new Date(b.finishedAt!).getTime());
    return shot.slice(0, EDITS_PER_DAY);
  })();

  // ---------------------------------------------------- 1. جدول المهام (ملخّص)
  const scheduleLines: string[] = [`🗓️ جدول ${dateLabel}`, ""];
  const workingToday = (e: Employee) => parseWorkDays(e.workDays).includes(today.getDay());
  for (const emp of employees) {
    const assignedLate = late.filter((t) => t.assigneeId === emp.id).length;
    // A freelance photographer has no standing schedule; list them only when
    // there is actually something on their plate.
    if (isFreelance(emp) && !assignedLate) continue;
    const todays = selectDailyWorkTasks({
      employee: emp,
      tasks: open,
      allTasks: tasks,
      companies,
      today,
    });
    let headline: string;
    if (isPublisher(emp)) {
      // The publisher's day is always the same shape: chase the clients, publish.
      const n = publishingToday.length;
      headline = n ? `متابعة مع الزباين والنشر — ${n} قطعة اليوم` : "متابعة مع الزباين";
    } else if (isEditor(emp)) {
      headline = editQueue.length
        ? `مونتاج ${editQueue.length} ريل — ${[...new Set(editQueue.map(coName))].join("، ")}`
        : "ما في ريلات جاهزة للمونتاج";
    } else if (!workingToday(emp)) {
      headline = "عطلة";
    } else if (!todays.length) {
      headline = isPhotographer(emp) ? "ما في تصوير اليوم" : "ما في مهام مجدولة";
    } else {
      // Group into «تصاميم وصل» / «ريلات جدارات» — the headline, never the pieces.
      const byCompany = new Map<string, Set<string>>();
      for (const t of todays) {
        const set = byCompany.get(coName(t)) ?? new Set<string>();
        set.add(
          t.stage === "SHOOT"
            ? "تصوير"
            : t.type === "REEL" || t.type === "AI_REEL"
              ? "ريلات"
              : t.stage === "WRITE"
                ? "كتابة"
                : "تصاميم",
        );
        byCompany.set(coName(t), set);
      }
      headline = [...byCompany.entries()]
        .map(([co, kinds]) => `${[...kinds].join(" و")}${co && co !== "—" ? ` ${co}` : ""}`)
        .join(" · ");
    }
    scheduleLines.push(
      `• ${emp.name}: ${headline}${assignedLate ? `  (متأخر ${assignedLate})` : ""}`,
    );
  }

  // ------------------------------------------------------- 2. التقرير التفصيلي
  const detailLines: string[] = [`📋 تفاصيل ${dateLabel}`];

  if (publishingToday.length) {
    detailLines.push("", "🚀 النشر اليوم:");
    for (const t of publishingToday.sort((a, b) => coName(a).localeCompare(coName(b))))
      detailLines.push(`• ${pieceLabel(t)} — ${coName(t)}`);
  } else {
    detailLines.push("", "🚀 النشر اليوم: ما في شي مجدول.");
  }

  const deliveringToday = open.filter(
    (t) => t.stage !== "PUBLISH" && dISO(deadlineOf(t)) === todayISO,
  );
  if (deliveringToday.length) {
    detailLines.push("", "🎯 تسليم اليوم:");
    const byPerson = new Map<string, Task[]>();
    for (const t of deliveringToday) {
      const arr = byPerson.get(who(t)) ?? [];
      arr.push(t);
      byPerson.set(who(t), arr);
    }
    for (const [person, list] of byPerson) {
      detailLines.push(`${person}:`);
      for (const t of list) detailLines.push(`   • ${pieceLabel(t)} — ${coName(t)}`);
    }
  }

  if (editQueue.length) {
    detailLines.push("", "🎬 مونتاج اليوم:");
    for (const t of editQueue) {
      const shotOn = new Date(t.finishedAt!);
      detailLines.push(`• ${pieceLabel(t)} — ${coName(t)} (تصوير ${dayLabel(shotOn)})`);
    }
  }

  if (late.length) {
    detailLines.push("", `⏰ متأخر (${late.length}):`);
    for (const t of late.slice(0, 12))
      detailLines.push(
        `• ${pieceLabel(t)} — ${coName(t)} · ${who(t)} · ${daysLateOfState(t, today)} يوم`,
      );
    if (late.length > 12) detailLines.push(`… و${late.length - 12} غيرها على اللوحة`);
  }

  // ---------------------------------------------------------------- companies
  const companyMessages: BriefMessage[] = [];
  for (const co of companies) {
    if (!co.managed || co.status !== "active") continue;
    const mine = open.filter((t) => t.companyId === co.id);

    const publishing = mine.filter((t) => t.stage === "PUBLISH" && dISO(t.publishDate) === todayISO);
    const delivering = mine.filter((t) => t.stage !== "PUBLISH" && dISO(deadlineOf(t)) === todayISO);
    const overdue = mine
      .filter((t) => isTaskLateState(t, today))
      .sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
    if (!publishing.length && !delivering.length && !overdue.length) continue;

    const lines: string[] = [`📅 ${co.name} — ${dateLabel}`];
    if (publishing.length) {
      lines.push("", "🚀 ينزل اليوم:");
      for (const t of publishing) lines.push(`• ${pieceLabel(t)} — ${who(t)}`);
    }
    if (delivering.length) {
      lines.push("", "🎬 تسليم اليوم:");
      for (const t of delivering) lines.push(`• ${pieceLabel(t)} — ${who(t)}`);
    }
    if (overdue.length) {
      lines.push("", "⏰ متأخر:");
      for (const t of overdue)
        lines.push(`• ${pieceLabel(t)} — متأخر ${daysLateOfState(t, today)} يوم · ${who(t)}`);
    }
    companyMessages.push({ key: co.id, title: co.name, text: lines.join("\n") });
  }

  // ---------------------------------------------------------------- employees
  const employeeMessages: BriefMessage[] = [];
  for (const emp of employees) {
    const todays = selectDailyWorkTasks({ employee: emp, tasks: open, allTasks: tasks, companies, today });
    const mineLate = late
      .filter((t) => t.assigneeId === emp.id && !todays.some((x) => x.id === t.id))
      .sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
    if (!todays.length && !mineLate.length) continue;

    const lines: string[] = [`☀️ صباح الخير ${emp.name} — ${dateLabel}`];
    if (todays.length) {
      lines.push("", "مهامك اليوم:");
      todays.forEach((t, i) => {
        const due = deadlineOf(t);
        const when = due ? ` — التسليم ${relativeDayLabel(due, today)}` : "";
        lines.push(`${i + 1}. ${pieceLabel(t)} · ${coName(t)}${when}`);
        // The plan's own words, so nobody has to open a Word file to start.
        if (t.brief) {
          const trimmed = t.brief.trim().split("\n").slice(0, BRIEF_LINES).join("\n   ");
          lines.push(`   ${trimmed}`);
        }
      });
    } else {
      lines.push("", "ما في مهام مجدولة اليوم.");
    }
    if (mineLate.length) {
      lines.push("", "⏰ متأخر عليك:");
      for (const t of mineLate)
        lines.push(`• ${pieceLabel(t)} · ${coName(t)} — متأخر ${daysLateOfState(t, today)} يوم`);
    }
    employeeMessages.push({ key: emp.id, title: emp.name, text: lines.join("\n") });
  }

  // --------------------------------------------------------------------- lead
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + AT_RISK_DAYS);
  const horizonISO = toISODate(horizon);
  const openByPipeline = new Map<string, Task[]>();
  for (const t of open) {
    if (!t.pipelineKey) continue;
    const arr = openByPipeline.get(t.pipelineKey) ?? [];
    arr.push(t);
    openByPipeline.set(t.pipelineKey, arr);
  }
  // A piece is at risk when its نشر card is due within the horizon while its own
  // production card is still open — the gap the lead used to discover only on
  // the publish day.
  const atRisk = open
    .filter((t) => {
      if (t.stage !== "PUBLISH") return false;
      const pd = dISO(t.publishDate);
      if (!pd || pd < todayISO || pd > horizonISO) return false;
      const siblings = t.pipelineKey ? (openByPipeline.get(t.pipelineKey) ?? []) : [];
      return siblings.some((s) => s.id !== t.id && s.stage !== "PUBLISH");
    })
    .sort((a, b) => (dISO(a.publishDate) ?? "").localeCompare(dISO(b.publishDate) ?? ""));

  const leadLines: string[] = [`🧭 المتابعة اليومية — ${dateLabel}`];
  if (atRisk.length) {
    leadLines.push("", `⚠️ معرّض للتأخير (${atRisk.length}):`);
    for (const t of atRisk) {
      const blockers = (openByPipeline.get(t.pipelineKey!) ?? [])
        .filter((s) => s.id !== t.id && s.stage !== "PUBLISH")
        .map((s) => who(s))
        .join("، ");
      leadLines.push(
        `• ${pieceLabel(t)} · ${coName(t)} — ينزل ${relativeDayLabel(new Date(t.publishDate!), today)} والإنتاج لسا مفتوح (${blockers})`,
      );
    }
  } else {
    leadLines.push("", "✅ ما في قطعة معرّضة للتأخير خلال يومين.");
  }
  if (late.length) {
    leadLines.push("", `⏰ متأخرات (${late.length}):`);
    for (const t of late.slice(0, 10))
      leadLines.push(`• ${pieceLabel(t)} · ${coName(t)} — ${daysLateOfState(t, today)} يوم · ${who(t)}`);
    if (late.length > 10) leadLines.push(`… و${late.length - 10} غيرها على لوحة المهام`);
  }
  if (deliveries) {
    leadLines.push(
      "",
      `📥 وصل على تلغرام آخر ٢٤ ساعة: ${deliveries.matched + deliveries.unmatched} ملف` +
        (deliveries.unmatched ? ` (${deliveries.unmatched} غير مطابق)` : ""),
    );
  }

  return {
    dateLabel,
    schedule: { key: "schedule", title: "جدول المهام", text: scheduleLines.join("\n") },
    detail: { key: "detail", title: "التقرير التفصيلي", text: detailLines.join("\n") },
    companies: companyMessages,
    employees: employeeMessages,
    lead: { key: "lead", title: "تقرير القائد", text: leadLines.join("\n") },
  };
}
