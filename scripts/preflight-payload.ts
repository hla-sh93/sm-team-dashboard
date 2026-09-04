/**
 * بيفحص حمولة «استيراد خطة JSON» على **لقطة الإنتاج** قبل ما تنطبّق.
 *
 * ليش: معرّف الكرت مو رقم القطعة. `2026_6_d_c_wasl_REEL_5` رقم قطعته ٣، و
 * `..._POST_59` عند Siizen هو بوست ٢. مرّة كتبت تصحيحاً على الكرت الغلط لأني
 * قريت الرقم من المعرّف. الحمولة بتطابق بـ(النوع·رقم القطعة·المرحلة)، وهاد
 * السكربت بيتأكّد إنّ كل بند بيطابق **صفاً واحداً بالضبط** وبيفرجيك عليه.
 *
 *   npx tsx scripts/preflight-payload.ts backups/prod-<آخر لقطة>.json scripts/data/<file>.json ...
 */
import { readFileSync } from "node:fs";

type Row = Record<string, unknown>;
const L = (v: unknown) => {
  if (!v) return "—";
  const d = new Date(v as string);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const [snapshotPath, ...files] = process.argv.slice(2);
if (!snapshotPath || !files.length) {
  console.error("الاستعمال: preflight-payload.ts <لقطة الإنتاج> <حمولة> [...]");
  process.exit(1);
}
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
const tasks = snap.tasks as Row[];
const companies = snap.companies as Row[];

let problems = 0;
for (const file of files) {
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const company = companies.find(
    (c) => c.name === payload.companyName || c.id === payload.companyId,
  );
  console.log(`\n■ ${file} — ${payload.companyName ?? payload.companyId} m=${payload.month}`);
  if (!company) {
    console.log("   ✗ الشركة مو موجودة باللقطة");
    problems++;
    continue;
  }
  for (const spec of (payload.pieceStates ?? []) as Row[]) {
    const hits = tasks.filter(
      (t) =>
        t.companyId === company.id &&
        t.year === payload.year &&
        t.month === payload.month &&
        t.type === spec.type &&
        t.pieceNo === spec.pieceNo &&
        t.stage === spec.stage &&
        t.status !== "CANCELED" &&
        t.isAuto,
    );
    if (hits.length !== 1) {
      console.log(`   ✗ ${spec.type}#${spec.pieceNo} ${spec.stage}: طابق ${hits.length} صف`);
      problems++;
      continue;
    }
    const t = hits[0];
    const bits = [String(t.id)];
    if (spec.pinned !== undefined) bits.push(`مثبّت ${t.isPinned}→${spec.pinned}`);
    if (spec.status) bits.push(`حالة ${t.status}→${spec.status}`);
    if (spec.date) bits.push(`إنجاز → ${spec.date}`);
    if (spec.workDate) bits.push(`شغل ${L(t.workDate)}→${spec.workDate}`);
    if (spec.readyDate) bits.push(`جهوزية ${L(t.readyDate)}→${spec.readyDate}`);
    if (spec.publishDate) bits.push(`نشر ${L(t.publishDate)}→${spec.publishDate}`);
    if (spec.removeEvidence) {
      const n = String(t.notes ?? "")
        .split(/\r?\n/)
        .filter((line) => line.trim() === String(spec.removeEvidence).trim()).length;
      bits.push(`بيشيل ${n} سطر`);
      if (!n) {
        console.log(`   ⚠️ ${spec.type}#${spec.pieceNo}: السطر المطلوب شيلو مو موجود على الكرت`);
      }
    }
    const dup = String(t.notes ?? "")
      .split(/\r?\n/)
      .filter((line) => line.trim() === String(spec.evidence).trim()).length;
    if (dup) bits.push(`الدليل موجود أصلاً (${dup})`);
    console.log(
      `   ✓ ${String(spec.type).padEnd(5)}#${String(spec.pieceNo).padEnd(3)} ${String(spec.stage).padEnd(7)} · ${bits.join(" · ")}`,
    );
  }
  for (const spec of (payload.adhocStates ?? []) as Row[]) {
    const hits = tasks.filter((t) => t.companyId === company.id && t.title === spec.title);
    if (hits.length !== 1) {
      console.log(`   ✗ «${spec.title}»: طابق ${hits.length} كرت`);
      problems++;
    } else {
      console.log(`   ✓ خارج الخطة «${spec.title}» · ${hits[0].id}`);
    }
  }
}
console.log(problems ? `\n✗ ${problems} مشكلة — ما تطبّق` : "\n✓ كل بند بيطابق صفاً واحداً بالضبط");
process.exit(problems ? 1 : 0);
