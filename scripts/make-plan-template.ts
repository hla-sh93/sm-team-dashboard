/**
 * بيولّد قالب خطة المحتوى كملف Word لشركة (أو لكل الشركات النشطة).
 *
 *   npx tsx scripts/make-plan-template.ts                 # كل الشركات النشطة
 *   npx tsx scripts/make-plan-template.ts "التوظيف"       # شركة وحدة
 *
 * الملفات بتنزل بـ`tmp/plan-templates/`. القالب فاضي: العدد المتعاقد عليه ونصّ
 * الدورة بينقروا من الداتا، والباقي بتعبّيه نوال.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Packer } from "docx";
import { prisma } from "@/lib/db";
import { buildPlanTemplate } from "@/lib/plan-template";
import { companySlug } from "@/lib/asset-name";
import { currentCycleBucket, cycleForBucket } from "@/lib/contract";
import { formatDateShort } from "@/lib/dates";

async function main() {
  const wanted = process.argv.slice(2);
  const companies = await prisma.company.findMany({
    where: wanted.length ? { name: { in: wanted } } : { managed: true, status: "active" },
    orderBy: { priority: "asc" },
  });
  if (!companies.length) {
    console.error("ما في شركة مطابقة.");
    process.exit(1);
  }
  // مجلّد بديل لما يكون قالب مفتوح بـWord (الملف بيصير مقفولاً عن الكتابة).
  const dir = process.env.PLAN_TEMPLATE_DIR ?? "tmp/plan-templates";
  mkdirSync(dir, { recursive: true });
  for (const company of companies) {
    const bucket = currentCycleBucket(company, new Date());
    const cycle = bucket ? cycleForBucket(company, bucket.year, bucket.month) : null;
    const cycleLabel = cycle
      ? `${formatDateShort(cycle.start)} ← ${formatDateShort(new Date(cycle.end.getTime() - 86_400_000))}`
      : null;
    const doc = buildPlanTemplate({
      company: company.name,
      cycleLabel,
      plan: { posts: company.posts, reels: company.reels, stories: company.stories, aiReels: company.aiReels },
      minRows: 4,
    });
    const file = `${dir}/${companySlug(company)}-plan-template.docx`;
    writeFileSync(file, await Packer.toBuffer(doc));
    console.log(`✓ ${file}  — ${company.name}${cycleLabel ? ` · ${cycleLabel}` : " · بلا دورة"}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
