/**
 * استيراد **سكربتات التصوير** ولصقها وصفاً على كروت الريل.
 *
 * القائدة (10/8): «كل المهام الدورية للشركات لازم يكون الها وصف — أو على
 * الأقل الريلات، لأن البوستات تتغير حسب رغبة الزبون والمنتجات التي يقدمها».
 *
 * وهاد ملف مختلف عن خطة الشهر: خطة الشهر جدول (رقم · نوع · فكرة · كابشن)
 * وبيقراها `import-plan-briefs`. أما سكربت التصوير فوثيقة سردية لكل ريل —
 * الفكرة، طريقة التصوير، السيناريو، لائحة اللقطات، الملاحظات. وهي يلي بيحتاجها
 * ماجد وأليسار فعلياً وقت الشغل، ومن دونها الكرت بيقول «ريل ٣» وبس.
 *
 * الوصف بينكتب على **كل مراحل القطعة** (تصوير · مونتاج · نشر) — لأن مراحل
 * القطعة الوحدة لازم تتفق على شو هي القطعة، وهاد ثابت بيحرسه الفحص.
 *
 *   npx tsx scripts/import-shooting-scripts.ts <ملف.docx|ملف.txt> --company برو [--apply]
 *
 * الـPDF مو مقروء (ما في قارئ بالمشروع) — حوّليه لـdocx أو صدّري نصّه لـtxt.
 */
import { readFileSync, existsSync } from "fs";
import { inflateRawSync } from "zlib";
import { PrismaClient } from "@prisma/client";
import { currentCycleBucket } from "../src/lib/contract";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const arg = (k: string) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
};
const file = argv.filter((a) => !a.startsWith("--"))[0];
const companyArg = arg("--company");

/** قراءة نصّ docx بلا اعتماديات — نفس أسلوب `import-plan-briefs`. */
function docxText(path: string): string | null {
  const buf = readFileSync(path);
  const needle = Buffer.from("word/document.xml");
  let at = buf.indexOf(needle);
  while (at !== -1) {
    const local = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), at);
    if (local === -1) break;
    const nameLen = buf.readUInt16LE(local + 26);
    const extraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + nameLen + extraLen;
    const comp = buf.readUInt16LE(local + 8);
    const size = buf.readUInt32LE(local + 18);
    try {
      const raw = buf.subarray(start, size ? start + size : undefined);
      const xml = (comp === 8 ? inflateRawSync(raw) : raw).toString("utf8");
      if (xml.includes("<w:document")) return xml;
    } catch {
      /* جرّب المدخل التالي */
    }
    at = buf.indexOf(needle, at + 1);
  }
  return null;
}

function toPlain(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * تقطيع الوثيقة لسكربتات مرقّمة.
 *
 * الشكلان يلي وصلوا فعلاً:
 *   • **مرقّم صراحةً** — «الريل1: قهوتك مو طلب» (برو). الرقم هو رقم القطعة.
 *   • **متسلسل بلا أرقام** — جدول سطره ينتهي بـ«Reel» (مانغو · عبادة).
 *     وقتها الترتيب هو الرقم: أول سكربت للريل ١ وهكذا.
 */
function splitScripts(text: string): { no: number; body: string }[] {
  const numbered = [...text.matchAll(/(?:^|\n)\s*(?:الريل|ريل|Reel)\s*[:\-]?\s*(\d{1,2})\s*[:\-]/g)];
  if (numbered.length >= 2) {
    const out: { no: number; body: string }[] = [];
    for (let i = 0; i < numbered.length; i++) {
      const start = numbered[i].index!;
      const end = i + 1 < numbered.length ? numbered[i + 1].index! : text.length;
      out.push({ no: Number(numbered[i][1]), body: text.slice(start, end).trim() });
    }
    return out;
  }
  // بلا أرقام: كل مقطع بينتهي بكلمة «Reel» لحاله هو سكربت.
  const parts = text
    .split(/\n\s*Reel\s*\n?/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 60);
  return parts.map((body, i) => ({ no: i + 1, body }));
}

async function main() {
  if (!file || !companyArg) {
    console.error(
      "الاستعمال: npx tsx scripts/import-shooting-scripts.ts <ملف.docx|txt> --company <اسم> [--apply]",
    );
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`ما لقيت الملف: ${file}`);
    process.exit(1);
  }
  if (/\.pdf$/i.test(file)) {
    console.error("الـPDF مو مقروء — حوّليه لـdocx أو صدّري نصّه لملف txt.");
    process.exit(1);
  }

  const text = /\.docx$/i.test(file)
    ? toPlain(docxText(file) ?? "")
    : readFileSync(file, "utf8");
  if (!text.trim()) {
    console.error("الملف فاضي أو ما انقرا");
    process.exit(1);
  }

  const co = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!co) {
    console.error(`ما لقيت شركة «${companyArg}»`);
    process.exit(1);
  }

  const scripts = splitScripts(text);
  console.log(`■ ${co.name} — ${scripts.length} سكربت تصوير\n`);

  // **الدورة الحالية** لا «الجاي بالتاريخ»: نصّ ريل موعده مرق من يومين لسا
  // بيلزم — الشغل يمكن ما انعمل بعد. وحصره بالمستقبل كان بيسقّط أربع ريلات
  // من ست عند برو لأن مواعيدها مرقت هالأسبوع.
  const bucket = currentCycleBucket(co as never, new Date());
  const cards = await prisma.task.findMany({
    where: {
      companyId: co.id,
      type: { in: ["REEL", "AI_REEL"] },
      status: { not: "CANCELED" },
      ...(bucket ? { year: bucket.year, month: bucket.month } : {}),
    },
    orderBy: [{ pieceNo: "asc" }],
  });
  const byPiece = new Map<number, typeof cards>();
  for (const c of cards) {
    if (c.pieceNo == null) continue;
    byPiece.set(c.pieceNo, [...(byPiece.get(c.pieceNo) ?? []), c]);
  }

  let set = 0;
  for (const s of scripts) {
    const rows = byPiece.get(s.no);
    if (!rows?.length) {
      console.log(`  ⚠️ ريل ${s.no}: ما في كرت مفتوح بهالرقم`);
      continue;
    }
    const head = s.body.split("\n")[0].slice(0, 70);
    console.log(`  ريل ${s.no} → ${rows.length} مرحلة · «${head}»`);
    set += rows.length;
    if (!APPLY) continue;
    for (const t of rows)
      await prisma.task.update({ where: { id: t.id }, data: { brief: s.body.slice(0, 4000) } });
  }
  console.log(APPLY ? `\n✅ انكتب الوصف على ${set} كرت` : `\n${set} كرت — تشغيل تجريبي، أضف --apply.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
