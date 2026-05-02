import { prisma } from '@/lib/db';
import { calculateMonthlyWorkload } from '@/lib/workload';
import { Avatar } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ROLE_LABELS, type Role, TYPE_LABELS } from '@/lib/constants';
import { formatMonthLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

export default async function WorkloadPage() {
  const today = new Date();
  const yr = today.getFullYear();
  const mo = today.getMonth();

  const [team, tasks] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.task.findMany(),
  ]);

  const workload = calculateMonthlyWorkload(team, tasks, yr, mo);

  return (
    <div className="animate-fade-in">
      <div className="mb-7">
        <h1 className="display-font text-3xl font-semibold">أحمال العمل</h1>
        <p className="text-fg-dim mt-1.5">
          تحليل تفصيلي لأحمال كل موظف خلال {formatMonthLabel(new Date(yr, mo, 1))}
        </p>
      </div>

      <div className="space-y-4">
        {workload.map((w) => (
          <Card key={w.member.id}>
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-5 items-center">
              <div className="flex items-center gap-3">
                <Avatar name={w.member.name} size={48} />
                <div>
                  <div className="font-bold text-base">{w.member.name}</div>
                  <div className="text-xs text-fg-muted">{ROLE_LABELS[w.member.role as Role]}</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2 text-xs">
                  <span className="text-fg-muted">من {w.workDays} يوم عمل في الشهر</span>
                  <span
                    className={cn(
                      'font-bold',
                      w.level === 'over' && 'text-danger',
                      w.level === 'warn' && 'text-warning'
                    )}
                  >
                    {w.consumedDays} / {w.workDays} يوم
                  </span>
                </div>
                <div className="h-3.5 bg-bg-elev-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      w.level === 'over' && 'bg-gradient-to-l from-danger to-orange-500',
                      w.level === 'warn' && 'bg-gradient-to-l from-warning to-orange-400',
                      w.level === 'normal' && 'bg-gradient-to-l from-success to-accent'
                    )}
                    style={{ width: `${Math.min(w.pct, 100)}%` }}
                  />
                </div>
              </div>

              <div
                className={cn(
                  'display-font text-3xl font-bold text-left min-w-[80px]',
                  w.level === 'over' && 'text-danger',
                  w.level === 'warn' && 'text-warning',
                  w.level === 'normal' && 'text-success'
                )}
              >
                {w.pct}%
              </div>
            </div>

            <hr className="my-4 border-border-soft" />

            <div className="flex flex-wrap gap-2">
              {Object.entries(w.breakdown).map(([k, v]) => {
                if (v === 0) return null;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-bg-elev border border-border"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {v} {TYPE_LABELS[k as keyof typeof TYPE_LABELS]}
                  </span>
                );
              })}
              {w.tasksCount === 0 && (
                <span className="text-xs text-fg-muted">لا توجد مهام لهذا الشهر</span>
              )}
            </div>

            {w.level === 'over' && (
              <div className="mt-4 bg-gradient-to-l from-danger/10 to-danger/5 border border-danger/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-danger font-bold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  تجاوز الطاقة بـ {w.pct - 100}%
                </div>
                <div className="text-xs">
                  اقترح: نقل بعض المهام لموظف آخر أو تأجيل لأسبوع لاحق
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
