"use client";

/**
 * «أنا مين» — الجهاز بيختار اسمه مرّة (خطة التحسينات F، ٢٩/١٠)، وكل تغيير حالة من قسم
 * الموظفين بينكتب باسمه (`src/server/task-events.ts`). **تصريح مو تحقّق** — قسم الموظفين
 * بلا كلمة سر عن قصد؛ الهدف إنّ «مين سكّر» يكون إله جواب. بواجهة الإدارة ما في سؤال:
 * الفاعل جلسة المسؤول.
 */
import Swal from "sweetalert2";

export const ACTOR_COOKIE = "sm_actor";
const MAX_AGE = 90 * 86_400;

export function chosenActorId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${ACTOR_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setActorId(id: string): void {
  document.cookie = `${ACTOR_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

const isAdminArea = () => typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

/**
 * قبل أول تغيير حالة: إذا الجهاز ما اختار اسمه، بيسأل. `false` = لغى، فما بيصير التغيير.
 * `force` = «غيّر الاسم».
 */
export async function ensureActor(employees: { id: string; name: string }[], force = false): Promise<boolean> {
  if (isAdminArea()) return true;
  const current = chosenActorId();
  if (!force && current && employees.some((e) => e.id === current)) return true;
  const esc = (v: string) =>
    v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const options = employees
    .map((e) => `<option value="${esc(e.id)}"${e.id === current ? " selected" : ""}>${esc(e.name)}</option>`)
    .join("");
  const res = await Swal.fire({
    title: "أنا مين؟",
    html:
      `<div style="text-align:right">` +
      `<select id="actor-pick" class="swal2-select" style="width:100%;margin:4px 0">${options}</select>` +
      `<small>بينحفظ على هالجهاز، وكل تغيير حالة بينكتب باسمك (الإدارة بتشوف «مين عمل شو»).</small>` +
      `</div>`,
    showCancelButton: true,
    confirmButtonText: "هيدا أنا",
    cancelButtonText: "إلغاء",
    preConfirm: () => (document.getElementById("actor-pick") as HTMLSelectElement).value,
  });
  if (!res.isConfirmed || !res.value) return false;
  setActorId(res.value as string);
  return true;
}
