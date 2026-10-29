"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, RefreshCw, UserX } from "lucide-react";
import { Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { linkTelegramSender, rematchSenderFiles } from "@/server/actions/telegram-identity";
import type { TelegramSenderRow } from "@/server/telegram-identity";
import type { Employee } from "@/types";

/**
 * «مرسلون غير معروفين» — حسابات بعتت على مجموعات تلغرام ومعرّفها مو مربوط بأي موظف. بلا ربط
 * البوت ما بيعرف مين بعت، فملفاته ما بتسكّر كروته (القائدة ٢٩/١٠ عن ليلاس).
 */
export default function TelegramSenders({ rows, employees }: { rows: TelegramSenderRow[]; employees: Employee[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [pick, setPick] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.senderId, r.byNameEmployeeId ?? ""])),
  );
  const [linked, setLinked] = useState<Record<string, number>>({});
  const name = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "";

  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-bg-elev p-3 text-sm text-fg-dim">
        كل يلي بعتوا على تلغرام آخر ٩٠ يوم مربوطين بموظفين ✓
      </section>
    );
  }

  const link = (r: TelegramSenderRow) => {
    const employeeId = pick[r.senderId];
    if (!employeeId) return toast("اختاري الموظف أول", "error");
    start(async () => {
      const res = await linkTelegramSender(employeeId, r.senderId);
      if (!res.ok) return toast(res.error, "error");
      toast(`انربط «${r.senderName ?? r.senderId}» بـ${name(employeeId)}`);
      setLinked((s) => ({ ...s, [r.senderId]: res.pending }));
    });
  };

  const rematch = (r: TelegramSenderRow) => {
    const expected = linked[r.senderId];
    start(async () => {
      const res = await rematchSenderFiles(r.senderId, expected);
      if (!res.ok) return toast(res.error, "error");
      toast(`انطابق ${res.matched} من ${res.tried} ملف`);
      router.refresh();
    });
  };

  return (
    <section className="rounded-lg border border-warning/40 bg-bg-elev p-3 flex flex-col gap-2">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <UserX className="w-4 h-4 text-warning" /> مرسلون غير معروفين على تلغرام ({rows.length})
      </h2>
      <p className="text-[11px] text-fg-muted">
        حسابات بعتت على المجموعات آخر ٩٠ يوم وما إلها موظف — البوت ما بيسكّر كروتها. اختاري الموظف واكبسي «اربط»،
        وبعدها «طابق ملفاته» لحتى ياخدوا جولة مطابقة بقواعد البوت نفسها.
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.senderId} className="flex flex-wrap items-center gap-2 text-sm border-b border-border/50 pb-1.5 last:border-0">
            <span className="font-semibold">{r.senderName ?? "بلا اسم"}</span>
            <span className="font-mono text-[11px] text-fg-muted" dir="ltr">
              {r.senderId}
            </span>
            <span className="text-[11px] text-fg-dim">
              {r.messages} رسالة · {r.pendingFiles} ملف معلّق
              {r.lastFile ? ` · آخر ملف: ${r.lastFile}` : ""}
            </span>
            {r.byNameEmployeeId && (
              <span className="text-[11px] text-accent">معروف بالاسم: {name(r.byNameEmployeeId)} — ثبّتي المعرّف</span>
            )}
            <span className="flex-1" />
            {linked[r.senderId] === undefined ? (
              <>
                <Select
                  className="h-8 w-36 text-xs"
                  value={pick[r.senderId] ?? ""}
                  onChange={(e) => setPick((s) => ({ ...s, [r.senderId]: e.target.value }))}
                >
                  <option value="">— الموظف —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
                <button
                  disabled={busy}
                  onClick={() => link(r)}
                  className="h-8 px-2 rounded-md bg-accent text-bg text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Link2 className="w-3.5 h-3.5" /> اربط
                </button>
              </>
            ) : (
              <button
                disabled={busy || linked[r.senderId] === 0}
                onClick={() => rematch(r)}
                className="h-8 px-2 rounded-md border border-border text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> طابق ملفاته ({linked[r.senderId]})
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
