"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/badge";
import { Donut } from "@/components/ui/Donut";
import { MonthBar } from "@/components/MonthBar";
import {
  ROLE_LABELS,
  isTaskDoneState,
  taskColor,
} from "@/lib/constants";
import { buildReelNumbers, cardLabelFor, groupTasksIntoCards } from "@/lib/cards";
import { completedCompanyPlanCount } from "@/lib/progress";
import {
  toISODate,
  fromISODate,
  formatDateShort,
  addWorkdaysFor,
  parseWorkDays,
  ARABIC_DAYS,
} from "@/lib/dates";
import type { Employee, Company, Task } from "@/types";
import { AlertTriangle, Building2, CalendarClock, Send, Users, Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function OverviewClient({
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
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const pathname = usePathname();
  // The overview is shared at `/` and `/admin`; keep board links in the same area.
  const base = pathname.startsWith("/admin") ? "/admin" : "";
  const managed = companies.filter((c) => c.managed && c.status === "active");
  const designers = employees.filter((e) => e.isScheduled && !e.isPhotographer);
  const content = tasks.filter((t) => t.kind === "CONTENT");
  const qty = (t: Task) => t.quantity ?? 1;
  const isDone = isTaskDoneState;
  const openUrgent = tasks.filter((t) => t.priority === "URGENT" && !isDone(t));

  const empName = (id: string | null) =>
    employees.find((e) => e.id === id)?.name ?? "—";
  const empColor = (id: string | null) =>
    employees.find((e) => e.id === id)?.color ?? undefined;
  const coName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "";

  // ---- إنجاز الفريق: per-person task completion (counts ALL assigned tasks, so
  // the publisher عمر — whose work is the PUBLISH cards — shows up too). منجز =
  // a task whose own stage is done; متبقّي = the rest.
  const achievement = employees
    .map((e) => {
      const mine = tasks.filter((t) => t.assigneeId === e.id);
      const total = mine.reduce((a, t) => a + qty(t), 0);
      const done = mine.filter(isDone).reduce((a, t) => a + qty(t), 0);
      return { emp: e, total, done, remaining: Math.max(0, total - done) };
    })
    .filter((x) => x.total > 0);

  // ---- إنجاز الشركات: a piece counts only when production is done AND publish
  // is done. A published-looking card whose design/shoot stage is still open
  // should not inflate the company percentage.
  const companyDone = managed
    .map((co) => {
      const plan = co.posts + co.reels + co.stories + co.aiReels;
      const done = completedCompanyPlanCount(tasks, co.id);
      const pct = plan > 0 ? Math.round(Math.min(100, (done / plan) * 100)) : 0;
      return { co, plan, done, remaining: Math.max(0, plan - done), pct };
    })
    .filter((x) => x.plan > 0)
    .sort((a, b) => a.co.priority - b.co.priority || b.pct - a.pct);

  // "اليوم" panel: LIVE (not done) tasks on a reference day, grouped per person,
  // using the SAME labels as the task board. The reference day is today if it has
  // work, else the nearest later working day with work.
  const deadlineOf = (t: Task): Date | null =>
    t.readyDate ? new Date(t.readyDate) : t.publishDate ? new Date(t.publishDate) : null;
  const reelNum = buildReelNumbers(tasks);
  const todayISO = toISODate(new Date());
  const dayISOSetOf = (t: Task) => {
    const deadline = deadlineOf(t);
    return [
      t.workDate ? toISODate(new Date(t.workDate)) : null,
      deadline ? toISODate(deadline) : null,
    ].filter((value): value is string => !!value);
  };
  const liveDated = tasks.filter((t) => dayISOSetOf(t).length > 0 && !isDone(t));
  const dayTasks = (iso: string) =>
    liveDated.filter((t) => dayISOSetOf(t).includes(iso));
  const monthDayISOs = Array.from(
    new Set(liveDated.flatMap(dayISOSetOf)),
  ).sort();
  const refDay =
    dayTasks(todayISO).length > 0
      ? todayISO
      : monthDayISOs.find((d) => d >= todayISO) ??
        monthDayISOs[monthDayISOs.length - 1] ??
        todayISO;
  const refIsToday = refDay === todayISO;
  // ALL employees are always listed. Per person on the reference day:
  //  - off (refDay not a working day)  → عطلة
  //  - working with no tasks           → متفرّغ لعمل إضافي
  //  - working with tasks              → the cards
  const refDayObj = fromISODate(refDay);
  const dayByPerson = employees.map((e) => ({
    emp: e,
    isOff: !parseWorkDays(e.workDays).includes(refDayObj.getDay()),
    cards: groupTasksIntoCards(dayTasks(refDay).filter((t) => t.assigneeId === e.id)),
  }));
  // Default tab: first person who actually has work today, else the first person.
  const defaultId =
    (dayByPerson.find((g) => g.cards.length > 0) ?? dayByPerson[0])?.emp.id ?? null;
  const activeId =
    activeTab && dayByPerson.some((g) => g.emp.id === activeTab) ? activeTab : defaultId;
  const activeGroup = dayByPerson.find((g) => g.emp.id === activeId) ?? null;

  // ---- المهام الحرجة: not-done tasks whose deadline is overdue or within ≤2
  // working days. Deadline = readyDate (design/adhoc) else publishDate.
  const soonISO = toISODate(addWorkdaysFor(new Date(), 2, [6, 0, 1, 2, 3]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const criticalSource = tasks.filter((t) => {
    if (isDone(t)) return false;
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
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        (a.dl?.getTime() ?? 0) - (b.dl?.getTime() ?? 0),
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
                className="flex flex-col gap-2 border border-border-soft rounded-lg p-3 bg-bg-elev/40"
              >
                {/* person header: avatar + name + counters + quick link to board */}
                <div className="flex items-center gap-2">
                  <Avatar name={emp.name} color={emp.color ?? undefined} size={22} />
                  <span className="text-sm font-semibold flex-1 truncate">{emp.name}</span>
                  <div className="flex items-center gap-1 text-[10px] tabular-nums">
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
                      <span className="rounded-full px-1.5 py-0.5 bg-bg-elev-2 text-fg-muted">
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
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span className="text-xs font-medium truncate">
                          {cardLabelFor(card.repr, card.count, reelNum, coName)}
                        </span>
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
            {achievement.map(({ emp, total, done, remaining }) => (
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
                  <span className="text-success">منجز {done}</span>
                  <span className="text-fg-dim">متبقّي {remaining}</span>
                  <span className="text-fg-muted">الكل {total}</span>
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
              {refIsToday
                ? "اليوم"
                : `أقرب يوم عمل · ${ARABIC_DAYS[fromISODate(refDay).getDay()]} ${formatDateShort(fromISODate(refDay))}`}
            </span>
          </div>

          {dayByPerson.length === 0 ? (
            <p className="text-sm text-fg-muted">لا يوجد موظفون.</p>
          ) : (
            <>
              {/* a tab for EVERY employee, always */}
              <div className="flex gap-1 flex-wrap border-b border-border-soft mb-3">
                {dayByPerson.map(({ emp, isOff, cards }) => {
                  const active = emp.id === activeId;
                  // Tasks take precedence (someone may publish on a day their
                  // workDays mark off): tasks → عطلة → متفرّغ.
                  const resting = isOff && cards.length === 0;
                  const badge =
                    cards.length > 0 ? String(cards.length) : isOff ? "عطلة" : "متفرّغ";
                  const badgeCls =
                    cards.length > 0
                      ? active
                        ? "bg-accent/15 text-accent"
                        : "bg-bg-elev-2 text-fg-muted"
                      : isOff
                        ? "bg-bg-elev-2 text-fg-muted"
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

              {/* active person's state: عطلة / متفرّغ / tasks */}
              <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1">
                {activeGroup && activeGroup.cards.length === 0 ? (
                  activeGroup.isOff ? (
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
                      <span className="text-xs truncate">
                        {cardLabelFor(card.repr, card.count, reelNum, coName)}
                      </span>
                    </div>
                  ))
                )}
              </div>
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
          نسبة النشر الفعلي من الخطة خلال دورة العقد — المهمة لا تُحتسب للشركة إلا بعد نشرها.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {companyDone.map(({ co, plan, done, remaining, pct }) => (
            <div key={co.id} className="border border-border-soft rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: co.color ?? "#C8A84E" }}
                  />
                  <span className="font-semibold">{co.name}</span>
                </div>
                <span
                  className={
                    "text-sm display-font " +
                    (pct >= 100 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger")
                  }
                >
                  {pct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-bg-elev-2 overflow-hidden mb-1.5">
                <div
                  className={"h-full " + (pct >= 100 ? "bg-success" : "bg-accent")}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="text-[11px] text-fg-dim tabular-nums">
                <span className="text-success">منجز {done}</span>
                <span className="text-fg-muted"> / {plan}</span>
                {remaining > 0 && <span className="text-warning"> · باقي {remaining}</span>}
              </div>
            </div>
          ))}
          {companyDone.length === 0 && (
            <p className="text-sm text-fg-muted col-span-full">لا توجد شركات مُدارة بخطة.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
