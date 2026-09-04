"use client";

import { useState, useTransition } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CompanyForm from "@/components/forms/CompanyForm";
import {
  deleteCompany,
  archiveCompany,
  renewContract,
  correctLatestRenewal,
  endContract,
  removeLatestRenewal,
  pauseCompanyPublishing,
  resumeCompanyPublishing,
} from "@/server/actions/companies";
import { applyCompanyPlanUpdate } from "@/server/actions/plans";
import { toast } from "@/components/ui/toaster";
import { contractStateOf, parseRenewals, type ContractState } from "@/lib/contract";
import { formatDateShort, toISODate } from "@/lib/dates";
import type { Company, Employee } from "@/types";
import { Plus, Pencil, Trash2, CalendarClock } from "lucide-react";

/** How a contract's cycle state reads on the card. */
function contractChip(s: ContractState): { label: string; cls: string } | null {
  switch (s.state) {
    case "none":
      return null;
    case "not_started":
      return {
        label: `الدورة تبدأ ${formatDateShort(s.startsAt)}`,
        cls: "bg-info/15 text-info",
      };
    case "active":
      return {
        label: `العقد حتى ${formatDateShort(s.endsAt)}`,
        cls: "bg-bg-elev2 text-fg-dim",
      };
    case "due_soon":
      return {
        label:
          s.daysLeft <= 0
            ? `تنتهي الدورة اليوم — ${formatDateShort(s.endsAt)}`
            : `تنتهي خلال ${s.daysLeft} يوم — ${formatDateShort(s.endsAt)}`,
        cls: "bg-warning/15 text-warning",
      };
    case "awaiting_renewal":
      return {
        label: `بانتظار التجديد منذ ${formatDateShort(s.endedAt)}`,
        cls: "bg-danger/15 text-danger",
      };
    case "ended":
      return {
        label: `العقد موقوف — ${formatDateShort(s.endedAt)}`,
        cls: "bg-bg-elev2 text-fg-muted",
      };
  }
}

