/**
 * Load the month's content plans into the task cards (§14).
 *
 * The plans arrive on Telegram as .docx tables — hook, script, caption,
 * hashtags per numbered piece. Until now the designer had to open the Word file
 * to know what «بوست-3» actually says. This lifts each row onto its piece's
 * card, so the brief travels with the work — and gives the delivery matcher the
 * only evidence it has for a file nobody named by the convention.
 *
 *   npx tsx scripts/import-plan-briefs.ts "C:/…/ChatExport_2026-08-03"
 *   npx tsx scripts/import-plan-briefs.ts "C:/…" --apply
 *   npx tsx scripts/import-plan-briefs.ts "C:/…" --company أغاليا --month 7
 *   npx tsx scripts/import-plan-briefs.ts "C:/…" --all      # حتى الشهور القديمة
 *
 * Point it at a Telegram Desktop export folder and it reads `result.json`: the
 * TOPIC a plan was sent in names its company («خطة جوبس.docx» carries no hint)
 * and the send date dates it. A plain folder of .docx files still works, with
 * the company read from the file name.
 *
 * Dry run by default. Re-runnable: a card's brief is simply overwritten with
 * the current plan text, so fixing a plan and re-importing is safe.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, dirname, join } from "path";
import { inflateRawSync } from "zlib";
import { PrismaClient } from "@prisma/client";
import { CONTENT_TYPE_LABELS, type ContentType } from "../src/lib/constants";
import { cyclesOf } from "../src/lib/contract";
import {
  buildTopicIndex,
  matchTopicCompany,
  monthWordIn,
  plainText,
  type ExportMessage,
} from "../src/lib/telegram/export";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const arg = (flag: string) => {
  const i = argv.indexOf(flag);
  return i > -1 ? argv[i + 1] : null;
};
/** يعرض أول وصفين من كل خطة — للتأكد إنّ القراءة طلعت نص مفهوم مو حشو. */
const SHOW = argv.includes("--show");
const ONLY_COMPANY = arg("--company");
const ONLY_MONTH = arg("--month") ? Number(arg("--month")) - 1 : null;
/** بلاه منستورد بس الشهر الحالي واللي قبله — التصدير فيه خطط من نيسان. */
const ALL_MONTHS = argv.includes("--all") || ONLY_MONTH != null;
const target = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--company" && argv[i - 1] !== "--month");

if (!target) {
  console.error('الاستعمال: npx tsx scripts/import-plan-briefs.ts "مجلد التصدير أو مجلد الخطط" [--apply] [--company اسم] [--month 8] [--all]');
  process.exit(1);
}

/** التصدير: مجلّد فيه `result.json`، أو الملف نفسه. */
const exportJson = target.toLowerCase().endsWith(".json")
  ? target
  : existsSync(join(target, "result.json"))
    ? join(target, "result.json")
    : null;
