"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Employee } from "@/types";
import { employeeSchema, type EmployeeInput } from "@/lib/schemas";
import { createEmployee, updateEmployee } from "@/server/actions/employees";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  WEEKDAY_ORDER,
  WEEKDAY_LABELS,
  WORKDAYS_DEFAULT,
  WORKDAYS_AYMAN,
  WORKDAYS_PHOTO,
  ROLE_LABELS,
} from "@/lib/constants";
import { parseWorkDays } from "@/lib/dates";
import { parseRates } from "@/lib/capacity";
import { toast } from "@/components/ui/toaster";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee?: Employee | null;
}

const PRESETS = [
  { label: "السبت → الأربعاء", days: WORKDAYS_DEFAULT },
  { label: "الأحد → الخميس", days: WORKDAYS_AYMAN },
  { label: "السبت → الخميس (مصور)", days: WORKDAYS_PHOTO },
];

export default function MemberForm({ open, onOpenChange, employee }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const isEdit = !!employee;

  const er = employee ? parseRates(employee.rates) : {};
  const defaults: Partial<EmployeeInput> = employee
    ? {
        name: employee.name,
        role: employee.role,
        hoursPerDay: employee.hoursPerDay,
        workDays: parseWorkDays(employee.workDays),
        isScheduled: employee.isScheduled,
        isPhotographer: employee.isPhotographer,
        salary: employee.salary || undefined,
        costPerReel: employee.costPerReel ?? undefined,
        color: employee.color ?? "#C8A84E",
        rates: {
          POST: er.POST,
          STORY: er.STORY,
          AI_REEL: er.AI_REEL,
          REEL: er.REEL,
        },
        planDays: er.PLAN ? Math.round(1 / er.PLAN) : undefined,
      }
    : {
        name: "",
        role: "designer",
        hoursPerDay: 8,
        workDays: WORKDAYS_DEFAULT,
        isScheduled: true,
        isPhotographer: false,
        color: "#C8A84E",
        rates: {},
      };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: defaults as EmployeeInput,
  });

  useEffect(() => {
    reset(defaults as EmployeeInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, open]);

  const workDays = watch("workDays") ?? [];
  const isPhotographer = watch("isPhotographer");

  // Photographer capacity entered the natural way: "X reels every Y days". We
  // derive the engine's rate = X / Y (reels per working day). Editing an existing
  // rate shows it back over a 2-day window (e.g. 1.5 → 3 reels / 2 days).
  const initReel = (): { count: number | ""; days: number | "" } => {
    const r = er.REEL;
    if (r && r > 0) return { count: Math.round(r * 2), days: 2 };
    return { count: "", days: "" };
  };
  const [reel, setReel] = useState<{ count: number | ""; days: number | "" }>(initReel);
  useEffect(() => {
    setReel(initReel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, open]);
  const reelRate =
    Number(reel.count) > 0 && Number(reel.days) > 0
      ? Number(reel.count) / Number(reel.days)
      : null;
  const setReelField = (k: "count" | "days", v: string) => {
    const next = { ...reel, [k]: v === "" ? "" : Number(v) };
    setReel(next);
    const c = Number(next.count);
    const d = Number(next.days);
    setValue("rates.REEL", c > 0 && d > 0 ? Math.round((c / d) * 1000) / 1000 : undefined, {
      shouldValidate: true,
    });
  };

  const toggleDay = (d: number) => {
    const set = new Set(workDays);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    setValue("workDays", Array.from(set), { shouldValidate: true });
  };

  const onSubmit = (data: EmployeeInput) => {
    start(async () => {
      const r = isEdit ? await updateEmployee(employee!.id, data) : await createEmployee(data);
      if (r.ok) {
        toast(isEdit ? "تم تحديث الموظف" : "تمت إضافة الموظف");
        onOpenChange(false);
        router.refresh(); // reflect the change immediately
      } else toast(r.error, "error");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل موظف" : "إضافة موظف"}</DialogTitle>
          <DialogDescription>السعة بالساعات وأيام العمل قابلة للتعديل لكل موظف.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>الدور</Label>
              <Select {...register("role")}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>الطاقة الإنتاجية</Label>

            {isPhotographer ? (
              /* Photographer: enter shooting speed as "X reels every Y days". */
              <div className="rounded-lg border border-border-soft p-3 space-y-2">
                <span className="text-[11px] text-fg-dim">سرعة التصوير</span>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span>ينجز</span>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="3"
                    className="w-16 text-center"
                    value={reel.count}
                    onChange={(e) => setReelField("count", e.target.value)}
                  />
                  <span>ريل كل</span>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="2"
                    className="w-16 text-center"
                    value={reel.days}
                    onChange={(e) => setReelField("days", e.target.value)}
                  />
                  <span>يوم عمل</span>
                </div>
                <p className="text-[11px] text-accent">
                  {reelRate != null
                    ? `≈ ${Math.round(reelRate * 100) / 100} ريل/يوم — أي نزلة تصوير تُغطّي عدة ريلات`
                    : "اتركيها فارغة لاستخدام الافتراضي (3 ريل كل يومين)."}
                </p>
              </div>
            ) : (
              /* Designer / writer: items per working day. */
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-fg-dim">بوست / يوم</span>
                  <Input type="number" step="1" min="0" placeholder="—" {...register("rates.POST", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-fg-dim">ستوري / يوم</span>
                  <Input type="number" step="1" min="0" placeholder="—" {...register("rates.STORY", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-fg-dim">ريل AI / يوم</span>
                  <Input type="number" step="1" min="0" placeholder="—" {...register("rates.AI_REEL", { valueAsNumber: true })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <span className="text-[11px] text-fg-dim">مدة إعداد الخطة (أيام)</span>
                <Input type="number" step="1" min="0" placeholder="—" {...register("planDays", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-fg-dim">اللون</span>
                <Input type="color" {...register("color")} className="h-10 p-1" />
              </div>
            </div>
            <p className="text-[10px] text-fg-muted">
              اتركي الخانة فارغة لاستخدام الافتراضي. مثال: المصمم 10 بوست/يوم، أيمن 1 ريل AI/يوم، مصوّر 3 ريل كل يومين.
            </p>
          </div>

          {/* Finance: monthly salary (+ per-reel cost for a freelance photographer) */}
          <div className="space-y-2">
            <Label>التكلفة (للمالية)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] text-fg-dim">الراتب الشهري ($)</span>
                <Input type="number" step="1" min="0" placeholder="—" {...register("salary", { valueAsNumber: true })} />
              </div>
              {isPhotographer && (
                <div className="space-y-1">
                  <span className="text-[11px] text-fg-dim">تكلفة الريل الواحد ($)</span>
                  <Input type="number" step="1" min="0" placeholder="—" {...register("costPerReel", { valueAsNumber: true })} />
                </div>
              )}
            </div>
            {isPhotographer && (
              <p className="text-[10px] text-fg-muted">
                للمصوّر المدفوع بالقطعة: اتركي الراتب فارغاً واملئي تكلفة الريل. وللمصوّر براتب ثابت: العكس.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>أيام العمل</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={
                    "px-2.5 py-1.5 rounded-md text-xs font-medium border transition " +
                    (workDays.includes(d)
                      ? "bg-accent text-bg border-accent"
                      : "bg-bg-elev text-fg-dim border-border")
                  }
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
            {errors.workDays && <p className="text-xs text-danger">{errors.workDays.message}</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setValue("workDays", p.days, { shouldValidate: true })}
                  className="text-[11px] px-2 py-1 rounded-md bg-bg-elev2 text-fg-dim hover:text-fg"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("isScheduled")} className="accent-accent" />
              يدخل محرّك الجدولة التلقائي
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("isPhotographer")} className="accent-accent" />
              مصور
            </label>
          </div>

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
