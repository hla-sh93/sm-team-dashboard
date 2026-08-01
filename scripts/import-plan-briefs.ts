/**
 * Load the month's content plans into the task cards (§14).
 *
 * The plans arrive on Telegram as .docx tables — hook, script, caption,
 * hashtags per numbered piece. Until now the designer had to open the Word file
 * to know what «بوست-3» actually says. This lifts each row onto its piece's
 * card, so the brief travels with the work.
 *
 *   npx tsx scripts/import-plan-briefs.ts "C:/…/Telegram Desktop"
 *   npx tsx scripts/import-plan-briefs.ts "C:/…" --apply
 *   npx tsx scripts/import-plan-briefs.ts "C:/…" --company أغاليا --month 7
 *
 * Dry run by default. Re-runnable: a card's brief is simply overwritten with
 * the current plan text, so fixing a plan and re-importing is safe.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { inflateRawSync } from "zlib";
import { PrismaClient } from "@prisma/client";
import { CONTENT_TYPE_LABELS, type ContentType } from "../src/lib/constants";
import { currentCycle } from "../src/lib/contract";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const arg = (flag: string) => {
  const i = argv.indexOf(flag);
  return i > -1 ? argv[i + 1] : null;
};
const ONLY_COMPANY = arg("--company");
const ONLY_MONTH = arg("--month") ? Number(arg("--month")) - 1 : null;
const dir = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--company" && argv[i - 1] !== "--month");

if (!dir) {
  console.error('الاستعمال: npx tsx scripts/import-plan-briefs.ts "مجلد الخطط" [--apply] [--company اسم] [--month 8]');
  process.exit(1);
}

// ---------------------------------------------------------------- docx → text

/** Read one entry out of a .docx (a zip) without pulling in a zip dependency. */
function readZipEntry(buf: Buffer, wanted: string): Buffer | null {
  // End of central directory: signature 0x06054b50, scanned from the tail.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      return method === 0 ? data : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function docxText(path: string): string | null {
  const xml = readZipEntry(readFileSync(path), "word/document.xml");
  if (!xml) return null;
  return xml
    .toString("utf8")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

// ---------------------------------------------------------------- plan parsing

const EN: Record<string, ContentType> = {
  reel: "REEL", reels: "REEL", post: "POST", posts: "POST", carousel: "POST",
  story: "STORY", stories: "STORY",
};
const AR: Record<string, ContentType> = {
  "ريل": "REEL", "ريلز": "REEL", "ريلات": "REEL", "بوست": "POST", "بوستات": "POST",
  "كاروسيل": "POST", "ستوري": "STORY", "ستوريز": "STORY",
};
const typeOf = (l: string): ContentType | null =>
  EN[l.trim().toLowerCase()] ?? AR[l.trim()] ?? null;
const sectionOf = (l: string): ContentType | null =>
  /خطة الريلز|الريلات|أولاً.*ريل/.test(l) ? "REEL"
  : /خطة البوستات|ثانياً.*بوست/.test(l) ? "POST"
  : /الستوريز|الستوريات|خطة الستوري/.test(l) ? "STORY" : null;
const NOISE = /^(#|رقم|النوع|نوع|الكابشن|الهاشتاغات|السكريبت|ملاحظة|تفاصيل|نص المحتوى|الهوك)/;

type PlanItem = { n: number; type: ContentType; brief: string };

/** Pull the numbered rows out of a plan, each with its whole cell block. */
function parsePlan(text: string): PlanItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\uFEFF/g, "").trim());
  const items: PlanItem[] = [];
  let section: ContentType | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const s = sectionOf(l);
    if (s) {
      section = s;
      continue;
    }
    if (!/^\d{1,2}$/.test(l)) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;
    const explicit = j < lines.length ? typeOf(lines[j]) : null;
    const type = explicit ?? section;
    if (!type) continue;
    // The brief is everything up to the next numbered row.
    const body: string[] = [];
    for (let k = explicit ? j + 1 : j; k < lines.length; k++) {
      if (/^\d{1,2}$/.test(lines[k])) break;
      if (lines[k] && !NOISE.test(lines[k])) body.push(lines[k]);
    }
    const brief = body.join("\n").trim();
    if (brief) items.push({ n: Number(l), type, brief });
    i = j;
  }
  return items;
}

// ---------------------------------------------------------------- main

