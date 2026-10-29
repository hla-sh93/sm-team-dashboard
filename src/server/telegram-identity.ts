/**
 * «مرسلون غير معروفين» — مين بيبعت على مجموعات تلغرام والبوت ما بيعرف مين هو.
 *
 * القائدة (٢٩/١٠): «أنا لهلأ تلغرام يمكن ما عم يربط اسم ليلاس صح؟». الربط كان بسكربتات بس، وفحص
 * ١٢/١٠ (DA-05) لقى «Lilas» بلا موظف — ملفاتها بتتخزّن «من غير صاحب الكرت» وما بتسكّر شي. هالقائمة
 * بتطلّع كل مرسِل معرّفه الرقمي مو مربوط بموظف، مع آخر ملف وعدد الملفات المعلّقة، حتى ينربط بنقرة.
 */
import { prisma } from "@/lib/db";

export type TelegramSenderRow = {
  senderId: string;
  senderName: string | null;
  messages: number;
  /** ملفات ما سكّرت شي (ما انطابقت، أو انحجزت) — رح تاخد جولة مطابقة بعد الربط. */
  pendingFiles: number;
  lastAt: string;
  lastFile: string | null;
  /** الموظف يلي بيطابق اسمه الظاهر (اسم بديل) — معروف بالاسم بس، والمعرّف مو مثبّت. */
  byNameEmployeeId: string | null;
};

const norm = (s: string) => s.normalize("NFKC").replace(/^@/, "").replace(/\s+/g, " ").trim().toLowerCase();

export const SENDER_WINDOW_DAYS = 90;

export async function loadUnknownTelegramSenders(now: Date = new Date()): Promise<TelegramSenderRow[]> {
  const since = new Date(now.getTime() - SENDER_WINDOW_DAYS * 86_400_000);
  const [employees, messages] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, telegramUserId: true, telegramAliases: true } }),
    prisma.telegramMessage.findMany({
      where: { sentAt: { gte: since }, senderId: { not: null } },
      select: { senderId: true, senderName: true, sentAt: true, kind: true, fileName: true, confirmed: true },
      orderBy: { sentAt: "desc" },
    }),
  ]);
  const linked = new Set(employees.map((e) => e.telegramUserId).filter(Boolean));
  const byAlias = (name: string | null) => {
    if (!name) return null;
    const hits = employees.filter((e) =>
      (e.telegramAliases ?? "").split(",").map(norm).filter(Boolean).includes(norm(name)),
    );
    return hits.length === 1 ? hits[0].id : null;
  };
  const rows = new Map<string, TelegramSenderRow>();
  for (const m of messages) {
    if (!m.senderId || linked.has(m.senderId)) continue;
    let row = rows.get(m.senderId);
    if (!row) {
      row = {
        senderId: m.senderId,
        senderName: m.senderName,
        messages: 0,
        pendingFiles: 0,
        lastAt: m.sentAt.toISOString(),
        lastFile: null,
        byNameEmployeeId: byAlias(m.senderName),
      };
      rows.set(m.senderId, row);
    }
    row.messages++;
    if (m.kind !== "TEXT") {
      if (!m.confirmed) row.pendingFiles++;
      row.lastFile ??= m.fileName ?? m.kind;
    }
  }
  return [...rows.values()].sort((a, b) => b.pendingFiles - a.pendingFiles || b.lastAt.localeCompare(a.lastAt));
}
