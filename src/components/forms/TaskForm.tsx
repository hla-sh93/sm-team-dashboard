"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Task, Employee, Company } from "@/types";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { createTask, updateTask } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "@/lib/constants";
import { toast } from "@/components/ui/toaster";
import { toISODate } from "@/lib/dates";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  employees: Employee[];
  companies: Company[];
  year: number;
  month: number;
}

export default function TaskForm({
  open,
  onOpenChange,
  task,
  employees,
  companies,
  year,
  month,
}: TaskFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!task;

  const defaults: Partial<TaskInput> = task
    ? {
        title: task.title ?? "",
        kind: "ADHOC",
        hours: task.hours,
        status: task.status as TaskInput["status"],
        priority: task.priority as TaskInput["priority"],
        readyDate: task.readyDate ? toISODate(new Date(task.readyDate)) : null,
        notes: task.notes ?? "",
        assigneeId: task.assigneeId ?? "",
        companyId: task.companyId ?? "",
        isPinned: task.isPinned,
        month: task.month,
        year: task.year,
      }
    : {
        title: "",
        kind: "ADHOC",
        hours: 1,
        status: "NOT_STARTED",
        priority: "NORMAL",
        readyDate: null,
        notes: "",
        assigneeId: employees[0]?.id ?? "",
        companyId: "",
        isPinned: false,
        month,
        year,
      };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: defaults as TaskInput,
  });

  useEffect(() => {
    reset(defaults as TaskInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, open]);

  const onSubmit = (data: TaskInput) => {
    startTransition(async () => {
      const payload = { ...data, kind: "ADHOC" as const };
      const result = isEdit
        ? await updateTask(task!.id, payload)
        : await createTask(payload);
      if (result.ok) {
        toast(isEdit ? "تم تحديث المهمة" : "تم إنشاء المهمة");
        onOpenChange(false);
        reset();
      } else {
        toast(result.error, "error");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل مهمة" : "إضافة مهمة مستعجلة"}</DialogTitle>
          <DialogDescription>
            تُجدول المهمة المستعجلة في أقرب وقت متاح (ASAP) ضمن سعة الموظف.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>عنوان المهمة</Label>
            <Input {...register("title")} placeholder="مثال: تصميم بروفايل كابرياني" />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>المسؤول</Label>
              <Select {...register("assigneeId")}>
                <option value="">— غير محدد —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الشركة</Label>
              <Select {...register("companyId")}>
                <option value="">— داخلي —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>الساعات</Label>
              <Input type="number" step="0.5" min="0" {...register("hours", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select {...register("priority")}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select {...register("status")}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>موعد التسليم (اختياري)</Label>
              <Input type="date" {...register("readyDate")} />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...register("isPinned")} className="accent-accent" />
                قفل يدوي (لا يُعاد جدولته)
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea {...register("notes")} placeholder="تفاصيل إضافية..." />
          </div>

          <input type="hidden" {...register("month", { valueAsNumber: true })} />
          <input type="hidden" {...register("year", { valueAsNumber: true })} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "جاري الحفظ..." : isEdit ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
