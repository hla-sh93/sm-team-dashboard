"use client";

import { useState, useTransition } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/badge";
import MemberForm from "@/components/forms/MemberForm";
import { deleteEmployee, handoverEmployeeWork } from "@/server/actions/employees";
import { sendTelegramTest } from "@/server/actions/telegram-identity";
import type { TelegramSenderRow } from "@/server/telegram-identity";
import type { HandoverRecord } from "@/server/handover";
import TelegramSenders from "./telegram-senders";
import { toast } from "@/components/ui/toaster";
import { ROLE_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { parseWorkDays } from "@/lib/dates";
import type { Employee } from "@/types";
import { Plus, Pencil, Trash2, Camera, Zap, ArrowRightLeft, Send } from "lucide-react";

export default function TeamClient({
  employees,
  unknownSenders,
  handovers = [],
}: {
  employees: Employee[];
  unknownSenders: TelegramSenderRow[];
  handovers?: HandoverRecord[];
}) {
  const handoverOf = new Map(handovers.map((h) => [h.fromId, h]));
  const nameOf = (id: string) => employees.find((x) => x.id === id)?.name ?? "—";
  const fmtDay = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}` : "");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [, start] = useTransition();

  const onDelete = (e: Employee) => {
    Swal.fire({
      title: "تأكيد الحذف",
      text: `حذف ${e.name}؟`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، احذف",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (!result.isConfirmed) return;
      start(async () => {
        const r = await deleteEmployee(e.id);
        if (r.ok) {
          toast("تم الحذف");
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  /**
   * «تسليم الشغل» (قرار القائدة ١٢/١٠ — ماجد استقال وليلاس مكانه من ١/١٠): المفتوح كلّه
   * والمنجز من التاريخ وطالع ومسؤوليات الشركات بتنتقل للمستلِم، والمغادر بيطلع من
   * التوزيع. معاينة بالأعداد أولاً، والتطبيق بنفس الأعداد.
   */
  const onHandover = (e: Employee) => {
    // الأسماء بتنحط بـHTML الحوار — بتتهرّب.
    const esc = (v: string) =>
      v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    const others = employees.filter((x) => x.id !== e.id);
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const options = others.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
    Swal.fire({
      title: `تسليم شغل ${e.name}`,
      html:
        `<div style="text-align:right;display:flex;flex-direction:column;gap:8px">` +
        `<label>المستلِم<select id="ho-to" class="swal2-select" style="width:100%;margin:4px 0">${options}</select></label>` +
        `<label>من تاريخ<input id="ho-date" class="swal2-input" dir="ltr" value="${iso}" style="width:100%;margin:4px 0"/></label>` +
        `<small>المفتوح كلّه + المنجز من التاريخ وطالع + مسؤوليات الشركات النشطة. المنجز قبل التاريخ بيضل باسم ${esc(e.name)}.</small>` +
        `</div>`,
      showCancelButton: true,
      confirmButtonText: "عاين",
      cancelButtonText: "إلغاء",
      preConfirm: () => ({
        toId: (document.getElementById("ho-to") as HTMLSelectElement).value,
        fromDate: (document.getElementById("ho-date") as HTMLInputElement).value.trim(),
      }),
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      const { toId, fromDate } = res.value as { toId: string; fromDate: string };
      start(async () => {
        const probe = await handoverEmployeeWork({ fromId: e.id, toId, fromDate });
        if (!probe.ok) return void toast(probe.error, "error");
        const toName = others.find((x) => x.id === toId)?.name ?? "";
        // التسليم بينفّذ هلّق: كل المفتوح بينتقل والمغادر بيطلع من التوزيع اليوم — مو بالتاريخ.
        const future = fromDate > iso;
        const confirm = await Swal.fire({
          title: "تأكيد التسليم",
          html:
            `من <b>${esc(e.name)}</b> لـ<b>${esc(toName)}</b> من ${esc(fromDate)}:<br/>` +
            `${probe.openCards} كرت مفتوح · ${probe.doneSince} كرت منجز من التاريخ · ${probe.companies} شركة` +
            (future
              ? `<br/><br/><b style="color:#c77e1b">⚠️ التاريخ لسا ما إجا:</b> التسليم بيصير <b>هلّق</b> — كروت ${esc(e.name)} المفتوحة كلها (حتى يلي قبل ${esc(fromDate)}) بتنتقل اليوم، وبيطلع من التوزيع اليوم. إذا لسا عم يشتغل، الأحسن تعمليه يوم ${esc(fromDate)}.`
              : ""),
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "سلّم",
          cancelButtonText: "إلغاء",
        });
        if (!confirm.isConfirmed) return;
        const r = await handoverEmployeeWork({ fromId: e.id, toId, fromDate, confirm: probe.total });
        if (r.ok) {
          toast(`انسلّم شغل ${e.name} لـ${toName}`);
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">الفريق</h1>
          <p className="text-sm text-fg-dim">السعة وأيام العمل لكل موظف</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4" /> موظف جديد
        </Button>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((e) => {
          const wd = parseWorkDays(e.workDays);
          return (
            <Card key={e.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} color={e.color ?? undefined} size={42} />
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {e.name}
                      {e.isPhotographer && <Camera className="w-3.5 h-3.5 text-accent" />}
                      {e.isScheduled && <Zap className="w-3.5 h-3.5 text-success" />}
                    </div>
                    <div className="text-xs text-fg-dim">
                      {ROLE_LABELS[e.role] ?? e.role} · {e.hoursPerDay}س/يوم
                    </div>
                    {handoverOf.get(e.id) && (
                      <div className="text-[10px] text-fg-muted">
                        سلّم شغله لـ{nameOf(handoverOf.get(e.id)!.toId)}
                        {handoverOf.get(e.id)!.fromDate ? ` من ${fmtDay(handoverOf.get(e.id)!.fromDate)}` : ""} — المنجز قبلها باسمه
                      </div>
                    )}
                    <div className={"text-[10px] " + (e.telegramUserId ? "text-success" : "text-warning")}>
                      {e.telegramUserId
                        ? "تلغرام مربوط ✓"
                        : e.telegramUsername || e.telegramAliases
                          ? "تلغرام بالاسم بس — ثبّتي المعرّف"
                          : "تلغرام غير مربوط"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    className="p-1.5 rounded-md hover:bg-bg-elev2 text-fg-dim"
                    onClick={() => {
                      setEditing(e);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {e.telegramUserId && (
                    <button
                      className="p-1.5 rounded-md hover:bg-bg-elev2 text-fg-dim"
                      title="رسالة اختبار على تلغرام"
                      onClick={() =>
                        start(async () => {
                          const r = await sendTelegramTest(e.id);
                          if (r.ok) toast(`انبعتت رسالة اختبار لـ${e.name}`);
                          else toast(r.error, "error");
                        })
                      }
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    className="p-1.5 rounded-md hover:bg-bg-elev2 text-fg-dim"
                    title="تسليم الشغل لموظف تاني"
                    onClick={() => onHandover(e)}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 rounded-md hover:bg-danger/10 text-danger"
                    onClick={() => onDelete(e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {wd.map((d) => (
                  <span
                    key={d}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elev2 text-fg-dim"
                  >
                    {WEEKDAY_LABELS[d]}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <TelegramSenders rows={unknownSenders} employees={employees} />

      <MemberForm open={open} onOpenChange={setOpen} employee={editing} />
    </div>
  );
}
