import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/badge";
import { MonthBar } from "@/components/MonthBar";
import { resolveActiveMonth } from "@/lib/month";
import { computeWorkload } from "@/lib/workload";
import { ROLE_LABELS, isTaskDoneState } from "@/lib/constants";
import { workRoster } from "@/lib/team";
import { hideDormantCompanyWork } from "@/lib/company-visibility";
import { AlertTriangle } from "lucide-react";
import { withoutPay } from "@/lib/auth";

export default async function WorkloadPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { year, month } = await resolveActiveMonth(await searchParams);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const publishFetchEnd = new Date(year, month + 1, 2);
  const [employeeRows, companies, allTasks, allSessions] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({
      where: {
        status: { not: "CANCELED" },
        OR: [
          { workDate: { gte: monthStart, lt: monthEnd } },
          { readyDate: { gte: monthStart, lt: monthEnd } },
          { publishDate: { gte: monthStart, lt: publishFetchEnd } },
        ],
      },
    }),
    prisma.photoSession.findMany({
      where: { shootDate: { gte: monthStart, lt: monthEnd } },
    }),
  ]);

  // الحمل ما بيلزمه راتب — ولا رقم بيوصل المتصفّح (٢٩/١٠).
  const employees = employeeRows.map(withoutPay);
  // شغل شركة موقوفة محفوظ ومخفي — ما بيدخل الحمل (D1، مراجعة ١٢/١٠).
  const tasks = hideDormantCompanyWork(allTasks, companies);
  const sessions = hideDormantCompanyWork(allSessions, companies);

  // فريق السوشال ميديا بس — السيلز والفريلانس برّا (قرار القائدة ١/٩)، إلا
  // لو ماسكين شغل مفتوح.
  const openHolders = new Set(
    tasks.filter((t) => !isTaskDoneState(t) && t.assigneeId).map((t) => t.assigneeId!),
  );
  const roster = workRoster(employees, openHolders);

  // Whole team, designers first (days), then the rest (by item count).
  const workload = computeWorkload(roster, tasks, year, month, sessions, companies).sort(
    (a, b) =>
      Number(b.tracksDays) - Number(a.tracksDays) ||
      b.pct - a.pct ||
      b.itemCount - a.itemCount,
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">أحمال العمل</h1>
          <p className="text-sm text-fg-dim">الأيام المطلوبة مقابل المتاحة داخل الشهر التقويمي</p>
        </div>
        <MonthBar year={year} month={month} />
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {workload.map((w) => {
          const cap = w.capacityDays || 1;
          const donePctCap = Math.min(100, (w.doneDays / cap) * 100);
          const remPctCap = Math.min(100 - donePctCap, (w.remainingDays / cap) * 100);
          const pctColor =
            w.level === "over" ? "text-danger" : w.level === "warn" ? "text-warning" : "text-success";
          return (
            <Card key={w.employee.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Avatar name={w.employee.name} color={w.employee.color ?? undefined} size={32} />
                  <div>
                    <div className="font-semibold">{w.employee.name}</div>
                    <div className="text-xs text-fg-dim">
                      {ROLE_LABELS[w.employee.role] ?? w.employee.role}
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <div className={"text-2xl display-font " + pctColor}>{w.pct}%</div>
                  <div className="text-[10px] text-fg-muted">الحمل من الطاقة (مطلوب ÷ متاح)</div>
                  {w.overflowCount > 0 && (
                    <div className="text-xs text-warning flex items-center gap-1 justify-end mt-0.5">
                      <AlertTriangle className="w-3 h-3" /> {w.overflowCount} تجاوز
                    </div>
                  )}
                </div>
              </div>

              {/* Burndown bar: done (green) · remaining (load color) · free (track) */}
              <div className="h-2.5 rounded-full bg-bg-elev2 overflow-hidden mb-1 flex">
                <div className="h-full bg-success" style={{ width: `${donePctCap}%` }} />
                <div
                  className={
                    "h-full " +
                    (w.level === "over" ? "bg-danger" : w.level === "warn" ? "bg-warning" : "bg-accent")
                  }
                  style={{ width: `${remPctCap}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-fg-muted mb-3">
                <span>منجز {w.donePct}%</span>
                <span>{w.freeDays} يوم متاح</span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <Stat label="مطلوب" value={`${w.committedDays}`} />
                <Stat label="منجز" value={`${w.doneDays}`} accent="success" />
                <Stat label="متبقّي" value={`${w.remainingDays}`} />
                <Stat label="متاح" value={`${w.freeDays}`} accent="accent" />
              </div>
              <div className="flex gap-2 mt-3 text-[11px] text-fg-dim flex-wrap">
                <span>بوست: {w.breakdown.POST}</span>
                <span>· ريل: {w.breakdown.REEL}</span>
                <span>· ريل AI: {w.breakdown.AI_REEL}</span>
                <span>· ستوري: {w.breakdown.STORY}</span>
                {/* كانت «مستعجلة» — هي المهام الإضافية (ADHOC)، وحملها من ساعاتها المكتوبة مو من المعدّل. */}
                <span className={w.adhocDays > w.capacityDays / 2 ? "text-warning font-semibold" : ""}>
                  · مهام إضافية: {w.breakdown.ADHOC} ({w.adhocDays} يوم)
                </span>
                <span>· الطاقة: {w.capacityDays} يوم</span>
                <span>· منجز: {w.donePct}%</span>
              </div>
            </Card>
          );
        })}
        {workload.length === 0 && (
          <p className="text-sm text-fg-muted">لا يوجد موظفون.</p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "accent";
}) {
  const color = accent === "success" ? "text-success" : accent === "accent" ? "text-accent" : "";
  return (
    <div className="bg-bg-elev rounded-lg py-2">
      <div className={"font-semibold tabular-nums " + color}>{value}</div>
      <div className="text-fg-muted text-[10px]">{label}</div>
    </div>
  );
}