const dir = exportJson ? dirname(exportJson) : target;

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
const NOISE = /^(#|رقم|النوع|نوع|الكابشن|الهاشتاغات|السكريبت|ملاحظة|تفاصيل|نص المحتوى|محتوى التصميم|الهوك)/;

type PlanItem = { n: number; type: ContentType; brief: string };

/** Pull the numbered rows out of a plan, each with its whole cell block. */
function parsePlan(text: string): PlanItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\uFEFF/g, "").trim());

  /**
   * \u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u062C\u062F\u0648\u0644 \u0645\u0648 \u0645\u0648\u062D\u0651\u062F \u0628\u064A\u0646 \u0627\u0644\u0634\u0631\u0643\u0627\u062A: \u0627\u0644\u0628\u0644\u0633\u0645 \u0628\u062A\u0643\u062A\u0628 [\u0627\u0644\u0631\u0642\u0645][\u0627\u0644\u0646\u0648\u0639][\u0627\u0644\u0645\u062D\u062A\u0648\u0649]\u060C
   * \u0648BW \u0628\u062A\u0643\u062A\u0628 [\u0627\u0644\u0645\u062D\u062A\u0648\u0649][\u0627\u0644\u0631\u0642\u0645][\u0627\u0644\u0646\u0648\u0639] (\u0639\u0645\u0648\u062F # \u0622\u062E\u0631 \u0634\u064A). \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0628\u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u063A\u0644\u0637
   * \u0645\u0627 \u0628\u062A\u0641\u0634\u0644 \u2014 \u0628\u062A\u0639\u0637\u064A \u0643\u0644 \u0635\u0641 **\u0646\u0635\u0651 \u062C\u0627\u0631\u0647** \u0648\u0628\u062A\u062A\u0631\u0643 \u0627\u0644\u0623\u062E\u064A\u0631 \u0641\u0627\u0636\u064A\u0627\u064B: \u0647\u064A\u0643 \u0628\u0648\u0633\u062A BW-4
   * \u0637\u0644\u0639 \u00AB\u0628\u0644\u0627 \u0648\u0635\u0641\u00BB \u0648\u0627\u0644\u0633\u0628\u0639\u0629 \u0627\u0644\u0628\u0627\u0642\u064A\u064A\u0646 \u0648\u0627\u0635\u0641\u064A\u0646 \u0648\u0635\u0641 \u0645\u0632\u0627\u062D. \u0641\u0645\u0646\u0642\u0631\u0623 \u0628\u0627\u0644\u0627\u062A\u062C\u0627\u0647\u064A\u0646 \u0648\u0645\u0646\u0627\u062E\u062F
   * \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0644\u064A \u0628\u062A\u0639\u0628\u0651\u064A \u0643\u0644 \u0627\u0644\u0635\u0641\u0648\u0641 \u2014 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0635\u062D\u064A\u062D \u0645\u0627 \u0628\u064A\u062A\u0631\u0643 \u0635\u0641\u0627\u064B \u0641\u0627\u0636\u064A\u0627\u064B.
   */
  const forward = parseDirection(lines, "after");
  const backward = parseDirection(lines, "before");
  // عدد الصفوف المرقّمة الفعلي بالملف — القراءة الصح هي يلي بتغطيهن كلهن.
  // (الصف الفاضي ما بيدخل بالنتيجة أصلاً، فمقارنة «كل الموجود واصف» بلا معنى.)
  let expected = 0;
  for (let i = 0; i < lines.length; i++)
    if (/^\d{1,2}$/.test(lines[i] ?? "")) expected++;
  if (forward.length >= expected) return forward;
  if (backward.length >= expected) return backward;
  return forward.length >= backward.length ? forward : backward;
}

function parseDirection(lines: string[], bodySide: "after" | "before"): PlanItem[] {
  const items: PlanItem[] = [];
  let section: ContentType | null = null;
  /** \u0628\u062F\u0627\u064A\u0629 \u0643\u062A\u0644\u0629 \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u2014 \u0644\u0648\u0636\u0639 \u00AB\u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0642\u0628\u0644 \u0627\u0644\u0631\u0642\u0645\u00BB. */
  let prevBlockStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const s = sectionOf(l);
    if (s) {
      section = s;
      prevBlockStart = i + 1;
      continue;
    }
    if (!/^\d{1,2}$/.test(l)) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;
    const explicit = j < lines.length ? typeOf(lines[j]) : null;
    const type = explicit ?? section;
    if (!type) continue;

    const body: string[] = [];
    if (bodySide === "after") {
      for (let k = explicit ? j + 1 : j; k < lines.length; k++) {
        if (/^\d{1,2}$/.test(lines[k])) break;
        if (lines[k] && !NOISE.test(lines[k])) body.push(lines[k]);
      }
    } else {
      for (let k = prevBlockStart; k < i; k++)
        if (lines[k] && !NOISE.test(lines[k]) && !typeOf(lines[k])) body.push(lines[k]);
    }
    const brief = body.join("\n").trim();
    if (brief) items.push({ n: Number(l), type, brief });
    prevBlockStart = explicit ? j + 1 : j;
    i = j;
  }
  return items;
}

