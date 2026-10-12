/**
 * الملخّص الأسبوعي للنشر (§14).
 *
 * القائدة (2026-08-08): «يصير البوت يبعت على الGeneral كل اسبوع ما سيتم نشره
 * حسب الأيام».
 *
 * بينبعت **الخميس** عن الأسبوع الجاي (`?next=1`) حتى الفريق يشوف جدوله قبل
 * ما يبلّش، لا بعد ما يمرق نصّه. وهي الرسالة الوحيدة يلي بتنزل بالمجموعة —
 * كل الباقي بيروح لخاصّ القائدة.
 */
import { NextResponse } from "next/server";
import { sendWeeklyPublishDigest } from "@/lib/telegram/service";
import { bearerMatches } from "@/lib/secret-compare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret)
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  if (!bearerMatches(auth, secret))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  // الافتراضي **الأسبوع الجاي**: الرسالة بتنبعت الخميس، ونشرة نفس الأسبوع
  // بتكون خلصت. `?next=0` بترجّع أسبوع اليوم للمعاينة.
  const next = new URL(req.url).searchParams.get("next") !== "0";
  const res = await sendWeeklyPublishDigest(new Date(), { next });
  return NextResponse.json({ ...res, next }, { status: res.ok ? 200 : 500 });
}
