"use client";

import { useEffect, useTransition } from "react";
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
  const [isPending, start] = useTransition();
  const isEdit = !!employee;

  const defaults: Partial<EmployeeInput> = employee
    ? {
        name: employee.name,
        role: employee.role,
        hoursPerDay: employee.hoursPerDay,
        workDays: parseWorkDays(employee.workDays),
        isScheduled: employee.isScheduled,
        isPhotographer: employee.isPhotographer,
        color: employee.color ?? "#C8A84E",
      }
    : {
        name: "",
        role: "designer",
        hoursPerDay: 6,
        workDays: WORKDAYS_DEFAULT,
        isScheduled: true,
        isPhotographer: false,
        color: "#C8A84E",
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ساعات/يوم</Label>
              <Input type="number" step="0.5" min="0.5" {...register("hoursPerDay", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>اللون</Label>
              <Input type="color" {...register("color")} className="h-10 p-1" />
            </div>
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
                  className="text-[11px] px-2 py-1 rounded-md bg-bg-elev-2 text-fg-dim hover:text-fg"
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
