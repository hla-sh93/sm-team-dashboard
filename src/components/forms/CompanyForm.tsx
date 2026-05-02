'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
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

  const {
    register,
    handleSubmit,
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
