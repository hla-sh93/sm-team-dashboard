/**
 * صفحة الشركات عند الموظفين — **للقراءة**، مع ملفات الخطة.
 *
 * القائدة (١٨/٩): «خلي الشركات تظهر للموظفين حتى يقدرو يشوفو الخطط ويعاينو
 * الملفات». فهون اسم الشركة وعقدها ومالكوها ودورتها، وأزرار الخطة الثلاثة:
 * تحميل القالب فارغاً، رفعه معبّى (نوال)، وتصدير الخطة بتواريخ النشر.
 *
 * وما فيها ولا زرّ من أزرار الإدارة: لا تعديل ولا حذف ولا تجديد ولا إيقاف نشر
 * ولا استيراد JSON. تلك قرارات عقود وبيانات، ومطرحها لوحة الإدارة.
 */
import { prisma } from "@/lib/db";
import { cycleForBucket, currentCycleBucket } from "@/lib/contract";
import { formatDateShort } from "@/lib/dates";
import { companyLifecycle } from "@/lib/company-visibility";
import CompaniesReadOnly from "./companies-readonly";

export const dynamic = "force-dynamic";

export default async function EmployeeCompaniesPage() {
  const [companies, employees] = await Promise.all([
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.employee.findMany({ select: { id: true, name: true } }),
  ]);
  const now = new Date();
  const rows = companies
    .filter((c) => c.managed && companyLifecycle(c) !== "archived")
    .map((company) => {
      const bucket = currentCycleBucket(company, now);
      const cycle = bucket ? cycleForBucket(company, bucket.year, bucket.month) : null;
      return {
        id: company.id,
        name: company.name,
        posts: company.posts,
        reels: company.reels,
        stories: company.stories,
        aiReels: company.aiReels,
        postOwnerId: company.postOwnerId,
        storyOwnerId: company.storyOwnerId,
        aiReelOwnerId: company.aiReelOwnerId,
        paused: companyLifecycle(company) === "paused",
        hasCycle: !!company.publishStartDate,
        cycleLabel: cycle
          ? `${formatDateShort(cycle.start)} ← ${formatDateShort(new Date(cycle.end.getTime() - 86_400_000))}`
          : null,
      };
    });
  return <CompaniesReadOnly rows={rows} employees={employees} />;
}
