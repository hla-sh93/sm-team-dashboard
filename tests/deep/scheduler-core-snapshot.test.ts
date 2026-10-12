/**
 * ثوابت على لقطة الإنتاج المستوردة بـ`prisma/dev.db` (prod-20261011-1249) —
 * قراءة فقط عبر `node:sqlite` بوضع readOnly، بلا Prisma. بتنتخطّى لما ما في
 * قاعدة. هون **الثوابت الحقيقية** بس (الملاحظات المعتمدة على الداتا بالتقرير).
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DB = "prisma/dev.db";

type Row = Record<string, unknown>;
async function openRows(): Promise<{ tasks: Row[]; employees: Row[]; sessions: Row[] } | null> {
  try {
    const mod = (await import("node:sqlite" as string)) as { DatabaseSync: new (p: string, o: { readOnly: boolean }) => { prepare: (s: string) => { all: () => Row[] }; close: () => void } };
    const db = new mod.DatabaseSync(DB, { readOnly: true });
    try {
      return {
        tasks: db.prepare("SELECT id, companyId, type, stage, status, board, pieceNo, pipelineKey, assigneeId, isPinned, year, month, publishDate, readyDate, workDate, completedAt, finishedAt FROM Task WHERE status <> 'CANCELED'").all(),
        employees: db.prepare("SELECT id, workDays, rates, isPhotographer FROM Employee").all(),
        sessions: db.prepare("SELECT companyId, kind, shootDate, deliverBy, reelCount, status FROM PhotoSession").all(),
      };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}
const asDate = (v: unknown): Date | null => (v == null ? null : typeof v === "number" ? new Date(v) : new Date(String(v)));
const isDone = (t: Row) => ["READY", "PUBLISHED"].includes(String(t.status)) || t.board === "DONE" || t.completedAt != null || t.finishedAt != null;
const utcDay = (d: Date) => d.toISOString().slice(0, 10);

describe.skipIf(!existsSync(DB))("لقطة الإنتاج — ثوابت المحرّك على الداتا الحيّة (قراءة فقط)", () => {
  it("كل مواعيد الكروت المفتوحة مخزّنة على منتصف ليل UTC (وإلا بتنقرا بيوم مختلف على Vercel وعلى الجهاز المحلي)", async () => {
    const data = await openRows();
    if (!data) return;
    const odd = data.tasks.filter((t) => !isDone(t)).flatMap((t) =>
      (["publishDate", "readyDate", "workDate"] as const).filter((f) => { const d = asDate(t[f]); return d && (d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0); }).map((f) => `${t.id} ${f}=${asDate(t[f])!.toISOString()}`),
    );
    expect(odd).toEqual([]);
  });

  it("ولا كرت نشر حيّ يوم جمعة", async () => {
    const data = await openRows();
    if (!data) return;
    const fri = data.tasks.filter((t) => t.stage === "PUBLISH" && asDate(t.publishDate)?.getUTCDay() === 5).map((t) => `${t.companyId} ${t.type}#${t.pieceNo} ${utcDay(asDate(t.publishDate)!)}`);
    expect(fri).toEqual([]);
  });

  it("الشغل المفتوح (كتابة/تصميم/تصوير/مونتاج) على يوم دوام صاحبه — المنجز بيسجّل الواقع ولو كان عطلة (BR-028)", async () => {
    const data = await openRows();
    if (!data) return;
    const wd = new Map(data.employees.map((e) => [String(e.id), JSON.parse(String(e.workDays ?? "[0,1,2,3,4]")) as number[]]));
    const off = data.tasks
      .filter((t) => !isDone(t) && t.assigneeId && t.workDate && ["WRITE", "DESIGN", "SHOOT", "EDIT"].includes(String(t.stage)))
      .filter((t) => !(wd.get(String(t.assigneeId)) ?? [0, 1, 2, 3, 4]).includes(asDate(t.workDate)!.getUTCDay()))
      .map((t) => `${t.id} ${t.companyId} ${t.type}#${t.pieceNo} ${t.stage} ${utcDay(asDate(t.workDate)!)} ${t.assigneeId}`);
    expect(off).toEqual([]);
  });

  it("سلسلة الريل المفتوحة بالترتيب: تصوير < مونتاج ≤ نشر، والتصوير قبل النشر", async () => {
    const data = await openRows();
    if (!data) return;
    const byPk = new Map<string, Record<string, Row>>();
    for (const t of data.tasks) { if (!t.pipelineKey) continue; const g = byPk.get(String(t.pipelineKey)) ?? {}; g[String(t.stage)] = t; byPk.set(String(t.pipelineKey), g); }
    const broken: string[] = [];
    for (const [pk, st] of byPk) {
      const s = st.SHOOT, e = st.EDIT, p = st.PUBLISH;
      if (!s || !p || isDone(p)) continue;
      const sd = asDate(s.readyDate ?? s.workDate), ed = e ? asDate(e.readyDate ?? e.workDate) : null, pd = asDate(p.publishDate);
      if (sd && pd && utcDay(sd) >= utcDay(pd)) broken.push(`${pk}: تصوير ${utcDay(sd)} ≥ نشر ${utcDay(pd)}`);
      else if (ed && sd && !isDone(s) && utcDay(ed) <= utcDay(sd)) broken.push(`${pk}: مونتاج ${utcDay(ed)} ≤ تصوير ${utcDay(sd)}`);
      else if (ed && pd && utcDay(ed) > utcDay(pd)) broken.push(`${pk}: مونتاج ${utcDay(ed)} > نشر ${utcDay(pd)}`);
    }
    expect(broken).toEqual([]);
  });

  it("أرقام القطع: ولا تكرار داخل (شركة، نوع، دلو) على كروت النشر الحيّة، وكل مراحل القطعة بنفس الرقم", async () => {
    const data = await openRows();
    if (!data) return;
    const groups = new Map<string, number[]>();
    for (const t of data.tasks) { if (t.stage !== "PUBLISH" || !t.type || t.pieceNo == null) continue; const k = `${t.companyId}|${t.type}|${t.year}-${t.month}`; groups.set(k, [...(groups.get(k) ?? []), Number(t.pieceNo)]); }
    const dups = [...groups].filter(([, v]) => new Set(v).size !== v.length).map(([k, v]) => `${k}: ${v.sort((a, b) => a - b).join(",")}`);
    expect(dups).toEqual([]);
    const byPk = new Map<string, Set<number | null>>();
    for (const t of data.tasks) { if (t.stage === "WRITE" || !t.pipelineKey) continue; const s = byPk.get(String(t.pipelineKey)) ?? new Set(); s.add(t.pieceNo == null ? null : Number(t.pieceNo)); byPk.set(String(t.pipelineKey), s); }
    const mixed = [...byPk].filter(([, s]) => s.size > 1).map(([k, s]) => `${k}: ${[...s]}`);
    expect(mixed).toEqual([]);
  });

  it("جلسات التصوير الحيّة: التسليم ما بيسبق التصوير، وجلسة الريلات فيها ريل واحد على الأقل", async () => {
    const data = await openRows();
    if (!data) return;
    const bad = data.sessions
      .filter((s) => s.status !== "CANCELED")
      .filter((s) => { const sd = asDate(s.shootDate), dd = asDate(s.deliverBy); return (sd && dd && dd < sd) || (s.kind === "REELS" && Number(s.reelCount) < 1); })
      .map((s) => `${s.companyId} ${s.kind} ${utcDay(asDate(s.shootDate)!)}`);
    expect(bad).toEqual([]);
  });
});
