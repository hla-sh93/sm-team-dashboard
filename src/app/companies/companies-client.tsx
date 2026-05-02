'use client';

import { useState, useTransition } from 'react';
import type { Company, TeamMember } from '@/types';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, CompanyChip } from '@/components/ui/badge';
import CompanyForm from '@/components/forms/CompanyForm';
import { COMPANY_STATUS_LABELS } from '@/lib/constants';
import { deleteCompany } from '@/server/actions/companies';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

interface Props {
  team: TeamMember[];
  companies: Company[];
}

export default function CompaniesClient({ team, companies }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editCo, setEditCo] = useState<Company | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`حذف ${name}؟ سيتم حذف جميع تاسكاتها.`)) return;
    startTransition(async () => {
      const result = await deleteCompany(id);
      if (result.ok) toast('تم الحذف');
      else toast(result.error, 'error');
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
        <div>
          <h1 className="display-font text-3xl font-semibold">الشركات والخطط</h1>
          <p className="text-fg-dim mt-1.5">{companies.length} شركة — مرتبة حسب الأولوية</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditCo(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4" />
          إضافة شركة
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((co) => {
          const designer = team.find((m) => m.id === co.designerId);
          const photog = team.find((m) => m.id === co.photographerId);
          const total = co.posts + co.reelAi + co.reelVideo;
          return (
            <Card
              key={co.id}
              className="!p-5 relative overflow-hidden"
              style={{ borderTop: `3px solid ${co.color}` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: co.color }}
                  />
                  <h3 className="display-font font-bold text-lg">{co.name}</h3>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full',
                    co.status === 'active' && 'bg-success/15 text-success',
                    co.status === 'paused' && 'bg-warning/15 text-warning',
                    co.status === 'archived' && 'bg-fg-muted/15 text-fg-muted'
                  )}
                >
                  {COMPANY_STATUS_LABELS[co.status as keyof typeof COMPANY_STATUS_LABELS]}
                </span>
              </div>

              <div className="text-xs text-fg-dim mb-3">
                أولوية: <span className="text-accent font-bold">#{co.priority}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <Stat label="بوست" value={co.posts} />
                <Stat label="ريل AI" value={co.reelAi} />
                <Stat label="ريل تصوير" value={co.reelVideo} />
              </div>

              <div className="text-xs space-y-1.5 mb-4 pb-4 border-b border-border-soft">
                <div className="flex items-center justify-between">
                  <span className="text-fg-muted">الموافقة:</span>
                  {co.needsApproval ? (
                    <span className="flex items-center gap-1 text-warning">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      مطلوبة
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-fg-dim">
                      <XCircle className="w-3.5 h-3.5" />
                      غير مطلوبة
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-fg-muted">إجمالي شهري:</span>
                  <span className="font-bold">{total} قطعة</span>
                </div>
              </div>

              <div className="space-y-1.5 mb-4 text-xs">
                {designer && (
                  <div className="flex items-center gap-2">
                    <span className="text-fg-muted w-12">مصمم:</span>
                    <Avatar name={designer.name} size={22} />
                    <span>{designer.name}</span>
                  </div>
                )}
                {photog && (
                  <div className="flex items-center gap-2">
                    <span className="text-fg-muted w-12">مصور:</span>
                    <Avatar name={photog.name} size={22} />
                    <span>{photog.name}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditCo(co);
                    setShowForm(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  تعديل
                </Button>
                <Button
                  variant="danger"
                  size="icon"
                  onClick={() => handleDelete(co.id, co.name)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}

        {companies.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3 text-center py-12">
            <div className="text-fg-muted">لا توجد شركات. ابدأ بإضافة شركة جديدة.</div>
          </Card>
        )}
      </div>

      <CompanyForm
        key={editCo?.id ?? 'new'}
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setEditCo(null);
        }}
        company={editCo}
        team={team}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg-elev rounded-md py-2 px-1 text-center">
      <div className="display-font text-xl font-bold">{value}</div>
      <div className="text-[10px] text-fg-muted mt-0.5">{label}</div>
    </div>
  );
}
