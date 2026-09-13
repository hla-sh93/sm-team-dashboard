/**
 * ليش ما انلقط الملف؟
 *
 * بيعيد تشغيل المطابِق على كل ملف مخزَّن غير مطابق وبيطلّع **السبب الفعلي** لكل
 * واحد، مصنَّفاً. بيقرا وبس — ما بيكتب ولا حرف على الداتا.
 *
 * ليش لزم: «البوت ما عم يلقط الملفات» سؤال ما إله جواب واحد — في ثمان أسباب
 * مختلفة تماماً (اسم ما بينقرا · شركة بلا كروت مفتوحة · إعادة إرسال · توبيك مو
 * مربوط…)، وكل واحد إله حلّ غير. بلا هالتصنيف كان التشخيص تخمين.
 *
 *   npx tsx scripts/why-unmatched.ts
 *
 * ⚠️ بيقيس على حالة الكروت **اليوم** لا وقت الإرسال، فملف ما طابق وقتها ممكن
 * يطلع «كان لازم يطابق» لأنّ الكرت انفتح بعدين — والعكس.
 */
import { PrismaClient } from "@prisma/client";
import { matchDelivery, parseOffPlanKeywords } from "@/lib/telegram/match";
import { parseAssetName, companySlug, slugMatches } from "@/lib/asset-name";
import { currentCycleBucket } from "@/lib/contract";
import { isTaskDoneState } from "@/lib/constants";

const p = new PrismaClient();
const PRODUCTION_STAGES = ["DESIGN", "SHOOT", "EDIT", "WRITE"];
const L = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "—");

type Reason = { code: string; detail: string };

