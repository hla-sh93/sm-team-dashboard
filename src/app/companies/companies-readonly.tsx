"use client";

import { Card } from "@/components/ui/card";
import PlanDocxButtons from "@/components/PlanDocxButtons";
import { CalendarClock } from "lucide-react";

export type CompanyRow = {
  id: string;
  name: string;
  posts: number;
  reels: number;
  stories: number;
  aiReels: number;
  postOwnerId: string | null;
  storyOwnerId: string | null;
  aiReelOwnerId: string | null;
  paused: boolean;
  hasCycle: boolean;
  cycleLabel: string | null;
};

export default function CompaniesReadOnly({
  rows,
  employees,
}: {
  rows: CompanyRow[];
  employees: { id: string; name: string }[];
}) {
  const nameOf = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="display-font text-2xl">الشركات</h1>
        <p className="text-sm text-fg-dim">الخطة الشهرية وملفاتها — للاطّلاع</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">لا توجد شركات نشطة.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{c.name}</h2>
                  <p className="text-xs text-fg-dim mt-1">
                    {c.posts} بوست · {c.reels} ريل · {c.aiReels} ريل AI · {c.stories} ستوري
                  </p>
                </div>
                {c.paused && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-warning/15 text-warning shrink-0">
                    موقوفة بطلب الزبون
                  </span>
                )}
              </div>

              <div className="flex gap-3 mt-3 text-[11px] text-fg-muted flex-wrap">
                <span>بوست → {nameOf(c.postOwnerId)}</span>
                <span>· ستوري → {nameOf(c.storyOwnerId)}</span>
                {c.aiReels > 0 && <span>· ريل AI → {nameOf(c.aiReelOwnerId)}</span>}
              </div>

              {c.cycleLabel && (
                <div className="mt-3">
                  <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-bg-elev2 text-fg-muted">
                    <CalendarClock className="w-3 h-3" />
                    دورة {c.cycleLabel}
                  </span>
                </div>
              )}

              {c.hasCycle ? (
                <PlanDocxButtons companyId={c.id} companyName={c.name} className="mt-3" />
              ) : (
                <p className="text-[11px] text-fg-muted mt-3">
                  لا يوجد تاريخ بدء نشر — لا دورة ولا ملفات خطة بعد.
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
