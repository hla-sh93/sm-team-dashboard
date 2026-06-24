"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Company, Employee } from "@/types";
import { companySchema, type CompanyInput } from "@/lib/schemas";
import { createCompany, updateCompany } from "@/server/actions/companies";
import { toISODate } from "@/lib/dates";
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
import { toast } from "@/components/ui/toaster";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  company?: Company | null;
  employees: Employee[];
}

export default function CompanyForm({ open, onOpenChange, company, employees }: Props) {
  const [isPending, start] = useTransition();
  const isEdit = !!company;

  const defaults: Partial<CompanyInput> = company
    ? {
        name: company.name,
        managed: company.managed,
        posts: company.posts,
        reels: company.reels,
        aiReels: company.aiReels,
        stories: company.stories,
        contractStartDate: company.contractStartDate
          ? toISODate(new Date(company.contractStartDate))
          : "",
        color: company.color ?? "#C8A84E",
        priority: company.priority,
        status: company.status as CompanyInput["status"],
        postOwnerId: company.postOwnerId ?? "",
        storyOwnerId: company.storyOwnerId ?? "",
        aiReelOwnerId: company.aiReelOwnerId ?? "",
        defaultOwnerId: company.defaultOwnerId ?? "",
        photographerId: company.photographerId ?? "",
      }
    : {
        name: "",
        managed: true,
        posts: 0,
        reels: 0,
        aiReels: 0,
        stories: 0,
        contractStartDate: "",
        color: "#C8A84E",
        priority: 99,
        status: "active",
        postOwnerId: "",
        storyOwnerId: "",
        aiReelOwnerId: "",
        defaultOwnerId: "",
        photographerId: "",
      };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: defaults as CompanyInput,
  });

  useEffect(() => {
    reset(defaults as CompanyInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, open]);

  const managed = watch("managed");

  const onSubmit = (data: CompanyInput) => {
    start(async () => {
      const r = isEdit ? await updateCompany(company!.id, data) : await createCompany(data);
      if (r.ok) {
        toast(isEdit ? "تم تحديث الشركة" : "تمت إضافة الشركة");
        onOpenChange(false);
      } else toast(r.error, "error");
    });
  };

  const ownerOptions = (
    <>
      <option value="">— بدون —</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </>
  );

  const photographers = employees.filter((e) => e.isPhotographer);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل شركة" : "إضافة شركة"}</DialogTitle>
          <DialogDescription>
            الشركة المُدارة لها خطة نشر؛ شركة التصميم-فقط تستقبل مهام يدوية فقط.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>اللون</Label>
              <Input type="color" {...register("color")} className="h-10 p-1" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("managed")} className="accent-accent" />
              شركة مُدارة (لها خطة نشر)
            </label>
          </div>

          {managed && (
            <div className="space-y-1.5">
              <Label>تاريخ بداية العقد</Label>
              <Input type="date" {...register("contractStartDate")} />
              <p className="text-[11px] text-fg-dim">
                تُوزَّع الخطة على دورة 30 يوماً من هذا التاريخ (مثال: من 20 لـ 20).
                اتركيه فارغاً لتوزيع الخطة على الشهر الميلادي.
              </p>
            </div>
          )}

          {managed && (
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>بوست</Label>
                <Input type="number" min="0" {...register("posts", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>ريل</Label>
                <Input type="number" min="0" {...register("reels", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>ريل AI</Label>
                <Input type="number" min="0" {...register("aiReels", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>ستوري</Label>
                <Input type="number" min="0" {...register("stories", { valueAsNumber: true })} />
              </div>
            </div>
          )}

          {managed ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>مالك البوست</Label>
                <Select {...register("postOwnerId")}>{ownerOptions}</Select>
              </div>
              <div className="space-y-1.5">
                <Label>مالك الستوري</Label>
                <Select {...register("storyOwnerId")}>{ownerOptions}</Select>
              </div>
              <div className="space-y-1.5">
                <Label>مالك ريل AI</Label>
                <Select {...register("aiReelOwnerId")}>{ownerOptions}</Select>
              </div>
              {photographers.length > 0 && (
                <div className="space-y-1.5">
                  <Label>المصور (للريلز)</Label>
                  <Select {...register("photographerId")}>
                    <option value="">— تلقائي (أول مصور) —</option>
                    {photographers.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>المسؤول الافتراضي (تصميم-فقط)</Label>
              <Select {...register("defaultOwnerId")}>{ownerOptions}</Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Input type="number" min="1" max="99" {...register("priority", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select {...register("status")}>
                <option value="active">نشط</option>
                <option value="paused">متوقف</option>
                <option value="archived">مؤرشف</option>
              </Select>
            </div>
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