export default function CompaniesClient({
  employees,
  companies,
}: {
  employees: Employee[];
  companies: Company[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [, start] = useTransition();
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";

  const doArchive = (c: Company) =>
    start(async () => {
      const r = await archiveCompany(c.id);
      if (r.ok) {
        toast(`تمت أرشفة ${c.name}`);
        router.refresh();
      } else toast(r.error, "error");
    });

  /** Record a renewal. The date defaults to the end of the current cycle — the
   *  common case is a contiguous renewal; a later date deliberately leaves a gap
   *  in which nothing is produced. */
  const onRenew = (c: Company, s: ContractState) => {
    const suggested =
      s.state === "due_soon" || s.state === "active"
        ? toISODate(s.endsAt)
        : s.state === "awaiting_renewal"
          ? toISODate(s.endedAt)
          : toISODate(new Date());
    Swal.fire({
      title: `تجديد عقد ${c.name}`,
      input: "date",
      inputValue: suggested,
      inputLabel: "تاريخ بدء الدورة الجديدة",
      text: "أي تاريخ بعد نهاية الدورة الحالية يترك فجوة لا يُنتَج فيها شيء.",
      showCancelButton: true,
      confirmButtonText: "تأكيد التجديد",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#0a8fa3",
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      start(async () => {
        const r = await renewContract(c.id, res.value as string);
        if (r.ok) {
          toast(`تم تجديد ${c.name} — أُعيد توليد الدورة الجديدة`);
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  /** Fix a wrongly entered last renewal while preserving the original start and
   * every earlier cycle. This is available even while the wrong cycle is active,
   * unlike the normal «جدّد» decision. */
  const onCorrectLatestRenewal = (c: Company) => {
    const renewals = parseRenewals(c).sort((a, b) => a.getTime() - b.getTime());
    const latest = renewals[renewals.length - 1];
    if (!latest) return;
    Swal.fire({
      title: `تصحيح آخر تجديد — ${c.name}`,
      input: "date",
      inputValue: toISODate(latest),
      inputLabel: "تاريخ بدء دورة النشر الصحيح",
      text: "سيُستبدل آخر تجديد فقط، وتبقى كل الدورات الأقدم وسجلها كما هي.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "صحّح آخر تجديد",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#0a8fa3",
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      start(async () => {
        const r = await correctLatestRenewal(c.id, res.value as string);
        if (r.ok) {
          toast(`تم تصحيح آخر تجديد لـ ${c.name} وإعادة بناء دورته فقط`);
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  /** دورة انسجّلت وما بلّشت — بتنشال هي وكروتها. الدورات الأقدم ما بتنلمس.
   *  الشغل المنجز محروس: لازم تأكيد بعدده حرفياً. */
  const onRemoveLatestRenewal = (c: Company) => {
    const cycles = parseRenewals(c);
    const latest = cycles[cycles.length - 1];
    if (!latest) return;
    Swal.fire({
      title: `شيل آخر تجديد — ${c.name}`,
      html: `دورة <b>${formatDateShort(latest)}</b> رح تنشال هي وكل كروتها المولّدة.<br/>استعمليها لما تكون الدورة انسجّلت وما بلّشت فعلاً — الشغل يلي صار بيرجع للدورة يلي قبلها.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "شيل الدورة",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#c0392b",
    }).then((res) => {
      if (!res.isConfirmed) return;
      start(async () => {
        const r = await removeLatestRenewal(c.id);
        if (r.ok) {
          toast(`انشالت دورة ${formatDateShort(latest)} من ${c.name}`);
          router.refresh();
          return;
        }
        if (!("doneCards" in r) || !r.doneCards) {
          toast(r.error, "error");
          return;
        }
        const confirmed = await Swal.fire({
          title: "الدورة فيها شغل منجز",
          html: `${r.doneCards} كرت منجز رح يروح مع الدورة.<br/>إذا كانت فعلاً دورة ما بلّشت وشغلها بيتبع الدورة يلي قبلها، اكتبي العدد للتأكيد.`,
          input: "text",
          inputPlaceholder: String(r.doneCards),
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "أكّدي وشيلي",
          cancelButtonText: "إلغاء",
          confirmButtonColor: "#c0392b",
        });
        if (!confirmed.isConfirmed || Number(confirmed.value) !== r.doneCards) return;
        const forced = await removeLatestRenewal(c.id, r.doneCards);
        if (forced.ok) {
          toast(`انشالت دورة ${formatDateShort(latest)} من ${c.name}`);
          router.refresh();
        } else toast(forced.error, "error");
      });
    });
  };

  /**
   * إيقاف نشر شركة — وتنظيف كروتها المعلّقة.
   *
   * القائدة (٤/٩): «بدي أقدر أوقف النشر من اللوحة وأنظّف كل الكروت، لحدّ ما
   * أرجّعها». التنظيف بيطال المعلّق وحده — المنجَز والمنشور ما بينلمسوا، وإلا
   * بتضيع أرقام الإنجاز وحصيلة كل شخص.
   */
  const onPausePublishing = (c: Company) => {
    Swal.fire({
      title: `أوقف النشر — ${c.name}`,
      html:
        "كل الكروت <b>المعلّقة</b> رح تنشال، وتاريخ بدء النشر بينفرّغ — فما في دورة وما في تأخير علينا." +
        "<br/><b>الشغل المنجَز والمنشور بيضل كما هو.</b>" +
        "<br/>لما ترجّعيها، بتحطّي تاريخ بدء نشر جديد والكروت بتنبني من أوله.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "أوقف النشر",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#c0392b",
    }).then((res) => {
      if (!res.isConfirmed) return;
      start(async () => {
        const r = await pauseCompanyPublishing(c.id);
        if (r.ok) {
          toast(`توقّف نشر ${c.name} · انشال ${r.removedTasks} كرت معلّق`);
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  /** إرجاع شركة موقوفة — التاريخ إلزامي لأنه مرساة الدورة كلها. */
  const onResumePublishing = (c: Company) => {
    Swal.fire({
      title: `رجّع النشر — ${c.name}`,
      html: "حطّي تاريخ بدء النشر الجديد. منه بتتحدّد الدورة، ومنه بيرتّب النظام التصميم والتصوير والمونتاج والنشر.",
      input: "text",
      inputPlaceholder: "YYYY-MM-DD",
      inputAttributes: { dir: "ltr", spellcheck: "false" },
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "رجّع وابنِ الدورة",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#0a8fa3",
      inputValidator: (v) =>
        /^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim()) ? null : "التاريخ لازم يكون YYYY-MM-DD",
    }).then((res) => {
      if (!res.isConfirmed) return;
      start(async () => {
        const r = await resumeCompanyPublishing(c.id, String(res.value).trim());
        if (r.ok) {
          toast(`رجع نشر ${c.name} — الدورة من ${r.from}`);
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  /** Paste a validated JSON plan payload. The selected card supplies the company
   * id, so a payload copied from another client cannot accidentally target it. */
  const onImportPlan = (c: Company) => {
    Swal.fire({
      title: `استيراد خطة — ${c.name}`,
      input: "textarea",
      inputLabel: "بيانات الخطة JSON",
      inputPlaceholder: '{"year":2026,"month":8,"items":[...]}',
      inputAttributes: { dir: "ltr", spellcheck: "false" },
      showCancelButton: true,
      confirmButtonText: "تحقق وطبّق الخطة",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#0a8fa3",
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(res.value as string) as Record<string, unknown>;
      } catch {
        toast("JSON غير صالح — لم يتغير شيء", "error");
        return;
      }
      delete payload.companyName;
      payload.companyId = c.id;
      start(async () => {
        const result = await applyCompanyPlanUpdate(payload);
        if (result.ok) {
          const closed = result.closedPreviousTasks
            ? ` وإغلاق ${result.closedPreviousTasks} مهمة سابقة`
            : "";
          const restored = result.restoredTasks
            ? ` واستعادة ${result.restoredTasks} مهمة من الإغلاق الخاطئ`
            : "";
          toast(
            `تم تطبيق ${result.describedPieces} وصفاً على خطة ${c.name}${closed}${restored}`,
          );
          router.refresh();
        } else toast(result.error, "error");
      });
    });
  };

  /** "Not renewed" — hard stop + pause. Reversible by renewing later. */
  const onEndContract = (c: Company) => {
    Swal.fire({
      title: `لم يُجدد عقد ${c.name}؟`,
      text: "سيتوقف توليد أي عمل جديد وتصبح الشركة موقوفة. يمكن التراجع بتسجيل تجديد لاحقاً.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، لم يُجدد",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#ef4444",
    }).then((res) => {
      if (!res.isConfirmed) return;
      start(async () => {
        const r = await endContract(c.id);
        if (r.ok) {
          toast(`تم إيقاف عقد ${c.name}`);
          router.refresh();
        } else toast(r.error, "error");
      });
    });
  };

  const onDelete = (c: Company) => {
    Swal.fire({
      title: "تأكيد الحذف",
      text: `حذف ${c.name}؟ إن كان لديها تاريخ، سيُقترح الأرشفة بدل الحذف.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، احذف",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (!result.isConfirmed) return;
      start(async () => {
        const r = await deleteCompany(c.id);
        if (r.ok) {
          toast("تم الحذف");
          router.refresh();
          return;
        }
        // Has history → cascade-delete blocked. Offer archiving instead.
        if ("canArchive" in r && r.canArchive) {
          const choice = await Swal.fire({
            title: "لا يمكن الحذف — يوجد تاريخ محفوظ",
            text: r.error,
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "أرشفة الشركة",
            cancelButtonText: "إلغاء",
            confirmButtonColor: "#0a8fa3",
          });
          if (choice.isConfirmed) doArchive(c);
        } else {
          toast(r.error, "error");
        }
      });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-2xl">الشركات</h1>
          <p className="text-sm text-fg-dim">الخطة والمالكون لكل نوع محتوى</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4" /> شركة جديدة
        </Button>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {companies.map((c) => {
          const state = contractStateOf(c);
          const chip = contractChip(state);
          const hasRenewals = parseRenewals(c).length > 0;
          // The renewal question only exists once a cycle is ending or over.
          const needsAnswer =
            state.state === "due_soon" ||
            state.state === "awaiting_renewal" ||
            state.state === "ended";
          return (
          <Card key={c.id} style={{ borderRight: `4px solid ${c.color ?? "#C8A84E"}` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="display-font text-lg">{c.name}</h2>
                  <span
                    className={
                      "text-[10px] px-2 py-0.5 rounded-full font-semibold " +
                      (c.managed
                        ? "bg-accent/15 text-accent"
                        : "bg-info/15 text-info")
                    }
                  >
                    {c.managed ? "مُدارة" : "تصميم-فقط"}
                  </span>
                </div>
                {c.managed ? (
                  <p className="text-xs text-fg-dim mt-1">
                    {c.posts} بوست · {c.reels} ريل · {c.aiReels} ريل AI · {c.stories} ستوري
                  </p>
                ) : (
                  <p className="text-xs text-fg-dim mt-1">
                    المسؤول: {empName(c.defaultOwnerId)}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  className="p-1.5 rounded-md hover:bg-bg-elev2 text-fg-dim"
                  onClick={() => {
                    setEditing(c);
                    setOpen(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-md hover:bg-danger/10 text-danger"
                  onClick={() => onDelete(c)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {c.managed && (
              <div className="flex gap-3 mt-3 text-[11px] text-fg-muted flex-wrap">
                <span>بوست → {empName(c.postOwnerId)}</span>
                <span>· ستوري → {empName(c.storyOwnerId)}</span>
                {c.aiReels > 0 && <span>· ريل AI → {empName(c.aiReelOwnerId)}</span>}
                {/* السيلز مو منتِج — بيتابع العقد والزبون ومواعيد التصوير بس */}
                {c.accountOwnerId && (
                  <span className="text-info">· 🤝 مسؤول العقد: {empName(c.accountOwnerId)}</span>
                )}
              </div>
            )}
            {chip && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span
                  className={
                    "text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold " +
                    chip.cls
                  }
                >
                  <CalendarClock className="w-3 h-3" />
                  {chip.label}
                </span>
                {needsAnswer && (
                  <>
                    <button
                      className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                      onClick={() => onRenew(c, state)}
                    >
                      جدّد
                    </button>
                    {state.state !== "ended" && (
                      <button
                        className="text-[11px] px-2 py-0.5 rounded-md text-fg-dim hover:bg-danger/10 hover:text-danger"
                        onClick={() => onEndContract(c)}
                      >
                        لم يُجدد
                      </button>
                    )}
                  </>
                )}
                {hasRenewals && (
                  <button
                    className="text-[11px] px-2 py-0.5 rounded-md text-fg-dim hover:bg-warning/10 hover:text-warning"
                    onClick={() => onCorrectLatestRenewal(c)}
                  >
                    صحّح آخر تجديد
                  </button>
                )}
                {hasRenewals && (
                  <button
                    className="text-[11px] px-2 py-0.5 rounded-md text-fg-dim hover:bg-danger/10 hover:text-danger"
                    onClick={() => onRemoveLatestRenewal(c)}
                  >
                    شيل آخر تجديد
                  </button>
                )}
              </div>
            )}
            {c.managed && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  className="text-[11px] px-2 py-1 rounded-md border border-border text-fg-dim hover:bg-bg-elev2 hover:text-fg"
                  onClick={() => onImportPlan(c)}
                >
                  استيراد خطة JSON
                </button>
                {/* تصدير Word — بينفتح بتبويب جديد فالمتصفح بينزّله لحاله.
                    بيبيّن للشركة يلي إلها تاريخ بدء نشر بس: بلا تاريخ ما في
                    دورة، والملف بلا دورة بيوهم إنّ في جدول وما في. */}
                {c.publishStartDate && (
                  <a
                    href={`/api/plan-doc?companyId=${c.id}`}
                    className="text-[11px] px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10"
                  >
                    تصدير الخطة Word
                  </a>
                )}
                {/* إيقاف/إرجاع النشر — الزرّان بديل بعض حسب حالة الشركة، فما
                    بتقدري توقفي موقوفة ولا ترجّعي شغّالة. */}
                {c.status === "paused" ? (
                  <button
                    className="text-[11px] px-2 py-1 rounded-md border border-success/40 text-success hover:bg-success/10"
                    onClick={() => onResumePublishing(c)}
                  >
                    رجّع النشر
                  </button>
                ) : (
                  <button
                    className="text-[11px] px-2 py-1 rounded-md border border-danger/40 text-danger hover:bg-danger/10"
                    onClick={() => onPausePublishing(c)}
                  >
                    أوقف النشر
                  </button>
                )}
              </div>
            )}
          </Card>
          );
        })}
        {companies.length === 0 && (
          <p className="text-sm text-fg-muted">لا توجد شركات بعد.</p>
        )}
      </div>

      <CompanyForm open={open} onOpenChange={setOpen} company={editing} employees={employees} />
    </div>
  );
}
