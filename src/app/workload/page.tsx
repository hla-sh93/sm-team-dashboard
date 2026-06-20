import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/badge";
import { MonthBar } from "@/components/MonthBar";
import { resolveActiveMonth } from "@/lib/month";
import { computeWorkload, isPublisherRole, isWriterRole } from "@/lib/workload";
import { ROLE_LABELS } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";

export default async function WorkloadPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const [employees, tasks, sessions] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ where: { year, month } }),
    prisma.photoSession.findMany({ where: { year, month } }),
  ]);

  // Whole team, designers first (hours), then the rest (by item count).
  const workload = computeWorkload(employees, tasks, year, month, sessions).sort(
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
          <p className="text-sm text-fg-dim">الأيام المطلوبة مقابل المتاحة لكل موظف (حسب الطاقة الإنتاجية)</p>
        </div>
        <MonthBar year={year} month={month} />
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {workload.map((w) => {
          const unit = isPublisherRole(w.employee.role)
            ? "منشور"
            : w.employee.isPhotographer
              ? "نزلة"
              : isWriterRole(w.employee.role)
                ? "خطة"
                : "مهمة";
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
                  {w.tracksDays ? (
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
                  ) : (
                    <div className="text-2xl display-font text-info">
                      {w.itemCount}
                      <span className="text-sm text-fg-dim"> {unit}</span>
                    </div>
                  )}
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
                    (w.tracksDays
                      ? w.level === "over"
                        ? "bg-danger"
                        : w.level === "warn"
                          ? "bg-warning"
                          : "bg-success"
                      : "bg-info/60")
                  }
                  style={{
                    width: w.tracksDays
                      ? `${Math.min(100, w.pct)}%`
                      : `${Math.min(100, w.itemCount * 6)}%`,
                  }}
                />
              </div>
              {w.tracksDays ? (
                <>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <Stat label="أيام مطلوبة" value={`${w.neededDays}`} />
                    <Stat label="أيام متاحة" value={`${w.capacityDays}`} />
                    <Stat label="مشغول" value={`${w.busyDays} يوم`} />
                    <Stat label="فاضي" value={`${w.freeDays} يوم`} />
                  </div>
                  <div className="flex gap-2 mt-3 text-[11px] text-fg-dim flex-wrap">
                    <span>بوست: {w.breakdown.POST}</span>
                    <span>· ريل AI: {w.breakdown.AI_REEL}</span>
                    <span>· ستوري: {w.breakdown.STORY}</span>
                    <span>· مستعجلة: {w.breakdown.ADHOC}</span>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label={unit} value={`${w.itemCount}`} />
                  <Stat label="أيام مشغولة" value={`${w.busyDays}`} />
                  <Stat label="أيام متاحة" value={`${w.freeDays}`} />
                </div>
              )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-elev rounded-lg py-2">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-fg-muted text-[10px]">{label}</div>
    </div>
  );
}
