'use client';

import { useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Company, TeamMember } from '@/types';
import { companySchema, type CompanyInput } from '@/lib/schemas';
import { createCompany, updateCompany } from '@/server/actions/companies';
import { Button } from '@/components/ui/button';
import { Input, Select, Label } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
  team: TeamMember[];
}

export default function CompanyForm({ open, onOpenChange, company, team }: CompanyFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!company;

  const designers = team.filter((m) => m.capPost > 0 || m.capReelAi > 0);
  const photogs = team.filter((m) => m.capReelVideo > 0);

  const parseDays = (raw: string | null | undefined): number[] => {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((n) => typeof n === 'number');
    } catch {}
    return [];
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: company
      ? {
          name: company.name,
          color: company.color,
          priority: company.priority,
          posts: company.posts,
          reelAi: company.reelAi,
          reelVideo: company.reelVideo,
          needsApproval: company.needsApproval,
          status: company.status as CompanyInput['status'],
          designerId: company.designerId ?? '',
          photographerId: company.photographerId ?? '',
          notes: company.notes ?? '',
          publishDaysPost: parseDays(company.publishDaysPost),
          publishDaysReel: parseDays(company.publishDaysReel),
          publishDaysVideo: parseDays(company.publishDaysVideo),
        }
      : {
          name: '',
          color: '#d4af37',
          priority: 99,
          posts: 0,
          reelAi: 0,
          reelVideo: 0,
          needsApproval: false,
          status: 'active',
          designerId: designers[0]?.id ?? '',
          photographerId: photogs[0]?.id ?? '',
          notes: '',
          publishDaysPost: [],
          publishDaysReel: [],
          publishDaysVideo: [],
        },
  });

  const onSubmit = (data: CompanyInput) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateCompany(company!.id, data)
        : await createCompany(data);
      if (result.ok) {
        toast(isEdit ? 'تم التحديث' : 'تمت الإضافة');
        onOpenChange(false);
        reset();
      } else {
        toast(result.error, 'error');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل شركة' : 'إضافة شركة جديدة'}</DialogTitle>
          <DialogDescription>حدد الخطة الشهرية وقواعد سير العمل</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <Label>اسم الشركة</Label>
              <Input {...register('name')} placeholder="مثال: غلامور" />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>اللون المميز</Label>
              <Input
                type="color"
                {...register('color')}
                className="h-10 cursor-pointer p-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>بوستات/شهر</Label>
              <Input
                type="number"
                min="0"
                {...register('posts', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ريل AI/شهر</Label>
              <Input
                type="number"
                min="0"
                {...register('reelAi', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ريل تصوير/شهر</Label>
              <Input
                type="number"
                min="0"
                {...register('reelVideo', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>المصمم المسؤول</Label>
              <Select {...register('designerId')}>
                <option value="">— لا يوجد —</option>
                {designers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المصور المسؤول</Label>
              <Select {...register('photographerId')}>
                <option value="">— لا يوجد —</option>
                {photogs.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>يحتاج موافقة العميل؟</Label>
              <Select
                {...register('needsApproval', {
                  setValueAs: (v) => v === 'true' || v === true,
                })}
              >
                <option value="false">لا، يبدأ بعد مراجعة هلا</option>
                <option value="true">نعم، إلزامية</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select {...register('status')}>
                <option value="active">نشط</option>
                <option value="paused">متوقف مؤقتاً</option>
                <option value="archived">مؤرشف</option>
              </Select>
            </div>
          </div>

          {/* Publishing days */}
          <div className="border-t border-border-soft pt-4 space-y-3">
            <div>
              <Label className="text-sm font-semibold">أيام النشر على إنستغرام</Label>
              <p className="text-xs text-fg-muted mt-1">
                اختر الأيام المسموح فيها النشر لهذه الشركة. الفراغ = استخدام الإفتراضي (سبت/اثنين/أربعاء)
              </p>
            </div>
            <Controller
              control={control}
              name="publishDaysPost"
              render={({ field }) => (
                <DayPicker
                  label="أيام البوستات"
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="publishDaysReel"
              render={({ field }) => (
                <DayPicker
                  label="أيام ريل AI (اختياري — يرث من البوستات)"
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="publishDaysVideo"
              render={({ field }) => (
                <DayPicker
                  label="أيام ريل التصوير (اختياري — يرث من ريل AI)"
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'جاري الحفظ...' : isEdit ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const set = new Set(value);
  const toggle = (d: number) => {
    const next = new Set(set);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    onChange(Array.from(next).sort());
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-fg-dim">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_ORDER.map((d) => {
          const active = set.has(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold border transition-all',
                active
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-bg-elev text-fg-dim border-border hover:border-accent-dim hover:text-fg',
              )}
            >
              {WEEKDAY_LABELS[d]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
