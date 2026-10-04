import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  addDaysToKey,
  shortDay,
  type CategoryCounts,
  type PeriodReport,
  type PersonReport,
} from "@/lib/period-report";
import { ROLE_LABELS } from "@/lib/constants";
import { WORK_WEEK } from "@/lib/dates";

/**
 * التقرير الدوري كوثيقة A4 — نفس الشكل على الشاشة وبالـPDF (WORK_RULES §١٠).
 * الأنماط محلية بالبادئة `pr-` حتى ما تلمس باقي التطبيق، و`@page` بيحدّد
 * المقاس والهوامش وترقيم الصفحات للطباعة.
 */
const CSS = `
.pr-doc { --pr-accent:#0a8fa3; --pr-accent-ink:#07778a; --pr-accent-soft:#e3f4f7; --pr-fg:#1b2733; --pr-fg2:#586475; --pr-fg3:#8a95a4;
  --pr-line:#d8dde4; --pr-line-soft:#e7ebf0; --pr-surface2:#eef1f4; --pr-good:#1e9e68; --pr-good-soft:#e4f5ed; --pr-warn:#b8730f;
  --pr-warn-soft:#fbf1e1; --pr-bad:#d6453b; --pr-bad-soft:#fbe9e7;
  direction: rtl; background:#fff; color:var(--pr-fg); max-width: 210mm; margin: 0 auto; padding: 14mm 13mm;
  border:1px solid var(--pr-line-soft); border-radius:8px; box-shadow: 0 1px 3px rgba(27,39,51,.06);
  font-size: 13px; line-height: 1.65; display:grid; gap: 22px; }
.pr-doc h1, .pr-doc h2, .pr-doc h3 { font-family: var(--font-reem), var(--font-tajawal), sans-serif; font-weight:600; margin:0; line-height:1.35; text-wrap: balance; }
.pr-doc h1 { font-size: 24px; }
.pr-doc h2 { font-size: 17px; }
.pr-doc h3 { font-size: 15px; }
.pr-doc p { margin:0; }
.pr-num { font-variant-numeric: tabular-nums; }
.pr-muted { color: var(--pr-fg2); }
.pr-small { font-size: 11.5px; }
.pr-na { color: var(--pr-fg3); font-size: 11.5px; }
.pr-head { display:grid; gap:8px; padding-bottom:14px; border-bottom:2px solid var(--pr-accent); }
.pr-eyebrow { font-size:11.5px; font-weight:700; letter-spacing:.02em; color:var(--pr-accent-ink); }
.pr-meta { display:flex; flex-wrap:wrap; gap:4px 18px; color:var(--pr-fg2); font-size:12px; }
.pr-meta b { color:var(--pr-fg); }
.pr-kpis { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:8px; }
.pr-kpi { border:1px solid var(--pr-line-soft); border-radius:6px; padding:9px 10px; display:grid; gap:1px; align-content:start; }
.pr-kpi b { font-family: var(--font-reem), var(--font-tajawal), sans-serif; font-size:22px; font-weight:600; line-height:1.2; }
.pr-kpi span { font-size:11.5px; color:var(--pr-fg2); }
.pr-kpi .pr-sub { font-size:10.5px; color:var(--pr-fg3); }
.pr-kpi.bad b { color: var(--pr-bad); } .pr-kpi.good b { color: var(--pr-good); }
.pr-section { display:grid; gap:10px; }
.pr-table { width:100%; border-collapse:collapse; font-size:12px; }
.pr-table th, .pr-table td { text-align:right; padding:6px 8px; border-bottom:1px solid var(--pr-line-soft); vertical-align:top; }
.pr-table th { background:var(--pr-surface2); color:var(--pr-fg2); font-weight:700; font-size:11px; white-space:nowrap; }
.pr-table tbody tr:last-child td { border-bottom:0; }
.pr-table tr.pr-total td { background:var(--pr-surface2); font-weight:800; }
.pr-table-wrap { border:1px solid var(--pr-line-soft); border-radius:6px; overflow:hidden; }
.pr-person-cell b { display:block; }
.pr-person-cell small { color:var(--pr-fg3); font-size:11px; }
.pr-big { font-weight:800; font-size:14px; }
.pr-bar { display:grid; gap:3px; min-width:90px; }
.pr-bar i { display:block; height:5px; border-radius:3px; background:var(--pr-surface2); position:relative; overflow:hidden; }
.pr-bar i::after { content:""; position:absolute; inset-block:0; inset-inline-start:0; width:var(--w); background:var(--c); border-radius:3px; }
.pr-people { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; }
.pr-card { border:1px solid var(--pr-line-soft); border-radius:6px; padding:11px 12px; display:grid; gap:8px; align-content:start; }
.pr-card-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.pr-card-head span { color:var(--pr-fg2); font-size:11.5px; }
.pr-metrics { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:6px; }
.pr-metric { background:var(--pr-surface2); border-radius:5px; padding:6px 8px; display:grid; }
.pr-metric b { font-size:15px; font-weight:800; line-height:1.3; }
.pr-metric span { font-size:10.5px; color:var(--pr-fg2); }
.pr-metric.bad b { color:var(--pr-bad); } .pr-metric.good b { color:var(--pr-good); }
.pr-line { font-size:11.5px; color:var(--pr-fg2); }
.pr-line b { color:var(--pr-fg); }
.pr-list { margin:0; padding-inline-start:16px; display:grid; gap:2px; font-size:11.5px; color:var(--pr-fg2); }
.pr-late { color:var(--pr-bad); font-weight:700; }
.pr-notes { border:1px solid var(--pr-line-soft); border-radius:6px; padding:11px 13px; display:grid; gap:6px; }
.pr-notes ul { margin:0; padding-inline-start:16px; display:grid; gap:4px; font-size:11.5px; color:var(--pr-fg2); }
.pr-notes b { color:var(--pr-fg); }
.pr-foot { color:var(--pr-fg3); font-size:10.5px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.pr-empty { color:var(--pr-fg2); font-size:12px; padding:10px 0; }
@media (max-width: 760px) {
  .pr-doc { padding: 18px 14px; }
  .pr-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .pr-people { grid-template-columns: minmax(0,1fr); }
  .pr-table-wrap { overflow-x:auto; }
  .pr-table { min-width: 620px; }
}
@media print {
  @page { size: A4; margin: 12mm 11mm 14mm;
    @bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #8a95a4; } }
  html, body { background:#fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pr-doc { max-width:none; padding:0; border:0; border-radius:0; box-shadow:none; gap:18px; }
  .pr-kpis { grid-template-columns: repeat(5, minmax(0,1fr)) !important; }
  .pr-people { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
  .pr-table { min-width:0 !important; }
  .pr-card, .pr-kpi, .pr-table tr, .pr-notes { break-inside: avoid; }
  .pr-section h2 { break-after: avoid; }
}
`;

