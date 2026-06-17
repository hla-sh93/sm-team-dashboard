"use client";

import { Card } from "@/components/ui/card";
import { MonthBar } from "@/components/MonthBar";
import { CONTENT_TYPE_LABELS, WEEKDAY_ORDER, WEEKDAY_LABELS } from "@/lib/constants";
import { toISODate } from "@/lib/dates";
import type { Company, Task } from "@/types";

export default function CalendarView({
  year,
  month,
  tasks,
  companies,
}: {
  year: number;
  month: number;
  tasks: Task[];
  companies: Company[];
}) {
  const coById = new Map(companies.map((c) => [c.id, c]));
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a grid starting on the Saturday of the first week.
  const cells: (Date | null)[] = [];
  // Leading blanks: how many WEEKDAY_ORDER slots before day 1.
  const firstDow = first.getDay();
  const lead = WEEKDAY_ORDER.indexOf(firstDow as (typeof WEEKDAY_ORDER)[number]);
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.publishDate) continue;
    const iso = toISODate(new Date(t.publishDate));
    const arr = byDay.get(iso) ?? [];
    arr.push(t);
    byDay.set(iso, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">الجدول</h1>
          <p className="text-sm text-fg-dim">تقويم النشر الشهري</p>
        </div>
        <MonthBar year={year} month={month} />
      </header>

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_ORDER.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-fg-dim py-2">
              {WEEKDAY_LABELS[d]}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} className="min-h-[96px]" />;
            const iso = toISODate(cell);
            const items = byDay.get(iso) ?? [];
            const isFriday = cell.getDay() === 5;
            return (
              <div
                key={i}
                className={
                  "min-h-[96px] rounded-lg border border-border-soft p-1.5 " +
                  (isFriday ? "bg-bg-elev-2/30" : "bg-bg-elev/40")
                }
              >
                <div className="text-xs text-fg-dim mb-1">{cell.getDate()}</div>
                <div className="flex flex-col gap-1">
                  {items.slice(0, 4).map((t) => {
                    const co = coById.get(t.companyId ?? "");
                    return (
                      <div
                        key={t.id}
                        title={`${co?.name} · ${CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]}`}
                        className="text-[10px] rounded px-1 py-0.5 truncate"
                        style={{
                          background: (co?.color ?? "#C8A84E") + "22",
                          borderRight: `2px solid ${co?.color ?? "#C8A84E"}`,
                        }}
                      >
                        {co?.name} ·{" "}
                        {CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]}
                      </div>
                    );
                  })}
                  {items.length > 4 && (
                    <div className="text-[10px] text-fg-muted">+{items.length - 4}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
