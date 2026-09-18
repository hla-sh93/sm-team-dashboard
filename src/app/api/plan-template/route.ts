/**
 * تنزيل قالب خطة الشهر فارغاً — بينبنى لحظة الطلب من داتا الشركة.
 *
 * القائدة (١٨/٩): «خلي كرت حتى نوال تحمل منها قالب خطة الشهر فارغ».
 *
 * مو ملفاً محفوظاً: اسم الشركة ودورتها وعدد قطعها بتتغيّر، والقالب المحفوظ
 * بيتقادم بصمت. وجداوله بتنحط حسب العقد، فشركة بلا ستوريز ما بتشوف جدول
 * ستوريز فاضي يغري بالتعبئة.
 */
import { NextResponse } from "next/server";
import { Packer } from "docx";
import { prisma } from "@/lib/db";
import { companySlug } from "@/lib/asset-name";
import { currentCycleBucket, cycleForBucket } from "@/lib/contract";
import { formatDateShort } from "@/lib/dates";
import { buildPlanTemplate } from "@/lib/plan-template";
import { withArabicDefaults } from "@/lib/docx-rtl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // بلا بوابة أدمن **عن قصد**: منطقة الموظفين مفتوحة بلا تسجيل دخول بقرار
  // التصميم («منطقة الموظفين لا تتطلب دخولاً — هذه الحماية للوحة الإدارة
  // فقط»)، وكل محتوى هالملف — السكريبت والكابشن والمواعيد — معروض أصلاً
  // بصفحة المهام المفتوحة. حجب الملف وحده كان بيمنع نوال من شغلها بلا ما
  // يخفي شي.
  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "الشركة مطلوبة" }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });
  if (!company.managed) {
    return NextResponse.json({ error: "هذه الشركة تصميم-فقط، ولا خطة محتوى لها" }, { status: 409 });
  }

  const bucket = currentCycleBucket(company, new Date());
  const cycle = bucket ? cycleForBucket(company, bucket.year, bucket.month) : null;
  const doc = buildPlanTemplate({
    company: company.name,
    cycleLabel: cycle
      ? `${formatDateShort(cycle.start)} ← ${formatDateShort(new Date(cycle.end.getTime() - 86_400_000))}`
      : null,
    plan: {
      posts: company.posts,
      reels: company.reels,
      stories: company.stories,
      aiReels: company.aiReels,
    },
  });
  const file = await withArabicDefaults(await Packer.toBuffer(doc));
  const slug = companySlug(company);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(slug)}-plan-template.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
