/**
 * جرد تسليمات تلغرام كملف Markdown — قراءة فقط، بلا أي كتابة على الداتا.
 *
 *   npx tsx scripts/telegram-inventory.ts <result.json> [منذ] > docs/cycle-reports/…md
 *
 * قاعدة القائدة (٢/٩): «أي صورة مرسلة مو من فريق الديزاين بتكون ماتيريال
 * للاستخدام فقط — سيلز أو مصوّر أو مونتير بيرسل ملفات مشان المصمّم يشتغل
 * عليها». فالتصنيف بيصير حسب **مرسِلها** لا حسب امتدادها.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { buildTopicIndex, matchTopicCompany } from "../src/lib/telegram/export";

const prisma = new PrismaClient();
const path = process.argv[2];
const since = process.argv[3] ?? "2026-08-01";

const isRawName = (f: string) => /^(DSC|_DSC|IMG|_MG|PXL|VID|MVI)[-_ ]?\d+/i.test(f);
const isVideo = (f: string) => /\.(mp4|mov|avi|mkv)$/i.test(f);
const isDoc = (f: string) => /\.(docx?|pdf|xlsx?|zip)$/i.test(f);
const isImage = (f: string) => /\.(jpg|jpeg|png|webp)$/i.test(f);

/** فريق الديزاين: المصمّمون + القائدة (نص مصمّمة). */
const isDesignRole = (role: string) => /designer|مصمم/i.test(role) || /نص مصمم/.test(role);

type Row = { co: string; date: string; from: string; role: string; file: string; kind: string };

async function main() {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const messages = raw.messages ?? [];
  const idx = buildTopicIndex(messages);
  const [companies, employees] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true } }),
    prisma.employee.findMany({ select: { name: true, role: true, telegramAliases: true } }),
  ]);
  const cos = companies.map((c) => ({ ...c, slug: null as string | null }));

  // اسم تلغرام الظاهر → الموظف. بلا هالخريطة التسليمات بتضيع صامتة: الاسم
  // الظاهر لاتيني عند نصّ الفريق.
  const byAlias = new Map<string, { name: string; role: string }>();
  for (const e of employees) {
    byAlias.set(e.name.trim(), { name: e.name, role: e.role });
    for (const a of (e.telegramAliases ?? "").split(",")) {
      const key = a.trim();
      if (key) byAlias.set(key, { name: e.name, role: e.role });
    }
  }
  const roleOf = (from: string) => byAlias.get(from.trim())?.role ?? "غير معروف";
  const teamName = (from: string) => byAlias.get(from.trim())?.name ?? from;

  const classify = (file: string, from: string) => {
    if (isVideo(file)) return "فيديو";
    if (isDoc(file)) return "مستند";
    const design = isDesignRole(roleOf(from));
    if (!design) return "مادة"; // قاعدة القائدة: من غير الديزاين = مادة للاستخدام
    if (file === "«صورة»") return "تصميم بلا اسم";
    if (isRawName(file)) return "مادة";
    return isImage(file) ? "تصميم" : "غير ذلك";
  };

  const rows: Row[] = [];
  for (const m of messages) {
    if (m.type !== "message") continue;
    const date: string = (m.date ?? "").slice(0, 10);
    if (date < since) continue;
    const file =
      m.file_name ?? (m.file ? String(m.file).split(/[\\/]/).pop() : m.photo ? "«صورة»" : null);
    if (!file) continue;
    const topicId = idx.topicOf(m);
    const title = topicId != null ? (idx.titles.get(topicId) ?? "") : "";
    const co = title ? matchTopicCompany(title, cos) : null;
    const from = m.from ?? "?";
    rows.push({
      co: co?.name ?? title ?? "بلا موضوع",
      date,
      from: teamName(from),
      role: roleOf(from),
      file,
      kind: classify(file, from),
    });
  }

  const byCo = new Map<string, Row[]>();
  for (const r of rows) {
    const l = byCo.get(r.co) ?? [];
    l.push(r);
    byCo.set(r.co, l);
  }
  const ordered = [...byCo.entries()].sort((a, b) => b[1].length - a[1].length);
  const out: string[] = [];
  const n = (list: Row[], k: string) => list.filter((r) => r.kind === k).length;

  out.push(`# جرد تسليمات تلغرام — من ${since} حتى ٢/٩/٢٠٢٦`);
  out.push("");
  out.push(`> مبني من تصدير تلغرام بتاريخ ٢/٩/٢٠٢٦. **قراءة فقط** — ما انلمست أي داتا.`);
  out.push("");
  out.push(`**قاعدة التصنيف** (القائدة، ٢/٩): أي صورة من غير فريق الديزاين هي **مادة**`);
  out.push(`للاستخدام لا إنجاز — السيلز والمصوّر والمونتير بيبعتوا ملفات مشان المصمّم`);
  out.push(`يشتغل عليها. فالتصميم بينحسب لما يبعتو مصمّم، والفيديو بينحسب لصاحبه.`);
  out.push(`و«تصميم بلا اسم» صورة من مصمّم شال تلغرام اسمها — بتنمطابق بالكابشن فقط.`);
  out.push("");
  out.push(`المجموع: **${rows.length}** ملف على **${byCo.size}** موضوع.`);
  out.push("");
  out.push(`| الشركة | تصميم | تصميم بلا اسم | فيديو | مادة | مستند | المجموع |`);
  out.push(`| --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
  for (const [co, list] of ordered) {
    out.push(
      `| ${co} | ${n(list, "تصميم")} | ${n(list, "تصميم بلا اسم")} | ${n(list, "فيديو")} | ${n(list, "مادة")} | ${n(list, "مستند")} | ${list.length} |`,
    );
  }
  out.push("");

  for (const [co, list] of ordered) {
    const bySender = new Map<string, number>();
    for (const r of list) bySender.set(`${r.from} (${r.role})`, (bySender.get(`${r.from} (${r.role})`) ?? 0) + 1);
    out.push(`## ${co}`);
    out.push("");
    out.push(
      `المرسلون: ${[...bySender.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ×${v}`)
        .join(" · ")}`,
    );
    out.push("");
    const first = list.reduce<Record<string, string>>((acc, r) => {
      if (!acc[r.file]) acc[r.file] = r.date;
      return acc;
    }, {});
    for (const kind of ["تصميم", "فيديو"]) {
      const named = [...new Set(list.filter((r) => r.kind === kind).map((r) => r.file))];
      if (!named.length) continue;
      out.push(`**${kind} (${named.length}):**`);
      out.push("");
      for (const f of named) out.push(`- \`${f}\` — ${first[f]}`);
      out.push("");
    }
    const material = n(list, "مادة");
    const anon = n(list, "تصميم بلا اسم");
    if (material || anon) {
      out.push(`ومعها ${material} مادة للاستخدام و${anon} تصميم بلا اسم.`);
      out.push("");
    }
  }

  console.log(out.join("\n"));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
