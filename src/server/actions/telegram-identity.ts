"use server";

import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { revalidateAll } from "@/lib/revalidate";
import { sendMessage } from "@/lib/telegram/client";
import { rematchStoredMessage } from "@/lib/telegram/ingest";
import { SENDER_WINDOW_DAYS } from "@/server/telegram-identity";

/**
 * ربط مرسِل تلغرام بموظف من الواجهة (القائدة ٢٩/١٠). المعرّف الرقمي هو الهوية الثابتة يلي
 * بيقراها البوت أول شي (`resolveSender`)؛ بعد الربط ملفات المرسِل المعلّقة بتقدر تاخد جولة مطابقة.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard(): Promise<string | null> {
  try {
    await assertAdmin();
    return null;
  } catch {
    return "غير مصرّح";
  }
}

const pendingWhere = (senderId: string) => ({
  senderId,
  confirmed: false,
  kind: { not: "TEXT" },
  sentAt: { gte: new Date(Date.now() - SENDER_WINDOW_DAYS * 86_400_000) },
});

export async function linkTelegramSender(employeeId: string, senderId: string): Promise<Result<{ pending: number }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  if (!/^\d{3,15}$/.test(senderId ?? "")) return { ok: false, error: "معرّف تلغرام غير صالح" };
  const [employee, holder] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true, telegramUserId: true } }),
    prisma.employee.findFirst({ where: { telegramUserId: senderId }, select: { id: true, name: true } }),
  ]);
  if (!employee) return { ok: false, error: "الموظف غير موجود" };
  if (holder && holder.id !== employee.id) return { ok: false, error: `هالحساب مربوط أصلاً بـ«${holder.name}»` };
  if (employee.telegramUserId && employee.telegramUserId !== senderId) {
    return { ok: false, error: `«${employee.name}» مربوط بحساب تاني — غيّريه من «تعديل» إذا قصدك تبديله` };
  }
  await prisma.employee.update({ where: { id: employee.id }, data: { telegramUserId: senderId } });
  const pending = await prisma.telegramMessage.count({ where: pendingWhere(senderId) });
  revalidateAll();
  return { ok: true, pending };
}

/**
 * جولة مطابقة لملفات مرسِل ما سكّرت شي — نفس مسار البوت الحي (`rematchStoredMessage`): نفس قواعد
 * الاسم والسكّر لصاحب الكرت (D3)، وبوقت الإرسال الأصلي. `expected` = العدد يلي شافته المسؤولة —
 * إذا تغيّر بالنص (وصلت ملفات جديدة) بيرفض بدل ما يطابق شي ما شافته.
 */
export async function rematchSenderFiles(
  senderId: string,
  expected: number,
): Promise<Result<{ matched: number; tried: number }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const rows = await prisma.telegramMessage.findMany({
    where: pendingWhere(senderId),
    select: { id: true },
    orderBy: { sentAt: "asc" },
  });
  if (rows.length !== expected) {
    return { ok: false, error: `العدد تغيّر (${expected} ← ${rows.length}) — حدّثي الصفحة وأعيدي` };
  }
  let matched = 0;
  for (const r of rows) {
    const by = await rematchStoredMessage(r.id);
    if (by && by !== "PUBLISH") matched++;
  }
  revalidateAll();
  return { ok: true, matched, tried: rows.length };
}

/** رسالة خاصة من البوت للموظف — بتنجح بس إذا الموظف بعت /start للبوت مرّة. */
export async function sendTelegramTest(employeeId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true, telegramUserId: true } });
  if (!e?.telegramUserId) return { ok: false, error: "ما في معرّف تلغرام لهالموظف" };
  const r = await sendMessage(e.telegramUserId, `أهلاً ${e.name} — حسابك مربوط بلوحة فريق السوشال ميديا ✅`, {
    silent: true,
  });
  if (r.ok) return { ok: true };
  return {
    ok: false,
    error: /chat not found|bot can't initiate|blocked/i.test(r.error)
      ? "الربط محفوظ، بس البوت ما بيقدر يبعتله — لازم الموظف يبعت /start للبوت مرّة"
      : `ما انبعتت: ${r.error}`,
  };
}
