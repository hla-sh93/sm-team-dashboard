"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Company, Employee } from "@/types";
import { companySchema, type CompanyInput } from "@/lib/schemas";
import { createCompany, updateCompany } from "@/server/actions/companies";
import { toISODate, formatDateShort } from "@/lib/dates";
import { cyclesOf } from "@/lib/contract";
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
  const router = useRouter();
  const [isPending, start] = useTransition();
  const isEdit = !!company;
  // Read-only audit trail of the contract's cycles (renewals are recorded from
  // the companies screen, not typed here).
  const cycleList = company ? cyclesOf(company) : [];

  const defaults: Partial<CompanyInput> = company
    ? {
        name: company.name,
        managed: company.managed,
        posts: company.posts,
        reels: company.reels,
        aiReels: company.aiReels,
        stories: company.stories,
        contractValue: company.contractValue || undefined,
        publishStartDate: company.publishStartDate
          ? toISODate(new Date(company.publishStartDate))
          : "",
        contractStartDate: company.contractStartDate
          ? toISODate(new Date(company.contractStartDate))
          : "",
        contentSupplied: company.contentSupplied ?? false,
        color: company.color ?? "#C8A84E",
        priority: company.priority,
        status: company.status as CompanyInput["status"],
        postOwnerId: company.postOwnerId ?? "",
        storyOwnerId: company.storyOwnerId ?? "",
        aiReelOwnerId: company.aiReelOwnerId ?? "",
        defaultOwnerId: company.defaultOwnerId ?? "",
        photographerId: company.photographerId ?? "",
        accountOwnerId: company.accountOwnerId ?? "",
      }
    : {
        name: "",
        managed: true,
        posts: 0,
        reels: 0,
        aiReels: 0,
        stories: 0,
        contractStartDate: "",
        publishStartDate: "",
        contentSupplied: false,
        color: "#C8A84E",
        priority: 99,
        status: "active",
        postOwnerId: "",
        storyOwnerId: "",
        aiReelOwnerId: "",
        defaultOwnerId: "",
        photographerId: "",
        accountOwnerId: "",
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

  // Preferred shoot weekday is numeric → kept as controlled state (string in the
  // select), merged into the payload on submit. "" = no preference.
  const [shootDay, setShootDay] = useState<string>(
    company?.preferredShootDay != null ? String(company.preferredShootDay) : "",
  );

  useEffect(() => {
    reset(defaults as CompanyInput);
    setShootDay(company?.preferredShootDay != null ? String(company.preferredShootDay) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, open]);

  const managed = watch("managed");

  const onSubmit = (data: CompanyInput) => {
    const payload = {
      ...data,
      preferredShootDay: shootDay === "" ? null : Number(shootDay),
    };
    start(async () => {
      const r = isEdit ? await updateCompany(company!.id, payload) : await createCompany(payload);
      if (r.ok) {
        toast(isEdit ? "تم تحديث الشركة" : "تمت إضافة الشركة");
        onOpenChange(false);
        router.refresh(); // show the updated company immediately (no stale snapshot)
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

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("managed")} className="accent-accent" />
              شركة مُدارة (لها خطة نشر)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("contentSupplied")} className="accent-accent" />
              المحتوى جاهز من العميل (بدون كروت كتابة)
            </label>
          </div>

          {managed && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>تاريخ توقيع العقد</Label>
                <Input type="date" {...register("contractStartDate")} />
                <p className="text-[11px] text-fg-dim">أسبوع التحضير بيمشي منه</p>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ بدء النشر</Label>
                <Input type="date" {...register("publishStartDate")} />
                {/* الحقل يلي بيمنع «التأخيرات الوهمية»: الدورة والخطة بتنبنيا منه،
                    وفراغه مع عقد موقّع بيعني إنّ الزبون لسا ما بلّش — فما بينحسب
                    علينا تأخير ولا بينولّد شغل. */}
                <p className="text-[11px] text-fg-dim">
                  الخطة شهر من هالتاريخ. فاضي = الزبون لسا ما بلّش → ولا تأخير علينا
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>قيمة العقد الشهرية ($)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="—"
                  {...register("contractValue", { valueAsNumber: true })}
                />
              </div>
              <p className="text-[11px] text-fg-dim col-span-2">
                تُوزَّع الخطة على دورة 30 يوماً من تاريخ العقد (مثال: من 20 لـ 20). قيمة
                العقد تُستخدم في حساب الربح/الخسارة في صفحة المالية.
              </p>
              {company && cycleList.length > 0 && (
                <div className="col-span-2 rounded-lg bg-bg-elev2 p-3">
                  <p className="text-[11px] font-semibold text-fg-dim mb-1.5">
                    دورات العقد ({cycleList.length})
                  </p>
                  <ul className="text-[11px] text-fg-muted space-y-0.5">
                    {cycleList.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-fg-dim">{i + 1}.</span>
                        <span>
                          {formatDateShort(c.start)} → {formatDateShort(c.end)}
                        </span>
                        {c.coldStart && i > 0 && (
                          <span className="text-warning">· تجديد بعد انقطاع</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-fg-dim mt-1.5">
                    التجديد يُسجَّل من صفحة الشركات (زر «جدّد») — لا يبدأ النظام دورة
                    جديدة قبل تأكيدها.
                  </p>
                </div>
              )}
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
              {/* السيلز بيتابع العقد والزبون ومواعيد التصوير — معلومة، مو إسناد
                  شغل: ما بينجدول وما بياخد كروت (قرار القائدة 3/8). */}
              <div className="space-y-1.5">
                <Label>مسؤول العقد (سيلز)</Label>
                <Select {...register("accountOwnerId")}>
                  <option value="">— بلا —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>يوم التصوير المفضّل (اختياري)</Label>
                <Select value={shootDay} onChange={(e) => setShootDay(e.target.value)}>
                  <option value="">— بدون تفضيل —</option>
                  <option value="6">السبت</option>
                  <option value="0">الأحد</option>
                  <option value="1">الاثنين</option>
                  <option value="2">الثلاثاء</option>
                  <option value="3">الأربعاء</option>
                  <option value="4">الخميس</option>
                </Select>
                <p className="text-[11px] text-fg-dim">
                  تفضيل فقط — يحاول النظام التصوير بهذا اليوم، ويمكنكِ تعديل أي نزلة يدوياً.
                </p>
              </div>
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
