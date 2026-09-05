/**
 * جرد مواعيد التصوير — الأحد، بداية الأسبوع.
 *
 * القائدة (٥/٩/٢٠٢٦): «بدي تقرير بالمواعيد للتصوير مشان نخبر فريق السيلز يحجز
 * مواعيد من أول الأسبوع». بيروح لخاصّها متل البريف — هي بتوزّع على السيلز.
 */
import { NextResponse } from "next/server";
import { sendShootAppointments } from "@/lib/telegram/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret)
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const res = await sendShootAppointments(new Date());
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