// ---------------------------------------------------------------- main

/** Plan file → company. Matched on the file name, so new plans just work. */
const FILE_HINTS: Record<string, string> = {
  wasl: "وصل للتداول",
  تداول: "وصل للتداول",
  agaly: "أغاليا",
  agali: "أغاليا",
  balsam: "مركز البلسم",
  jadarat: "جدارات",
  jobs: "التوظيف",
  جوبس: "التوظيف",
  bw: "BW",
  bru: "برو",
  siizen: "Siizen",
  مخبر: "مخبر د.نور",
  المخبر: "مخبر د.نور",
};

/** الشركة من اسم الملف — احتياط للخطط اللي انبعتت برّا أي توبيك. */
function companyFromName(name: string, companies: Company[]): Company | null {
  const lower = name.toLowerCase();
  const hint = Object.entries(FILE_HINTS).find(([k]) => lower.includes(k) || name.includes(k));
  return hint ? (companies.find((c) => c.name === hint[1]) ?? null) : null;
}

type Company = Awaited<ReturnType<PrismaClient["company"]["findMany"]>>[number];

/** خطة وحدة جاهزة للاستيراد: ملفها، شركتها، شهرها، ووقت وصولها. */
type PlanFile = {
  path: string;
  name: string;
  company: Company;
  month: number;
  /** من وين إجا الشهر — بينطبع بالتقرير لأنّ غلطه بيكتب خطة نيسان على آب. */
  monthFrom: string;
  at: Date;
};

/**
 * الشهر اللي بتخصّه الخطة.
 *
 * اسم الملف بيقولها بالعادة («Bw - Aug -»، «المخبر - July Plan-»). لما ما
 * يقولها، بنمشي على **أقرب بداية دورة** لتاريخ الإرسال: الخطة بتوصل قبل دورتها
 * بأيام أو بأولها، فـ«BalsamCenter_ContentPlan» يلي انبعت ٣٠/٧ هي خطة آب مو
 * تموز. زيادة نصف دورة على تاريخ الإرسال بتعطي هالتقريب بالضبط.
 *
 * القديم كان بياخد دورة **اليوم** لأي ملف بلا شهر بالاسم — فخطة نيسان بتنكتب
 * على كروت آب وبتمحي كل الأوصاف يلي المطابقة قايمة عليها.
 */
function monthOf(company: Company, name: string, caption: string | null, at: Date) {
  if (ONLY_MONTH != null) return { month: ONLY_MONTH, monthFrom: "--month" };
  const named = monthWordIn(`${name} ${caption ?? ""}`);
  if (named != null) return { month: named, monthFrom: "الاسم" };
  const mid = new Date(at);
  mid.setDate(mid.getDate() + 15);
  // الدورة اللي لسا ما خلصت وقتها — وإذا النشر لسا ما بلّش (جدارات وقّعت 4/7
  // وبتنشر من 7/8) فخطة تموز هي خطة **أول دورة**، مو خطة شهر بلا كروت.
  const cycle = company.contractStartDate
    ? (cyclesOf(company as never).find((c) => c.end.getTime() > mid.getTime()) ?? null)
    : null;
  if (cycle) return { month: cycle.start.getMonth(), monthFrom: "أقرب دورة للإرسال" };
  return { month: mid.getMonth(), monthFrom: "أقرب شهر للإرسال" };
}

