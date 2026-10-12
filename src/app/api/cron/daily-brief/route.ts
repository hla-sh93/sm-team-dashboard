/**
 * Morning brief cron (§14).
 *
 * Vercel calls this once a day (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. It sends the brief to the LEAD's
 * private chat only — she forwards what she wants to the company groups, so
 * nothing machine-written ever lands in a client conversation.
 */
import { NextResponse } from "next/server";
import { sendDailyBrief, type BriefWave } from "@/lib/telegram/service";
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

  // One scheduled call a day (see vercel.json): ?wave=general at 07:45 — توزيع
  // المهام. ?wave=detail is on demand only (١٦/٩). An unrecognised value sends
  // everything, so a mis-typed cron entry can never silently drop a wave.
  const raw = new URL(req.url).searchParams.get("wave");
  const wave: BriefWave = raw === "general" || raw === "detail" ? raw : "all";

  const res = await sendDailyBrief(new Date(), wave);
  return NextResponse.json({ ...res, wave }, { status: res.ok ? 200 : 500 });
}
