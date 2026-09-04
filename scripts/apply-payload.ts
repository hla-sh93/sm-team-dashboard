/**
 * يشغّل حمولة «استيراد خطة JSON» على الداتا **المحلية**.
 *
 * ليش: كل تعديل على الإنتاج بيمرّ من زر اللوحة، وقبله لازم نعرف إذا الحمولة
 * بتمشي أصلاً — القطع موجودة؟ المراحل مطابقة؟ الشرط كل-أو-لا-شي بينجح؟ بلا
 * هالسكربت كان الجواب بيجي من الإنتاج نفسه.
 *
 * الاستعمال:
 *   npx tsx scripts/apply-payload.ts scripts/data/<file>.json [...]
 *
 * بيوقف عند أول حمولة بتفشل — الحمولة الوحدة كل-أو-لا-شي، بس التسلسل بينهن لأ.
 */
import { readFileSync } from "node:fs";
import { applyPlanUpdatePayload } from "@/server/actions/plans";

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("حطّ مسار ملف حمولة واحد على الأقل.");
    process.exit(1);
  }
  for (const file of files) {
    const payload = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    // `_` هو تعليق الحمولة — شرح القرار ومصدره، مو حقل بيتقرا.
    delete payload._;
    const result = (await applyPlanUpdatePayload(payload)) as Record<string, unknown>;
    if (!result.ok) {
      console.error(`✗ ${file}\n  ${String(result.error)}`);
      process.exit(1);
    }
    const counts = Object.entries(result)
      .filter(([k, v]) => k !== "ok" && typeof v === "number")
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ");
    console.log(`✓ ${file}${counts ? `\n  ${counts}` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
