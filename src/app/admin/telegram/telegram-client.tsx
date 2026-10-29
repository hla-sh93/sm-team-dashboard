"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Send, MessageCircle, RefreshCw, BellRing } from "lucide-react";
import { Select, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import {
  linkChatToCompany,
  markChatAsTeam,
  sendBriefNow,
  setBriefRecipient,
  setUnblockNotify,
} from "@/server/actions/telegram";
import type { DailyBrief } from "@/lib/telegram/brief";
import type { Company, TelegramChat, TelegramMessage } from "@/types";

export default function TelegramClient({
  configured,
  chats,
  companies,
  leadChatId,
  recent,
  brief,
  unblockNotify,
  linkedEmployees,
}: {
  configured: boolean;
  chats: TelegramChat[];
  companies: Company[];
  leadChatId: string | null;
  recent: TelegramMessage[];
  brief: DailyBrief;
  unblockNotify: boolean;
  linkedEmployees: number;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [chatInput, setChatInput] = useState(leadChatId ?? "");
  const [tab, setTab] = useState<"main" | "companies" | "employees">("main");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(okMsg);
        router.refresh();
      } else toast(r.error ?? "فشل", "error");
    });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast("تم النسخ"),
      () => toast("تعذّر النسخ", "error"),
    );
  };

  // الصبح بتنبعت رسالة التوزيع وحدها (١٦/٩)؛ تقرير القائد والتفاصيل هون
  // للمعاينة والإرسال عند الطلب فقط.
  const messages =
    tab === "main"
      ? [brief.schedule, brief.lead]
      : tab === "companies"
        ? [brief.detail, ...brief.companies]
        : brief.employees;

  return (
    <div className="flex flex-col gap-6">
      <header className="border-t-4 border-accent pt-3 -mt-3 rounded">
        <h1 className="display-font text-2xl flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
          تلغرام — المتابعة والبريف الصباحي
        </h1>
        <p className="text-sm text-fg-dim">
          البوت بيراقب مجموعات الشركات ويسجّل شو انبعت. البريف الصباحي بيوصل لمحادثتك
          الخاصة بس — إنتِ اللي بتوجّهيه، ما في رسالة بتطلع من التطبيق لأي مجموعة.
        </p>
      </header>

      {!configured && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-semibold text-warning mb-1">البوت لسا غير مضبوط</p>
          <ol className="list-decimal pr-5 text-[12px] text-fg-dim flex flex-col gap-0.5">
            <li>افتحي @BotFather بتلغرام → /newbot → خدي التوكن.</li>
            <li>@BotFather → /setprivacy → Disable (لحتى يشوف رسائل المجموعات).</li>
            <li>
              حطّي التوكن بمتغيّر <span className="font-mono">TELEGRAM_BOT_TOKEN</span> و
              <span className="font-mono"> TELEGRAM_WEBHOOK_SECRET</span> عند Vercel.
            </li>
            <li>ضيفي البوت لكل مجموعة شركة، وابعتيله /start بمحادثة خاصة.</li>
          </ol>
        </div>
      )}

      {/* Brief recipient */}
      <section className="rounded-lg border border-border bg-bg-elev p-3 flex flex-col gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Send className="w-4 h-4 text-accent" /> وجهة البريف الصباحي
        </h2>
        <p className="text-[11px] text-fg-muted">
          ابعتي «/start» للبوت من حسابك، وبعدها رح تلاقي محادثتك بجدول المجموعات تحت — انسخي
          الـchat id وحطّيه هون. بيوصلك توزيع المهام كل صباح ٧:٤٥ وتقرير الإنجاز كل مساء ٨:٠٠.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Input
            className="h-9 w-48 text-sm font-mono"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="123456789"
          />
          <button
            disabled={busy}
            onClick={() => run(() => setBriefRecipient(chatInput), "تم الحفظ")}
            className="h-9 px-3 rounded-md bg-accent text-bg text-sm disabled:opacity-50"
          >
            حفظ
          </button>
          <button
            disabled={busy || !leadChatId}
            onClick={() => run(sendBriefNow, "انبعت البريف")}
            className="h-9 px-3 rounded-md border border-border text-sm hover:bg-bg disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> ابعتيلي البريف هلق
          </button>
        </div>
      </section>

      {/* «صار جاهز إلك» */}
      <section className="rounded-lg border border-border bg-bg-elev p-3 flex flex-col gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BellRing className="w-4 h-4 text-accent" /> إشعار «صار جاهز إلك»
          <span className={`text-[11px] rounded px-1.5 py-0.5 ${unblockNotify ? "bg-success/15 text-success" : "bg-bg text-fg-muted"}`}>
            {unblockNotify ? "شغّال" : "مطفي"}
          </span>
        </h2>
        <p className="text-[11px] text-fg-muted">
          لما تنسكّر مرحلة (تصوير، تصميم…) البوت بيبعت رسالة خاصة وحدة لصاحب المرحلة الجاية فيها الكروت يلي صارت
          جاهزة إله. كل كرت مرّة وحدة بس، وما بيبعت للشخص عن شغله هو، وبرّا ساعات الدوام (٩–٦ وأيام العطلة) بتوصل
          صامتة. بتوصل بس للموظفين المربوطين يلي بعتوا /start للبوت — هلّق {linkedEmployees} مربوطين.
        </p>
        <div>
          <button
            disabled={busy}
            onClick={() =>
              run(() => setUnblockNotify(!unblockNotify), unblockNotify ? "انطفى الإشعار" : "اشتغل الإشعار")
            }
            className={`h-9 px-3 rounded-md text-sm disabled:opacity-50 ${
              unblockNotify ? "border border-border hover:bg-bg" : "bg-accent text-bg"
            }`}
          >
            {unblockNotify ? "طفّيه" : "شغّليه"}
          </button>
        </div>
      </section>

      {/* Chats ↔ companies */}
      <section className="rounded-lg border border-border bg-bg-elev p-3">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-accent" /> ربط المواضيع بالشركات
        </h2>
        <p className="text-[11px] text-fg-muted mb-2">
          مجموعتكم بنظام Topics — كل شركة موضوع مستقل. تلغرام ما بيرسل اسم الموضوع
          مع كل رسالة، فإذا ظهر رقم بدل الاسم اعرفيه من آخر رسالة واربطيه.
        </p>
        {chats.length === 0 ? (
          <p className="text-[12px] text-fg-muted">
            ما وصلت أي رسالة بعد. ابعتي أي رسالة بكل موضوع لتظهر هون.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[620px]">
              <thead className="text-fg-muted">
                <tr className="text-right">
                  <th className="py-1.5 font-medium">الموضوع / المحادثة</th>
                  <th className="py-1.5 font-medium">آخر رسالة</th>
                  <th className="py-1.5 font-medium">المعرّف</th>
                  <th className="py-1.5 font-medium">الشركة</th>
                  <th className="py-1.5 font-medium">فريق</th>
                </tr>
              </thead>
              <tbody>
                {chats.map((c) => (
                  <tr key={c.id} className="border-t border-border-soft">
                    <td className="py-1.5 truncate max-w-[160px]">
                      {c.title ??
                        (c.type === "private"
                          ? "محادثة خاصة"
                          : c.threadId != null
                            ? `موضوع #${c.threadId}`
                            : "—")}
                    </td>
                    <td className="py-1.5 truncate max-w-[160px] text-fg-muted">
                      {c.lastText ?? "—"}
                    </td>
                    <td className="py-1.5 font-mono text-[11px]">
                      <button
                        onClick={() => copy(c.chatId)}
                        className="hover:text-accent flex items-center gap-1"
                        title="نسخ chat id"
                      >
                        {c.threadId != null ? `#${c.threadId}` : c.chatId}{" "}
                        <Copy className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="py-1.5">
                      <Select
                        className="h-7 text-[11px] py-0 w-36"
                        value={c.companyId ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          run(
                            () => linkChatToCompany(c.id, e.target.value || null),
                            "تم الربط",
                          )
                        }
                      >
                        <option value="">— غير مربوطة —</option>
                        {companies.map((co) => (
                          <option key={co.id} value={co.id}>
                            {co.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={c.isTeam}
                        disabled={busy || c.companyId != null}
                        onChange={(e) => run(() => markChatAsTeam(c.id, e.target.checked), "تم")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Brief preview */}
      <section className="rounded-lg border border-border bg-bg-elev p-3">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-accent" /> معاينة بريف {brief.dateLabel}
          </h2>
          <div className="flex gap-1 bg-bg border border-border rounded-lg p-1">
            {(
              [
                ["main", "العام ٧:٤٥"],
                ["companies", `شركات (${brief.companies.length})`],
                ["employees", `موظفين (${brief.employees.length})`],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={
                  "px-3 py-1 rounded-md text-[11px] " +
                  (tab === k ? "bg-accent text-bg" : "text-fg-dim hover:text-fg")
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {messages.length === 0 ? (
          <p className="text-[12px] text-fg-muted">ما في رسائل لهالقسم اليوم.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            {messages.map((m) => (
              <div key={m.key} className="rounded-md border border-border-soft bg-bg p-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold truncate">{m.title}</span>
                  <button
                    onClick={() => copy(m.text)}
                    className="text-fg-muted hover:text-accent shrink-0"
                    title="نسخ الرسالة"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="text-[11px] whitespace-pre-wrap font-sans text-fg-dim leading-relaxed">
                  {m.text}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent traffic */}
      <section className="rounded-lg border border-border bg-bg-elev p-3">
        <h2 className="text-sm font-semibold mb-2">آخر الرسائل المسجّلة</h2>
        {recent.length === 0 ? (
          <p className="text-[12px] text-fg-muted">لا شيء بعد.</p>
        ) : (
          <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto">
            {recent.map((m) => (
              <div key={m.id} className="text-[11px] flex items-center gap-2 border-b border-border-soft pb-1">
                <span className="text-fg-muted shrink-0">
                  {new Date(m.sentAt).toLocaleString("ar", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="truncate flex-1">
                  {m.fileName || m.caption?.slice(0, 60) || `[${m.kind}]`}
                </span>
                <span className="text-fg-muted shrink-0">{m.senderName ?? "—"}</span>
                {m.matchedBy === "PUBLISH" ? (
                  <span className="text-success shrink-0">تأكيد نشر</span>
                ) : m.matchedBy === "NOT_OWNER" ? (
                  <span className="text-warning shrink-0">من غير صاحب الكرت</span>
                ) : m.matchedBy === "WRONG_TOPIC" ? (
                  <span className="text-warning shrink-0">باسم شركة تانية</span>
                ) : m.taskId && m.confirmed ? (
                  <span className="text-success shrink-0">مطابق</span>
                ) : m.kind !== "TEXT" ? (
                  <span className="text-warning shrink-0">غير مطابق</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
