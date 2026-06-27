"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Task, Employee, Company } from "@/types";
import { createTask, updateTaskDetails } from "@/server/actions/tasks";
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
  ids?: string[]; // tasks of the card being edited (batched → all)
  displayLabel?: string; // computed label, used to seed the name when none
  employees: Employee[];
  companies: Company[];
  year: number;
  month: number;
}

const HPD = 6; // hours per working day (effort conversion)

export default function TaskForm({
  open,
  onOpenChange,
  task,
  ids,
  displayLabel,
  employees,
  companies,
  year,
  month,
}: TaskFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!task;
  const isAdhoc = !task || task.kind === "ADHOC";

  const blank = () => ({
    title: "",
    assigneeId: employees[0]?.id ?? "",
    companyId: "",
    days: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    workDate: "",
    readyDate: "",
    isPinned: false,
    notes: "",
  });
  const fromTask = (t: Task) => ({
    title: t.title || displayLabel || "",
    assigneeId: t.assigneeId ?? "",
    companyId: t.companyId ?? "",
    days: Math.round(((t.hours || 0) / HPD) * 10) / 10 || 1,
    priority: t.priority,
    status: t.status,
    workDate: t.workDate ? toISODate(new Date(t.workDate)) : "",
    readyDate: t.readyDate ? toISODate(new Date(t.readyDate)) : "",
    isPinned: t.isPinned,
    notes: t.notes ?? "",
  });

  const [form, setForm] = useState(() => (task ? fromTask(task) : blank()));
  useEffect(() => {
    setForm(task ? fromTask(task) : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, open]);

  const set = (k: keyof ReturnType<typeof blank>, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast("العنوان مطلوب", "error");
      return;
    }
    startTransition(async () => {
      if (isEdit) {
        const result = await updateTaskDetails(ids ?? [task!.id], {
          title: form.title.trim(),
          workDate: form.workDate || null,
          readyDate: form.readyDate || null,
          assigneeId: form.assigneeId || null,
          priority: form.priority,
          status: form.status,
          days: isAdhoc ? Number(form.days) || 0 : undefined,
          isPinned: form.isPinned,
        });
        if (result.ok) {
          toast("تم تحديث المهمة");
          onOpenChange(false);
          router.refresh(); // pull the fresh server view so the edit shows immediately
        } else toast(result.error, "error");
      } else {
        const days = Number(form.days) || 0;
        const result = await createTask({
          title: form.title.trim(),
          kind: "ADHOC",
          hours: Math.round(days * HPD * 10) / 10,
          days,
          priority: form.priority as TaskCreatePriority,
          status: form.status as TaskCreateStatus,
          readyDate: form.readyDate || null,
          workDate: form.workDate || null,
          notes: form.notes || null,
          assigneeId: form.assigneeId || null,
          companyId: form.companyId || null,
          isPinned: form.isPinned,
          month,
          year,
        });
        if (result.ok) {
          toast("تم إنشاء المهمة");
          onOpenChange(false);
          router.refresh();
        } else toast(result.error, "error");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل مهمة" : "إضافة مهمة إضافية"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "عدّل الاسم، المسؤول، الأولوية، وتاريخ البداية/النهاية. يُحدَّث الحمل وتُعاد الجدولة تلقائياً."
              : "تُجدول المهمة الإضافية حسب أولويتها (عادي/مهم/مستعجل) ضمن سعة الموظف."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>عنوان المهمة</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="مثال: تصميم بروفايل كابرياني"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>المسؤول</Label>
              <Select value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
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
              <Select
                value={form.companyId}
                onChange={(e) => set("companyId", e.target.value)}
                disabled={isEdit && !isAdhoc}
              >
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
              <Label>تاريخ البداية</Label>
              <Input type="date" value={form.workDate} onChange={(e) => set("workDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ النهاية / التسليم</Label>
              <Input type="date" value={form.readyDate} onChange={(e) => set("readyDate", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {isAdhoc && (
              <div className="space-y-1.5">
                <Label>أيام العمل</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.days}
                  onChange={(e) => set("days", e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {isEdit ? (
            <p className="text-[11px] text-fg-dim">
              يُحفظ تعديلك تلقائياً ولا يُلغى عند إعادة الجدولة.
            </p>
          ) : (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => set("isPinned", e.target.checked)}
                className="accent-accent"
              />
              قفل يدوي (لا يُعاد جدولته)
            </label>
          )}

          {isAdhoc && (
            <div className="space-y-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="تفاصيل إضافية..."
              />
            </div>
          )}

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

type TaskCreatePriority = (typeof PRIORITIES)[number];
type TaskCreateStatus = (typeof STATUSES)[number];
