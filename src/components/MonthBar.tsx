"use client";

import { ChevronLeft, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateSchedule } from "@/server/actions/schedule";
import { toast } from "@/components/ui/toaster";
import { ARABIC_MONTHS } from "@/lib/dates";

export function MonthBar({
  year,
  month,
  showGenerate = false, // pipeline regen is script-driven for now (not flat generate)
}: {
  year: number;
  month: number;
  showGenerate?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const go = (y: number, m: number) =>
    router.push(`${pathname}?y=${y}&m=${m}`);
  const prev = () => (month === 0 ? go(year - 1, 11) : go(year, month - 1));
  const next = () => (month === 11 ? go(year + 1, 0) : go(year, month + 1));

  const regenerate = () =>
    start(async () => {
      const r = await generateSchedule(year, month);
      if (r.ok) {
        const s = r.stages;
        toast(
          `تمت إعادة الجدولة · كتابة ${s.write} · تصميم ${s.design} · تصوير ${s.shoot} · نشر ${s.publish}`,
          "success",
        );
        // Surface any scheduling warnings (e.g. missing writer/designer/photographer)
        // so a "successful" regen doesn't silently hide gaps.
        if (r.warnings && r.warnings.length > 0) {
          toast(
            `تنبيهات (${r.warnings.length}): ${r.warnings.map((w) => w.message).join(" · ")}`,
            "warning",
          );
        }
        router.refresh();
      } else {
        toast(r.error, "error");
      }
    });

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 bg-bg-elev border border-border rounded-lg p-1">
        <button onClick={next} className="p-1.5 rounded-md hover:bg-bg-elev2 text-fg-dim">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="px-3 text-sm font-semibold min-w-[120px] text-center">
          {ARABIC_MONTHS[month]} {year}
        </span>
        <button onClick={prev} className="p-1.5 rounded-md hover:bg-bg-elev2 text-fg-dim">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      {showGenerate && (
        <Button variant="primary" size="sm" onClick={regenerate} disabled={pending}>
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          إعادة الجدولة
        </Button>
      )}
    </div>
  );
}
