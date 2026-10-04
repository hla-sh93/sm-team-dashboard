"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { PeriodKind } from "@/lib/period-report";

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "day", label: "يومي" },
  { kind: "week", label: "أسبوعي" },
  { kind: "month", label: "شهري" },
  { kind: "custom", label: "مخصّص" },
];

/**
 * اختيار الفترة وتحميل PDF. الاختيار نموذج GET عادي (بيشتغل بلا JavaScript
 * وبيعطي رابطاً قابلاً للمشاركة)، و«تحميل PDF» بيطبع الصفحة: المتصفح بيرسم
 * العربي بخطوط التطبيق نفسها، واسم الملف من عنوان الصفحة.
 */
export function PeriodToolbar({
  kind,
  date,
  from,
  to,
  fileName,
  canPrint,
}: {
  kind: PeriodKind;
  date: string;
  from: string;
  to: string;
  fileName: string;
  canPrint: boolean;
}) {
  const [selected, setSelected] = useState<PeriodKind>(kind);

  function printReport() {
    const previous = document.title;
    document.title = fileName;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const field =
    "h-10 rounded-md border border-border bg-bg-elev px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <form method="get" className="print:hidden mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border-soft bg-bg-elev p-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-semibold text-fg-dim mb-1.5">نوع التقرير</legend>
        <div className="flex rounded-md border border-border overflow-hidden" role="radiogroup">
          {KINDS.map((k) => (
            <label
              key={k.kind}
              className={`cursor-pointer px-4 h-10 flex items-center text-sm font-medium transition ${
                selected === k.kind ? "bg-accent text-white" : "bg-bg-elev text-fg-dim hover:bg-bg-elev2"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={k.kind}
                checked={selected === k.kind}
                onChange={() => setSelected(k.kind)}
                className="sr-only"
              />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      {selected === "custom" ? (
        <>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-dim">
            من
            <input id="period-from" type="date" name="from" defaultValue={from} required className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-dim">
            إلى
            <input id="period-to" type="date" name="to" defaultValue={to} required className={field} />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-dim">
          {selected === "day" ? "اليوم" : selected === "week" ? "أي يوم من الأسبوع" : "أي يوم من الشهر"}
          <input id="period-date" type="date" name="date" defaultValue={date} required className={field} />
        </label>
      )}

      <button
        type="submit"
        className="h-10 rounded-md border border-accent px-5 text-sm font-semibold text-accent hover:bg-accent-soft transition"
      >
        عرض التقرير
      </button>

      {canPrint && (
        <button
          type="button"
          onClick={printReport}
          className="h-10 rounded-md bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-dim transition flex items-center gap-2 ms-auto"
        >
          <FileDown className="w-4 h-4" />
          تحميل PDF
        </button>
      )}
    </form>
  );
}
