"use client";

import { cycleSpanLabel, isCarryoverFromPastCycle } from "@/lib/contract";
import { isDormantCompany } from "@/lib/company-visibility";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/badge";
import { Donut } from "@/components/ui/Donut";
import { MonthBar } from "@/components/MonthBar";
import {
  ROLE_LABELS,
  isTaskDoneState,
  isTaskLateState,
  taskColor,
} from "@/lib/constants";
import {
  buildReelNumbers,
  cardLabelFor,
  compareLabelsNaturally,
  comparePieceSequence,
  groupTasksIntoCards,
  type GroupedCard,
} from "@/lib/cards";
import type { CompanyProgress } from "@/lib/progress";
import { dailyTaskEffortDays, makeBlockedPredicate, selectDailyWorkTasks } from "@/lib/daily-work";
import { personDayState } from "@/lib/person-day-state";
import {
  toISODate,
  fromISODate,
  formatDateShort,
  addWorkdaysFor,
  parseWorkDays,
  ARABIC_DAYS,
  ARABIC_MONTHS, WORK_WEEK } from "@/lib/dates";
import { CyclePill } from "@/components/ui/pills";
import { updateDailyTasks } from "@/server/actions/tasks";
import { toast } from "@/components/ui/toaster";
import type { Employee, Company, Task } from "@/types";
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Send,
  Users,
  Zap,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { workRoster } from "@/lib/team";

