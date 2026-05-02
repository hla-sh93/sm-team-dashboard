'use client';

import { useState, useTransition } from 'react';
import type { TeamMember, Task } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/badge';
import MemberForm from '@/components/forms/MemberForm';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { calculateMonthlyWorkload } from '@/lib/workload';
import { deleteMember } from '@/server/actions/members';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

interface Props {
  team: TeamMember[];
  tasks: Task[];
}

export default function TeamClient({ team, tasks }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [, startTransition] = useTransition();

  const today = new Date();
  const workload = calculateMonthlyWorkload(team, tasks, today.getFullYear(), today.getMonth());

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`حذف ${name}؟`)) return;
    startTransition(async () => {
      const result = await deleteMember(id);
      if (result.ok) toast('تم الحذف');
      else toast(result.error, 'error');
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="display-font text-3xl font-semibold">الفريق</h1>
          <p className="text-fg-dim mt-1.5">{team.length} موظف — قدرات يومية وأحمال شهرية</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditMember(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4" />
          إضافة موظف
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {team.map((m) => {
          const w = workload.find((x) => x.member.id === m.id);
          return (
            <Card key={m.id} className="!p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} size={48} />
                  <div>
                    <div className="display-font font-bold text-base">{m.name}</div>
                    <div className="text-xs text-fg-muted">{ROLE_LABELS[m.role as Role]}</div>
                  </div>
                </div>
                {!m.active && (
                  <span className="text-[10px] font-bold text-fg-muted bg-fg-muted/15 px-2 py-0.5 rounded-full">
                    غير نشط
                  </span>
                )}
              </div>

              <div className="bg-bg-elev rounded-lg p-3 mb-4">
                <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider mb-2">
                  القدرات اليومية
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <CapItem label="بوست" value={m.capPost} />
                  <CapItem label="ريل AI" value={m.capReelAi} />
                  <CapItem label="ريل تصوير" value={m.capReelVideo} />
                  <CapItem label="خطة" value={m.capPlan} />
                </div>
              </div>

              {w && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-fg-muted">حمل هذا الشهر</span>
                    <span
                      className={cn(
                        'font-bold',
                        w.level === 'over' && 'text-danger',
                        w.level === 'warn' && 'text-warning',
                        w.level === 'normal' && 'text-success'
                      )}
                    >
                      {w.pct}%
                    </span>
                  </div>
                  <div className="h-2 bg-bg-elev-2 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        w.level === 'over' && 'bg-danger',
                        w.level === 'warn' && 'bg-warning',
                        w.level === 'normal' && 'bg-success'
                      )}
                      style={{ width: `${Math.min(w.pct, 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-fg-muted mt-1.5">
                    {w.tasksCount} مهمة · {w.consumedDays} يوم مُستهلك من {w.workDays}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditMember(m);
                    setShowForm(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  تعديل
                </Button>
                <Button
                  variant="danger"
                  size="icon"
                  onClick={() => handleDelete(m.id, m.name)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <MemberForm
        key={editMember?.id ?? 'new'}
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setEditMember(null);
        }}
        member={editMember}
      />
    </div>
  );
}

function CapItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{label}:</span>
      <span className={cn('font-bold', value === 0 ? 'text-fg-muted' : 'text-accent')}>
        {value === 0 ? '—' : value}
      </span>
    </div>
  );
}