/** الخطط جوّا تصدير تلغرام: التوبيك بيحدّد الشركة، والرسالة بتحدّد التاريخ. */
function fromExport(companies: Company[], skipped: string[]): PlanFile[] {
  const raw = JSON.parse(readFileSync(exportJson!, "utf8")) as { messages: ExportMessage[] };
  const messages = raw.messages ?? [];
  const { topicOf, titles } = buildTopicIndex(messages);
  const out: PlanFile[] = [];

  for (const m of messages) {
    if (!m.file || !m.file_name?.toLowerCase().endsWith(".docx")) continue;
    const path = join(dir, m.file);
    if (!existsSync(path)) {
      skipped.push(`${m.file_name} — الملف مو موجود بالتصدير`);
      continue;
    }
    const topic = topicOf(m);
    const company =
      (topic != null ? matchTopicCompany(titles.get(topic) ?? "", companies) : null) ??
      companyFromName(m.file_name, companies);
    if (!company) {
      skipped.push(`${m.file_name} — توبيك «${(topic != null && titles.get(topic)) || "—"}» مو مربوط بشركة`);
      continue;
    }
    const at = m.date_unixtime ? new Date(Number(m.date_unixtime) * 1000) : new Date(m.date);
    out.push({
      path,
      name: m.file_name,
      company,
      ...monthOf(company, m.file_name, plainText(m.text), at),
      at,
    });
  }
  return out;
}

/** مجلّد ملفات عادي: الشركة بتنقرأ من اسم الملف. */
function fromFolder(companies: Company[], skipped: string[]): PlanFile[] {
  const out: PlanFile[] = [];
  for (const f of readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".docx") && !f.startsWith("~$"))) {
    const company = companyFromName(f, companies);
    if (!company) {
      skipped.push(`${f} — ما عرفت لأي شركة`);
      continue;
    }
    const at = statSync(join(dir, f)).mtime;
    out.push({ path: join(dir, f), name: f, company, ...monthOf(company, f, null, at), at });
  }
  return out;
}

async function main() {
  const companies = await prisma.company.findMany();
  const skipped: string[] = [];
  const now = new Date();
  /** شهر مسموح: الجاري، اللي قبله، واللي بعده (الخطة بتوصل قبل دورتها). */
  const inRange = (month: number) => {
    if (ALL_MONTHS) return true;
    const d = Math.abs(month - now.getMonth());
    return Math.min(d, 12 - d) <= 1;
  };

  const found = (exportJson ? fromExport(companies, skipped) : fromFolder(companies, skipped))
    .filter((p) => !ONLY_COMPANY || p.company.name.includes(ONLY_COMPANY))
    // الأقدم أولاً: خطتين لنفس الشهر بتتكاملوا، والأحدث هي اللي بتغلب.
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  // نفس الملف بينبعت مرتين (تذكير، أو نسخة «(1)») — آخر إرسال بيكفي.
  const latest = new Map<string, PlanFile>();
  for (const p of found) latest.set(`${p.company.id}|${p.month}|${p.name}`, p);
  const plans = [...latest.values()].sort((a, b) => a.at.getTime() - b.at.getTime());

  let totalSet = 0;
  for (const p of plans) {
    const { company, month } = p;
    const f = `${p.name}${p.name === basename(p.path) ? "" : ""}`;
    if (!inRange(month)) {
      skipped.push(`${f} — شهر ${month + 1} برّا المدى (${p.monthFrom})`);
      continue;
    }

    const text = docxText(p.path);
    if (!text) {
      console.log(`⚠️  ${f} — ما قدرت أقرأ الملف`);
      continue;
    }
    const items = parsePlan(text);
    if (!items.length) {
      skipped.push(`${f} — ما لقيت بنود مرقّمة`);
      continue;
    }

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
      `${set ? "✅" : "⚠️ "} ${company.name.padEnd(13)} ${f.slice(0, 34).padEnd(34)} شهر ${month + 1}` +
        ` (${p.monthFrom}) → ${set} كرت` +
        (missing.length ? `   (${missing.join(" · ")})` : ""),
    );
    if (SHOW)
      for (const it of items.slice(0, 2))
        console.log(
          `      ${CONTENT_TYPE_LABELS[it.type]} ${it.n}: ${it.brief.replace(/\n/g, " ¶ ").slice(0, 160)}`,
        );
  }

  if (skipped.length) {
    console.log(`\n— متخطّى (${skipped.length}) —`);
    for (const s of skipped) console.log(`  ⏭️  ${s}`);
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
