import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/badge";
import { MonthBar } from "@/components/MonthBar";
import { resolveMonth } from "@/lib/month";
import { computeWorkload } from "@/lib/workload";
import { AlertTriangle } from "lucide-react";

export default async function WorkloadPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = resolveMonth(searchParams);
  const [employees, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ where: { year, month } }),
  ]);

  const workload = computeWorkload(
    employees.filter((e) => e.isScheduled),
    tasks,
    year,
    month,
  ).sort((a, b) => b.pct - a.pct);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">أحمال العمل</h1>
          <p className="text-sm text-fg-dim">إجمالي الساعات مقابل السعة لكل موظف</p>
        </div>
        <MonthBar year={year} month={month} />
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {workload.map((w) => (
          <Card key={w.employee.id}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Avatar name={w.employee.name} color={w.employee.color ?? undefined} size={32} />
                <div>
                  <div className="font-semibold">{w.employee.name}</div>
                  <div className="text-xs text-fg-dim">{w.employee.role}</div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={
                    "text-2xl display-font " +
                    (w.level === "over"
                      ? "text-danger"
                      : w.level === "warn"
                        ? "text-warning"
                        : "text-success")
                  }
                >
                  {w.pct}%
                </div>
                {w.overflowCount > 0 && (
                  <div className="text-xs text-warning flex items-center gap-1 justify-end">
                    <AlertTriangle className="w-3 h-3" /> {w.overflowCount} تجاوز
                  </div>
                )}
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-bg-elev-2 overflow-hidden mb-3">
              <div
                className={
                  "h-full rounded-full " +
                  (w.level === "over"
                    ? "bg-danger"
                    : w.level === "warn"
                      ? "bg-warning"
                      : "bg-success")
                }
                style={{ width: `${Math.min(100, w.pct)}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="إجمالي" value={`${w.totalHours}س`} />
              <Stat label="السعة" value={`${w.capacityHours}س`} />
              <Stat label="مشغول" value={`${w.busyDays} يوم`} />
              <Stat label="فاضي" value={`${w.freeDays} يوم`} />
            </div>
            <div className="flex gap-2 mt-3 text-[11px] text-fg-dim flex-wrap">
              <span>بوست: {w.breakdown.POST}</span>
              <span>· ريل AI: {w.breakdown.AI_REEL}</span>
              <span>· ستوري: {w.breakdown.STORY}</span>
              <span>· مستعجلة: {w.breakdown.ADHOC}</span>
            </div>
          </Card>
        ))}
        {workload.length === 0 && (
          <p className="text-sm text-fg-muted">لا يوجد موظفون مجدولون.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-elev rounded-lg py-2">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-fg-muted text-[10px]">{label}</div>
    </div>
  );
}
