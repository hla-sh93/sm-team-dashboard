import { prisma } from "@/lib/db";
import { loadTaskEvents } from "@/server/task-events";
import { buildReelNumbers, cardLabelFor } from "@/lib/cards";
import { BOARD_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = { board: "اللوح", status: "قائمة الحالة", telegram: "تلغرام" };
const stateLabel = (v: string) =>
  (BOARD_LABELS as Record<string, string>)[v] ?? (STATUS_LABELS as Record<string, string>)[v] ?? v;
/** وقت دمشق (UTC+3 ثابت) — «٢٩/١٠ ١٤:٠٥». */
const when = (iso: string) => {
  const d = new Date(Date.parse(iso) + 3 * 3_600_000);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

/** /admin/activity — «مين عمل شو» (خطة التحسينات F): آخر ١٤ يوم من تغييرات الحالة. */
export default async function ActivityPage() {
  const events = await loadTaskEvents(14);
  const ids = [...new Set(events.map((e) => e.taskId))];
  const [tasks, companies] = await Promise.all([
    prisma.task.findMany({ where: { id: { in: ids } } }),
    prisma.company.findMany({ select: { id: true, name: true } }),
  ]);
  const byId = new Map(tasks.map((t) => [t.id, t as unknown as Task]));
  const reelNum = buildReelNumbers(tasks as unknown as Task[]);
  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const label = (id: string) => {
    const t = byId.get(id);
    return t ? cardLabelFor(t, 1, reelNum, coName) : "(كرت انمحى)";
  };
  const unknown = events.filter((e) => !e.actor).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="border-t-4 border-accent pt-3 -mt-3 rounded">
        <h1 className="display-font text-2xl">مين عمل شو</h1>
        <p className="text-sm text-fg-dim">
          كل تغيير حالة على الكروت آخر ١٤ يوم: من اللوح وقائمة الحالة (باسم «أنا مين» يلي اختاره الجهاز، أو جلسة الإدارة)
          ومن تلغرام (باسم المرسِل والملف). الاسم بقسم الموظفين تصريح من الجهاز، مو كلمة سر.
        </p>
        {unknown > 0 && (
          <p className="text-[12px] text-warning mt-1">{unknown} تغيير بلا اسم — من جهاز ما اختار «أنا مين» (أو قبل هالميزة).</p>
        )}
      </header>
      {events.length === 0 ? (
        <p className="text-sm text-fg-dim">ما في تغييرات مسجّلة لسا.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[12px]">
            <thead className="bg-bg-elev text-fg-dim">
              <tr>
                <th className="text-start p-2">الوقت</th>
                <th className="text-start p-2">مين</th>
                <th className="text-start p-2">الكرت</th>
                <th className="text-start p-2">من ← لـ</th>
                <th className="text-start p-2">من وين</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={`${e.at}-${i}`} className="border-t border-border/60">
                  <td className="p-2 whitespace-nowrap" dir="ltr">{when(e.at)}</td>
                  <td className={`p-2 ${e.actor ? "" : "text-warning"}`}>{e.actor ?? "غير معروف"}</td>
                  <td className="p-2">{label(e.taskId)}</td>
                  <td className="p-2 whitespace-nowrap">
                    {stateLabel(e.from)} ← <b>{stateLabel(e.to)}</b>
                  </td>
                  <td className="p-2">{SOURCE[e.source] ?? e.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
