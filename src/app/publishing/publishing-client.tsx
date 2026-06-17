"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { MonthBar } from "@/components/MonthBar";
import {
  CONTENT_TYPE_LABELS,
  PHOTO_KIND_LABELS,
  PHOTO_STATUSES,
  PHOTO_STATUS_LABELS,
  STATUSES,
  STATUS_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
import { formatDateShort, toISODate } from "@/lib/dates";
import { updateTaskStatus, updatePhotoSessionStatus } from "@/server/actions/tasks";
import { toast } from "@/components/ui/toaster";
import type { Company, Employee, Task, PhotoSession } from "@/types";
import { AlertTriangle, Camera } from "lucide-react";

export default function PublishingClient({
  year,
  month,
  employees,
  companies,
  tasks,
  sessions,
}: {
  year: number;
  month: number;
  employees: Employee[];
  companies: Company[];
  tasks: Task[];
  sessions: PhotoSession[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";
  const managed = companies.filter((c) => c.managed && c.status === "active");

  const onStatus = (id: string, status: string) =>
    start(async () => {
      const r = await updateTaskStatus(id, status);
      if (r.ok) {
        toast("تم تحديث الحالة");
        router.refresh();
      } else toast(r.error, "error");
    });

  const onSessionStatus = (id: string, status: string) =>
    start(async () => {
      const r = await updatePhotoSessionStatus(id, status);
      if (r.ok) {
        toast("تم تحديث حالة النزلة");
        router.refresh();
      } else toast(r.error, "error");
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">جدول النشر</h1>
          <p className="text-sm text-fg-dim">منشورات كل شركة موزّعة على أسابيع الشهر</p>
        </div>
        <MonthBar year={year} month={month} />
      </header>

      {managed.map((co) => {
        const rows = tasks
          .filter((t) => t.companyId === co.id && t.publishDate)
          .sort(
            (a, b) =>
              new Date(a.publishDate!).getTime() - new Date(b.publishDate!).getTime(),
          );
        if (rows.length === 0) return null;
        const weekHas = [1, 2, 3, 4].map((w) => rows.some((r) => r.week === w));
        const interruption = weekHas.some((h) => !h);
        return (
          <Card key={co.id}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: co.color ?? "#C8A84E" }}
                />
                <h2 className="display-font text-lg">{co.name}</h2>
                <span className="text-xs text-fg-muted">({rows.length} منشور)</span>
              </div>
              {interruption ? (
                <span className="text-xs text-danger flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> انقطاع نشر
                </span>
              ) : (
                <span className="text-xs text-success">تغطية كل الأسابيع ✓</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-fg-dim text-xs border-b border-border-soft">
                    <th className="text-right font-medium pb-2">النوع</th>
                    <th className="text-right font-medium pb-2">الأسبوع</th>
                    <th className="text-right font-medium pb-2">موعد النشر</th>
                    <th className="text-right font-medium pb-2">اليوم</th>
                    <th className="text-right font-medium pb-2">المسؤول</th>
                    <th className="text-right font-medium pb-2">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-b border-border-soft/50">
                      <td className="py-2">
                        {CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS] ?? t.type}
                      </td>
                      <td className="py-2 text-fg-dim">{t.week}</td>
                      <td className="py-2">{formatDateShort(new Date(t.publishDate!))}</td>
                      <td className="py-2 text-fg-dim">
                        {WEEKDAY_LABELS[new Date(t.publishDate!).getDay()]}
                      </td>
                      <td className="py-2 text-fg-dim">{empName(t.assigneeId)}</td>
                      <td className="py-2">
                        <Select
                          className="w-32 h-8 text-xs py-1"
                          value={t.status}
                          onChange={(e) => onStatus(t.id, e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {sessions.length > 0 && (
        <Card>
          <h2 className="display-font text-lg mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5 text-accent" /> نزلات التصوير
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-dim text-xs border-b border-border-soft">
                  <th className="text-right font-medium pb-2">الشركة</th>
                  <th className="text-right font-medium pb-2">#</th>
                  <th className="text-right font-medium pb-2">النوع</th>
                  <th className="text-right font-medium pb-2">عدد الريلات</th>
                  <th className="text-right font-medium pb-2">يوم التصوير</th>
                  <th className="text-right font-medium pb-2">التسليم</th>
                  <th className="text-right font-medium pb-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border-soft/50">
                    <td className="py-2">
                      {companies.find((c) => c.id === s.companyId)?.name ?? ""}
                    </td>
                    <td className="py-2 text-fg-dim">{s.no}</td>
                    <td className="py-2">
                      {PHOTO_KIND_LABELS[s.kind as keyof typeof PHOTO_KIND_LABELS] ?? s.kind}
                    </td>
                    <td className="py-2 tabular-nums">{s.reelCount || "—"}</td>
                    <td className="py-2">{formatDateShort(new Date(s.shootDate))}</td>
                    <td className="py-2 text-fg-dim">{formatDateShort(new Date(s.deliverBy))}</td>
                    <td className="py-2">
                      <Select
                        className="w-32 h-8 text-xs py-1"
                        value={s.status}
                        onChange={(e) => onSessionStatus(s.id, e.target.value)}
                      >
                        {PHOTO_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {PHOTO_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tasks.length === 0 && (
        <Card className="text-center py-10 text-fg-muted">
          لا يوجد جدول نشر لهذا الشهر — اضغط «توليد الجدول».
          <span className="block text-xs mt-1">{toISODate(new Date(year, month, 1))}</span>
        </Card>
      )}
    </div>
  );
}