const pctColor = (pct: number | null) =>
  pct == null ? "var(--pr-fg3)" : pct >= 85 ? "var(--pr-good)" : pct >= 65 ? "var(--pr-warn)" : "var(--pr-bad)";

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function breakdown(counts: CategoryCounts): string {
  return CATEGORY_ORDER.filter((c) => counts[c] > 0)
    .map((c) => `${counts[c]} ${CATEGORY_LABELS[c]}`)
    .join(" · ");
}

function workdaysIn(from: string, to: string): number {
  let n = 0;
  for (let k = from; k <= to; k = addDaysToKey(k, 1)) {
    const [y, m, d] = k.split("-").map(Number);
    if (WORK_WEEK.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())) n++;
  }
  return n;
}

/** بلا تسليمات مقاسة (التصوير والنشر) «—» مو صفر: الصفر بيقول «ما تأخر» وهو ما انقاس. */
function delayText(p: { avgDelay: number | null; measured: number }): string {
  if (p.measured === 0) return "—";
  if (p.avgDelay == null) return "0";
  return `${p.avgDelay} يوم`;
}

function OnTimeBar({ pct, onTime, measured }: { pct: number | null; onTime: number; measured: number }) {
  if (pct == null) return <span className="pr-na">لا يُقاس من المنصة</span>;
  return (
    <div className="pr-bar">
      <span className="pr-num">
        {pct}% <span className="pr-na">({onTime}/{measured})</span>
      </span>
      <i style={{ ["--w" as string]: `${pct}%`, ["--c" as string]: pctColor(pct) }} />
    </div>
  );
}

