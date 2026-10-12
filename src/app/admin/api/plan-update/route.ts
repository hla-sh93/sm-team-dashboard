import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { applyCompanyPlanUpdate } from "@/server/actions/plans";

/** Admin-session endpoint used by verified plan imports. The action performs
 * its own cryptographic admin check and validates the complete payload before
 * writing anything. */
export async function POST(request: Request) {
  // «غير مصرّح» = 401 قبل قراءة الجسم (كان 400 متل خطأ بالحمولة — SA-12). الفعل
  // نفسه بيعيد التحقّق كمان.
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "غير مصرّح" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON غير صالح" }, { status: 400 });
  }
  const result = await applyCompanyPlanUpdate(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
