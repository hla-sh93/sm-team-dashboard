/**
 * تقرير المنجَز اليومي (§14) — ٥ مساءً بتوقيت دمشق.
 *
 * القائدة (10/8): «الساعة 5 تماما بتوقيت سورية: ارسال تقرير العمل المنجز
 * اليومي لكل من عمر وحلا».
 *
 * دمشق UTC+3 صيفاً، فـ٥ مساءً = 14:00 UTC (شوف `vercel.json`) — نفس الفارق
 * يلي عليه البريف الصباحي (04:45 UTC ⇒ 07:45 دمشق).
 */
import { NextResponse } from "next/server";
import { sendDailyDoneReport } from "@/lib/telegram/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`)
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const res = await sendDailyDoneReport(new Date());
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
