"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Task, Employee, Company, PublicEmployee, PublicCompany } from "@/types";
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
import { extraAssetName } from "@/lib/asset-name";
import { ADHOC_WORK_TYPES, adhocDaysFromRate, hoursOfDays, rateNote, type AdhocWorkType } from "@/lib/adhoc-effort";
import { ratePerDay } from "@/lib/capacity";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  ids?: string[]; // tasks of the card being edited (batched → all)
  displayLabel?: string; // computed label, used to seed the name when none
  employees: PublicEmployee[];
  companies: PublicCompany[];
  year: number;
  month: number;
}

const HPD = 8; // hours per working day (effort conversion)

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
    // بلا افتراضي: «يوم» افتراضي كان سبب ٤١ تصميم بـ٨ س لكل وحدة (تشرين).
    days: "" as number | string,
    workType: "" as AdhocWorkType | "",
    units: 1 as number | string,
    priority: "NORMAL",
    status: "NOT_STARTED",
    workDate: "",
    readyDate: "",
    publishDate: "",
    quantity: 1,
    isPinned: false,
    notes: "",
    brief: "",
  });
  const fromTask = (t: Task) => ({
    title: t.title || displayLabel || "",
    assigneeId: t.assigneeId ?? "",
    companyId: t.companyId ?? "",
    days: Math.round(((t.hours || 0) / HPD) * 100) / 100 || 1,
    workType: "OTHER" as AdhocWorkType | "",
    units: 1 as number | string,
    priority: t.priority,
    status: t.status,
    workDate: t.workDate ? toISODate(new Date(t.workDate)) : "",
    readyDate: t.readyDate ? toISODate(new Date(t.readyDate)) : "",
    publishDate: t.publishDate ? toISODate(new Date(t.publishDate)) : "",
    quantity: t.quantity ?? 1,
    isPinned: t.isPinned,
    notes: t.notes ?? "",
    brief: t.brief ?? "",
  });

  const [form, setForm] = useState(() => (task ? fromTask(task) : blank()));
  useEffect(() => {
    setForm(task ? fromTask(task) : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, open]);

  const set = (k: keyof ReturnType<typeof blank>, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));
  const isDesignUnitEditable =
    isEdit && task?.kind === "CONTENT" && task.stage !== "PUBLISH" && task.type === "POST";
  const isPublishCard = isEdit && task?.kind === "PUBLISH" && task.stage === "PUBLISH";
  const postFormat = Number(form.quantity) > 1 ? "CAROUSEL" : "SINGLE";

  // مدة المهمة الإضافية: نوع العمل × الوحدات ÷ معدّل صاحب الكرت، أو يدوي لـ«شغل تاني».
  const assignee = employees.find((e) => e.id === form.assigneeId);
  const rateDays =
    form.workType && form.workType !== "OTHER" ? adhocDaysFromRate(assignee, form.workType, Number(form.units)) : null;
  const effectiveDays = rateDays ?? (Number(form.days) || 0);
  const workTypeMeta = ADHOC_WORK_TYPES.find((t) => t.key === form.workType);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdhoc && !isEdit && !form.workType) {
      toast("اختاري نوع العمل — المدة بتنحسب من معدّل الشخص", "error");
      return;
    }
    if (isAdhoc && form.workType && form.workType !== "OTHER" && !assignee) {
      toast("اختاري المسؤول أول — المدة من معدّله", "error");
      return;
    }
    if (isAdhoc && (!form.workType || form.workType === "OTHER") && !(Number(form.days) > 0)) {
      toast("اكتبي أيام العمل (مثلاً 0.5 = نص يوم)", "error");
      return;
    }
    if (!form.title.trim()) {
      toast("العنوان مطلوب", "error");
      return;
    }
    // «ممنوع مهمة بلا وصف» (القائدة ١٣/١٠) — المهمة الإضافية وصفها منها؛ قطعة الخطة من ملف الخطة.
    if (isAdhoc && !form.brief.trim()) {
      toast("الوصف مطلوب — اكتبي شو المطلوب بالضبط", "error");
      return;
    }
    startTransition(async () => {
      if (isEdit) {
        // بس يلي تغيّر + نسخة الكرت: النافذة القديمة كانت تبعت كل الحقول، فلو
        // حدا سكّر الكرت من اللوح وهي مفتوحة، الحفظ كان يرجّعه مفتوحاً (SA-03).
        const initial = fromTask(task!);
        const changed = (k: keyof typeof initial) => form[k] !== initial[k];
        const result = await updateTaskDetails(ids ?? [task!.id], {
          expectedStatus: task!.status as TaskCreateStatus,
          ...(changed("title") ? { title: form.title.trim() } : {}),
          ...(isAdhoc && changed("brief") ? { brief: form.brief.trim() } : {}),
          ...(changed("workDate") ? { workDate: form.workDate || null } : {}),
          ...(changed("readyDate") ? { readyDate: form.readyDate || null } : {}),
          ...(isPublishCard && changed("publishDate") ? { publishDate: form.publishDate || null } : {}),
          ...(changed("assigneeId") ? { assigneeId: form.assigneeId || null } : {}),
          ...(changed("priority") ? { priority: form.priority } : {}),
          ...(changed("status") ? { status: form.status } : {}),
          // Effort floor: a 0-day task would vanish from workload math.
          ...(isAdhoc && (changed("days") || rateDays != null)
            ? { days: Math.max(0.1, effectiveDays) }
            : {}),
          ...(isDesignUnitEditable && changed("quantity")
            ? { quantity: Math.max(1, Math.round(Number(form.quantity) || 1)) }
            : {}),
        });
        if (result.ok) {
          toast("تم تحديث المهمة");
          if ("warning" in result && result.warning) toast(result.warning, "error");
          onOpenChange(false);
          router.refresh(); // pull the fresh server view so the edit shows immediately
        } else toast(result.error, "error");
      } else {
        // Effort floor: a 0-day task would vanish from workload math.
        const days = Math.max(0.1, effectiveDays);
        const why = rateDays != null && assignee && form.workType ? rateNote(assignee, form.workType, Number(form.units)) : null;
        const result = await createTask({
          title: form.title.trim(),
          kind: "ADHOC",
          hours: hoursOfDays(days),
          days,
          priority: form.priority as TaskCreatePriority,
          status: form.status as TaskCreateStatus,
          readyDate: form.readyDate || null,
          workDate: form.workDate || null,
          notes: [form.notes, why].filter(Boolean).join("\n") || null,
          brief: form.brief.trim(),
          assigneeId: form.assigneeId || null,
          companyId: form.companyId || null,
          isPinned: form.isPinned,
          month,
          year,
        });
        if (result.ok) {
          toast("تم إنشاء المهمة");
          if ("warning" in result && result.warning) toast(result.warning, "error");
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

          {isPublishCard && (
            <div className="space-y-1.5">
              <Label>تاريخ النشر</Label>
              <Input
                type="date"
                value={form.publishDate}
                onChange={(e) => set("publishDate", e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {isAdhoc && (
              <div className="space-y-1.5 col-span-3">
                <Label>نوع العمل (المدة بتنحسب من معدّل المسؤول)</Label>
                <div className="flex gap-2 flex-wrap items-center">
                  <Select className="flex-1 min-w-48" value={form.workType} onChange={(e) => set("workType", e.target.value)}>
                    <option value="">— اختاري —</option>
                    {ADHOC_WORK_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  {workTypeMeta?.rateKey ? (
                    <>
                      <Input
                        className="w-20"
                        type="number"
                        step="1"
                        min="1"
                        value={form.units}
                        onChange={(e) => set("units", e.target.value)}
                        title="عدد الوحدات"
                      />
                      <span className="text-[11px] text-fg-dim">{workTypeMeta.unit}</span>
                    </>
                  ) : form.workType === "OTHER" ? (
                    <>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="أيام"
                        value={form.days}
                        onChange={(e) => set("days", e.target.value)}
                      />
                      <span className="text-[11px] text-fg-dim">يوم عمل</span>
                    </>
                  ) : null}
                </div>
                {rateDays != null && assignee && workTypeMeta?.rateKey && (
                  <p className="text-[11px] text-accent">
                    {Math.round(Number(form.units))} {workTypeMeta.unit} ÷ {ratePerDay(assignee, workTypeMeta.rateKey)}/يوم ({assignee.name}) ={" "}
                    {hoursOfDays(rateDays)} س ≈ {Math.round(rateDays * 100) / 100} يوم
                  </p>
                )}
                {isEdit && form.workType === "OTHER" && (
                  <p className="text-[10px] text-fg-muted">المخزَّن هلّق: {form.days} يوم. لو هو تصميم، اختاري «تصميم» والعدد حتى تنحسب من المعدّل.</p>
                )}
              </div>
            )}
            {isDesignUnitEditable && (
              <>
                <div className="space-y-1.5">
                  <Label>نوع البوست</Label>
                  <Select
                    value={postFormat}
                    onChange={(e) => set("quantity", e.target.value === "CAROUSEL" ? 2 : 1)}
                  >
                    <option value="SINGLE">بوست عادي</option>
                    <option value="CAROUSEL">كاروسيل</option>
                  </Select>
                </div>
                {postFormat === "CAROUSEL" && (
                  <div className="space-y-1.5">
                    <Label>عدد السلايدات</Label>
                    <Input
                      type="number"
                      step="1"
                      min="2"
                      value={form.quantity}
                      onChange={(e) => set("quantity", e.target.value)}
                    />
                    <p className="text-[10px] text-fg-muted">
                      كل سلايد = وحدة تصميم. الكاروسيل يبقى بوست واحد بالنشر.
                    </p>
                  </div>
                )}
              </>
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
              <Label>الوصف (إجباري)</Label>
              <Textarea
                value={form.brief}
                onChange={(e) => set("brief", e.target.value)}
                placeholder="شو المطلوب بالضبط — بيظهر على الكرت وبالبريف"
                required
              />
            </div>
          )}

          {/* اسم الملف التلقائي للمهمة الإضافية — بينتنسخ، وتلغرام بيلقط الملف يلي بيحمله. */}
          {isEdit && isAdhoc && task && (
            <div className="space-y-1.5">
              <Label>اسم الملف عند الإرسال</Label>
              <button
                type="button"
                dir="ltr"
                title="اضغطي لنسخ اسم الملف"
                onClick={() => {
                  const name = extraAssetName(companies.find((c) => c.id === task.companyId) ?? null, task);
                  navigator.clipboard?.writeText(name).then(
                    () => toast(`انتنسخ: ${name}`),
                    () => toast(name),
                  );
                }}
                className="w-full text-start text-xs font-mono rounded-md px-2 py-1.5 bg-bg-elev2 text-fg-dim hover:text-accent hover:bg-accent/10 transition"
              >
                {extraAssetName(companies.find((c) => c.id === task.companyId) ?? null, task)}
              </button>
            </div>
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

          {/* The content brief lifted from the month's plan — read-only here:
              it belongs to the plan document, not to a single card. */}
          {!isAdhoc && task?.brief && (
            <div className="space-y-1.5">
              <Label>المطلوب من الخطة</Label>
              <pre className="text-[11px] whitespace-pre-wrap font-sans text-fg-dim bg-bg border border-border-soft rounded-md p-2 max-h-56 overflow-y-auto leading-relaxed">
                {task.brief}
              </pre>
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