export default function OverviewClient({
  year,
  month,
  employees,
  companies,
  tasks,
  companyProgress,
}: {
  year: number;
  month: number;
  employees: Employee[];
  companies: Company[];
  tasks: Task[];
  companyProgress: CompanyProgress[];
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [, startDayEdit] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  // The overview is shared at `/` and `/admin`; keep board links in the same area.
  const base = pathname.startsWith("/admin") ? "/admin" : "";
  const managed = companies.filter((c) => c.managed && !isDormantCompany(c));
  const designers = employees.filter((e) => e.isScheduled && !e.isPhotographer);
  // KPI = THIS bucket's production cards only; carryover extras from other
  // cycles are live work but not part of this month's plan count.
  const content = tasks.filter(
    (t) => t.kind === "CONTENT" && t.year === year && t.month === month,
  );
  const qty = (t: Task) => t.quantity ?? 1;
  const isDone = isTaskDoneState;
  const openUrgent = tasks.filter((t) => t.priority === "URGENT" && !isDone(t));

  const empName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? "—";
  const empColor = (id: string | null) =>
    employees.find((e) => e.id === id)?.color ?? undefined;
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

  // ---- إنجاز الفريق: per-person task completion (counts ALL assigned tasks, so
  // the publisher عمر — whose work is the PUBLISH cards — shows up too). منجز =
  // a task whose own stage is done; متبقّي = the rest.
  //
  // حلا نصّ يومها إدارة ثابتة (قاعدتها 2/8/2026: «إنجاز حلا ع طول 50% — هي
  // ممتلئة بمهام الإدارة، والباقي للمهام الإضافية»)، فنصف الدونات عندها محجوز
  // ومعدود دايماً، والنصف التاني بيتحرّك مع مهامها الإضافية. كانت بتطلع 0%
  // لأنّ إدارة الفريق ما إلها كروت تنعدّ.
  const isLead = (e: Employee) => /تيم ليدر|team ?lead/i.test(e.role);
  const LEAD_ADMIN_SHARE = 0.5;
  const achievement = employees
    .map((e) => {
      const mine = tasks.filter((t) => t.assigneeId === e.id);
      const total = mine.reduce((a, t) => a + qty(t), 0);
      const done = mine.filter(isDone).reduce((a, t) => a + qty(t), 0);
      if (!isLead(e)) return { emp: e, total, done, remaining: Math.max(0, total - done), admin: 0 };
      // نُعبّر عن النصف الإداري بوحدات من نفس مقياس مهامها حتى الدونات تضل صادقة:
      // إدارة = نصف، والمهام الإضافية = النصف التاني.
      const admin = Math.max(1, total);
      return {
        emp: e,
        total: total + admin,
        done: done + admin,
        remaining: Math.max(0, total - done),
        admin,
      };
    })
    .filter((x) => x.total > 0);

  // ---- إنجاز الشركات: computed on the server over each company's OWN contract
  // cycle (see OverviewView) — never from `tasks`, which is this calendar
  // month's live board with done work archived out.
  const progressById = new Map(companyProgress.map((p) => [p.companyId, p]));
  const companyDone = managed
    .map((co) => {
      const p = progressById.get(co.id);
      const plan = p?.plan ?? co.posts + co.reels + co.stories + co.aiReels;
      const done = p?.published ?? 0;
      const produced = p?.produced ?? 0;
      const pct = plan > 0 ? Math.round(Math.min(100, (done / plan) * 100)) : 0;
      const producedPct = plan > 0 ? Math.round(Math.min(100, (produced / plan) * 100)) : 0;
      return {
        co,
        plan,
        done,
        produced,
        remaining: Math.max(0, plan - done),
        pct,
        producedPct,
        cycleLabel: p?.cycleLabel ?? null,
      };
    })
    .filter((x) => x.plan > 0)
    .sort((a, b) => a.co.priority - b.co.priority || b.pct - a.pct);

  // "اليوم" panel: active daily queue per person. It is NOT a date filter: if a
  // person has unfinished work, we show the next cards they should work on now,
  // sorted by priority/precedence and capped by their daily production capacity.
  const deadlineOf = (t: Task): Date | null =>
    t.readyDate ? new Date(t.readyDate) : t.publishDate ? new Date(t.publishDate) : null;
  const reelNum = buildReelNumbers(tasks);
  const today = new Date();
  const todayISO = toISODate(today);
  const openByPerson = new Map(
    employees.map((e) => [
      e.id,
      groupTasksIntoCards(tasks.filter((t) => t.assigneeId === e.id && !isDone(t))),
    ]),
  );
  // ALL employees are always listed. Per person state:
  //  - daily queue from open work      → the cards
  //  - open work that cannot be queued → متبقّي
  //  - off with no open work           → عطلة
  //  - no open work at all             → متفرّغ لعمل إضافي
  const refDayObj = fromISODate(todayISO);
  // فريق السوشال ميديا بس (قرار القائدة ١/٩): السيلز مسؤولين حسابات مو
  // منتِجين، والمصوّر الفريلانس بينشغّل عند الحاجة — الاتنين ما بيظهروا هون.
  // ويلي ماسك شغل مفتوح بيضل ظاهر مهما كان دوره، مشان ما يضيع كرت بصمت.
  const rosterToday = workRoster(
    employees,
    new Set(employees.filter((e) => (openByPerson.get(e.id)?.length ?? 0) > 0).map((e) => e.id)),
  );
  const dayByPerson = rosterToday.map((e) => ({
    emp: e,
    isOff: !parseWorkDays(e.workDays).includes(refDayObj.getDay()),
    cards: groupTasksIntoCards(
      selectDailyWorkTasks({
        employee: e,
        tasks,
        allTasks: tasks,
        companies,
        today,
      }),
    ),
    openCards: openByPerson.get(e.id) ?? [],
  }));
  // Default tab: first person with reference-day work, then open backlog, else
  // the first person.
  const defaultId =
    (
      dayByPerson.find((g) => g.cards.length > 0) ??
      dayByPerson.find((g) => g.openCards.length > 0) ??
      dayByPerson[0]
    )?.emp.id ?? null;
  const activeId =
    activeTab && dayByPerson.some((g) => g.emp.id === activeTab) ? activeTab : defaultId;
  const activeGroup = dayByPerson.find((g) => g.emp.id === activeId) ?? null;

  // «تعديل مهام اليوم» editor. A person's day is a full production load (e.g.
  // 2 ستوري + 6 بوست), so the lead ticks the exact card mix for today: kept +
  // added cards go onto today, un-ticked today-cards move to the next work day.
  const [editDayFor, setEditDayFor] = useState<string | null>(null);
  const editGroup = dayByPerson.find((g) => g.emp.id === editDayFor) ?? null;
  const todayIdsOf = (g: typeof editGroup) => new Set(g?.cards.flatMap((c) => c.ids) ?? []);
  // Per-card daily load (in working days) for the person, so the meter can show
  // whether the picked mix fills the day.
  const scopeCounts = (() => {
    const m = new Map<string, number>();
    for (const t of tasks) {
      if (!(t.stage === "WRITE" || t.kind === "CONTENT_WRITING")) continue;
      if (!t.assigneeId || !t.companyId) continue;
      const k = `${t.assigneeId}|${t.companyId}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  })();
  const loadOf = (card: GroupedCard, emp: Employee) =>
    dailyTaskEffortDays(emp, card.repr, scopeCounts);

  // Ticked cards while the editor is open (id set). Seeded with today's cards.
  const [daySel, setDaySel] = useState<Set<string>>(new Set());
  const openDayEditor = (g: NonNullable<typeof activeGroup>) => {
    setDaySel(todayIdsOf(g));
    setEditDayFor(g.emp.id);
  };
  const onSaveDay = () => {
    if (!editGroup) return;
    const todayIds = todayIdsOf(editGroup);
    const promoteIds = [...daySel];
    const demoteIds = [...todayIds].filter((id) => !daySel.has(id));
    if (promoteIds.length === 0 && demoteIds.length === 0) {
      setEditDayFor(null);
      return;
    }
    startDayEdit(async () => {
      // Pass the browser's local day: the server may sit in another timezone.
      const r = await updateDailyTasks(promoteIds, demoteIds, todayISO);
      if (r.ok) {
        toast("تم تحديث مهام اليوم");
        setEditDayFor(null);
        router.refresh();
      } else toast(r.error, "error");
    });
  };

  // ---- المهام الحرجة: not-done tasks whose deadline is overdue or within ≤2
  // working days. Deadline = readyDate (design/adhoc) else publishDate.
  const soonISO = toISODate(addWorkdaysFor(new Date(), 2, WORK_WEEK));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  // A card whose blocker is still open is not on fire — whoever holds the
  // blocker is. أليسار's montage cards were showing as her overdue work for
  // reels ماجد has not shot yet.
  const isBlockedCard = makeBlockedPredicate(tasks);
  const criticalSource = tasks.filter((t) => {
    if (isDone(t) || isBlockedCard(t)) return false;
    const dl = deadlineOf(t);
    if (!dl) return false;
    return toISODate(dl) <= soonISO;
  });
  const criticalCards = groupTasksIntoCards(criticalSource)
    .map((card) => {
      const items = card.ids.map((id) => taskById.get(id)!).filter(Boolean);
      const dls = items
        .map((t) => deadlineOf(t))
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime());
      const dl = dls[0] ?? null;
      const overdue = dl ? toISODate(dl) < todayISO : false;
      return { card, dl, overdue };
    })
    // نفس الموعد = بالتسلسل الرقمي (نوع ← رقم ← مرحلة) لا بترتيب الوصول: كان
    // «ريل-2 · BW» يطلع قبل «ريل-1 · BW» بنفس اليوم — قرار القائدة ١٥/٩:
    // الكروت تظهر بالترتيب من ١ للعدد.
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        (a.dl?.getTime() ?? 0) - (b.dl?.getTime() ?? 0) ||
        comparePieceSequence(a.card.repr, b.card.repr) ||
        compareLabelsNaturally(a.card.repr.title ?? "", b.card.repr.title ?? ""),
    );

  // Group the critical cards by the person responsible so the home page reads as
  // a daily ops board ("who owns what's on fire") instead of one flat list. Each
  // person block carries counters: متأخرة / اليوم / هذا الأسبوع.
  const bucketOf = (dl: Date | null): "overdue" | "today" | "soon" => {
    if (!dl) return "soon";
    const iso = toISODate(dl);
    if (iso < todayISO) return "overdue";
    if (iso === todayISO) return "today";
    return "soon";
  };
  const criticalByPerson = employees
    .map((e) => {
      const items = criticalCards.filter((c) => c.card.repr.assigneeId === e.id);
      const counts = { overdue: 0, today: 0, soon: 0 };
      for (const it of items) counts[bucketOf(it.dl)]++;
      return { emp: e, items, counts };
    })
    .filter((g) => g.items.length > 0)
    .sort(
      (a, b) =>
        b.counts.overdue - a.counts.overdue ||
        (a.items[0]?.dl?.getTime() ?? 0) - (b.items[0]?.dl?.getTime() ?? 0),
    );

  const kpis = [
    { label: "الشركات المُدارة", value: managed.length, icon: Building2 },
    { label: "منشورات الشهر", value: content.length, icon: Send },
    { label: "المصممون", value: designers.length, icon: Users },
    { label: "مهام مستعجلة مفتوحة", value: openUrgent.length, icon: Zap },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">نظرة عامة</h1>
          <p className="text-sm text-fg-dim">لوحة إدارة فريق السوشال ميديا</p>
        </div>
        <MonthBar year={year} month={month} showGenerate />
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl display-font">{k.value}</div>
                  <div className="text-xs text-fg-dim mt-1">{k.label}</div>
                </div>
                <Icon className="w-8 h-8 text-accent/40" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* المهام الحرجة حسب الفريق */}
      {criticalByPerson.length > 0 && (
        <Card className="border-r-4 border-danger">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-danger" />
            <h2 className="display-font text-lg">المهام الحرجة حسب الفريق</h2>
            <span className="text-xs text-fg-muted">
              متأخرة أو تستحق خلال يومَي عمل · {criticalCards.length}
            </span>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {criticalByPerson.map(({ emp, items, counts }) => (
              <div
                key={emp.id}
                className="flex flex-col gap-2 min-w-0 border border-border-soft rounded-lg p-3 bg-bg-elev/40"
              >
                {/* person header: avatar + name + counters + quick link to board */}
                <div className="flex items-center gap-2">
                  <Avatar name={emp.name} color={emp.color ?? undefined} size={22} />
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate">{emp.name}</span>
                  <div className="flex items-center gap-1 text-[10px] tabular-nums shrink-0 flex-wrap justify-end">
                    {counts.overdue > 0 && (
                      <span className="rounded-full px-1.5 py-0.5 bg-danger/15 text-danger font-semibold">
                        متأخرة {counts.overdue}
                      </span>
                    )}
                    {counts.today > 0 && (
                      <span className="rounded-full px-1.5 py-0.5 bg-warning/15 text-warning font-semibold">
                        اليوم {counts.today}
                      </span>
                    )}
                    {counts.soon > 0 && (
                      <span className="rounded-full px-1.5 py-0.5 bg-bg-elev2 text-fg-muted">
                        الأسبوع {counts.soon}
                      </span>
                    )}
                  </div>
                </div>

                {/* this person's critical cards (overdue first, then nearest).
                    Capped so a heavy backlog doesn't make the home page endless —
                    counters above give the totals, the board link shows the rest. */}
                <div className="flex flex-col gap-1.5">
                  {items.slice(0, 6).map(({ card, dl, overdue }) => (
                    <div
                      key={card.key}
                      className={
                        "flex items-start gap-2 min-w-0 rounded-md px-2 py-1.5 border " +
                        (overdue
                          ? "bg-danger/10 border-danger/40"
                          : "bg-warning/10 border-warning/40")
                      }
                    >
                      <AlertTriangle
                        className={
                          "w-3.5 h-3.5 mt-0.5 shrink-0 " +
                          (overdue ? "text-danger" : "text-warning")
                        }
                      />
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-xs font-medium truncate">
                          {cardLabelFor(card.repr, card.count, reelNum, coName)}
                        </span>
                        {(card.repr.year !== year || card.repr.month !== month) && (
                          <CyclePill
                            carryover={isCarryoverFromPastCycle(
                              card.repr.companyId
                                ? companies.find((c) => c.id === card.repr.companyId)
                                : null,
                              card.repr.year,
                              card.repr.month,
                            )}
                            cycleLabel={cycleLabelFor(card.repr.companyId, card.repr.year, card.repr.month)}
                            late={overdue}
                          />
                        )}
                        {dl && (
                          <span
                            className={
                              "text-[10px] " +
                              (overdue ? "text-danger font-semibold" : "text-warning")
                            }
                          >
                            {overdue ? "تأخّرت" : "تستحق"} {formatDateShort(dl)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length > 6 && (
                    <span className="text-[10px] text-fg-muted text-center pt-0.5">
                      +{items.length - 6} مهمة أخرى
                    </span>
                  )}
                </div>

                <Link
                  href={`${base}/tasks?person=${emp.id}`}
                  className="flex items-center justify-center gap-1 text-[11px] text-accent hover:underline mt-0.5"
                >
                  عرض في البورد <ArrowLeft className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* إنجاز الفريق + مهام اليوم */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="display-font text-lg mb-4">إنجاز الفريق</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {achievement.map(({ emp, total, done, remaining, admin }) => (
              <div
                key={emp.id}
                className="flex flex-col items-center text-center gap-1.5 border border-border-soft rounded-lg p-3"
              >
                <Donut done={done} total={total} />
                <span className="text-sm font-semibold leading-tight">{emp.name}</span>
                <span className="text-[10px] text-fg-muted">
                  {ROLE_LABELS[emp.role] ?? emp.role}
                </span>
                <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
                  {admin > 0 && <span className="text-accent">إدارة ٥٠٪</span>}
                  <span className="text-success">منجز {done - admin}</span>
                  <span className="text-fg-dim">متبقّي {remaining}</span>
                  <span className="text-fg-muted">الكل {total - admin}</span>
                </div>
              </div>
            ))}
            {achievement.length === 0 && (
              <p className="text-sm text-fg-muted col-span-full">لا توجد مهام بعد.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="display-font text-lg">مهام اليوم</h2>
            <span className="text-xs text-fg-dim">
              اليوم · {ARABIC_DAYS[refDayObj.getDay()]} {formatDateShort(refDayObj)}
            </span>
          </div>

          {dayByPerson.length === 0 ? (
            <p className="text-sm text-fg-muted">لا يوجد موظفون.</p>
          ) : (
            <>
              {/* a tab for EVERY employee, always */}
              <div className="flex gap-1 flex-wrap border-b border-border-soft mb-3">
                {dayByPerson.map(({ emp, isOff, cards, openCards }) => {
                  const active = emp.id === activeId;
                  // Tasks take precedence, then any unfinished backlog. A
                  // person is "متفرّغ" only when they have no open cards at all.
                  const state = personDayState({
                    dayCardCount: cards.length,
                    openCardCount: openCards.length,
                    isOff,
                  });
                  const resting = state === "OFF";
                  const badge =
                    state === "TASKS"
                      ? String(cards.length)
                      : state === "BACKLOG"
                        ? `متبقّي ${openCards.length}`
                        : state === "OFF"
                          ? "عطلة"
                          : "متفرّغ";
                  const badgeCls =
                    state === "TASKS"
                      ? active
                        ? "bg-accent/15 text-accent"
                        : "bg-bg-elev2 text-fg-muted"
                      : state === "BACKLOG"
                        ? "bg-warning/10 text-warning"
                      : state === "OFF"
                        ? "bg-bg-elev2 text-fg-muted"
                        : "bg-success/10 text-success";
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setActiveTab(emp.id)}
                      className={
                        "flex items-center gap-1.5 px-2.5 py-1.5 -mb-px border-b-2 text-xs font-medium transition " +
                        (active
                          ? "border-accent text-fg"
                          : "border-transparent text-fg-dim hover:text-fg") +
                        (resting ? " opacity-70" : "")
                      }
                    >
                      <Avatar name={emp.name} color={emp.color ?? undefined} size={18} />
                      {emp.name}
                      <span className={"rounded-full px-1.5 text-[10px] " + badgeCls}>{badge}</span>
                    </button>
                  );
                })}
              </div>

              {/* active person's state: tasks / backlog / عطلة / متفرّغ */}
              <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1">
                {activeGroup && activeGroup.cards.length === 0 ? (
                  personDayState({
                    dayCardCount: activeGroup.cards.length,
                    openCardCount: activeGroup.openCards.length,
                    isOff: activeGroup.isOff,
                  }) === "BACKLOG" ? (
                    <div className="text-center py-8 text-sm text-warning">
                      لدى {activeGroup.emp.name} {activeGroup.openCards.length} مهمة غير منجزة.
                      <Link
                        href={`${base}/tasks?person=${activeGroup.emp.id}`}
                        className="block text-accent hover:underline mt-2"
                      >
                        عرض مهامه المفتوحة
                      </Link>
                    </div>
                  ) : activeGroup.isOff ? (
                    <div className="text-center py-8 text-sm text-fg-muted">
                      عطلة اليوم — {activeGroup.emp.name} في يوم إجازته.
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-success">
                      متفرّغ — جاهز لعمل إضافي.
                    </div>
                  )
                ) : (
                  activeGroup?.cards.map((card) => (
                    <div
                      key={card.key}
                      className="flex items-center gap-2 min-w-0 bg-bg-elev rounded-md px-2.5 py-2 border border-border-soft"
                      style={{ borderRight: `3px solid ${taskColor(card.repr.kind, card.repr.type)}` }}
                    >
                      {card.repr.overflow && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                      )}
                      <span className="text-xs truncate flex-1">
                        {cardLabelFor(card.repr, card.count, reelNum, coName)}
                      </span>
                      {(card.repr.year !== year || card.repr.month !== month) && (
                        <CyclePill
                          cycleLabel={cycleLabelFor(card.repr.companyId, card.repr.year, card.repr.month)}
                          late={isTaskLateState(card.repr)}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {activeGroup && !activeGroup.isOff && activeGroup.openCards.length > 0 && (
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => openDayEditor(activeGroup)}
                    className="flex items-center gap-1.5 text-[11px] text-fg-dim hover:text-accent border border-border-soft rounded-md px-2.5 py-1.5 transition"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    تعديل مهام اليوم
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* إنجاز الشركات */}
      <Card>
        <div className="flex items-baseline gap-2 mb-1">
          <h2 className="display-font text-lg">إنجاز الشركات</h2>
        </div>
        <p className="text-xs text-fg-dim mb-4">
          كل شركة على <strong>دورة عقدها هي</strong>، مو على شهر التقويم. الشريط الغامق =
          المنشور فعلاً (وهو المقياس التعاقدي)، والفاتح = يلي خلص إنتاجه وواقف على النشر.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {companyDone.map(({ co, plan, done, produced, remaining, pct, producedPct, cycleLabel }) => (
            <div key={co.id} className="border border-border-soft rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: co.color ?? "#C8A84E" }}
                  />
                  <span className="font-semibold truncate">{co.name}</span>
                  {cycleLabel && (
                    <span className="text-[10px] text-fg-muted tabular-nums shrink-0">
                      {cycleLabel}
                    </span>
                  )}
                </div>
                <span
                  className={
                    "text-sm display-font shrink-0 " +
                    (pct >= 100 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger")
                  }
                >
                  {pct}%
                </span>
              </div>
              {/* Two bars in one track: production behind, publishing in front —
                  so a company whose work is finished but unpublished reads as
                  «الفريق خلّص، النشر واقف» instead of a flat zero. */}
              <div className="relative h-2 rounded-full bg-bg-elev2 overflow-hidden mb-1.5">
                <div
                  className="absolute inset-y-0 right-0 bg-accent/30"
                  style={{ width: `${Math.min(100, producedPct)}%` }}
                />
                <div
                  className={"absolute inset-y-0 right-0 " + (pct >= 100 ? "bg-success" : "bg-accent")}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="text-[11px] text-fg-dim tabular-nums">
                <span className="text-success">منشور {done}</span>
                <span className="text-fg-muted"> / {plan}</span>
                {produced > done && (
                  <span className="text-accent"> · جاهز للنشر {produced - done}</span>
                )}
                {remaining > produced - done && (
                  <span className="text-warning"> · باقي {remaining - (produced - done)}</span>
                )}
              </div>
            </div>
          ))}
          {companyDone.length === 0 && (
            <p className="text-sm text-fg-muted col-span-full">لا توجد شركات مُدارة بخطة.</p>
          )}
        </div>
      </Card>

      {/* «تعديل مهام اليوم» — pick the exact card mix that fills a person's day. */}
      <Dialog open={editDayFor != null} onOpenChange={(o) => !o && setEditDayFor(null)}>
        <DialogContent className="max-w-md">
          {editGroup &&
            (() => {
              const EPSD = 1e-9;
              const emp = editGroup.emp;
              const todayIds = todayIdsOf(editGroup);
              const todayCards = editGroup.cards;
              const backlog = editGroup.openCards.filter(
                (c) => !c.ids.some((id) => todayIds.has(id)),
              );
              const allCards = [...todayCards, ...backlog];
              const cardById = new Map(allCards.map((c) => [c.repr.id, c]));
              // A full-day card (reel / AI reel / a design or ad-hoc that is ≥1
              // day) owns the whole day — same rule the engine uses.
              const isExclusive = (card: GroupedCard) =>
                card.repr.type === "REEL" ||
                card.repr.type === "AI_REEL" ||
                loadOf(card, emp) >= 1 - EPSD;

              const selectedCards = allCards.filter((c) => daySel.has(c.repr.id));
              // Everything not chosen yet (dropped today-cards + backlog) is the
              // add-pool; a chosen card moves up into «مهام اليوم».
              const addPool = allCards.filter((c) => !daySel.has(c.repr.id));
              const hasExclusiveSel = selectedCards.some(isExclusive);
              // Publish cards cost 0 (unlimited); a day is full at ≥1 work-day of
              // production, or the moment a full-day card is picked.
              const usedDays = hasExclusiveSel
                ? 1
                : selectedCards.reduce((s, c) => s + loadOf(c, emp), 0);
              const remaining = Math.max(0, 1 - usedDays);
              const pct = Math.round(Math.min(1, usedDays) * 100);
              // A backlog card is addable if it still fits the remaining day (a
              // full-day card is offered as a "switch the whole day" option).
              const fits = (card: GroupedCard) =>
                isExclusive(card) || loadOf(card, emp) <= remaining + EPSD;
              const canAddMore =
                !hasExclusiveSel && remaining > EPSD && addPool.some(fits);
              const meterColor = usedDays >= 1 - EPSD ? "bg-success" : "bg-accent";

              // Checking a full-day card clears the rest; checking a partial drops
              // any full-day card that was selected.
              const onToggle = (card: GroupedCard) => {
                const id = card.repr.id;
                setDaySel((prev) => {
                  if (prev.has(id)) {
                    const n = new Set(prev);
                    n.delete(id);
                    return n;
                  }
                  if (isExclusive(card)) return new Set([id]);
                  const n = new Set(
                    [...prev].filter((x) => {
                      const c = cardById.get(x);
                      return c ? !isExclusive(c) : true;
                    }),
                  );
                  n.add(id);
                  return n;
                });
              };

              const row = (card: GroupedCard, disabled = false) => {
                const checked = daySel.has(card.repr.id);
                const off = disabled && !checked;
                return (
                  <label
                    key={card.key}
                    className={
                      "flex items-center gap-2 rounded-md px-2.5 py-2 border border-border-soft bg-bg-elev transition " +
                      (off
                        ? "opacity-40 cursor-not-allowed"
                        : "cursor-pointer hover:border-accent/40")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={off}
                      onChange={() => onToggle(card)}
                      className="accent-accent w-4 h-4 shrink-0"
                    />
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: taskColor(card.repr.kind, card.repr.type) }}
                    />
                    <span className="text-xs truncate flex-1">
                      {cardLabelFor(card.repr, card.count, reelNum, coName)}
                    </span>
                    {isExclusive(card) && (
                      <span className="text-[9px] rounded px-1 py-0.5 bg-accent/10 text-accent shrink-0">
                        يوم كامل
                      </span>
                    )}
                  </label>
                );
              };

              return (
                <>
                  <DialogHeader>
                    <DialogTitle>مهام اليوم — {emp.name}</DialogTitle>
                    <DialogDescription>
                      شيكلِست حسب سعة {emp.name} اليومية: زيد كروت لتعبّي اليوم. مهمة بتاخد
                      يوم كامل بتقفل القائمة، وإذا ضل مجال بيطلع «لسا فيك تضيف». المفكوكة
                      بتنتقل لأقرب يوم عمل — بلا أي تأثير على المواعيد أو النشر.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mb-4">
                    <div className="flex items-baseline justify-between text-[11px] mb-1">
                      <span className="text-fg-dim">حمل اليوم</span>
                      <span
                        className={
                          "tabular-nums font-semibold " +
                          (usedDays >= 1 - EPSD ? "text-success" : "text-accent")
                        }
                      >
                        {hasExclusiveSel ? "مهمة يوم كامل · 100%" : `${pct}% من يوم عمل`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-bg-elev2 overflow-hidden">
                      <div
                        className={"h-full " + meterColor}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-fg-dim mb-1.5">
                        مهام اليوم
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {selectedCards.length === 0 ? (
                          <p className="text-[11px] text-fg-muted">
                            لا مهام مختارة — زيد من المتبقّي.
                          </p>
                        ) : (
                          selectedCards.map((c) => row(c))
                        )}
                      </div>
                    </div>

                    {/* Add-list — gated by remaining capacity. */}
                    {hasExclusiveSel ? (
                      <p className="text-[11px] text-fg-muted bg-bg-elev2 rounded-md px-2.5 py-2">
                        اخترت مهمة بتاخد اليوم كامل — باقي القائمة مقفولة. فكّها لإضافة
                        مهام أصغر.
                      </p>
                    ) : !canAddMore ? (
                      <p className="text-[11px] text-success bg-success/10 rounded-md px-2.5 py-2">
                        ✓ اليوم ممتلئ — ما عاد في مجال لمهام إضافية.
                      </p>
                    ) : (
                      <div>
                        <p className="text-[11px] font-semibold text-accent mb-1.5">
                          لسا فيك تضيف ({remaining >= 1 ? "يوم" : `~${Math.round(remaining * 100)}%`}{" "}
                          متبقّي)
                        </p>
                        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {addPool.map((c) => row(c, !fits(c)))}
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => setEditDayFor(null)}>
                      إلغاء
                    </Button>
                    <Button size="sm" onClick={onSaveDay}>
                      حفظ مهام اليوم
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
