import { prisma } from "@/lib/db";
import PublishingClient from "./publishing-client";

export default async function PublishingPage() {
  const [companies, items] = await Promise.all([
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.publishingItem.findMany({ orderBy: { publishDate: "asc" } }),
  ]);

  return (
    <div className="animate-fade-in">
      <div className="mb-7">
        <h1 className="display-font text-3xl font-semibold leading-tight">
          جدول النشر
        </h1>
        <p className="text-fg-dim mt-1.5">
          خطة النشر الشهرية على منصات التواصل — مسؤولية الناشر (عمر)
        </p>
      </div>
      <PublishingClient companies={companies} items={items} />
    </div>
  );
}
