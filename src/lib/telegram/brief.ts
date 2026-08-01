/**
 * Morning brief (§14) — what the lead receives at 07:45 Damascus every day.
 *
 * The lead explicitly does NOT want the bot writing into client groups: every
 * message below is delivered to her private chat, one Telegram message each, so
 * she can forward the ones she wants. Nothing here sends anything — this module
 * is pure text assembly and is unit-tested as such.
 *
 * Sent in TWO WAVES (§14), because that is how the lead actually works:
 *   07:45 — «العام»: صباح الخير + ONE line per person, written the way she
 *           writes it by hand — «أيمن ريلات جدارات». No bullets, no emoji, no
 *           counts, no dates, no lateness figures. Just who owes what today.
 *           Her own risk report rides along (it is for her eyes, not the group).
 *   08:00 — «التفصيلي»: the per-person sheets, which DO carry the piece names,
 *           the plan's words and what is late on each person.
 * The per-company sheets go with the second wave too — same audience, same
 * level of detail.
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
  /** Wave 1 (07:45) — the one-line-per-person message she forwards as-is. */
  schedule: BriefMessage;
  /** Wave 2 (08:00) — today's publishing and deliveries, piece by piece. */
  detail: BriefMessage;
  companies: BriefMessage[];
  employees: BriefMessage[];
  lead: BriefMessage;
};

export type DeliveryStats = { matched: number; unmatched: number };

/**
 * Which wave to send. The lead sends the team two different things at two
 * different times, so the bot hands her two different batches:
 *   "general" (07:45) — the one-line-per-person message she forwards to the team
 *                       group as-is, plus her own private risk report.
 *   "detail"  (08:00) — the per-person and per-company sheets, with the piece
 *                       names, the plan's words and what is late on whom.
 *   "all"             — both, for the «ابعتيلي البريف هلق» button.
 */
export type BriefWave = "general" | "detail" | "all";

