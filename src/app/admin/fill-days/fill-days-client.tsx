"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { applyFillDays, previewFillDays, type FillPreview } from "@/server/actions/fill-days";

type Ready = Extract<FillPreview, { ok: true }>;
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dayLabel = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}/${m}`;
};

/**
 * «تعبئة الأيام» (خطة التحسينات D): كل شخص بطاقته الكاملة كل يوم دوام، بترتيب «مهام اليوم»
 * نفسه. بيكتب يوم البداية بس — التسليم والنشر ما بيتحرّكوا.
 */
export default function FillDaysClient({ todayISO }: { todayISO: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [fromISO, setFrom] = useState(todayISO);
  const [preview, setPreview] = useState<Ready | null>(null);

  const runPreview = () =>
    start(async () => {
      const r = await previewFillDays(fromISO);
      if (r.ok) setPreview(r);
      else toast(r.error, "error");
    });

  const runApply = () => {
    if (!preview) return;
    if (!window.confirm(`كتابة يوم البداية على ${preview.moves.length} كرت؟ التسليم والنشر ما بيتغيّروا.`)) return;
    start(async () => {
      const r = await applyFillDays(preview.fromISO, preview.fingerprint);
      if (r.ok) {
        toast(`انكتب يوم البداية على ${r.moved} كرت`);
        setPreview(null);
        router.refresh();
      } else toast(r.error, "error");
    });
  };

  const byPerson = useMemo(() => {
    if (!preview) return [];
    const m = new Map<string, Ready["moves"]>();
    for (const mv of preview.moves) m.set(mv.person, [...(m.get(mv.person) ?? []), mv]);
    return [...m.entries()].map(([person, moves]) => ({
      person,
      moves: [...moves].sort((a, b) => a.startISO.localeCompare(b.startISO)),
      earlier: moves.filter((x) => !x.fromISO || x.startISO < x.fromISO).length,
    }));
  }, [preview]);

  const bottleneckGroups = useMemo(() => {
    if (!preview) return [];
    const m = new Map<string, { already: Ready["moves"]; slipping: Ready["moves"] }>();
    for (const b of preview.bottlenecks) {
      const g = m.get(b.person) ?? { already: [], slipping: [] };
      (b.readyISO != null && b.readyISO < preview.fromISO ? g.already : g.slipping).push(b);
      m.set(b.person, g);
    }
    return [...m.entries()].map(([person, g]) => ({ person, ...g }));
  }, [preview]);

  const loadByPerson = useMemo(() => {
    if (!preview) return [];
    const m = new Map<string, { dayISO: string; load: number }[]>();
    for (const d of preview.days) m.set(d.person, [...(m.get(d.person) ?? []), d]);
    return [...m.entries()];
  }, [preview]);

  return (
    <div className="flex flex-col gap-5">
      <header className="border-t-4 border-accent pt-3 -mt-3 rounded">
        <h1 className="display-font text-2xl flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-accent" /> تعبئة الأيام
        </h1>
        <p className="text-sm text-fg-dim">
          كل شخص بطاقته الكاملة كل يوم دوام — بنفس ترتيب «مهام اليوم» (بدّل ← الشغّال ← المستعجل ← المستحقّ ← الموعد ←
          أولوية الشركة)، والمرحلة الجاية بتبلّش تاني يوم من خلاص يلي قبلها. بيكتب <b>يوم البداية</b> بس على كروت الخطة؛
          التسليم والنشر ما بيتحرّكوا، والتصوير و«بدّل» والمهام الإضافية ما بتنلمس.
        </p>
      </header>

      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-xs text-fg-dim flex flex-col gap-1">
          من يوم
          <Input type="date" className="h-9 w-44" min={todayISO} value={fromISO} onChange={(e) => (setFrom(e.target.value), setPreview(null))} />
        </label>
        <button disabled={busy} onClick={runPreview} className="h-9 px-3 rounded-md bg-accent text-bg text-sm disabled:opacity-50">
          {busy && !preview ? "…" : "عاين"}
        </button>
        {preview && preview.moves.length > 0 && (
          <button disabled={busy} onClick={runApply} className="h-9 px-3 rounded-md border border-accent text-accent text-sm disabled:opacity-50">
            طبّق ({preview.moves.length})
          </button>
        )}
      </div>

      {preview && (
        <>
          {preview.bottlenecks.length > 0 && (
            <section className="rounded-lg border border-warning/40 bg-warning/5 p-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-warning">
                <AlertTriangle className="w-4 h-4" /> اختناق — ما رح يلحقوا تسليمهم ({preview.bottlenecks.length})
              </h2>
              <p className="text-[11px] text-fg-muted mb-1">
                ما بينكتب عليهم شي. «متأخر أصلاً» = تسليمه قبل يوم البداية؛ «رح يتأخر» = الطاقة ما بتكفّي قبل تسليمه. الحلّ
                قرارك: «إعادة جدولة المتأخر»، أو تسليمهم لحدا فاضي.
              </p>
              {bottleneckGroups.map((g) => (
                <details key={g.person} className="text-[12px]">
                  <summary className="cursor-pointer select-none">
                    <b>{g.person}</b> — {g.already.length} متأخر أصلاً · {g.slipping.length} رح يتأخر
                  </summary>
                  <ul className="flex flex-col gap-0.5 mt-1 ps-3 text-fg-dim">
                    {[...g.slipping, ...g.already].map((b) => (
                      <li key={b.taskId}>
                        {b.label} — بيخلص {dayLabel(b.endISO)} والتسليم {dayLabel(b.readyISO)}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>
          )}

          <section className="rounded-lg border border-border bg-bg-elev p-3">
            <h2 className="text-sm font-semibold mb-2">الحمل اليومي بالتوقّع</h2>
            <div className="flex flex-col gap-1.5">
              {loadByPerson.map(([person, days]) => (
                <div key={person} className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="w-24 font-semibold truncate">{person}</span>
                  {days.map((d) => (
                    <span
                      key={d.dayISO}
                      title={`${dayLabel(d.dayISO)} — ${Math.round(d.load * 100)}%`}
                      className={`px-1.5 py-0.5 rounded ${d.load >= 0.99 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                    >
                      {d.dayISO.slice(8, 10)}/{Number(d.dayISO.slice(5, 7))} {Math.round(d.load * 100)}%
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-bg-elev p-3">
            <h2 className="text-sm font-semibold mb-2">
              يوم البداية الجديد ({preview.moves.length} كرت)
            </h2>
            {preview.moves.length === 0 && <p className="text-sm text-fg-dim">كل كروت الخطة على يومها المتوقّع ✓</p>}
            <div className="flex flex-col gap-3">
              {byPerson.map((g) => (
                <div key={g.person}>
                  <h3 className="text-[12px] font-semibold">
                    {g.person} — {g.moves.length} كرت ({g.earlier} أبكر)
                  </h3>
                  <ul className="text-[11px] text-fg-dim flex flex-col gap-0.5 mt-1">
                    {g.moves.map((mv) => (
                      <li key={mv.taskId}>
                        {mv.label}: يبدأ {dayLabel(mv.fromISO)} ← <b className="text-fg">{dayLabel(mv.startISO)}</b> · التسليم{" "}
                        {dayLabel(mv.readyISO)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
