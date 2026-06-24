"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/badge";
import { Donut } from "@/components/ui/Donut";
import { MonthBar } from "@/components/MonthBar";
import {
  DONE_STATUSES,
  ROLE_LABELS,
  taskColor,
  type Status,
} from "@/lib/constants";
import { buildReelNumbers, cardLabelFor, groupTasksIntoCards } from "@/lib/cards";
import {
  toISODate,
  fromISODate,
  formatDateShort,
  addWorkdaysFor,
  ARABIC_DAYS,
} from "@/lib/dates";
import type { Employee, Company, Task } from "@/types";
import { AlertTriangle, Building2, CalendarClock, Send, Users, Zap } from "lucide-react";

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
  const managed = companies.filter((c) => c.managed && c.status === "active");
  const designers = employees.filter((e) => e.isScheduled && !e.isPhotographer);
  const content = tasks.filter((t) => t.kind === "CONTENT");
  const qty = (t: Task) => t.quantity ?? 1;
  const isDone = (t: Task) =>
    DONE_STATUSES.includes(t.status as Status) || t.board === "DONE";
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

  // ---- إنجاز الشركات: a company's task is "done" ONLY once PUBLISHED (Omar's
  // PUBLISH card = DONE), not when designed/shot. % = published ÷ plan over the
  // company's contract cycle (the bucket's tasks already span that cycle).
  const companyDone = managed
    .map((co) => {
      const plan = co.posts + co.reels + co.stories + co.aiReels;
      const published = tasks
        .filter((t) => t.companyId === co.id && t.kind === "PUBLISH" && t.board === "DONE")
        .reduce((a, t) => a + qty(t), 0);
      const pct = plan > 0 ? Math.round(Math.min(100, (published / plan) * 100)) : 0;
      return { co, plan, published, remaining: Math.max(0, plan - published), pct };
    })
    .filter((x) => x.plan > 0)
    .sort((a, b) => a.co.priority - b.co.priority || b.pct - a.pct);

  // "اليوم" panel: LIVE (not done) tasks on a reference day, grouped per person,
  // using the SAME labels as the task board. The reference day is today if it has
  // work, else the nearest later working day with work.
  const reelNum = buildReelNumbers(tasks);
  const todayISO = toISODate(new Date());
  const liveDated = tasks.filter((t) => t.workDate && !isDone(t));
  const dayTasks = (iso: string) =>
    liveDated.filter((t) => toISODate(new Date(t.workDate!)) === iso);
  const monthDayISOs = Array.from(
    new Set(liveDated.map((t) => toISODate(new Date(t.workDate!)))),
  ).sort();
  const refDay =
    dayTasks(todayISO).length > 0
      ? todayISO
      : monthDayISOs.find((d) => d >= todayISO) ??
        monthDayISOs[monthDayISOs.length - 1] ??
        todayISO;
  const refIsToday = refDay === todayISO;
  const dayByPerson = employees
    .map((e) => ({
      emp: e,
      cards: groupTasksIntoCards(dayTasks(refDay).filter((t) => t.assigneeId === e.id)),
    }))
    .filter((g) => g.cards.length > 0);
  const activeId =
    activeTab && dayByPerson.some((g) => g.emp.id === activeTab)
      ? activeTab
      : dayByPerson[0]?.emp.id ?? null;
  const activeGroup = dayByPerson.find((g) => g.emp.id === activeId) ?? null;

  // ---- المهام الحرجة: not-done tasks whose deadline is overdue or within ≤2
  // working days. Deadline = readyDate (design/adhoc) else publishDate.
  const deadlineOf = (t: Task): Date | null =>
    t.readyDate ? new Date(t.readyDate) : t.publishDate ? new Date(t.publishDate) : null;
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

      {/* المهام الحرجة */}
      {criticalCards.length > 0 && (
        <Card className="border-r-4 border-danger">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-danger" />
            <h2 className="display-font text-lg">المهام الحرجة</h2>
            <span className="text-xs text-fg-muted">
              متأخرة أو تستحق خلال يومَي عمل · {criticalCards.length}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {criticalCards.map(({ card, dl, overdue }) => (
              <div
                key={card.key}
                className={
                  "flex items-start gap-2 min-w-0 rounded-md px-2.5 py-2 border " +
                  (overdue
                    ? "bg-danger/10 border-danger/40"
                    : "bg-warning/10 border-warning/40")
                }
              >
                <AlertTriangle
                  className={"w-4 h-4 mt-0.5 shrink-0 " + (overdue ? "text-danger" : "text-warning")}
                />
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-xs font-medium truncate">
                    {cardLabelFor(card.repr, card.count, reelNum, coName)}
                  </span>
                  <span className="text-[10px] text-fg-dim flex items-center gap-1.5">
                    <span>{empName(card.repr.assigneeId)}</span>
                    {dl && (
                      <span className={overdue ? "text-danger font-semibold" : "text-warning"}>
                        · {overdue ? "تأخّرت" : "تستحق"} {formatDateShort(dl)}
                      </span>
                    )}
                  </span>
                </div>
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
            <p className="text-sm text-fg-muted">لا توجد مهام مجدولة.</p>
          ) : (
            <>
              {/* tab per person */}
              <div className="flex gap-1 flex-wrap border-b border-border-soft mb-3">
                {dayByPerson.map(({ emp, cards }) => {
                  const active = emp.id === activeId;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setActiveTab(emp.id)}
                      className={
                        "flex items-center gap-1.5 px-2.5 py-1.5 -mb-px border-b-2 text-xs font-medium transition " +
                        (active
                          ? "border-accent text-fg"
                          : "border-transparent text-fg-dim hover:text-fg")
                      }
                    >
                      <Avatar name={emp.name} color={emp.color ?? undefined} size={18} />
                      {emp.name}
                      <span
                        className={
                          "rounded-full px-1.5 text-[10px] " +
                          (active ? "bg-accent/15 text-accent" : "bg-bg-elev-2 text-fg-muted")
                        }
                      >
                        {cards.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* active person's daily tasks */}
              <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1">
                {activeGroup?.cards.map((card) => (
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
                ))}
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
          {companyDone.map(({ co, plan, published, remaining, pct }) => (
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
                <span className="text-success">نُشر {published}</span>
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
