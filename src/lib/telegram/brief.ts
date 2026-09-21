/**
 * Morning brief (§14) — what the lead receives at 07:45 Damascus every day.
 *
 * The lead explicitly does NOT want the bot writing into client groups: every
 * message below is delivered to her private chat, one Telegram message each, so
 * she can forward the ones she wants. Nothing here sends anything — this module
 * is pure text assembly and is unit-tested as such.
 *
 * (١٦/٩/٢٠٢٦) القائدة: «بدي الصبح بس توزيع المهام» — الموجة العامة صارت الرسالة
 * الوحيدة يلي بتنبعت كل صباح: سطر لكل شخص بالشركة والعدد والنوع بلا أرقام قطع،
 * والنشر بالشركة ونوع المحتوى فقط. موجة التفاصيل وتقرير القائد (المعرّض
 * للتأخير + المتأخرات) بقيا للمعاينة والإرسال عند الطلب، وما بينبعتوا آلياً.
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
import { isDormantCompany } from "@/lib/company-visibility";
import { assetNameForTask } from "@/lib/asset-name";
import { hasStartedPublishing } from "@/lib/contract";
import { buildContentNumbers } from "@/lib/cards";
import { makeBlockedPredicate, selectDailyWorkTasks } from "@/lib/daily-work";
import { countByCompany, typesByCompany } from "./summary";

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
 *   "detail"  (08:00) — ONE sectioned sheet (تصميم / تصوير ومونتاج / نشر) with
 *                       the piece names and the plan's words.
 *   "all"             — both, for the «ابعتيلي البريف هلق» button.
 *
 * The per-company and per-person sheets are NOT part of any wave. They used to
 * be — wave 2 was 19 Telegram messages every morning — and the lead's verdict
 * (3/8) was «كل يوم عم يوصلني كتييير مسجات باسلوب عشوائي ما عم استفيد منه».
 * They still exist on `DailyBrief` because /admin/telegram previews them and she
 * forwards a single company's sheet on demand; they just never auto-send.
 */
export type BriefWave = "general" | "detail" | "all";

export function briefMessagesFor(brief: DailyBrief, wave: BriefWave): BriefMessage[] {
  // الصبح رسالة وحدة: توزيع المهام. تقرير القائد ما عاد ينبعت آلياً (١٦/٩).
  if (wave === "general") return [brief.schedule];
  if (wave === "detail") return [brief.detail];
  return [brief.schedule, brief.detail];
}

/** Publish dates within this many days count as "about to slip". */
const AT_RISK_DAYS = 2;
/** How much of a piece's content brief to inline in a personal message. */
const BRIEF_LINES = 6;
/** The publisher gets a one-line reminder of WHICH piece, not the whole script. */
const PUBLISH_BRIEF_CHARS = 90;
/** Worst-N overdue rows any single sheet is allowed to print. */
const LATE_IN_SHEET = 8;

const dISO = (d: Date | string | null | undefined): string | null =>
  d == null ? null : toISODate(d instanceof Date ? d : new Date(d));

