/**
 * Morning brief cron (§14).
 *
 * Vercel calls this once a day (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. It sends the brief to the LEAD's
 * private chat only — she forwards what she wants to the company groups, so
 * nothing machine-written ever lands in a client conversation.
 */
import { NextResponse } from "next/server";
import { sendDailyBrief } from "@/lib/telegram/service";

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

  const res = await sendDailyBrief();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
