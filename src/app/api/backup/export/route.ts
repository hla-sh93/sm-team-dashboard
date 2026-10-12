/**
 * تصدير لقطة الداتا — المصدر الوحيد للنسخة الاحتياطية اليومية (١٢ ظهراً).
 *
 * ليش مسار HTTP: ما في وصول لقاعدة الإنتاج من جهاز الفريق، فالتطبيق هو يلي
 * بيصدّر. وليش مو كرون على Vercel: ملفات Vercel للقراءة فقط وقت التشغيل —
 * ما بيقدر يحفظ ملف أصلاً — والخطة المجانية بتأخّر الكرون لساعة. فالسحب
 * محلي، والمسار هون بيعطي الداتا لمين معه السرّ.
 *
 * الحماية: نفس سلوك الكرونات حرفياً — بلا `CRON_SECRET` ← 503 (فشل مغلق، مو
 * مفتوح)، بسرّ خاطئ ← 401. والمسار **قراءة فقط**: ما بيكتب ولا صف، وما بيقبل
 * إلا GET.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSnapshot } from "@/lib/backup";
import { bearerMatches } from "@/lib/secret-compare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret)
    return NextResponse.json({ ok: false, error: "backup_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  if (!bearerMatches(auth, secret))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const snapshot = await buildSnapshot(prisma as never, "vercel-postgres");
    return NextResponse.json(snapshot, {
      status: 200,
      // لقطة اليوم ما بتنكاش: كل سحب لازم يشوف الحالة اللحظية.
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    // التفصيل بالسجلّ بس: رسالة Prisma فيها اسم مضيف القاعدة ومستخدمها (SA-12).
    console.error("backup export failed", e);
    return NextResponse.json({ ok: false, error: "export_failed" }, { status: 500 });
  }
}
