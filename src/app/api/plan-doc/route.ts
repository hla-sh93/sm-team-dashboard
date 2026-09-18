/**
 * تصدير خطة شركة كملف Word — من اللوحة، بالتواريخ الحيّة.
 *
 * القائدة (٤/٩): «بدي التطبيق يدير التواريخ وأقدر أصدّره من اللوحة أي وقت
 * أدخّل تاريخ نشر (للشركات النشطة)».
 *
 * فما في تواريخ مكتوبة بالإيد ولا سكربت خارجي: كل شي بينقرا من الكروت لحظة
 * الطلب. الشركة يلي ما إلها تاريخ بدء نشر بينرفض تصديرها — ما إلها دورة أصلاً،
 * والملف بلا دورة بيوهم إنّ في جدول وما في.
 */
import { NextResponse } from "next/server";
import { Packer } from "docx";
import { prisma } from "@/lib/db";
import { cycleForBucket, currentCycleBucket } from "@/lib/contract";
import { companySlug } from "@/lib/asset-name";
import { DONE_STATUSES } from "@/lib/constants";
import { buildPlanDoc, type PlanDocRow } from "@/lib/plan-doc";

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
  if (!company.publishStartDate) {
    return NextResponse.json(
      { error: "ما في تاريخ بدء نشر لهالشركة — حطّي التاريخ أولاً وبعدها صدّري." },
      { status: 409 },
    );
  }

  const bucket = currentCycleBucket(company, new Date());
  if (!bucket) {
    return NextResponse.json({ error: "ما في دورة شغّالة لهالشركة" }, { status: 409 });
  }
  const cycle = cycleForBucket(company, bucket.year, bucket.month);
  if (!cycle) return NextResponse.json({ error: "ما في دورة شغّالة لهالشركة" }, { status: 409 });

  const tasks = await prisma.task.findMany({
    where: {
      companyId,
      year: bucket.year,
      month: bucket.month,
      type: { not: null },
      status: { not: "CANCELED" },
    },
    include: { assignee: { select: { name: true } } },
  });

  // القطعة صفّ واحد: مرحلة النشر بتحمل التاريخ والحالة، ومراحل الإنتاج بتحمل
  // يوم الجهوزية. الجمع بالـpipelineKey مشان ما تنفصل القطعة عن نفسها.
  const done = (t: { board: string; status: string }) =>
    t.board === "DONE" || DONE_STATUSES.includes(t.status as never);

  const rows: PlanDocRow[] = [];
  for (const publish of tasks.filter((t) => t.stage === "PUBLISH")) {
    const production = tasks.filter((t) => t.pipelineKey && t.pipelineKey === publish.pipelineKey && t.stage !== "PUBLISH");
    const ready = production.length > 0 && production.every(done);
    const readyDate = production
      .map((t) => t.readyDate ?? t.workDate)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    rows.push({
      type: publish.type!,
      pieceNo: publish.pieceNo,
      // الوصف بينحط على كل مراحل القطعة، فأي مرحلة فيها نصّ بتكفي.
      brief: publish.brief ?? production.find((t) => t.brief?.trim())?.brief ?? null,
      readyDate,
      publishDate: publish.publishDate,
      owner: publish.assignee?.name ?? null,
      state: publish.status === "PUBLISHED" ? "منشور" : ready ? "جاهز للنشر" : "غير منجز",
    });
  }

  const slug = companySlug(company);
  const doc = buildPlanDoc({
    company: company.name,
    slug,
    cycleStart: cycle.start,
    cycleEnd: new Date(cycle.end.getTime() - 86_400_000), // نهاية الدورة حصرية
    plan: { posts: company.posts, reels: company.reels, stories: company.stories, aiReels: company.aiReels },
    rows,
    generatedAt: new Date(),
  });

  const buffer = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(slug)}-plan.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