function dayLabel(d: Date): string {
  return `${ARABIC_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * "اليوم" / "بكرا" / "الأحد 3/8" — how a deadline reads in a message.
 * A date that already passed must never read like a plan: «التسليم الأحد 28/6»
 * on the 2nd of August is a lie about when the piece is due.
 */
function relativeDayLabel(target: Date, today: Date): string {
  const t = dISO(target)!;
  const t0 = dISO(today)!;
  if (t === t0) return "اليوم";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (t === dISO(tomorrow)) return "بكرا";
  return dayLabel(target);
}

/** «— التسليم بكرا» / «— كان لازم يتسلّم الأحد 28/6» — never a past "due". */
function dueSuffix(t: Task, today: Date): string {
  const due = deadlineOf(t);
  if (!due) return "";
  const overdue = (dISO(due) ?? "") < (dISO(today) ?? "");
  return overdue
    ? ` — كان لازم يتسلّم ${dayLabel(due)}`
    : ` — التسليم ${relativeDayLabel(due, today)}`;
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
  /** نصّ الخطة تبع القطعة — محطوط على كرت التصميم، وكل المراحل بدها ياه. */
  const briefByPiece = new Map<string, string>();
  for (const t of tasks) {
    if (!t.pipelineKey || !t.brief?.trim() || briefByPiece.has(t.pipelineKey)) continue;
    briefByPiece.set(t.pipelineKey, t.brief);
  }
  const pieceBrief = (t: Task): string | null =>
    t.brief?.trim() || (t.pipelineKey ? (briefByPiece.get(t.pipelineKey) ?? null) : null);
  const who = (t: Task): string =>
    (t.assigneeId ? empById.get(t.assigneeId)?.name : null) ?? "غير مُسند";

  // A paused or archived company is not being worked on at all: Siizen has not
  // started and المول الصيني did not renew. Their cards must not surface
  // ANYWHERE in the brief — «Siizen 7-3 ينزل اليوم» in a message the lead
  // forwards is simply wrong.
  const dormant = new Set(companies.filter((c) => isDormantCompany(c)).map((c) => c.id));
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
    companies
      .filter((c) => !hasStartedPublishing(c) || c.lateExemptReason?.trim())
      .map((c) => c.id),
  );
  // كرت محجوز ما بينحسب متأخر: أليسار كانت تطلع «Makhbar 7-4 متأخر 15 يوم»
  // لريل ماجد لسا ما صوّرو. المتأخر هو التصوير، والمونتاج ما فيه يبلّش أصلاً.
  const isBlocked = makeBlockedPredicate(tasks);
  const late = open.filter(
    (t) =>
      isTaskLateState(t, today) &&
      !isBlocked(t) &&
      !(t.companyId && lateExempt.has(t.companyId)) &&
      // الموقوفة مركونة بانتظار الزبون — ما بتطلع «متأخر» بولا تقرير (5/8).
      !(t.companyId && dormant.has(t.companyId)),
  );
  const publishingToday = open.filter(
    (t) => t.stage === "PUBLISH" && dISO(t.publishDate) === todayISO,
  );

  // ------------------------------------------------- 1. العام (07:45) — «صباح الخير»
  // Written the way the lead writes it by hand: a greeting, then one bare line
  // per person — «أيمن ريلات جدارات». No bullets, no emoji, no counts, no dates,
  // no «متأخر ١٣ يوم». Anything more than "who owes what" belongs in wave 2.
  const workingToday = (e: Employee) => parseWorkDays(e.workDays).includes(today.getDay());
  /** «@Omar_ORR» when we know the handle — a real mention beats a name. */
  const mention = (e: Employee) =>
    e.telegramUsername?.trim() ? `@${e.telegramUsername.trim().replace(/^@/, "")}` : e.name;

  const scheduleLines: string[] = ["صباح الخير", ""];
  const idleToday: string[] = [];
  // كرت نشر بيدخل سطر عمر لما يكون إله شركة بتنشر فعلاً — والمعفاة (جدارات) ما
  // بتنشر أصلاً.
  //
  // كان بيستثني كل كرت خارج الخطة فيعدّه «مهمة متابعة» بلا اسم شركة. القائدة
  // (٢١/٩/٢٠٢٦): «خليه بشركة التوظيف — كرت نشر المسابقة». حملة مسابقة فوني
  // جوبس (٢٠/٩ → ٥/١٠) كرت خارج الخطة، فكانت رح تمرق أسبوعين بلا ما ينذكر
  // التوظيف ولا مرة بسطر النشر، بينما اللوح بيسمّيها — وهاد بالضبط التعارض
  // يلي رصدته. الشرط الباقي: لازم يكون إله شركة، وإلا ما في اسم يتسمّى فيه
  // (كرت «متابعة مع العملاء» بلا شركة بيضل «مهمة متابعة»).
  const publishPiece = (t: Task) =>
    t.stage === "PUBLISH" && !!t.companyId && !lateExempt.has(t.companyId);
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
    const owed = mineLate.filter((t) => !todays.some((x) => x.id === t.id));

    let headline: string;
    if (isPublisher(emp)) {
      // النشر بالشركة ونوع المحتوى فقط (القائدة ١٦/٩): «نشر: وصل (بوست، ستوري)
      // · التوظيف (بوست)، متراكم: عبادة (ستوري)» — بلا أعداد ولا أسماء قطع.
      const pubToday = todays.filter(publishPiece);
      const pubLate = owed.filter(publishPiece);
      // بلا `!publishPiece` بينعدّ الكرت مرتين: باسم شركته وكـ«مهمة متابعة».
      const followUps = todays.filter((t) => t.kind === "ADHOC" && !publishPiece(t)).length;
      headline = pubToday.length ? `نشر: ${typesByCompany(pubToday, coName)}` : "متابعة الصفحات والنشر";
      if (pubLate.length) headline += `، متراكم: ${typesByCompany(pubLate, coName)}`;
      if (followUps) headline += followUps === 1 ? " ومهمة متابعة" : ` و${followUps} مهام متابعة`;
    } else {
      // المهام بالشركة والعدد والنوع، بلا ترقيم كل بوست (القائدة ١٦/٩):
      // «التوظيف 3 بوست · التدريب 2 تصميم، ومتأخر: البلسم 3 ستوري».
      headline = countByCompany(todays, coName);
      const chase = owed.length ? `ومتأخر: ${countByCompany(owed, coName, 3)}` : "";
      if (chase) headline = headline ? `${headline}، ${chase}` : chase.replace(/^و/, "");
    }
    // Nothing today and nothing owed → not worth a line. Idle capacity is real
    // information though, so it goes to her private report instead.
    if (!headline) {
      if (workingToday(emp) && emp.isScheduled) idleToday.push(emp.name);
      continue;
    }
    // علامة RTL بأول السطر: منشن بحروف لاتينية (Nawal، @Omar_ORR) بيقلب اتجاه
    // السطر بعرض تلغرام فيطلع «خطة مانغو Nawal» والاسم بالآخر. العلامة بتثبّت
    // السياق عربي فيضل الاسم أول شي متل ما بتكتبها القائدة بإيدها.
    scheduleLines.push(`‏${mention(emp)} ${headline}`);
  }

  // -------------------------- 2. التقرير التفصيلي (٨:٠٠)
  // الهيكل حرفياً متل ما طلبته القائدة (2/8/2026):
  //   للتصميم:  1- أيمن …  2- سابين …
  //   للنشر:    3- عمر — شو لازم ينزل لكل شركة
  //   للكتابة:  4- نوال …
  //   فيديو:    5- ماجد (شو يصوّر)  6- أليسار (شو تمنتج)
  // الترقيم **متسلسل عبر الأقسام كلها** مو بيرجع لـ1 بكل قسم — «هيك لازم يطلعو
  // التقارير». والترتيب هو ترتيبها: تصميم ← نشر ← كتابة ← فيديو.
  const detailLines: string[] = [`📋 تفاصيل ${dateLabel}`];
  let itemNo = 0;

  /** بنود شخص: مهام اليوم بموعدها، وبعدها المتأخر عليه (بحد أقصى 6 + عدّاد). */
  const personItems = (emp: Employee): string[] => {
    const todays = selectDailyWorkTasks({ employee: emp, tasks: open, allTasks: tasks, companies, today });
    const mineLate = late
      .filter((t) => t.assigneeId === emp.id && !todays.some((x) => x.id === t.id))
      .sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
    const out: string[] = [];
    for (const t of todays) out.push(`   • ${pieceLabel(t)} · ${coName(t)}${dueSuffix(t, today)}`);
    for (const t of mineLate.slice(0, 6))
      out.push(`   • ${pieceLabel(t)} · ${coName(t)} — متأخر ${daysLateOfState(t, today)} يوم`);
    if (mineLate.length > 6) out.push(`   … و${mineLate.length - 6} متأخرات غيرها على اللوحة`);
    return out;
  };

  const isDesigner = (e: Employee) =>
    /designer|مصمم/i.test(e.role) && !isPublisher(e) && !isPhotographer(e) && !isEditor(e);
  const isWriter = (e: Employee) => /كات|writer/i.test(e.role);

  /** «1- أيمن:» وتحته بنوده. بيرجع false إذا ما في شي يتقال عنه. */
  const pushPerson = (name: string, items: string[], emptyLine?: string): boolean => {
    if (!items.length && !emptyLine) return false;
    detailLines.push(`${++itemNo}- ${name}:`);
    detailLines.push(...(items.length ? items : [`   ${emptyLine}`]));
    return true;
  };

  // ── للتصميم ──
  const designBlocks = employees
    .filter((e) => isDesigner(e) && workingToday(e))
    .map((e) => ({ e, items: personItems(e) }))
    .filter((b) => b.items.length);
  if (designBlocks.length) {
    detailLines.push("", "🎨 للتصميم:");
    for (const b of designBlocks) pushPerson(b.e.name, b.items);
  }

  // ── للنشر ── «شو لازم ينزل لكل شركة»: عدد بالنوع، مو أسماء القطع وحدة وحدة.
  const publisher = employees.find((e) => isPublisher(e));
  // شركة معفاة (جدارات) ما بتدخل قسم النشر إطلاقاً — العميل لسا ما بلّش ينشر.
  // والكروت اليدوية بتنعرض بالاسم تحت، فلو انعدّت هون بتنحسب مرتين.
  // كرت النشر `kind: "PUBLISH"` مو `"CONTENT"` — الشرط القديم كان بيستبعد الـ363
  // كرت نشر كلهن فيطلع قسم عمر فاضي. المقصود استبعاد **اليدوية** بس، لأنها
  // بتنعرض بالاسم تحت وبتنعدّ مرتين لو دخلت العدّاد.
  const publishable = (t: Task) =>
    t.kind !== "ADHOC" && !(t.companyId && lateExempt.has(t.companyId));
  const latePublish = late.filter((t) => t.stage === "PUBLISH" && publishable(t));
  if (publisher) {
    const byCo = new Map<string, { today: Task[]; late: Task[]; lateN: number }>();
    const bucket = (t: Task) => {
      const g = byCo.get(coName(t)) ?? { today: [], late: [], lateN: 0 };
      byCo.set(coName(t), g);
      return g;
    };
    for (const t of publishingToday.filter(publishable)) bucket(t).today.push(t);
    for (const t of latePublish) { const g = bucket(t); g.late.push(t); g.lateN++; }
    const byType = (list: Task[]) => {
      const m = new Map<string, number>();
      for (const t of list) m.set(typeLabel(t), (m.get(typeLabel(t)) ?? 0) + 1);
      return [...m.entries()].map(([k, n]) => `${n} ${k}`).join(" · ");
    };
    const rows: string[] = [];
    for (const [co, g] of [...byCo.entries()].sort(
      (a, b) => b[1].today.length - a[1].today.length || b[1].lateN - a[1].lateN,
    )) {
      const todayPart = g.today.length ? byType(g.today) : "—";
      const latePart = g.lateN ? ` · متراكم: ${byType(g.late)}` : "";
      rows.push(`   • ${co}: ${todayPart}${latePart}`);
    }
    // بنوده اليدوية (تثبيت مواعيد، استلام مواد) بالاسم — مكانها الوحيد.
    const followUps = [
      ...selectDailyWorkTasks({ employee: publisher, tasks: open, allTasks: tasks, companies, today })
        .filter((t) => t.kind === "ADHOC"),
      ...late.filter((t) => t.kind === "ADHOC" && t.assigneeId === publisher.id),
    ].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
    if (followUps.length) {
      rows.push("   متابعة وبنود يدوية:");
      for (const t of followUps)
        rows.push(`     – ${t.title ?? "—"}${t.companyId ? ` (${coName(t)})` : ""}`);
    }
    detailLines.push("", "🚀 للنشر:");
    pushPerson(publisher.name, rows, "ما في شي مجدول للنشر اليوم.");
  }

  // ── للكتابة ──
  const writeBlocks = employees
    .filter((e) => isWriter(e) && workingToday(e))
    .map((e) => ({ e, items: personItems(e) }))
    .filter((b) => b.items.length);
  if (writeBlocks.length) {
    detailLines.push("", "✍️ للكتابة:");
    for (const b of writeBlocks) pushPerson(b.e.name, b.items);
  }

  // ── فيديو ── تصوير ثم مونتاج، بنفس العدّاد المتسلسل.
  const shootBlocks = employees
    .filter((e) => isPhotographer(e) && e.isScheduled)
    .map((e) => ({ e, items: personItems(e) }));
  const editors = employees.filter((e) => isEditor(e)).map((e) => ({ e, items: personItems(e) }));
  if (shootBlocks.some((b) => b.items.length) || editors.length) {
    detailLines.push("", "🎬 فيديو:");
    for (const b of shootBlocks) pushPerson(`${b.e.name} (تصوير)`, b.items);
    for (const b of editors)
      pushPerson(`${b.e.name} (مونتاج)`, b.items, "ما في ريلات جاهزة للمونتاج.");
  }

  // ---------------------------------------------------------------- companies
  const companyMessages: BriefMessage[] = [];
  for (const co of companies) {
    if (!co.managed || isDormantCompany(co)) continue;
    const mine = open.filter((t) => t.companyId === co.id);

    // شركة معفاة (جدارات) ما بيصير يطلع لها «🚀 ينزل اليوم»: هي معفاة أصلاً لأنو
    // العميل لسا ما بلّش ينشر. الورقة كانت بتقول السببين مع بعض بنفس الرسالة.
    const publishing = lateExempt.has(co.id)
      ? []
      : mine.filter((t) => t.stage === "PUBLISH" && dISO(t.publishDate) === todayISO);
    const delivering = mine.filter((t) => t.stage !== "PUBLISH" && dISO(deadlineOf(t)) === todayISO);
    const overdue = lateExempt.has(co.id)
      ? []
      : mine
          .filter((t) => isTaskLateState(t, today))
          .sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
    if (!publishing.length && !delivering.length && !overdue.length) continue;

    const lines: string[] = [`📅 ${co.name} — ${dateLabel}`];
    // Say WHY nothing is late here, or the sheet looks like an oversight.
    if (lateExempt.has(co.id))
      lines.push(
        `(${co.lateExemptReason?.trim() || "النشر لسا ما بلّش عند الزبون"} — التأخير مو محسوب)`,
      );
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
      // القطعة الواحدة إلها كرت إنتاج وكرت نشر، فبلا ذكر المرحلة «Bru 7-1 · ستوري»
      // بتطلع مرتين بورقة وحدة وكأنها غلط بالداتا.
      for (const t of overdue.slice(0, LATE_IN_SHEET))
        lines.push(
          `• ${pieceLabel(t)}${t.stage === "PUBLISH" ? " (نشر)" : ""} — متأخر ${daysLateOfState(t, today)} يوم · ${who(t)}`,
        );
      if (overdue.length > LATE_IN_SHEET)
        lines.push(`… و${overdue.length - LATE_IN_SHEET} غيرها على اللوحة`);
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
        lines.push(`${i + 1}. ${pieceLabel(t)} · ${coName(t)}${dueSuffix(t, today)}`);
        // The plan's own words, so nobody has to open a Word file to start.
        // The text lives on the DESIGN card, but «الوصف مهم للتصميم والنشر
        // والتصوير والمونتاج» — so it is looked up per PIECE and every stage
        // gets it. The publisher gets ONE line: he needs to know which piece he
        // is posting, and pasting full scripts under all 35 of his cards is
        // what blew his sheet past Telegram's limit on the first real run.
        const bf = pieceBrief(t);
        if (bf) {
          const flat = bf.trim();
          if (t.stage === "PUBLISH") {
            const head = flat.split("\n").map((l) => l.trim()).find((l) => l.length > 2) ?? "";
            if (head)
              lines.push(
                `   ${head.slice(0, PUBLISH_BRIEF_CHARS)}${head.length > PUBLISH_BRIEF_CHARS ? "…" : ""}`,
              );
          } else {
            lines.push(`   ${flat.split("\n").slice(0, BRIEF_LINES).join("\n   ")}`);
          }
        } else {
          lines.push("   ⚠️ بلا وصف — نصّ الخطة ناقص");
        }
      });
    } else {
      lines.push("", "ما في مهام مجدولة اليوم.");
    }
    if (mineLate.length) {
      // Same cap as the company sheets: a personal message is a to-do list, not
      // an inventory. The full backlog is on the board.
      lines.push("", `⏰ متأخر عليك (${mineLate.length}):`);
      for (const t of mineLate.slice(0, LATE_IN_SHEET))
        lines.push(`• ${pieceLabel(t)} · ${coName(t)} — متأخر ${daysLateOfState(t, today)} يوم`);
      if (mineLate.length > LATE_IN_SHEET)
        lines.push(`… و${mineLate.length - LATE_IN_SHEET} غيرها على اللوحة`);
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
    // مرتّبة **شركة شركة** (القائدة 5/8): «متأخر بشركة كذا: القائمة، بعدين
    // المتأخر بشركة كذا». قائمة مسطّحة من ٤٠ سطر ما بتنقرا ولا بتنعمل فيها شي؛
    // مجمّعة بتصير مكالمة واحدة لكل زبون. الشركات بالأكثر تأخيراً أولاً، وجوّا
    // الشركة الأقدم أولاً — وسقف لكل شركة حتى وحدة ما تبلع الرسالة.
    const byCompany = new Map<string, Task[]>();
    for (const t of late) {
      const name = coName(t);
      const arr = byCompany.get(name) ?? [];
      arr.push(t);
      byCompany.set(name, arr);
    }
    leadLines.push("", `⏰ متأخرات (${late.length}) — حسب الشركة:`);
    const ordered = [...byCompany.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [name, rows] of ordered) {
      rows.sort((a, b) => daysLateOfState(b, today) - daysLateOfState(a, today));
      leadLines.push("", `▪️ ${name} (${rows.length}):`);
      for (const t of rows.slice(0, LATE_IN_SHEET))
        leadLines.push(`   • ${pieceLabel(t)} — ${daysLateOfState(t, today)} يوم · ${who(t)}`);
      if (rows.length > LATE_IN_SHEET)
        leadLines.push(`   … و${rows.length - LATE_IN_SHEET} غيرها على اللوحة`);
    }
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