export function briefMessagesFor(brief: DailyBrief, wave: BriefWave): BriefMessage[] {
  if (wave === "general") return [brief.schedule, brief.lead];
  if (wave === "detail") return [brief.detail, ...brief.companies, ...brief.employees];
  return [brief.schedule, brief.lead, brief.detail, ...brief.companies, ...brief.employees];
}

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

  // A paused or archived company is not being worked on at all: Siizen has not
  // started and المول الصيني did not renew. Their cards must not surface
  // ANYWHERE in the brief — «Siizen 7-3 ينزل اليوم» in a message the lead
  // forwards is simply wrong.
  const dormant = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));
  const open = tasks.filter(
    (t) =>
      !isTaskDoneState(t) &&
      t.status !== "CANCELED" &&
      !(t.companyId && dormant.has(t.companyId)),
  );
  // A company whose delay is the CLIENT's (جدارات — the page access never came)
  // is exempt everywhere lateness is reported, «معرّض للتأخير» included. The
  // deadlines underneath are untouched; clearing the reason restores them.
  const lateExempt = new Set(
    companies.filter((c) => c.lateExemptReason?.trim()).map((c) => c.id),
  );
  const late = open.filter(
    (t) => isTaskLateState(t, today) && !(t.companyId && lateExempt.has(t.companyId)),
  );
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

  // ------------------------------------------------- 1. العام (07:45) — «صباح الخير»
  // Written the way the lead writes it by hand: a greeting, then one bare line
  // per person — «أيمن ريلات جدارات». No bullets, no emoji, no counts, no dates,
  // no «متأخر ١٣ يوم». Anything more than "who owes what" belongs in wave 2.
  const workingToday = (e: Employee) => parseWorkDays(e.workDays).includes(today.getDay());
  /** «@Omar_ORR» when we know the handle — a real mention beats a name. */
  const mention = (e: Employee) =>
    e.telegramUsername?.trim() ? `@${e.telegramUsername.trim().replace(/^@/, "")}` : e.name;

  /**
   * «ريلات جدارات · تصاميم وصل» — kinds of work grouped by company, no pieces.
   * Capped at `max` companies (busiest first): a line naming nine companies is
   * the wall of text she asked us to stop sending. The rest is «وغيرها».
   */
  const groupByCompany = (list: Task[], max = 2): string => {
    // A bare «تصاميم» tells her nothing — every entry must name WHO it is for.
    // A company card names its company; an ad-hoc card has no company, so its
    // own title is the name (and already says what the work is).
    const named = new Map<string, { kinds: Set<string>; n: number }>();
    for (const t of list) {
      const co = t.companyId ? coById.get(t.companyId)?.name : null;
      const label = co ?? t.title?.trim() ?? "";
      if (!label || label === "—") continue; // unnameable → better silent than bare
      const entry = named.get(label) ?? { kinds: new Set<string>(), n: 0 };
      entry.n++;
      // Only a company entry takes a kind word in front of it.
      if (co)
        entry.kinds.add(
          t.stage === "SHOOT"
            ? "تصوير"
            : t.type === "REEL" || t.type === "AI_REEL"
              ? "ريلات"
              : t.stage === "WRITE"
                ? "كتابة"
                : "تصاميم",
        );
      named.set(label, entry);
    }
    const ordered = [...named.entries()].sort((a, b) => b[1].n - a[1].n);
    const shown = ordered
      .slice(0, max)
      .map(([label, { kinds }]) => [[...kinds].join(" و"), label].filter(Boolean).join(" "));
    if (ordered.length > max) shown.push("وغيرها");
    return shown.join(" · ");
  };

  const scheduleLines: string[] = ["صباح الخير", ""];
  const idleToday: string[] = [];
  for (const emp of employees) {
    const mineLate = late.filter((t) => t.assigneeId === emp.id);
    // Off today → not on today's list at all. A freelancer has no standing
    // schedule either; they appear only when work is actually on them.
    if (!workingToday(emp) && !mineLate.length) continue;
    if (isFreelance(emp) && !mineLate.length) continue;
    const todays = selectDailyWorkTasks({
      employee: emp,
      tasks: open,
      allTasks: tasks,
      companies,
      today,
    });

    // What they owe, as a bare noun phrase — «ريلات أغاليا المتأخرة». Never a
    // day count: she chases people, she doesn't invoice them.
    const owed = mineLate.filter((t) => !todays.some((x) => x.id === t.id));

    // The chase names COMPANIES only — what kind of work it is, is obvious from
    // whose line it is. «المتأخر التوظيف ووصل وغيرها». A company already named
    // in today's part is dropped: repeating it reads like a stutter.
    const todayCompanies = new Set(todays.map(coName));
    const owedCompanies = [
      ...new Set(owed.map((t) => (t.companyId ? coName(t) : (t.title?.trim() || "—")))),
    ].filter((c) => c && c !== "—" && !todayCompanies.has(c));
    let headline: string;
    let chase = owedCompanies.length
      ? `المتأخر ${owedCompanies.slice(0, 2).join(" و")}${owedCompanies.length > 2 ? " وغيرها" : ""}`
      : "";
    if (isPublisher(emp)) {
      // The publisher's day is always the same shape — the count is noise, and
      // his "late" list is the standing publish backlog, not a daily chase.
      headline = "متابعة الصفحات والنشر";
      chase = "";
    } else if (isEditor(emp)) {
      headline = editQueue.length
        ? `مونتاج ريلات ${[...new Set(editQueue.map(coName))].join(" و")}`
        : "";
    } else {
      headline = groupByCompany(todays);
    }
    if (chase) headline = headline ? `${headline}، و${chase}` : chase;
    // Nothing today and nothing owed → not worth a line. Idle capacity is real
    // information though, so it goes to her private report instead.
    if (!headline) {
      if (workingToday(emp) && emp.isScheduled) idleToday.push(emp.name);
      continue;
    }
    scheduleLines.push(`${mention(emp)} ${headline}`);
  }

  // -------------------------- 2. التقرير التفصيلي (٨:٠٠) — أقسام، بطلب القائدة
  // «التصميم: أيمن، سابين · التصوير والمونتاج: ماجد (شو يصوّر)، أليسار (شو
  // تسلّم) · النشر: عمر — شو ننشر لكل شركة». كل بند مع موعده.
  const detailLines: string[] = [`📋 تفاصيل ${dateLabel}`];

  /** بنود شخص: مهام اليوم بموعدها، وبعدها المتأخر عليه (بحد أقصى 6 + عدّاد). */
  const personItems = (emp: Employee): string[] => {
    const todays = selectDailyWorkTasks({ employee: emp, tasks: open, allTasks: tasks, companies, today });
    const mineLate = late
      .filter((t) => t.assigneeId === emp.id && !todays.some((x) => x.id === t.id))
      .sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
    const out: string[] = [];
    for (const t of todays) {
      const due = deadlineOf(t);
      out.push(`   • ${pieceLabel(t)} · ${coName(t)}${due ? ` — التسليم ${relativeDayLabel(due, today)}` : ""}`);
    }
    for (const t of mineLate.slice(0, 6))
      out.push(`   • ${pieceLabel(t)} · ${coName(t)} — متأخر ${daysLateOfState(t, today)} يوم`);
    if (mineLate.length > 6) out.push(`   … و${mineLate.length - 6} متأخرات غيرها على اللوحة`);
    return out;
  };

  const isDesigner = (e: Employee) =>
    /designer|مصمم/i.test(e.role) && !isPublisher(e) && !isPhotographer(e) && !isEditor(e);
  const isWriter = (e: Employee) => /كات|writer/i.test(e.role);

  // — التصميم —
  const designers = employees.filter((e) => isDesigner(e) && workingToday(e));
  const designBlocks = designers
    .map((e) => ({ e, items: personItems(e) }))
    .filter((b) => b.items.length);
  if (designBlocks.length) {
    detailLines.push("", "🎨 التصميم:");
    designBlocks.forEach((b, i) => {
      detailLines.push(`${i + 1}- ${b.e.name}:`);
      detailLines.push(...b.items);
    });
  }

  // — الكتابة — (مو بهيكل القائدة الحرفي، بس نوال لازم مكان لما يكون عندها شغل)
  const writers = employees.filter((e) => isWriter(e) && workingToday(e));
  const writeBlocks = writers.map((e) => ({ e, items: personItems(e) })).filter((b) => b.items.length);
  if (writeBlocks.length) {
    detailLines.push("", "✍️ الكتابة:");
    for (const b of writeBlocks) {
      detailLines.push(`${b.e.name}:`);
      detailLines.push(...b.items);
    }
  }

  // — التصوير والمونتاج —
  const shooters = employees.filter((e) => isPhotographer(e) && e.isScheduled);
  const shootBlocks = shooters.map((e) => ({ e, items: personItems(e) })).filter((b) => b.items.length);
  const editors = employees.filter((e) => isEditor(e));
  if (shootBlocks.length || editQueue.length) {
    detailLines.push("", "🎬 التصوير والمونتاج:");
    let n = 0;
    for (const b of shootBlocks) {
      detailLines.push(`${++n}- تصوير (${b.e.name}):`);
      detailLines.push(...b.items);
    }
    for (const ed of editors) {
      detailLines.push(`${++n}- مونتاج (${ed.name}):`);
      if (editQueue.length)
        for (const t of editQueue)
          detailLines.push(`   • ${pieceLabel(t)} · ${coName(t)} (تصوير ${dayLabel(new Date(t.finishedAt!))})`);
      else detailLines.push("   ما في ريلات جاهزة للمونتاج.");
    }
  }

  // — النشر — «شو لازم ننشر لكل شركة»: قطع اليوم بالتفصيل، والمتراكم عدّاد لكل
  // شركة (تعدادو قطعة قطعة هو جدار الـ٩٣ سطر يلي منعنا عنه).
  const publisher = employees.find((e) => isPublisher(e));
  // شركة معفاة (جدارات) ما بتدخل قسم النشر إطلاقاً: العميل لسا ما بلّش ينشر،
  // فما في شي «لازم ينتشر» عندها لحد ما توصل الإشارة.
  const publishable = (t: Task) => !(t.companyId && lateExempt.has(t.companyId));
  const latePublish = late.filter((t) => t.stage === "PUBLISH" && publishable(t));
  if (publisher) {
    detailLines.push("", `🚀 النشر (${publisher.name}):`);
    const byCo = new Map<string, { today: Task[]; lateN: number }>();
    for (const t of publishingToday.filter(publishable)) {
      const g = byCo.get(coName(t)) ?? { today: [], lateN: 0 };
      g.today.push(t);
      byCo.set(coName(t), g);
    }
    for (const t of latePublish) {
      const g = byCo.get(coName(t)) ?? { today: [], lateN: 0 };
      g.lateN++;
      byCo.set(coName(t), g);
    }
    if (!byCo.size) detailLines.push("   ما في شي مجدول للنشر اليوم.");
    for (const [co, g] of [...byCo.entries()].sort((a, b) => b[1].today.length - a[1].today.length || b[1].lateN - a[1].lateN)) {
      const pieces = g.today.map((t) => pieceLabel(t)).join(" · ");
      const tail = g.lateN ? ` (ومتراكم ${g.lateN})` : "";
      detailLines.push(`   • ${co}: ${pieces || "—"}${tail}`);
    }
  }

  // ---------------------------------------------------------------- companies
  const companyMessages: BriefMessage[] = [];
  for (const co of companies) {
    if (!co.managed || co.status !== "active") continue;
    const mine = open.filter((t) => t.companyId === co.id);

    const publishing = mine.filter((t) => t.stage === "PUBLISH" && dISO(t.publishDate) === todayISO);
    const delivering = mine.filter((t) => t.stage !== "PUBLISH" && dISO(deadlineOf(t)) === todayISO);
    const overdue = lateExempt.has(co.id)
      ? []
      : mine
          .filter((t) => isTaskLateState(t, today))
          .sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
    if (!publishing.length && !delivering.length && !overdue.length) continue;

    const lines: string[] = [`📅 ${co.name} — ${dateLabel}`];
    // Say WHY nothing is late here, or the sheet looks like an oversight.
    if (lateExempt.has(co.id)) lines.push(`(${co.lateExemptReason} — التأخير مو محسوب)`);
    if (publishing.length) {
      lines.push("", "🚀 ينزل اليوم:");
      for (const t of publishing) lines.push(`• ${pieceLabel(t)} — ${who(t)}`);
    }
    if (delivering.length) {
      lines.push("", "🎬 تسليم اليوم:");
      for (const t of delivering) lines.push(`• ${pieceLabel(t)} — ${who(t)}`);
    }
    if (overdue.length) {
      // Worst 8 only — وصل's sheet once ran 35 lines, and a wall of overdue
      // rows is exactly the noise the lead told us to stop sending. The full
      // list lives on the board; the sheet's job is «شو أهم شي وقف».
      lines.push("", `⏰ متأخر (${overdue.length}):`);
      for (const t of overdue.slice(0, 8))
        lines.push(`• ${pieceLabel(t)} — متأخر ${daysLateOfState(t, today)} يوم · ${who(t)}`);
      if (overdue.length > 8) lines.push(`… و${overdue.length - 8} غيرها على اللوحة`);
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
      // جدارات-style exemption: the client is the blocker, so «about to slip»
      // is as meaningless for it as «late» — nothing can be published anyway.
      if (t.companyId && lateExempt.has(t.companyId)) return false;
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
  // Who is free today. Deliberately absent from the group-facing message — but
  // she is the one who reassigns work, so she needs to know there is slack.
  if (idleToday.length) leadLines.push("", `🟢 فاضي اليوم: ${idleToday.join("، ")}`);

  return {
    dateLabel,
    schedule: { key: "schedule", title: "العام (٧:٤٥)", text: scheduleLines.join("\n") },
    detail: { key: "detail", title: "التفصيلي (٨:٠٠)", text: detailLines.join("\n") },
    companies: companyMessages,
    employees: employeeMessages,
    lead: { key: "lead", title: "تقرير القائد", text: leadLines.join("\n") },
  };
}
