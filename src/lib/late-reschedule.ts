/**
 * «إعادة جدولة المتأخر» — زرّ الإدارة (القائدة ٢٧/١٠: «بس اكبسه بيعمل إعادة جدولة للمهام
 * المتأخرة كلها، مع مراعاة الإزاحة لباقي المهام وتأثيراتها على بعضها … مع إمكانية سحب
 * تاريخ اليوم فبيعمل الجدولة من التاريخ يلي بختاره»).
 *
 * نقي (بلا قاعدة): بياخد الكروت والموظفين والشركات ويرجّع **خطة** نقلات — المعاينة
 * والتطبيق بيقروا نفس الجواب. نفس منهج إعادة جدولة ١١/١٠ يدوياً (`prod-65…72`)، بس مؤتمت:
 *
 *  - «متأخر» = تعريف `late.ts` الوحيد (ومعه «بانتظار» — موعده فات وحاجزه مفتوح).
 *  - كل كرت إنتاج متأخر بينحطّ بأول يوم دوام لصاحبه من تاريخ البداية فيه سعة (معدّل
 *    الشخص، `dailyTaskEffortDays` — نفس حساب «مهام اليوم»)، بعد حاجزه بالمهلة:
 *    كتابة ← +١ يوم · تصوير ← مونتاج `SHOOT_BEFORE_MONTAGE.min` · إنتاج ← نشر `LEAD`.
 *  - التصوير المتأخر بدّو موعد جديد مع الزبون: مو أبكر من `SHOOT_APPOINTMENT_NOTICE_DAYS`.
 *  - **الإزاحة:** النشر بيضل بالترتيب الرقمي لكل نوع (القطعة N بعد N−1)، وما في قطعتي
 *    تغذية (بوست/ريل) لنفس الشركة بنفس اليوم، ولا ستوريين. القطعة يلي ما تأخّرت بس صار
 *    يومها قبل يلي قبلها، أو حاجزها انزاح بعدها، بتنزاح كمان — وبس هي.
 *  - الترتيب بالسعة: أولوية الشركة (صفحة «الأولويات») ثم أولوية الكرت ثم موعده.
 *  - السبت للنشر بس، والإنتاج على أيام دوام صاحبه.
 *
 * المنجز ما بيتحرّك أبداً (WORK_RULES §٤). الكرت المنقول بيتثبّت (إعادة التوليد ما
 * بتسحبه) وبينكتب عليه سطر بموعده القديم.
 */
import { LEAD, SHOOT_APPOINTMENT_NOTICE_DAYS, SHOOT_BEFORE_MONTAGE, isTaskDoneState } from "@/lib/constants";
import { parseWorkDays } from "@/lib/dates";
import { dailyTaskEffortDays } from "@/lib/daily-work";
import { makeLateClassifier, type LateCompany } from "@/lib/late";
import { cycleForBucket } from "@/lib/contract";
import { dayKeyOf } from "@/lib/team-day";
import type { Employee, Task } from "@/types";

export type RescheduleCompany = LateCompany & { name: string; priority: number };
export type RescheduleEmployee = Pick<Employee, "id" | "name" | "role" | "rates" | "hoursPerDay" | "workDays">;

export type MoveReason = "late" | "after" | "order";

export type RescheduleMove = {
  taskId: string;
  title: string;
  companyId: string | null;
  stage: string | null;
  type: string | null;
  pieceNo: number | null;
  assigneeId: string | null;
  reason: MoveReason;
  from: { work: string | null; ready: string | null; publish: string | null };
  to: { work: string | null; ready: string | null; publish: string | null };
  warnings: string[];
};

export type ReschedulePlan = {
  fromISO: string;
  /** النقلات الحقيقية (يوم شغل أو جهوزية أو نشر تغيّر). */
  moves: RescheduleMove[];
  /** كروت إنتاج مفتوحة بس «يوم النشر» المعروض عليها لحق قطعتها — ما بتنعرض قطعة قطعة. */
  syncs: { taskId: string; publish: string }[];
  /** كروت ما لقيتلها يوم ضمن الأفق. */
  unplaced: { taskId: string; title: string }[];
  /** بصمة الخطة — التطبيق بيرفض إذا الداتا تغيّرت بعد المعاينة. */
  fingerprint: string;
};

