'use client';

import { useState, useTransition } from 'react';
import type { Company } from '@/types';
import { GripVertical, Wand2, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { reorderCompanies } from '@/server/actions/companies';
import { generateSchedule } from '@/server/actions/schedule';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

interface Props {
  companies: Company[];
}

export default function PrioritiesClient({ companies: initialCompanies }: Props) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isScheduling, startScheduling] = useTransition();

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIdx = companies.findIndex((c) => c.id === draggedId);
    const targetIdx = companies.findIndex((c) => c.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const newOrder = [...companies];
    const [removed] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, removed);

    // Optimistic update
    setCompanies(newOrder.map((c, i) => ({ ...c, priority: i + 1 })));
    setDraggedId(null);
    setDragOverId(null);

    startTransition(async () => {
      const result = await reorderCompanies(newOrder.map((c) => c.id));
      if (result.ok) toast('تم تحديث الترتيب');
      else {
        toast(result.error, 'error');
        setCompanies(initialCompanies);
      }
    });
  };

  const handleReschedule = () => {
    const today = new Date();
    startScheduling(async () => {
      const result = await generateSchedule(today.getFullYear(), today.getMonth());
      if (result.ok) {
        toast(`تم إعادة الجدولة: ${result.stats.total} مهمة`);
      } else {
        toast(result.error, 'error');
      }
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="display-font text-3xl font-semibold">ترتيب الأولويات</h1>
          <p className="text-fg-dim mt-1.5">
            اسحبي وأفلتي للترتيب — الشركة الأعلى تحصل على وقت العمل أولاً
          </p>
        </div>
        <Button variant="primary" onClick={handleReschedule} disabled={isScheduling}>
          <Wand2 className="w-4 h-4" />
          {isScheduling ? 'جاري إعادة الجدولة...' : 'إعادة جدولة فوراً'}
        </Button>
      </div>

      <Card className="!p-4 mb-5 bg-info/5 border-info/30">
        <div className="flex items-start gap-3 text-sm">
          <ArrowDown className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-info mb-1">كيف تعمل الأولويات؟</div>
            <div className="text-fg-dim text-xs leading-relaxed">
              عند توليد جدول الشهر، النظام يعطي الشركة #1 أول حق في حجز أيام العمل،
              ثم #2 وهكذا. لو خلصت طاقة الفريق، الشركات الأقل أولوية ممكن تتأخر للشهر التالي.
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {companies.map((co, i) => (
          <div
            key={co.id}
            draggable
            onDragStart={() => handleDragStart(co.id)}
            onDragOver={(e) => handleDragOver(e, co.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, co.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            className={cn(
              'bg-bg-card border border-border-soft rounded-[14px] p-4 flex items-center gap-4 cursor-move transition-all',
              draggedId === co.id && 'opacity-40',
              dragOverId === co.id && draggedId !== co.id && 'border-accent bg-accent/5 -translate-y-0.5',
              isPending && 'pointer-events-none opacity-70'
            )}
            style={{ borderRight: `4px solid ${co.color}` }}
          >
            <GripVertical className="w-5 h-5 text-fg-muted flex-shrink-0" />

            <div
              className="display-font text-2xl font-bold w-10 text-center"
              style={{ color: co.color ?? "#C8A84E" }}
            >
              {i + 1}
            </div>

            <div className="flex-1">
              <div className="font-bold text-base">{co.name}</div>
              <div className="text-xs text-fg-muted mt-0.5">
                {co.posts} بوست · {co.reels} ريل · {co.aiReels} ريل AI · {co.stories} ستوري
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-fg-dim">
              {!co.managed && (
                <span className="bg-info/15 text-info px-2 py-0.5 rounded-full font-semibold">
                  تصميم-فقط
                </span>
              )}
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full font-semibold',
                  co.status === 'active' && 'bg-success/15 text-success',
                  co.status === 'paused' && 'bg-warning/15 text-warning',
                  co.status === 'archived' && 'bg-fg-muted/15 text-fg-muted'
                )}
              >
                {co.status === 'active' ? 'نشط' : co.status === 'paused' ? 'متوقف' : 'مؤرشف'}
              </span>
            </div>
          </div>
        ))}

        {companies.length === 0 && (
          <Card className="text-center py-12">
            <div className="text-fg-muted">
              لا توجد شركات. أضيفي شركات من قسم "الشركات" أولاً.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
