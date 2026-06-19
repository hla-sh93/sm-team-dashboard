/**
 * Regenerate July's CONTENT tasks + photo sessions from the (new) engine, while
 * KEEPING the manual writer (CONTENT_WRITING) and publisher (REPORT) tasks.
 * Ad-hoc tasks are taken from the engine output (so their workDate is packed).
 * Run:  npx tsx scripts/regen-july.ts   (then re-apply مخبر-Tuesday + re-seed)
 */
import { readFileSync, writeFileSync } from "fs";
import { buildSchedule } from "../src/lib/scheduler";

const PATH = "prisma/seed-data.json";
const data: any = JSON.parse(readFileSync(PATH, "utf8"));
const year: number = data.meta.year;
const month = data.meta.month - 1; // 0-based

const iso = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`
    : null;
const DOW = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const coName: Record<string, string> = Object.fromEntries(
  data.companies.map((c: any) => [c.id, c.name]),
);

const employees = data.employees.map((e: any) => ({
  id: e.id, name: e.name, role: e.role, hoursPerDay: e.hoursPerDay,
  workDays: e.workDays, isScheduled: e.isScheduled, isPhotographer: e.isPhotographer,
}));
const companies = data.companies.map((c: any, i: number) => ({
  id: c.id, name: c.name, managed: c.managed, priority: i + 1, status: "active",
  posts: c.posts, reels: c.reels, stories: c.stories, aiReels: c.aiReels,
  postOwnerId: c.postOwnerId, storyOwnerId: c.storyOwnerId,
  aiReelOwnerId: c.aiReelOwnerId, defaultOwnerId: c.defaultOwnerId,
}));
const adhocIn = data.tasks
  .filter((t: any) => t.kind === "ADHOC")
  .map((t: any) => ({
    id: t.id, title: t.title, companyId: t.companyId, assigneeId: t.assigneeId,
    hours: t.hours ?? 0, priority: t.priority, status: t.status,
    readyDate: t.readyDate ? new Date(t.readyDate + "T00:00:00") : null,
  }));

const result = buildSchedule({ year, month, employees, companies, adhoc: adhocIn });

let n = 1;
const id = () => `t_${String(n++).padStart(3, "0")}`;

// Engine CONTENT tasks (sorted for stable ids).
const content = result.tasks
  .filter((t) => t.kind === "CONTENT")
  .sort(
    (a, b) =>
      (a.companyId ?? "").localeCompare(b.companyId ?? "") ||
      (a.type ?? "").localeCompare(b.type ?? "") ||
      (a.publishDate?.getTime() ?? 0) - (b.publishDate?.getTime() ?? 0),
  )
  .map((t) => ({
    kind: "CONTENT", type: t.type, title: null,
    companyId: t.companyId, company: coName[t.companyId ?? ""],
    assigneeId: t.assigneeId, hours: t.hours || null,
    priority: t.priority, status: t.status,
    publishDate: iso(t.publishDate), week: t.week,
    readyDate: iso(t.readyDate), workDate: iso(t.workDate),
    overflow: t.overflow,
    dayName: t.publishDate ? DOW[t.publishDate.getDay()] : null,
    id: id(), month: data.meta.month, year,
  }));

// Keep manual writer + report tasks as-is (renumbered).
const manual = data.tasks
  .filter((t: any) => t.kind === "CONTENT_WRITING" || t.kind === "REPORT")
  .map((t: any) => ({ ...t, id: id() }));

// Ad-hoc from engine (packed workDate).
const adhoc = result.tasks
  .filter((t) => t.kind === "ADHOC")
  .map((t) => ({
    kind: "ADHOC", type: null, title: t.title,
    companyId: t.companyId, company: coName[t.companyId ?? ""],
    assigneeId: t.assigneeId, hours: t.hours, priority: t.priority, status: t.status,
    publishDate: null, week: null,
    readyDate: iso(t.readyDate), workDate: iso(t.workDate), overflow: t.overflow,
    id: id(), month: data.meta.month, year,
  }));

const sessions = result.sessions.map((s) => ({
  id: `ps_${s.companyId}_${s.no}`,
  companyId: s.companyId, company: coName[s.companyId] ?? "",
  no: s.no, kind: s.kind,
  shootDate: iso(s.shootDate), deliverBy: iso(s.deliverBy),
  reelCount: s.reelCount, status: s.status,
}));

data.tasks = [...content, ...manual, ...adhoc];
data.photoSessions = sessions;
data.meta.totals = {
  contentItems: content.length,
  allTasks: data.tasks.length,
  photoSessions: sessions.length,
};
data.meta.generatedBy = "engine v2 (month-wide distribution)";

writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(
  `Regenerated: ${content.length} content + ${manual.length} manual + ${adhoc.length} adhoc = ${data.tasks.length} tasks; ${sessions.length} sessions.`,
);
