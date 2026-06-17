"use client";

import { Button } from "@/components/ui/button";
import { toCSV, downloadCSV } from "@/lib/csv";
import { Download, Printer } from "lucide-react";

export type ReportRow = {
  employee: string;
  role: string;
  totalHours: number;
  busyDays: number;
  freeDays: number;
  done: number;
};

export type TaskRow = {
  date: string;
  weekday: string;
  employee: string;
  type: string;
  target: string;
  hours: number;
  publishDate: string;
  status: string;
};

export function ReportActions({
  teamRows,
  taskRows,
  monthLabel,
}: {
  teamRows: ReportRow[];
  taskRows: TaskRow[];
  monthLabel: string;
}) {
  const exportTeam = () => {
    const csv = toCSV(
      ["الموظف", "الدور", "إجمالي الساعات", "أيام مشغولة", "أيام متاحة", "مهام منجزة"],
      teamRows.map((r) => [r.employee, r.role, r.totalHours, r.busyDays, r.freeDays, r.done]),
    );
    downloadCSV(`تقرير-الفريق-${monthLabel}.csv`, csv);
  };

  const exportTasks = () => {
    const csv = toCSV(
      ["التاريخ", "اليوم", "الموظف", "النوع", "الشركة/العنوان", "ساعات", "موعد النشر", "الحالة"],
      taskRows.map((r) => [
        r.date,
        r.weekday,
        r.employee,
        r.type,
        r.target,
        r.hours,
        r.publishDate,
        r.status,
      ]),
    );
    downloadCSV(`جدول-المهام-${monthLabel}.csv`, csv);
  };

  return (
    <div className="flex items-center gap-2 no-print">
      <Button size="sm" onClick={exportTasks}>
        <Download className="w-4 h-4" /> تصدير المهام CSV
      </Button>
      <Button size="sm" onClick={exportTeam}>
        <Download className="w-4 h-4" /> تصدير الفريق CSV
      </Button>
      <Button size="sm" variant="ghost" onClick={() => window.print()}>
        <Printer className="w-4 h-4" /> طباعة PDF
      </Button>
    </div>
  );
}