const HORIZON_DAYS = 120;
const FEED_TYPES = new Set(["POST", "REEL", "AI_REEL"]);
const TYPE_ORDER = ["REEL", "AI_REEL", "POST", "STORY"];
const PRIORITY_RANK: Record<string, number> = { URGENT: 2, IMPORTANT: 1, NORMAL: 0 };
const PUBLISH_WEEK = [0, 1, 2, 3, 4, 6]; // دوام الأحد→الخميس + السبت للنشر (PUBLISH_WEEK_DAYS)
const EPS = 1e-9;

// ── أيام بصيغة ISO (يوم دمشق) — حساب نقي بلا منطقة زمنية ──────────────────────
const utcOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDaysISO = (iso: string, n: number) => new Date(utcOf(iso) + n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (iso: string) => new Date(utcOf(iso)).getUTCDay();
const dayOf = (v: Date | string | null | undefined): string | null => (v == null ? null : dayKeyOf(v));
const maxISO = (...xs: (string | null | undefined)[]) =>
  xs.filter((x): x is string => !!x).sort().pop() ?? null;
/** أول يوم ≥ `iso` من أيام `days`. */
function forwardTo(iso: string, days: number[]): string {
  let d = iso;
  for (let i = 0; i < 7 && !days.includes(weekdayOf(d)); i++) d = addDaysISO(d, 1);
  return d;
}
/** آخر يوم ≤ `iso` من أيام `days`. */
function backTo(iso: string, days: number[]): string {
  let d = iso;
  for (let i = 0; i < 7 && !days.includes(weekdayOf(d)); i++) d = addDaysISO(d, -1);
  return d;
}

const isPublishCard = (t: Task) => t.stage === "PUBLISH" || t.kind === "PUBLISH";

export function planLateReschedule(input: {
  tasks: Task[];
  employees: RescheduleEmployee[];
  companies: RescheduleCompany[];
  /** يوم البداية ISO (يوم دمشق) — الافتراضي اليوم. */
  fromISO: string;
  /** حصر بشركات (`null` بالقائمة = المهام الداخلية بلا شركة). بلاه = الكل. */
  companyIds?: (string | null)[] | null;
}): ReschedulePlan {
  const { tasks, employees, companies, fromISO } = input;
  const D = fromISO;
  const [fy, fm, fd] = D.split("-").map(Number);
  const fromLocal = new Date(fy, fm - 1, fd);
  const live = tasks.filter((t) => t.status !== "CANCELED");
  const byId = new Map(live.map((t) => [t.id, t]));
  const empById = new Map(employees.map((e) => [e.id, e]));
  const coById = new Map(companies.map((c) => [c.id, c]));
  const scope = input.companyIds ? new Set(input.companyIds) : null;
  const inScope = (t: Task) => !scope || scope.has(t.companyId ?? null);

  const classify = makeLateClassifier(live, companies, fromLocal);
  const lateSet = new Set(live.filter((t) => inScope(t) && classify(t) != null).map((t) => t.id));

  const workDaysOf = (t: Task) => {
    const emp = t.assigneeId ? empById.get(t.assigneeId) : undefined;
    const days = emp ? parseWorkDays(emp.workDays) : [0, 1, 2, 3, 4];
    return days.length ? days : [0, 1, 2, 3, 4];
  };
  const scopeCounts = new Map<string, number>();
  for (const t of live) {
    if (!(t.stage === "WRITE" || t.kind === "CONTENT_WRITING") || !t.assigneeId || !t.companyId) continue;
    const key = `${t.assigneeId}|${t.companyId}|${t.year}-${t.month}`;
    scopeCounts.set(key, (scopeCounts.get(key) ?? 0) + 1);
  }
  const effortOf = (t: Task) => {
    const emp = t.assigneeId ? empById.get(t.assigneeId) : undefined;
    return emp ? dailyTaskEffortDays(emp as Employee, t, scopeCounts) : 0;
  };

  // ── السعة: حمل كل شخص بكل يوم من الكروت المفتوحة يلي ما رح تتحرّك ─────────────
  const ledger = new Map<string, number>();
  const key = (who: string, day: string) => `${who}|${day}`;
  const spread = (t: Task, sign: 1 | -1) => {
    if (!t.assigneeId || isPublishCard(t)) return;
    const effort = effortOf(t);
    if (effort <= 0) return;
    const start = dayOf(t.workDate) ?? dayOf(t.readyDate);
    const end = maxISO(start, dayOf(t.readyDate));
    if (!start || !end) return;
    const days: string[] = [];
    const wd = workDaysOf(t);
    for (let d = start; d <= end && days.length < 60; d = addDaysISO(d, 1)) if (wd.includes(weekdayOf(d))) days.push(d);
    if (!days.length) days.push(start);
    for (const d of days) {
      if (d < D) continue;
      ledger.set(key(t.assigneeId, d), (ledger.get(key(t.assigneeId, d)) ?? 0) + (sign * effort) / days.length);
    }
  };
  for (const t of live) if (!isTaskDoneState(t)) spread(t, 1);

  /** أول أيام فيهن سعة لـ`effort` يوم، من `floor`. */
  function placeProduction(t: Task, floor: string): { work: string; ready: string } | null {
    const who = t.assigneeId;
    const wd = workDaysOf(t);
    const effort = effortOf(t);
    let d = forwardTo(floor, wd);
    const last = addDaysISO(D, HORIZON_DAYS);
    if (!who || effort <= EPS) return { work: d, ready: d };
    if (effort >= 1 - EPS) {
      // كرت يوم كامل أو أكتر: أيام متتالية فاضية.
      const need = Math.max(1, Math.ceil(effort - EPS));
      while (d <= last) {
        const run: string[] = [];
        let c = d;
        while (run.length < need && c <= last) {
          if (wd.includes(weekdayOf(c))) {
            if ((ledger.get(key(who, c)) ?? 0) > EPS) break;
            run.push(c);
          }
          c = addDaysISO(c, 1);
        }
        if (run.length === need) {
          for (const r of run) ledger.set(key(who, r), (ledger.get(key(who, r)) ?? 0) + effort / need);
          return { work: run[0], ready: run[run.length - 1] };
        }
        d = forwardTo(addDaysISO(run.length ? run[run.length - 1] : d, 1), wd);
      }
      return null;
    }
    while (d <= last) {
      if (wd.includes(weekdayOf(d)) && (ledger.get(key(who, d)) ?? 0) + effort <= 1 + EPS) {
        ledger.set(key(who, d), (ledger.get(key(who, d)) ?? 0) + effort);
        return { work: d, ready: d };
      }
      d = addDaysISO(d, 1);
    }
    return null;
  }

  type Sched = { work: string | null; ready: string; publish?: string | null };
  const resolved = new Map<string, Sched>();
  const moves = new Map<string, RescheduleMove>();
  const unplaced: ReschedulePlan["unplaced"] = [];

  const current = (t: Task) => ({
    work: dayOf(t.workDate),
    ready: dayOf(isPublishCard(t) ? (t.publishDate ?? t.readyDate) : (t.readyDate ?? t.publishDate)),
    publish: dayOf(t.publishDate),
  });

  /**
   * أبكر يوم بيسمحلو فيه حاجزه (بموعده الجديد) — `dep` = حدّ الحاجز لحاله، و`floor` = هو
   * أو يوم البداية، أيّهما أبعد. كرت ما تأخّر وما زال بعد حدّ حاجزه بيضل مكانه — ولو
   * بلّش قبل يوم البداية (شغل ماشي).
   */
  function floorAfter(t: Task): { dep: string | null; floor: string; blockerMoved: boolean } {
    const blocker = t.blockedById ? byId.get(t.blockedById) : undefined;
    if (!blocker) return { dep: null, floor: D, blockerMoved: false };
    const b = resolve(blocker);
    let gap = 1;
    if (isPublishCard(t)) gap = LEAD[(t.type ?? "POST") as keyof typeof LEAD] ?? 2;
    else if (blocker.stage === "SHOOT" && t.stage === "EDIT") gap = SHOOT_BEFORE_MONTAGE.min;
    const dep = addDaysISO(b.ready, gap);
    return { dep, floor: maxISO(D, dep)!, blockerMoved: moves.has(blocker.id) };
  }

  function record(t: Task, reason: MoveReason, to: RescheduleMove["to"], warnings: string[] = []) {
    const from = current(t);
    if (from.work === to.work && from.ready === to.ready && from.publish === to.publish) return;
    moves.set(t.id, {
      taskId: t.id,
      title: t.title ?? "",
      companyId: t.companyId ?? null,
      stage: t.stage ?? null,
      type: t.type ?? null,
      pieceNo: t.pieceNo ?? null,
      assigneeId: t.assigneeId ?? null,
      reason,
      from,
      to,
      warnings,
    });
  }

  /** موعد كرت إنتاج (أو كرت بلا نشر) بعد إعادة الجدولة — بيتحسب مرّة وحدة. */
  function resolve(t: Task): Sched {
    const hit = resolved.get(t.id);
    if (hit) return hit;
    const cur = current(t);
    if (isTaskDoneState(t)) {
      const s = { work: cur.work, ready: dayOf(t.finishedAt ?? t.completedAt) ?? cur.ready ?? D };
      resolved.set(t.id, s);
      return s;
    }
    // حماية من حلقة بالداتا: سجّل موقّتاً قبل ما نلحق الحاجز.
    resolved.set(t.id, { work: cur.work, ready: cur.ready ?? D });
    const { dep, floor, blockerMoved } = floorAfter(t);
    const isLate = lateSet.has(t.id);
    const start = cur.work ?? cur.ready;
    // كرت ما تأخّر بيتحرّك بس إذا **نحنا** حرّكنا حاجزه لبعده — مهلة ضيّقة موجودة بالداتا
    // من قبل مش شغل هالزرّ.
    if (!isLate && !(blockerMoved && dep && start && start < dep)) {
      const s = { work: cur.work, ready: cur.ready ?? start ?? D };
      resolved.set(t.id, s);
      return s;
    }
    spread(t, -1);
    // «بدّل» من القائدة على يوم بعد البداية قرار — ما منسحب الكرت قبله.
    const manual = dayOf(t.manualDay);
    const shootFloor = maxISO(
      floor,
      t.stage === "SHOOT" ? addDaysISO(D, SHOOT_APPOINTMENT_NOTICE_DAYS) : null,
      manual && manual > D ? manual : null,
    )!;
    const placed = placeProduction(t, shootFloor);
    if (!placed) {
      spread(t, 1);
      unplaced.push({ taskId: t.id, title: t.title ?? "" });
      const s = { work: cur.work, ready: cur.ready ?? D };
      resolved.set(t.id, s);
      return s;
    }
    const s = { work: placed.work, ready: placed.ready };
    resolved.set(t.id, s);
    const warnings = t.stage === "SHOOT" ? ["موعد تصوير جديد — لازم يتأكّد مع الزبون"] : [];
    record(t, isLate ? "late" : "after", { work: placed.work, ready: placed.ready, publish: cur.publish }, warnings);
    return s;
  }

  // ── ترتيب المعالجة: أولوية الشركة ← أولوية الكرت ← الموعد ← النوع ← الرقم ────────
  const coRank = (t: Task) => (t.companyId ? (coById.get(t.companyId)?.priority ?? 999) : 1000);
  const order = (a: Task, b: Task) =>
    coRank(a) - coRank(b) ||
    (PRIORITY_RANK[String(b.priority)] ?? 0) - (PRIORITY_RANK[String(a.priority)] ?? 0) ||
    TYPE_ORDER.indexOf(a.type ?? "") - TYPE_ORDER.indexOf(b.type ?? "") ||
    (a.pieceNo ?? 9999) - (b.pieceNo ?? 9999) ||
    (current(a).ready ?? "9999").localeCompare(current(b).ready ?? "9999") ||
    a.id.localeCompare(b.id);

  // سلاسل النشر لكل شركة فيها متأخر، ونوع — بالترتيب الرقمي.
  const affectedCompanies = new Set(
    [...lateSet].map((id) => byId.get(id)?.companyId).filter((c): c is string => !!c),
  );
  const publishCards = live.filter((t) => isPublishCard(t) && t.companyId && t.type);
  /** أيام النشر الحالية (قبل أي نقلة) و«المحجوزة» بنقلاتنا — `${شركة}|feed|story|${يوم}` → عدد. */
  const occupied = new Map<string, number>();
  const placed = new Map<string, number>();
  const lane = (t: Task) => (FEED_TYPES.has(t.type ?? "") ? "feed" : "story");
  const occKey = (t: Task, day: string) => `${t.companyId}|${lane(t)}|${day}`;
  for (const p of publishCards) {
    const day = current(p).publish;
    if (day) occupied.set(occKey(p, day), (occupied.get(occKey(p, day)) ?? 0) + 1);
  }
  const sequences = new Map<string, Task[]>();
  for (const p of publishCards) {
    if (!affectedCompanies.has(p.companyId!)) continue;
    const k = `${p.companyId}|${p.type}`;
    (sequences.get(k) ?? sequences.set(k, []).get(k)!).push(p);
  }

  function runSequence(seq: Task[]) {
    seq.sort(
      (a, b) =>
        (a.pieceNo ?? 9999) - (b.pieceNo ?? 9999) ||
        (current(a).publish ?? "9999").localeCompare(current(b).publish ?? "9999"),
    );
    let cursor: string | null = null;
    let prevMoved = false;
    for (const p of seq) {
      const cur = current(p);
      if (isTaskDoneState(p)) {
        cursor = maxISO(cursor, cur.publish);
        prevMoved = false;
        continue;
      }
      const { dep, blockerMoved } = floorAfter(p);
      const isLate = lateSet.has(p.id);
      // الحدود يلي بتفرض نقلة على قطعة ما تأخّرت: حاجز **نحنا** حرّكناه، أو قطعة قبلها
      // **نحنا** حطّيناها بعدها، أو يوم أخدته قطعة منقولة. ترتيب أو تزاحم موجود من قبل بيضل.
      const keepFloor = maxISO(blockerMoved ? dep : null, prevMoved && cursor ? addDaysISO(cursor, 1) : null);
      const mine = cur.publish ? occKey(p, cur.publish) : null;
      const clash = (day: string) =>
        (occupied.get(occKey(p, day)) ?? 0) - (mine === occKey(p, day) ? 1 : 0) + (placed.get(occKey(p, day)) ?? 0) > 0;
      if (
        !isLate &&
        cur.publish &&
        (!keepFloor || cur.publish >= keepFloor) &&
        !(placed.get(occKey(p, cur.publish)) ?? 0)
      ) {
        cursor = maxISO(cursor, cur.publish);
        prevMoved = false;
        continue;
      }
      const placeFloor = maxISO(D, dep, cursor ? addDaysISO(cursor, 1) : null)!;
      let day = forwardTo(placeFloor, PUBLISH_WEEK);
      const last = addDaysISO(D, HORIZON_DAYS);
      while (clash(day) && day <= last) day = forwardTo(addDaysISO(day, 1), PUBLISH_WEEK);
      if (day > last) {
        unplaced.push({ taskId: p.id, title: p.title ?? "" });
        cursor = maxISO(cursor, cur.publish);
        continue;
      }
      if (mine) occupied.set(mine, (occupied.get(mine) ?? 1) - 1);
      placed.set(occKey(p, day), (placed.get(occKey(p, day)) ?? 0) + 1);
      cursor = day;
      prevMoved = true;
      const publisher = p.assigneeId ? empById.get(p.assigneeId) : undefined;
      const work = backTo(day, publisher ? parseWorkDays(publisher.workDays) : [0, 1, 2, 3, 4]);
      const warnings: string[] = [];
      const co = coById.get(p.companyId!);
      const cycle = co ? cycleForBucket(co, p.year, p.month) : null;
      if (cycle && utcOf(day) >= Date.UTC(cycle.end.getFullYear(), cycle.end.getMonth(), cycle.end.getDate())) {
        const lastDay = addDaysISO(
          `${cycle.end.getFullYear()}-${String(cycle.end.getMonth() + 1).padStart(2, "0")}-${String(cycle.end.getDate()).padStart(2, "0")}`,
          -1,
        );
        warnings.push(`بعد نهاية الدورة (${Number(lastDay.slice(8))}/${Number(lastDay.slice(5, 7))})`);
      }
      record(p, isLate ? "late" : blockerMoved ? "after" : "order", { work, ready: day, publish: day }, warnings);
    }
  }

  /** كرت نشر متأخر بلا قطعة خطة (نشر مهمة إضافية): أول يوم نشر بعد حاجزه. */
  function runLoosePublish(p: Task) {
    const { floor } = floorAfter(p);
    const day = forwardTo(floor, PUBLISH_WEEK);
    const publisher = p.assigneeId ? empById.get(p.assigneeId) : undefined;
    record(p, "late", {
      work: backTo(day, publisher ? parseWorkDays(publisher.workDays) : [0, 1, 2, 3, 4]),
      ready: day,
      publish: day,
    });
  }

  // كل وحدة (سلسلة، أو كرت متأخر برّا السلاسل) بدورها — الأعلى أولوية بياخد السعة أول.
  type Unit = { rep: Task; run: () => void };
  const units: Unit[] = [...sequences.values()].map((seq) => ({
    rep: [...seq].sort(order)[0],
    run: () => runSequence(seq),
  }));
  for (const t of live) {
    if (!lateSet.has(t.id)) continue;
    if (isPublishCard(t) && t.companyId && t.type && affectedCompanies.has(t.companyId)) continue;
    units.push({ rep: t, run: () => (isPublishCard(t) ? runLoosePublish(t) : void resolve(t)) });
  }
  units.sort((a, b) => order(a.rep, b.rep));
  for (const u of units) u.run();

  // ٣) يوم النشر المعروض على كروت الإنتاج المفتوحة يلحق قطعته.
  const syncs: ReschedulePlan["syncs"] = [];
  for (const m of moves.values()) {
    if (!m.to.publish || m.stage !== "PUBLISH") continue;
    const p = byId.get(m.taskId);
    if (!p?.pipelineKey) continue;
    for (const t of live) {
      if (t.pipelineKey !== p.pipelineKey || isPublishCard(t) || isTaskDoneState(t)) continue;
      if (moves.has(t.id)) moves.get(t.id)!.to.publish = m.to.publish;
      else if (dayOf(t.publishDate) !== m.to.publish) syncs.push({ taskId: t.id, publish: m.to.publish });
    }
  }

  const list = [...moves.values()].sort(
    (a, b) => (a.to.ready ?? "").localeCompare(b.to.ready ?? "") || a.taskId.localeCompare(b.taskId),
  );
  const fingerprint = fnv(
    JSON.stringify([D, list.map((m) => [m.taskId, m.to]), syncs, unplaced.map((u) => u.taskId)]),
  );
  return { fromISO: D, moves: list, syncs, unplaced, fingerprint };
}

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}
