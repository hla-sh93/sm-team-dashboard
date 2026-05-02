'use client';

import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Task, TeamMember, Company } from '@/types';
import { taskSchema, type TaskInput } from '@/lib/schemas';
import { createTask, updateTask } from '@/server/actions/tasks';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Label } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TYPE_LABELS, ROLE_LABELS, type Role } from '@/lib/constants';
import { toast } from '@/components/ui/toaster';
import { toISODate } from '@/lib/dates';

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  team: TeamMember[];
  companies: Company[];
  defaultStartDate?: string;
}

export default function TaskForm({
  open,
  onOpenChange,
  task,
  team,
  companies,
  defaultStartDate,
}: TaskFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!task;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: task
      ? {
          title: task.title,
          type: task.type as TaskInput['type'],
          status: task.status as TaskInput['status'],
          priority: task.priority as TaskInput['priority'],
          startDate: toISODate(new Date(task.startDate)),
          duration: task.duration,
          notes: task.notes ?? '',
          assigneeId: task.assigneeId,
          companyId: task.companyId ?? '',
        }
      : {
          title: '',
          type: 'custom',
          status: 'in_progress',
          priority: 'normal',
          startDate: defaultStartDate ?? toISODate(new Date()),
          duration: 1,
          notes: '',
          assigneeId: team[0]?.id ?? '',
          companyId: '',
        },
  });

  // Re-init when task changes
  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        type: task.type as TaskInput['type'],
        status: task.status as TaskInput['status'],
        priority: task.priority as TaskInput['priority'],
        startDate: toISODate(new Date(task.startDate)),
        duration: task.duration,
        notes: task.notes ?? '',
        assigneeId: task.assigneeId,
        companyId: task.companyId ?? '',
      });
    }
  }, [task, reset]);

  const onSubmit = (data: TaskInput) => {
    startTransition(async () => {
      const result = isEdit ? await updateTask(task!.id, data) : await createTask(data);
      if (result.ok) {
        toast(isEdit ? 'تم تحديث التاسك' : 'تم إنشاء التاسك');
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
          <DialogTitle>{isEdit ? 'تعديل تاسك' : 'إضافة تاسك جديدة'}</DialogTitle>
          <DialogDescription>
            عيّن المسؤول والمدة بدقة، النظام رح يحسب الأحمال تلقائياً
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>عنوان المهمة</Label>
              <Input {...register('title')} placeholder="مثال: تصميم منشور مناسبة العيد" />
              {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select {...register('type')}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>الشركة</Label>
              <Select {...register('companyId')}>
                <option value="">— داخلي —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>المسؤول</Label>
              <Select {...register('assigneeId')}>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {ROLE_LABELS[m.role as Role]}
                  </option>
                ))}
              </Select>
              {errors.assigneeId && (
                <p className="text-xs text-danger">{errors.assigneeId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select {...register('status')}>
                <option value="in_progress">قيد العمل</option>
                <option value="review">للمراجعة</option>
                <option value="ready">جاهز للنشر</option>
                <option value="published">منشور</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>تاريخ البدء</Label>
              <Input type="date" {...register('startDate')} />
              {errors.startDate && (
                <p className="text-xs text-danger">{errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>المدة (يوم)</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                {...register('duration', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select {...register('priority')}>
                <option value="urgent">عاجل</option>
                <option value="normal">عادي</option>
                <option value="low">منخفض</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea {...register('notes')} placeholder="تفاصيل إضافية..." />
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
