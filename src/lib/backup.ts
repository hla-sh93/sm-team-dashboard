/**
 * لقطة الداتا — التصدير والتحقق والتدوير.
 *
 * القائدة (٢/٩/٢٠٢٦): «بدي backup يومي الساعة ١٢ ظهراً للداتا في Vercel
 * وتنزيلها على نسخة اللوكال حتى يصيرو متوافقين، مع الاحتفاظ فقط بآخر ٣ نسخ.
 * مابدي أي بيانات تروح».
 *
 * ليش المسار مو سحب مباشر من القاعدة: ما في وصول لقاعدة الإنتاج من جهاز
 * الفريق — القيم المسحوبة بـ`.env.production.local` مموّهة. فالتطبيق نفسه هو
 * يلي بيصدّر، عبر مسار محمي بنفس سرّ الكرونات وبنفس السلوك fail-closed.
 *
 * ⚠️ التواريخ: **ما منلمس** المنطقة الزمنية هون. مصدّر المحلي بيسقّط التواريخ
 * على منتصف ليل UTC لأنه بيرسل من جهاز GMT+3 لخادم UTC. بالاتجاه المعاكس
 * (إنتاج ← محلي) نفس العملية بتزحّط اليوم يوم للورا: تاريخ مكتوب محلياً
 * بيتخزّن 21:00Z لليوم السابق، وإعادة إسقاطه على خادم UTC بتخليه اليوم
 * السابق فعلاً. فمنمرّر اللحظة كما هي — الدورة كاملة بترجع نفس اليوم.
 */

export const SNAPSHOT_SCHEMA = "social-media-team-dashboard/v1";

/** مفاتيح الدخول ما بتنسخ أبداً: نسخة فيها هاش كلمة سرّ بيئة تانية بتقدر
 *  تستبدل مالك الحساب لو انستوردت بالغلط. */
export const AUTH_KEYS = new Set(["authSecret", "adminPasswordHash", "adminEmail"]);

export type SnapshotCounts = {
  employees: number;
  companies: number;
  tasks: number;
  photoSessions: number;
  settings: number;
};

export type Snapshot = {
  meta: {
    exportedAt: string;
    source: string;
    schema: string;
    counts: SnapshotCounts;
  };
  employees: unknown[];
  companies: unknown[];
  tasks: unknown[];
  photoSessions: unknown[];
  settings: unknown[];
};

type SnapshotSource = {
  employee: { findMany: (args: unknown) => Promise<unknown[]> };
  company: { findMany: (args: unknown) => Promise<unknown[]> };
  task: { findMany: (args: unknown) => Promise<unknown[]> };
  photoSession: { findMany: (args: unknown) => Promise<unknown[]> };
  setting: { findMany: (args: unknown) => Promise<unknown[]> };
};

/** يبني لقطة كاملة من أي عميل Prisma (الإنتاج أو المحلي). قراءة فقط. */
export async function buildSnapshot(db: SnapshotSource, source: string): Promise<Snapshot> {
  const [employees, companies, tasks, photoSessions, allSettings] = await Promise.all([
    db.employee.findMany({ orderBy: { id: "asc" } }),
    db.company.findMany({ orderBy: { id: "asc" } }),
    db.task.findMany({ orderBy: { id: "asc" } }),
    db.photoSession.findMany({ orderBy: { id: "asc" } }),
    db.setting.findMany({ orderBy: { key: "asc" } }),
  ]);
  const settings = (allSettings as { key: string }[]).filter((s) => !AUTH_KEYS.has(s.key));
  return {
    meta: {
      exportedAt: new Date().toISOString(),
      source,
      schema: SNAPSHOT_SCHEMA,
      counts: {
        employees: employees.length,
        companies: companies.length,
        tasks: tasks.length,
        photoSessions: photoSessions.length,
        settings: settings.length,
      },
    },
    employees,
    companies,
    tasks,
    photoSessions,
    settings,
  };
}

/** عدّ الصفوف الفعلي بالملف — مو يلي مكتوب بـ`meta` (لقطة مبتورة بتكذب). */
export function actualCounts(snapshot: Snapshot): SnapshotCounts {
  return {
    employees: snapshot.employees?.length ?? 0,
    companies: snapshot.companies?.length ?? 0,
    tasks: snapshot.tasks?.length ?? 0,
    photoSessions: snapshot.photoSessions?.length ?? 0,
    settings: snapshot.settings?.length ?? 0,
  };
}

export type AcceptDecision = { ok: true } | { ok: false; reason: string };

/**
 * حارس الانكماش. نسخة احتياطية بتنكتب فوق كارثة هي كارثة تانية: لقطة فاضية أو
 * ناقصة فجأة معناها خلل بالمصدر لا واقع جديد، فبتنرفض وما بينحذف ولا ملف.
 *
 * `shrinkTolerance` = كم مسموح تنقص النسبة (٠.٢ = ٢٠٪). النقص المشروع بيصير:
 * كروت بتنحذف مع إعادة التوليد. النقص الكارثي بيصير: جدول فاضي.
 */
export function acceptSnapshot(
  next: Snapshot,
  previous: Snapshot | null,
  shrinkTolerance = 0.2,
): AcceptDecision {
  if (next.meta?.schema !== SNAPSHOT_SCHEMA)
    return { ok: false, reason: `شكل لقطة غير معروف: ${next.meta?.schema ?? "بلا"}` };

  const counts = actualCounts(next);
  const declared = next.meta.counts;
  for (const key of Object.keys(counts) as (keyof SnapshotCounts)[]) {
    if (declared && declared[key] !== counts[key])
      return {
        ok: false,
        reason: `اللقطة مبتورة: ${key} مكتوب ${declared[key]} والموجود ${counts[key]}`,
      };
  }

  // الجداول الأساسية ما بيصير تكون فاضية — شركة أو موظف صفر يعني قاعدة تانية
  // أو استيراد فشل بالنصّ، لا يوم شغل عادي.
  for (const key of ["employees", "companies", "tasks"] as const) {
    if (counts[key] === 0) return { ok: false, reason: `جدول ${key} فاضي` };
  }

  if (!previous) return { ok: true };
  const before = actualCounts(previous);
  for (const key of Object.keys(counts) as (keyof SnapshotCounts)[]) {
    if (before[key] === 0) continue;
    const drop = (before[key] - counts[key]) / before[key];
    if (drop > shrinkTolerance)
      return {
        ok: false,
        reason: `${key} نقص من ${before[key]} لـ${counts[key]} (${Math.round(drop * 100)}٪ — الحدّ ${Math.round(shrinkTolerance * 100)}٪)`,
      };
  }
  return { ok: true };
}

/**
 * أي ملفات تنحذف بعد نجاح النسخة الجديدة. بترجّع الأقدم فقط بعد ما تخلّي
 * `keep` نسخة — والترتيب بالاسم لأن الاسم فيه التاريخ والساعة.
 *
 * ⚠️ ما بتلمس إلا اللقطات: نسخ `dev.db` الأمان برّا هالتدوير عن قصد، لأنها
 * الشبكة الأخيرة لو استيراد خرب المحلي.
 */
export function snapshotsToDelete(files: string[], keep = 3): string[] {
  const sorted = [...files].sort();
  return sorted.slice(0, Math.max(0, sorted.length - keep));
}