function PersonCard({ p, showItems }: { p: PersonReport; showItems: boolean }) {
  const late = p.lateItems.slice(0, 6);
  return (
    <article className="pr-card">
      <div className="pr-card-head">
        <h3>{p.name}</h3>
        <span>{roleLabel(p.role)}</span>
      </div>
      <div className="pr-metrics">
        <div className="pr-metric">
          <b className="pr-num">{p.units}</b>
          <span>{p.units ? breakdown(p.byCategory) : "لا منجز بالفترة"}</span>
        </div>
        <div className={`pr-metric ${p.onTimePct != null && p.onTimePct >= 85 ? "good" : ""}`}>
          <b className="pr-num">{p.onTimePct == null ? "—" : `${p.onTimePct}%`}</b>
          <span>في الموعد{p.measured ? ` (${p.onTime} من ${p.measured})` : ""}</span>
        </div>
        <div className={`pr-metric ${p.lateCount > 0 ? "bad" : ""}`}>
          <b className="pr-num">{delayText(p)}</b>
          <span>
            معدل التأخير{p.lateCount ? ` (${p.lateCount})` : ""} · متأخر مفتوح {p.openLate}
          </span>
        </div>
      </div>
      {p.byCompany.length > 0 && (
        <p className="pr-line">
          <b>حسب الجهة:</b> {p.byCompany.map((c) => `${c.name} ${c.count}`).join(" · ")}
        </p>
      )}
      {late.length > 0 && (
        <div>
          <p className="pr-line">
            <b>المتأخر:</b>
          </p>
          <ul className="pr-list">
            {late.map((i) => (
              <li key={i.taskId}>
                {i.companyName} · {i.label} — <span className="pr-late">{i.lateDays} يوم</span>
              </li>
            ))}
            {p.lateItems.length > late.length && <li>و{p.lateItems.length - late.length} غيرها</li>}
          </ul>
        </div>
      )}
      {showItems && p.items.length > 0 && (
        <div>
          <p className="pr-line">
            <b>المنجز:</b>
          </p>
          <ul className="pr-list">
            {p.items.map((i) => (
              <li key={i.taskId}>
                {shortDay(i.dayKey)} · {i.companyName} · {i.label} ({CATEGORY_LABELS[i.category]})
                {i.lateDays ? <span className="pr-late"> — متأخر {i.lateDays} يوم</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function PeriodReportView({ report }: { report: PeriodReport }) {
  const { period, team, people, companies } = report;
  const generated = new Date(report.generatedAt);
  const issued = `${shortDay(new Date(generated.getTime() + 3 * 3_600_000).toISOString().slice(0, 10))}/${generated.getUTCFullYear()}`;
  const workdays = workdaysIn(period.from, period.to);
  const totals = companies.reduce(
    (acc, c) => {
      for (const k of CATEGORY_ORDER) acc.byCategory[k] += c.byCategory[k];
      acc.planDue += c.planDue;
      acc.planPublished += c.planPublished;
      return acc;
    },
    { byCategory: { design: 0, shoot: 0, edit: 0, write: 0, publish: 0, other: 0 } as CategoryCounts, planDue: 0, planPublished: 0 },
  );

  return (
    <div className="pr-doc">
      {/* نص خام: React بيهرّب علامات التنصيص بأبناء <style>، فـ`content:""` (تعبئة
          شريط النسبة) و`counter(page)` (ترقيم صفحات الـPDF) كانوا بيبطلوا. الثابت محلي بلا مدخلات. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="pr-head">
        <div className="pr-eyebrow">فريق السوشال ميديا · تقرير الإنجاز</div>
        <h1>
          {period.title} — {period.label}
        </h1>
        <div className="pr-meta">
          <span>
            الفترة: <b className="pr-num">{period.from === period.to ? shortDay(period.from) : `${shortDay(period.from)} – ${shortDay(period.to)}`}/{period.to.slice(0, 4)}</b>
          </span>
          <span>
            أيام الدوام: <b className="pr-num">{workdays}</b>
          </span>
          <span>
            تاريخ الإصدار: <b className="pr-num">{issued}</b>
          </span>
          <span>المصدر: <b>منصة الفريق وملفات تلغرام المربوطة</b></span>
        </div>
      </header>

      <section className="pr-section" aria-labelledby="pr-sum">
        <h2 id="pr-sum">الخلاصة</h2>
        <div className="pr-kpis">
          <div className="pr-kpi">
            <b className="pr-num">{team.productionUnits}</b>
            <span>مهمة إنتاج منجزة</span>
            <span className="pr-sub">{breakdown({ ...team.byCategory, publish: 0 }) || "—"}</span>
          </div>
          <div className="pr-kpi">
            <b className="pr-num">{team.published}</b>
            <span>منشور مسجّل</span>
            <span className="pr-sub">لـ{team.activeCompanies} جهة</span>
          </div>
          <div className={`pr-kpi ${team.onTimePct != null && team.onTimePct >= 85 ? "good" : ""}`}>
            <b className="pr-num">{team.onTimePct == null ? "—" : `${team.onTimePct}%`}</b>
            <span>تسليم في الموعد</span>
            <span className="pr-sub">
              {team.onTime} من {team.measured}
            </span>
          </div>
          <div className="pr-kpi">
            <b className="pr-num">{delayText(team)}</b>
            <span>معدل التأخير</span>
            <span className="pr-sub">لـ{team.lateCount} قطعة متأخرة</span>
          </div>
          <div className={`pr-kpi ${team.openLate > 0 ? "bad" : ""}`}>
            <b className="pr-num">{team.openLate}</b>
            <span>متأخر مفتوح</span>
            <span className="pr-sub">
              {report.asOfKey > period.to ? `بنهاية ${shortDay(period.to)}` : "حتى اليوم"}
            </span>
          </div>
        </div>
      </section>

      <section className="pr-section" aria-labelledby="pr-people">
        <h2 id="pr-people">أداء الأفراد</h2>
        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead>
              <tr>
                <th>الشخص</th>
                <th>المنجز</th>
                <th>في الموعد</th>
                <th>معدل التأخير</th>
                <th>متأخر مفتوح</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td className="pr-person-cell">
                    <b>{p.name}</b>
                    <small>{roleLabel(p.role)}</small>
                  </td>
                  <td>
                    <span className="pr-big pr-num">{p.units}</span>
                    {p.units > 0 && <div className="pr-na">{breakdown(p.byCategory)}</div>}
                  </td>
                  <td>
                    <OnTimeBar pct={p.onTimePct} onTime={p.onTime} measured={p.measured} />
                  </td>
                  <td className="pr-num">
                    {delayText(p)}
                    {p.lateCount > 0 && <span className="pr-na"> · {p.lateCount} قطعة</span>}
                  </td>
                  <td className="pr-num">{p.openLate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pr-section" aria-labelledby="pr-details">
        <h2 id="pr-details">التفاصيل لكل شخص</h2>
        <div className="pr-people">
          {people.map((p) => (
            <PersonCard key={p.id} p={p} showItems={report.showItems} />
          ))}
        </div>
      </section>

      <section className="pr-section" aria-labelledby="pr-cos">
        <h2 id="pr-cos">إنجاز الشركات</h2>
        {companies.length === 0 ? (
          <p className="pr-empty">لا شغل منجز ولا نشر مستحق بهالفترة.</p>
        ) : (
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>الجهة</th>
                  <th>الدورة</th>
                  <th>تصميم</th>
                  <th>تصوير</th>
                  <th>مونتاج</th>
                  <th>كتابة</th>
                  <th>أخرى</th>
                  <th>منشور</th>
                  <th>النشر المستحق</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const coPct = c.planDue ? Math.round((c.planPublished / c.planDue) * 100) : null;
                  return (
                    <tr key={c.id}>
                      <td className="pr-person-cell">
                        <b>{c.name}</b>
                      </td>
                      <td className="pr-num">{c.cycles.join(" · ") || <span className="pr-na">—</span>}</td>
                      <td className="pr-num">{c.byCategory.design || ""}</td>
                      <td className="pr-num">{c.byCategory.shoot || ""}</td>
                      <td className="pr-num">{c.byCategory.edit || ""}</td>
                      <td className="pr-num">{c.byCategory.write || ""}</td>
                      <td className="pr-num">{c.byCategory.other || ""}</td>
                      <td className="pr-num">{c.published || ""}</td>
                      <td>
                        {c.planDue ? (
                          <div className="pr-bar">
                            <span className="pr-num">
                              {c.planPublished} من {c.planDue}
                            </span>
                            <i style={{ ["--w" as string]: `${coPct}%`, ["--c" as string]: pctColor(coPct) }} />
                          </div>
                        ) : (
                          <span className="pr-na">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="pr-total">
                  <td>المجموع</td>
                  <td></td>
                  <td className="pr-num">{totals.byCategory.design}</td>
                  <td className="pr-num">{totals.byCategory.shoot}</td>
                  <td className="pr-num">{totals.byCategory.edit}</td>
                  <td className="pr-num">{totals.byCategory.write}</td>
                  <td className="pr-num">{totals.byCategory.other}</td>
                  <td className="pr-num">{totals.byCategory.publish}</td>
                  <td className="pr-num">
                    {totals.planPublished} من {totals.planDue}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pr-notes" aria-labelledby="pr-method">
        <h2 id="pr-method">طريقة الحساب</h2>
        <ul>
          <li>
            <b>المنجز:</b> كل كرت انسكّر جاهزاً أو منشوراً خلال الفترة بتوقيت دمشق. الإقفال الإداري والملغى غير محسوبين،
            والتصوير المسجَّل على غير مصوّر بينحسب لمصوّر الشركة.
          </li>
          <li>
            <b>الموعد:</b> للتصميم والمونتاج والكتابة حين للتسليم وقت معروف (ملف على تلغرام أو سطر دليل). الستوري على نهاية
            دورتها، وتبديل القائدة ليوم الكرت بيصير هو الموعد. معدل التأخير = متوسط أيام التأخير للقطع المتأخرة.
          </li>
          <li>
            <b>المتأخر المفتوح:</b> ما انسكّر وموعده مرق، عدا الشركات الموقوفة والمحجوز خلف مرحلة سابقة والموقوف بطلب الزبون.
          </li>
          <li>
            <b>النشر:</b> حسب تسجيل المنصة لحظة إصدار التقرير، لا حسب صفحات إنستغرام.
          </li>
        </ul>
      </section>

      <footer className="pr-foot">
        <span>أُعدّ آلياً من منصة فريق السوشال ميديا.</span>
        <span className="pr-num" dir="ltr">
          {period.from} → {period.to}
        </span>
      </footer>
    </div>
  );
}