/** Plan file → company. Matched on the file name, so new plans just work. */
const FILE_HINTS: Record<string, string> = {
  wasl: "وصل للتداول",
  agaly: "أغاليا",
  agali: "أغاليا",
  balsam: "مركز البلسم",
  jadarat: "جدارات",
  jobs: "التوظيف",
  bw: "BW",
  bru: "برو",
  siizen: "Siizen",
  مخبر: "مخبر د.نور",
  المخبر: "مخبر د.نور",
};

async function main() {
  const companies = await prisma.company.findMany();
  const files = readdirSync(dir!).filter((f) => f.toLowerCase().endsWith(".docx") && !f.startsWith("~$"));

  let totalSet = 0;
  for (const f of files) {
    const lower = f.toLowerCase();
    const hint = Object.entries(FILE_HINTS).find(([k]) => lower.includes(k) || f.includes(k));
    const company = hint ? companies.find((c) => c.name === hint[1]) : null;
    if (!company) {
      console.log(`⏭️  ${f} — ما عرفت لأي شركة`);
      continue;
    }
    if (ONLY_COMPANY && !company.name.includes(ONLY_COMPANY)) continue;

    const text = docxText(join(dir!, f));
    if (!text) {
      console.log(`⚠️  ${f} — ما قدرت أقرأ الملف`);
      continue;
    }
    const items = parsePlan(text);
    if (!items.length) {
      console.log(`⚠️  ${f} — ما لقيت بنود مرقّمة`);
      continue;
    }

    // Which cycle does this plan belong to? The file name usually says
    // (July / Aug / آب). Failing that, use the company's CURRENT cycle rather
    // than the file's timestamp — a plan downloaded today can easily belong to
    // a cycle that started weeks ago.
    const monthFromName = /aug|آب/i.test(f) ? 7 : /jul|تموز/i.test(f) ? 6 : null;
    const cycle = company.contractStartDate ? currentCycle(company as never, new Date()) : null;
    const month = ONLY_MONTH ?? monthFromName ?? cycle?.start.getMonth() ?? statSync(join(dir!, f)).mtime.getMonth();

    const tasks = await prisma.task.findMany({
      where: { companyId: company.id, month, status: { not: "CANCELED" }, type: { not: null } },
      orderBy: [{ pieceNo: "asc" }],
    });
    const byType = new Map<string, typeof tasks>();
    for (const t of tasks.filter((t) => t.stage !== "PUBLISH")) {
      const arr = byType.get(t.type!) ?? [];
      arr.push(t);
      byType.set(t.type!, arr);
    }

    let set = 0;
    const missing: string[] = [];
    // Plan rows are numbered per type; match them to pieces by ORDER, because a
    // plan's «#7» is its 5th post when the numbering skips.
    for (const type of ["REEL", "POST", "STORY", "AI_REEL"] as ContentType[]) {
      const planned = items.filter((i) => i.type === type).sort((a, b) => a.n - b.n);
      // AI reels are covered by the plan's REEL rows when a company has no real ones.
      const pieces = (byType.get(type) ?? []).sort((a, b) => (a.pieceNo ?? 0) - (b.pieceNo ?? 0));
      const pool = pieces.length ? pieces : type === "REEL" ? (byType.get("AI_REEL") ?? []) : [];
      for (let i = 0; i < Math.min(planned.length, pool.length); i++) {
        const t = pool[i];
        const brief = planned[i].brief.slice(0, 4000);
        if (APPLY) {
          await prisma.task.update({ where: { id: t.id }, data: { brief } });
          // The publish card shows the same brief — the publisher needs the caption.
          if (t.pipelineKey)
            await prisma.task.updateMany({
              where: { pipelineKey: t.pipelineKey, stage: "PUBLISH" },
              data: { brief },
            });
        }
        set++;
      }
      if (planned.length > pool.length)
        missing.push(`${CONTENT_TYPE_LABELS[type]}: ${planned.length} بالخطة مقابل ${pool.length} كرت`);
    }
    totalSet += set;
    console.log(
      `${set ? "✅" : "⚠️ "} ${company.name.padEnd(13)} ${f.padEnd(32)} شهر ${month + 1} → ${set} كرت` +
        (missing.length ? `   (${missing.join(" · ")})` : ""),
    );
  }

  console.log(`\n${APPLY ? "انكتب" : "رح ينكتب"} نص المحتوى على ${totalSet} كرت.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
