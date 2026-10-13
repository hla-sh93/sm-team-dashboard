"use client";

/**
 * أزرار خطة الشهر: تحميل القالب فارغاً، رفعه معبّى، وتصدير الخطة بتواريخ النشر.
 *
 * مشتركة بين لوحة الإدارة وصفحة الشركات عند الموظفين (قرار القائدة ١٨/٩:
 * «خلي الشركات تظهر للموظفين حتى يقدرو يشوفو الخطط ويعاينو الملفات») — نوال
 * هي يلي بتنزّل وبترفع، وهي مو أدمن.
 *
 * المعاينة إلزامية قبل أي كتابة: الملف بينزّل نصوصاً على كروت شغل حقيقية،
 * فالقراءة بتنعرض أول — كم قطعة مقابل العقد، وأي كرت كتابة رح ينسكّر، وأي
 * تحذير — وبعدين بتأكيد واحد بتنطبّق.
 */
import { useRef, useTransition } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { applyCompanyPlanDocx, previewCompanyPlanDocx } from "@/server/actions/plans";
import { toast } from "@/components/ui/toaster";

const esc = (value: string) =>
  value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);

export default function PlanDocxButtons({
  companyId,
  companyName,
  canUpload = true,
  className = "",
}: {
  companyId: string;
  companyName: string;
  canUpload?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onerror = () => toast("تعذّرت قراءة الملف", "error");
    reader.onload = () => {
      const base64 = String(reader.result ?? "").split(",")[1] ?? "";
      if (!base64) {
        toast("الملف فارغ", "error");
        return;
      }
      start(async () => {
        let preview = await previewCompanyPlanDocx(companyId, base64);
        if (!preview.ok) {
          void Swal.fire({ icon: "error", title: "الملف ما انقرا", text: preview.error, confirmButtonColor: "#0a8fa3" });
          return;
        }
        // دورة جاية مسجَّلة: لأي دورة الخطة؟ — اختيار صريح بدل ما تنزل على الحالية (PU-16).
        let target: { year: number; month: number } | undefined;
        if (preview.targets.length > 1) {
          const options = preview.targets;
          const choice = await Swal.fire({
            title: "لأي دورة هالخطة؟",
            input: "radio",
            inputOptions: Object.fromEntries(
              options.map((t, i) => [String(i), `${t.current ? "الحالية" : "الجاية"}: ${t.cycleLabel}`]),
            ),
            inputValue: "0",
            inputValidator: (value) => (value ? null : "اختاري دورة"),
            showCancelButton: true,
            confirmButtonText: "متابعة",
            cancelButtonText: "إلغاء",
            confirmButtonColor: "#0a8fa3",
          });
          if (!choice.isConfirmed) return;
          const picked = options[Number(choice.value)];
          target = { year: picked.year, month: picked.month };
          if (!picked.current) {
            preview = await previewCompanyPlanDocx(companyId, base64, target);
            if (!preview.ok) {
              void Swal.fire({ icon: "error", title: "الملف ما انقرا", text: preview.error, confirmButtonColor: "#0a8fa3" });
              return;
            }
          }
        }
        const counts = preview.counts
          .map((row) => {
            const bad = row.inFile !== row.inContract;
            return `<span style="color:${bad ? "#b45309" : "#166534"}">${row.inFile}/${row.inContract} ${esc(row.label)}</span>`;
          })
          .join(" · ");
        const cards = preview.writeCards
          .map(
            (card) =>
              `<li>${esc(card.title)}${card.assignee ? ` — ${esc(card.assignee)}` : ""}${card.alreadyDone ? " (مسكَّر أصلاً)" : ""}</li>`,
          )
          .join("");
        const pieces = preview.pieces
          .map((piece) => `<li><b>${esc(piece.label)}-${piece.pieceNo}</b> · ${esc(piece.head)}</li>`)
          .join("");
        const warnings = preview.warnings.length
          ? `<div style="background:#fef3c7;border-radius:6px;padding:8px;margin:8px 0"><b>تنبيهات</b><ul style="margin:4px 0 0;padding-inline-start:18px">${preview.warnings
              .map((w) => `<li>${esc(w)}</li>`)
              .join("")}</ul></div>`
          : "";
        const res = await Swal.fire({
          title: `معاينة خطة ${esc(companyName)}`,
          html: `<div dir="rtl" style="text-align:right;font-size:13px">
            <p style="margin:0 0 6px">${preview.cycleLabel ? `الدورة: ${esc(preview.cycleLabel)}` : "بلا دورة"}</p>
            <p style="margin:0 0 6px">القطع مقابل العقد: ${counts}</p>
            ${warnings}
            <p style="margin:8px 0 2px"><b>كروت الكتابة التي ستُسكَّر</b></p>
            <ul style="margin:0;padding-inline-start:18px">${cards || "<li>لا شيء</li>"}</ul>
            <p style="margin:8px 0 2px"><b>النصوص ستنزل على</b></p>
            <ul style="margin:0;padding-inline-start:18px;max-height:180px;overflow:auto">${pieces}</ul>
          </div>`,
          width: 620,
          showCancelButton: true,
          confirmButtonText: "طبّق الخطة",
          cancelButtonText: "إلغاء",
          confirmButtonColor: "#0a8fa3",
        });
        if (!res.isConfirmed) return;
        const applied = await applyCompanyPlanDocx({ companyId, fileBase64: base64, fileName: file.name, target });
        if (!applied.ok) {
          void Swal.fire({ icon: "error", title: "ما انطبّقت", text: applied.error, confirmButtonColor: "#0a8fa3" });
          return;
        }
        toast(
          `تم تطبيق خطة ${applied.company}: ${applied.describedPieces} وصفاً` +
            (applied.closedWriteCards ? ` · أُغلق ${applied.closedWriteCards} كرت كتابة` : ""),
        );
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={"flex flex-wrap gap-1.5 " + className}>
      <a
        href={`/api/plan-template?companyId=${companyId}`}
        title="ملف Word فارغ بجداول الشهر — لتعبئته وإعادة رفعه"
        className="text-[11px] px-2 py-1 rounded-md border border-accent/40 text-accent hover:bg-accent/10"
      >
        حمّل قالب الخطة
      </a>
      {canUpload && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
          <button
            type="button"
            disabled={busy}
            title="رفع خطة الشهر المعبّاة — معاينة قبل التطبيق"
            className="text-[11px] px-2 py-1 rounded-md border border-success/40 text-success hover:bg-success/10 disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "…" : "ارفع الخطة"}
          </button>
        </>
      )}
      <a
        href={`/api/plan-doc?companyId=${companyId}`}
        title="خطة الدورة الحالية بتواريخ النشر والمسؤولين والحالة"
        className="text-[11px] px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10"
      >
        تصدير الخطة Word
      </a>
    </div>
  );
}
