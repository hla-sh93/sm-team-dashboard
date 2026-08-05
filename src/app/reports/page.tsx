import { Avatar } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReportActions, type ReportRow, type TaskRow } from "@/components/ReportActions";
import { MonthBar } from "@/components/MonthBar";
import {
  CONTENT_TYPE_LABELS,
  ROLE_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
  isTaskDoneState,
  isTaskLateState,
  WEEKDAY_LABELS,
  type Stage,
  type Status,
} from "@/lib/constants";
import { formatDateShort, toISODate } from "@/lib/dates";
import { resolveActiveMonth, monthLabel } from "@/lib/month";
import { computeWorkload } from "@/lib/workload";
import { buildReelNumbers, cardLabelFor, groupTasksIntoCards } from "@/lib/cards";
import { completedCompanyPlanCount, producedCompanyPlanCount } from "@/lib/progress";
import { currentCycleBucket } from "@/lib/contract";
import { LatePill, daysLateOf } from "@/components/ui/pills";
import { prisma } from "@/lib/db";
import { AlertTriangle, CheckCircle2, Trophy } from "lucide-react";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const label = monthLabel({ year, month });

  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany(),
    prisma.task.findMany({ where: { year, month, status: { not: "CANCELED" } } }),
  ]);

  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const isDone = isTaskDoneState;
  const done = tasks.filter((t) => isDone(t));
  const qty = (t: { quantity?: number }) => t.quantity ?? 1;
  const doneCount = done.reduce((a, t) => a + qty(t), 0);

  // Actual time taken = finishedAt − startedAt (calendar days). Only available
  // once a task was moved through the board; null for never-started/seed data.
  const DAY = 86400000;
  const elapsedDays = (t: { startedAt: Date | null; finishedAt: Date | null }) => {
    if (!t.startedAt || !t.finishedAt) return null;
    return Math.max(
      0,
      Math.round((new Date(t.finishedAt).getTime() - new Date(t.startedAt).getTime()) / DAY),
    );
  };
  const elapsedLabel = (n: number | null) =>
    n == null ? "—" : n === 0 ? "نفس اليوم" : n === 1 ? "يوم" : `${n} يوم`;
  const timedDone = done.filter((t) => elapsedDays(t) != null);
  const avgElapsed =
    timedDone.length > 0
      ? Math.round(
          (timedDone.reduce((a, t) => a + (elapsedDays(t) ?? 0), 0) / timedDone.length) * 10,
        ) / 10
      : null;

  // Per-company plan completion (المنجَز مقابل المتبقّي من الخطة).
  const PLAN_TYPES: { type: string; label: string; key: "posts" | "reels" | "aiReels" | "stories" }[] = [
    { type: "POST", label: "بوست", key: "posts" },
    { type: "REEL", label: "ريل", key: "reels" },
    { type: "AI_REEL", label: "ريل AI", key: "aiReels" },
    { type: "STORY", label: "ستوري", key: "stories" },
  ];
  // «إنجاز خطة الشركات» يُقاس على **دورة العقد**، مو على شهر التقويم — نفس القاعدة
  // اللي على النظرة العامة. وصل بتمشي 13/7 ← 12/8، فكروتها بباكت تموز؛ قراءة باكت
  // آب كانت بتعطي «0/15 بوست» لشركة نصّ دورتها خالص.
  const cycleTaskCache = new Map<string, typeof tasks>();
  for (const co of companies) {
    const b = currentCycleBucket(co, new Date());
    cycleTaskCache.set(
      co.id,
      b.year === year && b.month === month
        ? tasks.filter((t) => t.companyId === co.id)
        : await prisma.task.findMany({
            where: { companyId: co.id, year: b.year, month: b.month, status: { not: "CANCELED" } },
          }),
    );
  }
  const companyPlan = companies
    .filter((c) => c.managed && c.status === "active")
    .sort((a, b) => a.priority - b.priority)
    .map((co) => {
      const cycleTasks = cycleTaskCache.get(co.id) ?? [];
      const rows = PLAN_TYPES.map((pt) => {
        const plan = co[pt.key] ?? 0;
        const d = completedCompanyPlanCount(cycleTasks, co.id, pt.type);
        // «منتَج» = الإنتاج خالص (تصميم/تصوير/مونتاج) حتى لو النشر لسا — شغل
        // موجود فعلاً وما لازم يقرأ كأنّه ما انعمل.
        const produced = producedCompanyPlanCount(cycleTasks, co.id, pt.type);
        return { ...pt, plan, done: d, produced, remaining: Math.max(0, plan - d) };
      }).filter((r) => r.plan > 0 || r.done > 0);
      const totalPlan = rows.reduce((a, r) => a + r.plan, 0);
      const totalDone = rows.reduce((a, r) => a + Math.min(r.done, r.plan), 0);
      const pct = totalPlan > 0 ? Math.round((totalDone / totalPlan) * 100) : 0;
      return { co, rows, pct, totalPlan, totalDone };
    })
    .filter((x) => x.rows.length > 0);

  // Out-of-plan (ad-hoc) done work, grouped lightly for the summary.
  const outOfPlanDone = done
    .filter((t) => t.kind === "ADHOC")
    .reduce((a, t) => a + qty(t), 0);

  const workload = computeWorkload(
    employees.filter((e) => e.isScheduled),
    tasks,
    year,
    month,
    [],
    companies,
  );

  const byAssignee = new Map<string, typeof tasks>();
  for (const t of done) {
    const arr = byAssignee.get(t.assigneeId ?? "") ?? [];
    arr.push(t);
    byAssignee.set(t.assigneeId ?? "", arr);
  }

  // Per-person LEDGER (all their tasks, batched like the board) for the detailed
  // breakdown: name · start → end · actual duration · lateness.
  const reelNum = buildReelNumbers(tasks);
  const allByAssignee = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    const arr = allByAssignee.get(t.assigneeId) ?? [];
    arr.push(t);
    allByAssignee.set(t.assigneeId, arr);
  }
  const isLate = isTaskLateState;
  // Start = when work began (else planned workDate); End = when finished (else the
  // deadline / publish date).
  const startOf = (t: (typeof tasks)[number]) => t.startedAt ?? t.workDate;
  const endOf = (t: (typeof tasks)[number]) =>
    t.finishedAt ?? t.readyDate ?? t.publishDate;

  // ---- تشخيص التأخيرات: WHERE (stage) + WHO (person) + HOW MUCH (days) ----
  const stageLabelOf = (t: (typeof tasks)[number]) =>
    t.stage ? STAGE_LABELS[t.stage as Stage] : t.kind === "ADHOC" ? "إضافية" : "أخرى";
  const lateTasks = tasks.filter((t) => isLate(t));
  const lateByStage = new Map<string, number>();
  for (const t of lateTasks) {
    const s = stageLabelOf(t);
    lateByStage.set(s, (lateByStage.get(s) ?? 0) + 1);
  }
  // ترتيب خط الإنتاج — «مونتاج» انضافت كمرحلة، وبلاها كانت بتنفرز أول القائمة
  // (indexOf = −1) وكأنها قبل الكتابة.
  const STAGE_ORDER = ["كتابة", "تصميم", "تصوير", "مونتاج", "نشر", "إضافية", "أخرى"];
  const lateStages = [...lateByStage.entries()].sort(
    (a, b) => STAGE_ORDER.indexOf(a[0]) - STAGE_ORDER.indexOf(b[0]),
  );
  const lateByPerson = employees
    .map((e) => {
      const mine = lateTasks.filter((t) => t.assigneeId === e.id);
      const maxDays = mine.reduce((a, t) => Math.max(a, daysLateOf(t)), 0);
      return { e, count: mine.length, maxDays };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || b.maxDays - a.maxDays);

  const teamRows: ReportRow[] = employees.map((e) => {
    const w = workload.find((x) => x.employee.id === e.id);
    return {
      employee: e.name,
      role: ROLE_LABELS[e.role] ?? e.role,
      neededDays: w?.neededDays ?? 0,
      busyDays: w?.busyDays ?? 0,
      freeDays: w?.freeDays ?? 0,
      done: (byAssignee.get(e.id) ?? []).length,
    };
  });

  const taskRows: TaskRow[] = tasks
    .filter((t) => t.workDate)
    .sort((a, b) => new Date(a.workDate!).getTime() - new Date(b.workDate!).getTime())
    .map((t) => ({
      date: toISODate(new Date(t.workDate!)),
      weekday: WEEKDAY_LABELS[new Date(t.workDate!).getDay()] ?? "",
      employee: employees.find((e) => e.id === t.assigneeId)?.name ?? "",
      type:
        t.kind === "CONTENT" && t.type
          ? CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]
          : t.title ?? "مهمة",
      target: coName(t.companyId) || (t.title ?? ""),
      hours: t.hours,
      startedAt: t.startedAt ? toISODate(new Date(t.startedAt)) : "",
      finishedAt: t.finishedAt ? toISODate(new Date(t.finishedAt)) : "",
      actualDays: elapsedDays(t),
      publishDate: t.publishDate ? toISODate(new Date(t.publishDate)) : "",
      status: STATUS_LABELS[t.status as Status] ?? t.status,
    }));

  const contributors = employees.filter((e) => (byAssignee.get(e.id) ?? []).length > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">التقارير</h1>
          <p className="text-sm text-fg-dim">إنجاز {label}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ReportActions teamRows={teamRows} taskRows={taskRows} monthLabel={label} />
          <MonthBar year={year} month={month} showGenerate={false} />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">المنجز (شامل الكميات)</div>
              <div className="display-font text-2xl">{doneCount}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">متوسط مدة الإنجاز الفعلية</div>
              <div className="display-font text-2xl">
                {avgElapsed == null ? "—" : avgElapsed === 0 ? "نفس اليوم" : `${avgElapsed} يوم`}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">المساهمون</div>
              <div className="display-font text-2xl">
                {contributors.length} / {employees.length}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 text-info flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-fg-muted">إجمالي المهام بالشهر</div>
              <div className="display-font text-2xl">{tasks.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* المنجَز مقابل المتبقّي من خطة كل شركة */}
      {companyPlan.length > 0 && (
        <Card>
          <h2 className="display-font text-lg mb-1">إنجاز خطة الشركات — المنشور</h2>
          {/* «إنجاز» كلمة وحدة بمعنيين، وهاد سبب لبس حقيقي: البلسم كانت بتطلع
              هون ٠٪ وبنفس الوقت ٢٨٪ بجرد الدورات. النسبة هون = **المنشور** لأنّه
              هو خط النهاية عند الزبون؛ و«منتَج» جنبها = خالص بس لسا ما اننشر. */}
          <p className="text-xs text-fg-dim mb-4">
            كل شركة على دورة عقدها هي، مو على شهر التقويم. النسبة = المنشور فعلاً؛
            و«منتَج» = خالص عنا وواقف على النشر.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {companyPlan.map(({ co, rows, pct }) => (
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
                <div className="h-2 rounded-full bg-bg-elev2 overflow-hidden mb-2">
                  <div
                    className={"h-full " + (pct >= 100 ? "bg-success" : "bg-accent")}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {rows.map((r) => (
                    <div key={r.type} className="flex items-center justify-between">
                      <span className="text-fg-dim">{r.label}</span>
                      <span className="tabular-nums">
                        <span className={r.done >= r.plan ? "text-success" : ""}>{r.done}</span>
                        <span className="text-fg-muted">/{r.plan}</span>
                        {/* منتَج بس مو منشور = شغل خالص محبوس عالنشر — يستاهل
                            يبيّن، لأنّ «باقي ١٠» لحالها بتقرأ كأنّ ما انعمل شي */}
                        {r.produced > r.done && (
                          <span className="text-info"> · منتَج {r.produced}</span>
                        )}
                        {r.remaining > 0 && (
                          <span className="text-warning"> · باقي {r.remaining}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {outOfPlanDone > 0 && (
            <p className="text-xs text-fg-muted mt-3">
              + {outOfPlanDone} مهمة منجزة <strong>خارج الخطة</strong> (مفصّلة لكل شخص بالأسفل).
            </p>
          )}
        </Card>
      )}

      {/* تشخيص التأخيرات: أين (المرحلة) ومَن (الشخص) وكم (الأيام) */}
      <Card className={lateTasks.length > 0 ? "border-r-4 border-danger" : undefined}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className={"w-5 h-5 " + (lateTasks.length ? "text-danger" : "text-success")} />
          <h2 className="display-font text-lg">تشخيص التأخيرات</h2>
          <span className="text-xs text-fg-muted">{lateTasks.length} مهمة متأخرة</span>
        </div>
        {lateTasks.length === 0 ? (
          <p className="text-sm text-success">لا تأخيرات — كل المهام ضمن مواعيدها. 👏</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div>
              <div className="text-xs text-fg-dim mb-2">أين التأخير (حسب المرحلة)</div>
              <div className="flex flex-wrap gap-2">
                {lateStages.map(([stage, n]) => (
                  <span
                    key={stage}
                    className="text-xs rounded-md px-2 py-1 bg-danger/10 text-danger font-medium"
                  >
                    {stage}: {n}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-fg-dim mb-2">عند مَن (حسب الشخص)</div>
              <div className="flex flex-col gap-1.5">
                {lateByPerson.map(({ e, count, maxDays }) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <Avatar name={e.name} color={e.color ?? undefined} size={18} />
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="text-danger font-semibold tabular-nums">{count} متأخرة</span>
                    {maxDays > 0 && (
                      <span className="text-[11px] text-fg-muted tabular-nums">
                        أقصى {maxDays === 1 ? "يوم" : `${maxDays} يوم`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <h2 className="display-font text-lg">تفاصيل المهام لكل شخص</h2>
        {employees.map((e) => {
          const mine = allByAssignee.get(e.id) ?? [];
          if (mine.length === 0) return null;
          const total = mine.reduce((a, t) => a + qty(t), 0);
          const doneN = mine.filter((t) => isDone(t)).reduce((a, t) => a + qty(t), 0);
          const cards = groupTasksIntoCards(mine).sort((a, b) => {
            const la = isLate(a.repr) ? 1 : 0;
            const lb = isLate(b.repr) ? 1 : 0;
            if (la !== lb) return lb - la; // late first
            return (startOf(a.repr)?.getTime() ?? 0) - (startOf(b.repr)?.getTime() ?? 0);
          });
          return (
            <Card key={e.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} color={e.color ?? undefined} size={40} />
                  <div>
                    <div className="font-semibold">{e.name}</div>
                    <div className="text-xs text-fg-muted">{ROLE_LABELS[e.role] ?? e.role}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="display-font text-2xl">
                    <span className="text-success">{doneN}</span>
                    <span className="text-fg-muted text-lg"> / {total}</span>
                  </div>
                  <div className="text-[10px] text-fg-muted">منجز / إجمالي المهام</div>
                </div>
              </div>

              {/* column header */}
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] text-fg-muted border-b border-border-soft pb-1 mb-1">
                <span>المهمة</span>
                <span>البداية ← النهاية</span>
                <span className="text-center">المدة الفعلية</span>
                <span className="text-center">الحالة</span>
              </div>

              <div className="space-y-1">
                {cards.map((c) => {
                  const t = c.repr;
                  const taskDone = isDone(t);
                  const late = isLate(t);
                  const s = startOf(t);
                  const en = endOf(t);
                  return (
                    <div
                      key={c.key}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center gap-x-3 gap-y-0.5 text-sm py-1.5 border-b border-border-soft last:border-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {taskDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                        ) : (
                          <span
                            className={
                              "w-2 h-2 rounded-full shrink-0 " +
                              (late ? "bg-danger" : "bg-border")
                            }
                          />
                        )}
                        <span className="truncate">
                          {cardLabelFor(t, c.count, reelNum, coName)}
                        </span>
                        {late && <LatePill days={daysLateOf(t)} />}
                      </span>
                      <span className="text-[11px] text-fg-muted tabular-nums shrink-0">
                        {s ? formatDateShort(new Date(s)) : "—"} ←{" "}
                        {en ? formatDateShort(new Date(en)) : "—"}
                      </span>
                      <span
                        className="text-[11px] tabular-nums shrink-0 text-accent sm:text-center sm:w-20"
                        title="المدة الفعلية المستغرقة (من البدء حتى الإنجاز)"
                      >
                        {elapsedLabel(elapsedDays(t))}
                      </span>
                      <span className="text-xs text-fg-dim shrink-0 sm:text-center sm:w-20">
                        {STATUS_LABELS[t.status as Status] ?? t.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