(async () => {
  const companies = await p.company.findMany();
  const coById = new Map(companies.map((c) => [c.id, c]));
  const employees = await p.employee.findMany();

  // القائدة (١٣/٩): «يلي بيهمّ مطابقته هو المرسَل من التصميم أو المونتاج —
  // الباقي غالباً داتا داخلية». فالقياس بينحصر فيهن.
  const PRODUCERS = new Set(["Ayman", "Sabine", "Elissar"]);
  const msgs = (
    await p.telegramMessage.findMany({
      where: { kind: { in: ["PHOTO", "VIDEO", "DOCUMENT"] }, taskId: null },
      orderBy: { sentAt: "desc" },
    })
  ).filter((m) => (process.env.ALL ? true : PRODUCERS.has(m.senderName ?? "")));

  const byReason = new Map<string, { n: number; rows: string[] }>();
  const push = (r: Reason, line: string) => {
    const e = byReason.get(r.code) ?? { n: 0, rows: [] };
    e.n++;
    e.rows.push(line);
    byReason.set(r.code, e);
  };

  for (const m of msgs) {
    const co = m.companyId ? coById.get(m.companyId) : null;
    const label = `${L(m.sentAt)} · ${String(co?.name ?? "بلا شركة").padEnd(22)} · ${String(m.senderName ?? "—").padEnd(15)} · ${(m.fileName ?? m.caption?.replace(/\s+/g, " ").slice(0, 34) ?? "(بلا اسم)").slice(0, 40)}`;

    if (!co) {
      push({ code: "١· توبيك مو مربوط بشركة", detail: "" }, label);
      continue;
    }

    const all = await p.task.findMany({
      where: {
        companyId: co.id,
        kind: { in: ["CONTENT", "CONTENT_WRITING", "ADHOC"] },
        stage: { in: PRODUCTION_STAGES },
        status: { not: "CANCELED" },
      },
    });
    const candidates = all.filter(
      (t) => t.board !== "DONE" && !isTaskDoneState(t) && t.status !== "READY" && t.status !== "PUBLISHED",
    );
    const closed = all.filter((t) => !candidates.includes(t));

    if (!candidates.length) {
      push({ code: "٢· ما ضل ولا كرت مفتوح بالشركة", detail: "" }, label);
      continue;
    }

    const delivery = {
      id: m.id,
      chatId: m.chatId,
      messageId: m.messageId,
      sentAt: m.sentAt,
      senderId: m.senderId,
      senderName: m.senderName,
      kind: m.kind,
      fileName: m.fileName,
      caption: m.caption,
      fileId: m.fileId,
      mediaGroupId: m.mediaGroupId,
    } as never;

    const sender = m.senderId ? employees.find((e) => e.telegramUserId === m.senderId) : null;
    const res = matchDelivery(
      delivery,
      companySlug(co),
      candidates as never,
      parseOffPlanKeywords(co.offPlanKeywords),
      closed as never,
      currentCycleBucket(co as never, m.sentAt),
      undefined,
      sender?.id ?? null,
    );

    if (res) {
      push({ code: "★ كان لازم يطابق — بيطابق هلق", detail: "" }, `${label}   ← ${res.by}`);
      continue;
    }

    // ما طابق. ليش؟
    const parsed =
      parseAssetName(m.fileName) ??
      parseAssetName(m.caption) ??
      parseAssetName(`${companySlug(co)} ${m.fileName ?? m.caption ?? ""}`);

    if (m.kind === "DOCUMENT") {
      push({ code: "٣· ملف (docx/pdf) وما في كرت كتابة مفتوح", detail: "" }, label);
      continue;
    }
    if (!parsed) {
      const hasBriefs = candidates.some((t) => t.brief?.trim());
      push(
        {
          code: hasBriefs
            ? "٤· اسم ما بينقرا + ما طابق ولا وصف بالخطة"
            : "٥· اسم ما بينقرا وما في أوصاف بالخطة",
          detail: "",
        },
        label,
      );
      continue;
    }
    if (!slugMatches(parsed.slug, companySlug(co))) {
      // هل الاسم بينقرا صح لو حطّينا اسم الشركة قدّامه؟ إذا أي، فالسلَق المقروء
      // كلمة نوع (story/post/reel) انقرأت غلطاً كاسم شركة — وهاد يلي قطع الطريق.
      const prefixed = parseAssetName(`${companySlug(co)} ${m.fileName ?? m.caption ?? ""}`);
      push(
        {
          code: prefixed
            ? "٦أ· كلمة النوع انقرأت كاسم شركة (قابل للإصلاح)"
            : "٦ب· الاسم بيسمّي شركة تانية",
          detail: parsed.slug,
        },
        `${label}   (سلَق=${parsed.slug}${prefixed ? ` ← المفروض ${companySlug(co)} ق${prefixed.readings[0]?.pieceNo}` : ""})`,
      );
      continue;
    }
    if (m.mediaGroupId) {
      const sib = await p.telegramMessage.findFirst({
        where: { mediaGroupId: m.mediaGroupId, chatId: m.chatId, taskId: { not: null } },
      });
      if (sib) {
        push({ code: "٩· شريحة تانية من كاروسيل انلقط أصلاً (سليم)", detail: "" }, label);
        continue;
      }
    }
    const readings = parsed.readings.map((r) => `ش${r.month0 + 1}/ق${r.pieceNo}`).join(" أو ");
    const closedHit = parsed.readings.some((r) =>
      closed.some((t) => t.month === r.month0 && t.pieceNo === r.pieceNo),
    );
    push(
      { code: closedHit ? "٧· القطعة مسلَّمة من قبل (إعادة إرسال)" : "٨· الاسم بيسمّي قطعة مو مفتوحة", detail: "" },
      `${label}   (${readings})`,
    );
  }

  console.log(`■ ملفات مخزَّنة وغير مطابقة: ${msgs.length}\n`);
  for (const [code, e] of [...byReason.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`\n── ${code} — ${e.n} ملف`);
    for (const r of e.rows.slice(0, 14)) console.log(`   ${r}`);
    if (e.rows.length > 14) console.log(`   … و${e.rows.length - 14} غيرها`);
  }
  await p.$disconnect();
})();
