"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import {
  applyLateReschedule,
  previewLateReschedule,
  type LateReschedulePreview,
} from "@/server/actions/late-reschedule";

type Co = { id: string; name: string; priority: number };
type Ready = Extract<LateReschedulePreview, { ok: true }>;

const TEAM = "__team__";
const STAGE: Record<string, string> = { WRITE: "كتابة", DESIGN: "تصميم", SHOOT: "تصوير", EDIT: "مونتاج", PUBLISH: "نشر" };
const TYPE: Record<string, string> = { POST: "بوست", STORY: "ستوري", REEL: "ريل", AI_REEL: "ريل AI" };
const REASON: Record<string, string> = { late: "متأخر", after: "بعد حاجزه", order: "إزاحة بالترتيب" };
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dayLabel = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}/${m}`;
};

export default function RescheduleClient({ todayISO, companies }: { todayISO: string; companies: Co[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [fromISO, setFrom] = useState(todayISO);
  const [picked, setPicked] = useState<Set<string>>(() => new Set([...companies.map((c) => c.id), TEAM]));
  const [preview, setPreview] = useState<Ready | null>(null);

  const selection = () => [...picked].map((id) => (id === TEAM ? null : id));

  const runPreview = () =>
    start(async () => {
      const r = await previewLateReschedule(fromISO, selection());
      if (r.ok) setPreview(r);
      else toast(r.error, "error");
    });

  const runApply = () => {
    if (!preview) return;
    const n = preview.plan.moves.length;
    if (!window.confirm(`تطبيق ${n} نقلة من ${dayLabel(fromISO)}؟ الكروت المنقولة بتتثبّت على مواعيدها الجديدة.`)) return;
    start(async () => {
      const r = await applyLateReschedule(fromISO, selection(), preview.plan.fingerprint);
      if (r.ok) {
        toast(`تمّت إعادة الجدولة — ${r.moved} نقلة`);
        setPreview(null);
        router.refresh();
      } else toast(r.error, "error");
    });
  };

  const groups = useMemo(() => {
    if (!preview) return [];
    const by = new Map<string, Ready["plan"]["moves"]>();
    for (const m of preview.plan.moves) {
      const k = m.companyId ?? TEAM;
      by.set(k, [...(by.get(k) ?? []), m]);
    }
    const rank = new Map(companies.map((c) => [c.id, c.priority]));
    return [...by.entries()].sort((a, b) => (rank.get(a[0]) ?? 999) - (rank.get(b[0]) ?? 999));
  }, [preview, companies]);

  const perPerson = useMemo(() => {
    if (!preview) return [];
    const by = new Map<string, number>();
    for (const m of preview.plan.moves) {
      if (!m.assigneeId || m.stage === "PUBLISH") continue;
      by.set(m.assigneeId, (by.get(m.assigneeId) ?? 0) + 1);
    }
    return [...by.entries()].map(([id, n]) => `${preview.names.people[id] ?? id} ${n}`);
  }, [preview]);

  const toggle = (id: string) => {
    setPreview(null);
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="border-t-4 border-accent pt-3 -mt-3 rounded">
        <h1 className="display-font text-2xl flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
          إعادة جدولة المتأخر
        </h1>
        <p className="text-sm text-fg-dim">
          بيحطّ كل كرت متأخر بأول يوم دوام فيه سعة لصاحبه من التاريخ المختار، وبيزيح وراه بس
          يلي لازم يتزاح: المرحلة الجاية من نفس القطعة، والقطع يلي بعدها بالترتيب، وأي يوم
          نشر بيتصادم بنفس الشركة. الأولوية بالسعة حسب ترتيب صفحة «الأولويات». المنجز ما
          بيتحرّك، والمنقول بيتثبّت وبينكتب عليه موعده القديم.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-bg-elev p-3 flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap items-center">
          <label className="text-sm flex items-center gap-2">
            من تاريخ
            <Input
              type="date"
              className="h-9 w-44 text-sm"
              value={fromISO}
              onChange={(e) => {
                setFrom(e.target.value || todayISO);
                setPreview(null);
              }}
            />
          </label>
          <button
            disabled={busy || picked.size === 0}
            onClick={runPreview}
            className="h-9 px-3 rounded-md bg-accent text-bg text-sm disabled:opacity-50 flex items-center gap-1"
          >
            <CalendarClock className="w-4 h-4" /> {busy && !preview ? "جاري الحساب…" : "إعادة جدولة المتأخر"}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap text-[12px]">
          {[...companies.map((c) => ({ id: c.id, name: c.name })), { id: TEAM, name: "مهام داخلية" }].map((c) => (
            <label key={c.id} className="flex items-center gap-1 border border-border rounded px-2 py-1">
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
              {c.name}
            </label>
          ))}
        </div>
      </section>

      {preview && (
        <section className="rounded-lg border border-border bg-bg-elev p-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <h2 className="text-sm font-semibold">
              المعاينة: {preview.plan.moves.length} نقلة
              {preview.plan.syncs.length ? ` (+${preview.plan.syncs.length} كرت بيلحق يوم نشر قطعته)` : ""}
            </h2>
            <span className="flex-1" />
            <button
              disabled={busy || preview.plan.moves.length === 0}
              onClick={runApply}
              className="h-9 px-3 rounded-md bg-accent text-bg text-sm disabled:opacity-50"
            >
              {busy ? "جاري التطبيق…" : "طبّق"}
            </button>
            <button onClick={() => setPreview(null)} className="h-9 px-3 rounded-md border border-border text-sm">
              إلغاء
            </button>
          </div>
          {preview.plan.moves.length === 0 && <p className="text-sm text-fg-dim">ما في شي متأخر بالشركات المختارة.</p>}
          {perPerson.length > 0 && (
            <p className="text-[12px] text-fg-dim">كروت إنتاج انتقلت لكل شخص: {perPerson.join(" · ")}</p>
          )}
          {preview.plan.unplaced.length > 0 && (
            <div className="rounded border border-warning/40 bg-warning/10 p-2 text-[12px]">
              ما لقيت يوم إلن خلال ١٢٠ يوم (بيضلّوا متل ما هنّ): {preview.plan.unplaced.map((u) => u.title).join("، ")}
            </div>
          )}
          {groups.map(([co, moves]) => (
            <div key={co} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">
                {co === TEAM ? "مهام داخلية" : (preview.names.companies[co] ?? co)} — {moves.length}
              </h3>
              <ul className="flex flex-col gap-0.5 text-[12px]">
                {moves.map((m) => {
                  const what =
                    m.type && m.pieceNo != null
                      ? `${STAGE[m.stage ?? ""] ?? m.stage ?? ""} ${TYPE[m.type] ?? m.type}-${m.pieceNo}`
                      : m.title || `${STAGE[m.stage ?? ""] ?? ""} ${TYPE[m.type ?? ""] ?? ""}`;
                  const was = m.stage === "PUBLISH" ? m.from.publish : (m.from.ready ?? m.from.work);
                  const now = m.stage === "PUBLISH" ? m.to.publish : m.to.ready;
                  return (
                    <li key={m.taskId} className="flex flex-wrap gap-2 items-center border-b border-border/50 py-0.5">
                      <span className="font-medium">{what}</span>
                      {m.assigneeId && <span className="text-fg-muted">{preview.names.people[m.assigneeId]}</span>}
                      <span dir="ltr" className="font-mono">
                        {dayLabel(was)} → {dayLabel(now)}
                      </span>
                      <span className="rounded bg-bg px-1.5 text-fg-dim">{REASON[m.reason]}</span>
                      {m.warnings.map((w) => (
                        <span key={w} className="text-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {w}
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
