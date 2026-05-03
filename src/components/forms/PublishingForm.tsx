"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { PUBLISH_STATUS_LABELS, PUBLISH_TYPE_LABELS } from "@/lib/constants";
import { toISODate } from "@/lib/dates";
import { publishingItemSchema, type PublishingItemInput } from "@/lib/schemas";
import {
  createPublishingItem,
  updatePublishingItem,
} from "@/server/actions/publishing";
import type { Company, PublishingItem } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";

interface PublishingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PublishingItem | null;
  companies: Company[];
}

export default function PublishingForm({
  open,
  onOpenChange,
  item,
  companies,
}: PublishingFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!item;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PublishingItemInput>({
    resolver: zodResolver(publishingItemSchema),
    defaultValues: item
      ? {
          contentType: item.contentType as PublishingItemInput["contentType"],
          publishDate: toISODate(new Date(item.publishDate)),
          status: item.status as PublishingItemInput["status"],
          notes: item.notes ?? "",
          companyId: item.companyId,
          taskId: item.taskId ?? "",
        }
      : {
          contentType: "post",
          publishDate: toISODate(new Date()),
          status: "scheduled",
          notes: "",
          companyId: companies[0]?.id ?? "",
          taskId: "",
        },
  });

  useEffect(() => {
    if (item) {
      reset({
        contentType: item.contentType as PublishingItemInput["contentType"],
        publishDate: toISODate(new Date(item.publishDate)),
        status: item.status as PublishingItemInput["status"],
        notes: item.notes ?? "",
        companyId: item.companyId,
        taskId: item.taskId ?? "",
      });
    }
  }, [item, reset]);

  const onSubmit = (data: PublishingItemInput) => {
    startTransition(async () => {
      const result = isEdit
        ? await updatePublishingItem(item!.id, data)
        : await createPublishingItem(data);
      if (result.ok) {
        toast(isEdit ? "تم التحديث" : "تمت الإضافة");
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
          <DialogTitle>
            {isEdit ? "تعديل عنصر نشر" : "إضافة عنصر نشر"}
          </DialogTitle>
          <DialogDescription>
            النشر مسموح في أي يوم بما فيه عطلة الأسبوع
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الشركة</Label>
              <Select {...register("companyId")}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {errors.companyId && (
                <p className="text-xs text-danger">
                  {errors.companyId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>نوع المحتوى</Label>
              <Select {...register("contentType")}>
                {Object.entries(PUBLISH_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>تاريخ النشر</Label>
              <Input type="date" {...register("publishDate")} />
              {errors.publishDate && (
                <p className="text-xs text-danger">
                  {errors.publishDate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select {...register("status")}>
                {Object.entries(PUBLISH_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea
              {...register("notes")}
              placeholder="رابط، فكرة، أو أي تفاصيل..."
            />
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
              {isPending ? "جاري الحفظ..." : isEdit ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
