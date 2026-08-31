import { NextResponse } from "next/server";
import { applyCompanyPlanUpdate } from "@/server/actions/plans";

/** Admin-session endpoint used by verified plan imports. The action performs
 * its own cryptographic admin check and validates the complete payload before
 * writing anything. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON غير صالح" }, { status: 400 });
  }
  const result = await applyCompanyPlanUpdate(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
