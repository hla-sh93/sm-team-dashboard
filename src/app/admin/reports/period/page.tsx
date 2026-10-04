import { PeriodReportView } from "@/components/reports/PeriodReportView";
import { PeriodToolbar } from "@/components/reports/PeriodToolbar";
import { dayKeyOf, resolvePeriod, type PeriodKind } from "@/lib/period-report";
import { loadPeriodReport } from "@/server/period-report";

// تقرير لحظي من الداتا الحيّة — ولا نسخة مخبّأة.
export const dynamic = "force-dynamic";

/**
 * تقارير الإنجاز الدورية — يومي · أسبوعي · شهري · مخصّص، بتصدير PDF
 * (WORK_RULES §١٠). تحت `/admin` فبوّابة الأدمن بتحميها (أداء أفراد).
 */
export default async function PeriodReportPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; date?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const todayKey = dayKeyOf(new Date());
  const result = resolvePeriod(params, todayKey);

  const kind: PeriodKind = result.ok
    ? result.period.kind
    : params.kind === "day" || params.kind === "week" || params.kind === "custom"
      ? params.kind
      : "month";
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey;
  const from = result.ok ? result.period.from : params.from ?? todayKey;
  const to = result.ok ? result.period.to : params.to ?? todayKey;

  const toolbar = (
    <PeriodToolbar
      kind={kind}
      date={date}
      from={from}
      to={to}
      fileName={result.ok ? `${result.period.title} — ${result.period.label}` : "تقرير الإنجاز"}
      canPrint={result.ok}
    />
  );

  if (!result.ok) {
    return (
      <div>
        {toolbar}
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {result.error}
        </p>
      </div>
    );
  }

  const report = await loadPeriodReport(result.period);
  return (
    <div>
      {toolbar}
      <PeriodReportView report={report} />
    </div>
  );
}
