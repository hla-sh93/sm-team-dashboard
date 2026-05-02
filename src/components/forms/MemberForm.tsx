'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TeamMember } from '@/types';
import { memberSchema, type MemberInput } from '@/lib/schemas';
import { createMember, updateMember } from '@/server/actions/members';
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
import { ROLE_LABELS } from '@/lib/constants';
import { toast } from '@/components/ui/toaster';

interface MemberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamMember | null;
}

export default function MemberForm({ open, onOpenChange, member }: MemberFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!member;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MemberInput>({
    resolver: zodResolver(memberSchema),
    defaultValues: member
      ? {
          name: member.name,
          role: member.role as MemberInput['role'],
          capPost: member.capPost,
          capReelAi: member.capReelAi,
          capReelVideo: member.capReelVideo,
          capPlan: member.capPlan,
          active: member.active,
        }
      : {
          name: '',
          role: 'designer',
          capPost: 0,
          capReelAi: 0,
          capReelVideo: 0,
          capPlan: 0,
          active: true,
        },
  });

  const onSubmit = (data: MemberInput) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateMember(member!.id, data)
        : await createMember(data);
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
          <DialogTitle>{isEdit ? 'تعديل موظف' : 'إضافة موظف'}</DialogTitle>
          <DialogDescription>حدد الدور والقدرات اليومية</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input {...register('name')} placeholder="مثال: نوال" />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>الدور</Label>
              <Select {...register('role')}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="bg-bg-elev rounded-lg p-4 border border-border-soft">
            <div className="text-xs text-fg-dim mb-3 font-semibold">
              القدرات اليومية (المتاح في يوم العمل الواحد)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>بوستات/يوم</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  {...register('capPost', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ريل AI/يوم</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  {...register('capReelAi', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ريل تصوير/يوم</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  {...register('capReelVideo', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>خطط/يوم</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  {...register('capPlan', { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-fg-muted leading-relaxed">
              💡 القدرات الكسرية: 0.5 = قطعة كل يومين. مثلاً نوال = 0.5 خطة/يوم تعني خطة كل يومين.
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
