/**
 * بيفرجي أثر قاعدة «الدورة السابقة مثبّتة بكروتها» على لقطة الإنتاج: لكل شركة
 * ودلو عندها بعده دورة مسجَّلة، عدد القطع الموجود مقابل رقم السجلّ.
 *
 * الفرق مو خطأ — هو بالضبط يلي القاعدة بتحميه: دلو قديم عدد قطعه غير رقم
 * السجلّ الحالي كان رح يتغيّر عند أول إعادة جدولة.
 *
 *   npx tsx scripts/audit-frozen-plans.ts backups/prod-<آخر لقطة>.json
 */
import { readFileSync } from "node:fs";
import { hasLaterCycle, pieceCountsOf, type PlanCounts } from "@/lib/cycle-plan";

type Row = Record<string, unknown>;
const snapshotPath = process.argv[2];
if (!snapshotPath) {
  console.error("الاستعمال: audit-frozen-plans.ts <لقطة الإنتاج>");
  process.exit(1);
}
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
const tasks = snap.tasks as Row[];
const fields = ["posts", "reels", "aiReels", "stories"] as const;
const show = (c: PlanCounts) => fields.map((f) => c[f]).join("/");

console.log("شركة · دلو · قطع موجودة (بوست/ريل/AI/ستوري) · السجلّ");
for (const company of snap.companies as Row[]) {
  const buckets = new Map<string, Row[]>();
  for (const t of tasks) {
    if (t.companyId !== company.id || !t.isAuto || !t.type) continue;
    const key = `${t.year}|${t.month}`;
    buckets.set(key, [...(buckets.get(key) ?? []), t]);
  }
  for (const [key, rows] of [...buckets].sort()) {
    const [year, month] = key.split("|").map(Number);
    if (!hasLaterCycle(company as never, year, month)) continue;
    const existing = pieceCountsOf(rows as never);
    const record = company as unknown as PlanCounts;
    const differs = fields.some((f) => existing[f] !== record[f]);
    console.log(
      `${differs ? "≠" : "="} ${String(company.name)} · ${year}/m=${month} · ${show(existing)} · ${show(record)}`,
    );
  }
}
