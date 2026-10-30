import { Card } from "@/components/ui/card";
import { MonthBar } from "@/components/MonthBar";
import { resolveActiveMonth, monthLabel } from "@/lib/month";
import { computeFinance, type FinanceResult } from "@/lib/finance";
import { formatDateShort } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { teamToday } from "@/lib/team-day";
import { frozenPlanCounts } from "@/server/cycle-plan";
import { TrendingUp, TrendingDown, Wallet, DollarSign, Lock } from "lucide-react";
import { isOwnerSession } from "@/lib/auth";
import { EVIDENCE_LABELS, freelanceOutput } from "@/lib/freelance-output";
import { buildReelNumbers, cardLabelFor } from "@/lib/cards";

const money = (n: number) => {
  const r = Math.round(n);
  return `$${r.toLocaleString("en-US")}`;
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  // المالية فيها الرواتب (والربح بيكشفها) — للمالكة بس (٢٩/١٠). ولا قراءة قبل الفحص.
  if (!(await isOwnerSession())) {
    return (
      <div className="rounded-lg border border-border bg-bg-elev p-6 text-sm text-fg-dim flex items-center gap-2">
        <Lock className="w-4 h-4" /> صفحة المالية للمالكة بس.
      </div>
    );
  }
  const { year, month } = await resolveActiveMonth(await searchParams);
  const label = monthLabel({ year, month });
  const [employees, companies] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
  ]);
  // P&L history: computeFinance always reads CURRENT salaries/contract values,
  // so a raise or an archived client would silently rewrite past months. For a
  // PAST month we therefore freeze the first computed result as a snapshot in
  // Setting (`financeSnapshot:{y}-{m}`) and render the snapshot from then on.
  // The current month stays live.
  const now = new Date();
  const today = teamToday(now);
  const isPast = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  const snapKey = `financeSnapshot:${year}-${month}`;
  // خطة الشهر نفسه (دورة انسجّلت بعدها دورة = عدد قطعها) وحالة الشركة وقته (TR-20).
  const plans = await frozenPlanCounts(
    companies.filter((c) => c.managed),
    () => ({ year, month }),
  );
  let f = computeFinance(employees, companies, year, month, { plans, today });
  let snapshotAt: Date | null = null;
  if (isPast) {
    const row = await prisma.setting.findUnique({ where: { key: snapKey } }).catch(() => null);
    if (row) {
      try {
        const saved = JSON.parse(row.value) as { savedAt: string; data: FinanceResult };
        f = saved.data;
        snapshotAt = new Date(saved.savedAt);
      } catch {
        /* broken snapshot → fall back to live numbers */
      }
    } else if (f.hasData) {
      snapshotAt = now;
      await prisma.setting
        .create({ data: { key: snapKey, value: JSON.stringify({ savedAt: now.toISOString(), data: f }) } })
        .catch(() => null); // best effort (double render / race is harmless)
    }
  }
  const profit = f.netProfit >= 0;

  // خرج الفريلانس بالقطعة — كروت فعلية (مو الخطة).
  const payPerReel = employees.filter((e) => (e.costPerReel ?? 0) > 0);
  const reelRows = payPerReel.length
    ? await prisma.task.findMany({
        where: {
          assigneeId: { in: payPerReel.map((e) => e.id) },
          type: "REEL",
          stage: { in: ["SHOOT", "EDIT"] },
          // «منجز» = ختم إنجاز (نفس `isTaskDoneState`)؛ هامش يوم على الطرفين ويوم دمشق بيحسمه `freelanceOutput`.
          OR: [
            { finishedAt: { gte: new Date(year, month, -1), lt: new Date(year, month + 1, 2) } },
            { AND: [{ finishedAt: null }, { completedAt: { gte: new Date(year, month, -1), lt: new Date(year, month + 1, 2) } }] },
          ],
        },
      })
    : [];
  const reelNum = buildReelNumbers(reelRows as never);
  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const freelance = payPerReel.map((e) => {
    const out = freelanceOutput(e, reelRows, year, month);
    return {
      id: e.id,
      name: e.name,
      cpr: e.costPerReel ?? 0,
      ...out,
      lines: out.lines.map((l) => ({ ...l, label: cardLabelFor(reelRows.find((r) => r.id === l.id) as never, 1, reelNum, coName) })),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">المالية</h1>
          <p className="text-sm text-fg-dim">ربح/خسارة كل عقد، نقطة التعادل، وسعة الفريق — {label}</p>
        </div>
        <MonthBar year={year} month={month} showGenerate={false} />
      </header>

      {snapshotAt && (
        <div className="flex items-center gap-2 text-xs text-fg-dim bg-bg-elev border border-border-soft rounded-lg px-3 py-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          أرقام مثبّتة — لقطة محفوظة بتاريخ {formatDateShort(snapshotAt)} حتى لا تتغيّر
          أرباح الشهور الماضية عند تعديل الرواتب أو العقود لاحقاً.
        </div>
      )}

      {!f.hasData && (
        <Card className="text-center py-8 text-fg-muted">
          أدخلي <strong>قيمة العقد الشهرية</strong> لكل شركة (الشركات) و<strong>الراتب الشهري</strong> لكل
          موظف (الفريق) لتظهر الأرقام هنا.
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="الإيرادات الشهرية" value={money(f.totalRevenue)} icon={DollarSign} tone="accent" />
        <Kpi label="إجمالي التكاليف" value={money(f.totalCost)} icon={Wallet} tone="muted" sub={`أجور ${money(f.totalSalaries)} · متغيّر ${money(f.totalVariable)}`} />
        <Kpi
          label={profit ? "صافي الربح" : "صافي الخسارة"}
          value={money(f.netProfit)}
          icon={profit ? TrendingUp : TrendingDown}
          tone={profit ? "success" : "danger"}
        />
        <Kpi label="هامش الربح" value={`${Math.round(f.marginPct)}%`} icon={profit ? TrendingUp : TrendingDown} tone={profit ? "success" : "danger"} />
      </div>

      {/* Per-contract P&L */}
      <Card>
        <h2 className="display-font text-lg mb-1">ربح/خسارة لكل عقد</h2>
        <p className="text-xs text-fg-dim mb-4">
          <strong>التكلفة الكاملة</strong> = حصة العقد من كل رواتب الفريق (حسب أيام العمل) + تصوير بالقطعة —
          عقد رخيص قد يبدو خاسراً. <strong>هامش المساهمة</strong> = السعر − الكلفة الحدّية المباشرة (بوست 1.5$،
          ستوري 1$، ريل 10$) — يبيّن إن كان العقد يغطّي إنتاجه المباشر.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-fg-dim text-xs border-b border-border-soft">
                <th className="text-right font-medium pb-2">الشركة</th>
                <th className="text-left font-medium pb-2">قيمة العقد</th>
                <th className="text-left font-medium pb-2">التكلفة الكاملة</th>
                <th className="text-left font-medium pb-2">ربح/خسارة كامل</th>
                <th className="text-left font-medium pb-2">كلفة حدّية</th>
                <th className="text-left font-medium pb-2">هامش المساهمة</th>
              </tr>
            </thead>
            <tbody>
              {f.perContract.map((p) => {
                const win = p.profit >= 0;
                const contribWin = p.contribution >= 0;
                return (
                  <tr key={p.company.id} className="border-b border-border-soft/50">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.company.color ?? "#C8A84E" }} />
                        {p.company.name}
                      </span>
                    </td>
                    <td className="py-2 text-left tabular-nums">{money(p.revenue)}</td>
                    <td className="py-2 text-left tabular-nums text-fg-dim">{money(p.laborCost)}</td>
                    <td className={"py-2 text-left tabular-nums font-semibold " + (win ? "text-success" : "text-danger")}>
                      {win ? "+" : "−"}
                      {money(Math.abs(p.profit))}
                    </td>
                    <td className="py-2 text-left tabular-nums text-fg-dim">{money(p.marginalCost)}</td>
                    <td className={"py-2 text-left tabular-nums font-semibold " + (contribWin ? "text-success" : "text-danger")}>
                      {contribWin ? "+" : "−"}
                      {money(Math.abs(p.contribution))}
                      <span className="text-[10px] font-normal opacity-70"> ({Math.round(p.contributionMargin)}%)</span>
                    </td>
                  </tr>
                );
              })}
              {f.perContract.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-fg-muted">لا توجد عقود مُدارة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {f.overhead > 0 && (
          <p className="text-[11px] text-fg-muted mt-3">
            + {money(f.overhead)} رواتب غير موزّعة على العقود (إدارة / طاقة فائضة) — مخصومة من صافي الربح.
          </p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Break-even */}
        <Card>
          <h2 className="display-font text-lg mb-4">نقطة التعادل</h2>
          <div className="flex items-end gap-3 mb-4">
            <div className="display-font text-4xl">
              {f.breakEvenContracts ?? "—"}
            </div>
            <div className="text-sm text-fg-dim mb-1">عقد كحد أدنى لتغطية الأجور</div>
          </div>
          <div
            className={
              "text-sm rounded-lg px-3 py-2 mb-3 " +
              (f.aboveBreakEven
                ? "bg-success/10 text-success border border-success/30"
                : "bg-danger/10 text-danger border border-danger/30")
            }
          >
            {f.breakEvenContracts == null
              ? "حدّدي قيم العقود والرواتب أولاً."
              : f.aboveBreakEven
                ? `أنتِ فوق التعادل: لديكِ ${f.numContracts} عقد مقابل ${f.breakEvenContracts} مطلوبة.`
                : `أنتِ تحت التعادل: لديكِ ${f.numContracts} عقد، تحتاجين ${f.breakEvenContracts} لتغطية الأجور.`}
          </div>
          <Line label="إجمالي الأجور الثابتة" value={money(f.totalSalaries)} />
          <Line label="متوسط قيمة العقد" value={money(f.avgContractValue)} />
          <Line label="متوسط صافي مساهمة العقد" value={money(f.avgContribution)} />
        </Card>

        {/* Team capacity */}
        <Card>
          <h2 className="display-font text-lg mb-1">سعة الفريق</h2>
          <p className="text-xs text-fg-dim mb-4">
            كم عقداً يستطيع الفريق الحالي تغطيته إنتاجياً (يحدّه أكثر دور مشغولاً).
          </p>
          <div className="flex items-end gap-3 mb-4">
            <div className="display-font text-4xl">{f.teamMaxContracts || "—"}</div>
            <div className="text-sm text-fg-dim mb-1">
              عقد كحد أقصى · لديكِ {f.numContracts}
              {f.extraContracts > 0 && (
                <span className="text-success"> · تتسع لـ {f.extraContracts} إضافية</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {f.capacity.map((c) => (
              <div key={c.empId}>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-fg-dim tabular-nums">
                    {Math.round(c.usedDays)}/{c.capacityDays} يوم · {c.pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-bg-elev2 overflow-hidden">
                  <div
                    className={"h-full " + (c.pct > 100 ? "bg-danger" : c.pct > 85 ? "bg-warning" : "bg-accent")}
                    style={{ width: `${Math.min(100, c.pct)}%` }}
                  />
                </div>
              </div>
            ))}
            {f.capacity.length === 0 && (
              <p className="text-sm text-fg-muted">لا توجد بيانات إنتاج بعد.</p>
            )}
          </div>
        </Card>
      </div>
      {/* «خرج الفريلانس» (٣٠/١٠): المدفوع بالقطعة — العدد الفعلي ودليل كل ريل قبل الدفع. */}
      {freelance.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">خرج الفريلانس — {label}</h2>
          <p className="text-[11px] text-fg-muted mb-3">
            ريلات منجزة فعلاً بالشهر (مونتاج للمونتير، تصوير للمصوّر) × تكلفة الريل. الدليل من سطر الإقفال على الكرت:
            «ملف تلغرام» = البوت لقط ملفه؛ «انسكّر مع النشر» أو «بلا دليل» = راجعيه قبل الدفع.
          </p>
          {freelance.map((p) => (
            <div key={p.id} className="mb-4 last:mb-0">
              <div className="text-sm font-semibold">
                {p.name}: {p.count} ريل × ${p.cpr} = <span className="text-accent">${p.amount}</span>
                <span className="text-[11px] text-fg-dim font-normal">
                  {" "}· بملف تلغرام {p.withEvidence} · للمراجعة {p.count - p.withEvidence}
                </span>
              </div>
              <ul className="mt-1 text-[11px] text-fg-dim flex flex-col gap-0.5">
                {p.lines.map((l) => (
                  <li key={l.id} className={l.evidence === "telegram" || l.evidence === "cascade" ? "" : "text-warning"}>
                    {l.doneISO.slice(8, 10)}/{Number(l.doneISO.slice(5, 7))} · {l.label} — {EVIDENCE_LABELS[l.evidence]}
                    {l.evidenceLine ? ` («${l.evidenceLine.slice(0, 70)}»)` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: "accent" | "success" | "danger" | "muted";
  sub?: string;
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "accent"
          ? "text-accent"
          : "text-fg-dim";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className={"text-2xl display-font tabular-nums " + toneCls}>{value}</div>
          <div className="text-xs text-fg-dim mt-1">{label}</div>
          {sub && <div className="text-[10px] text-fg-muted mt-0.5 truncate">{sub}</div>}
        </div>
        <Icon className={"w-8 h-8 shrink-0 opacity-40 " + toneCls} />
      </div>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border-soft last:border-0">
      <span className="text-fg-dim">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
