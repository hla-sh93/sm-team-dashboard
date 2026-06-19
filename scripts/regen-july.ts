/**
 * Regenerate July's CONTENT tasks + photo sessions from the (new) engine, while
 * KEEPING the manual writer (CONTENT_WRITING) and publisher (REPORT) tasks.
 * Ad-hoc tasks are taken from the engine output (so their workDate is packed).
 * Run:  npx tsx scripts/regen-july.ts   (then re-apply مخبر-Tuesday + re-seed)
 */
import { readFileSync, writeFileSync } from "fs";
import { buildSchedule } from "../src/lib/scheduler";
import { expandPipeline } from "../src/lib/pipeline";

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

const writerId =
  data.employees.find((e: any) => /كات|writer/i.test(e.role))?.id ?? null;
const publisherId =
  data.employees.find((e: any) => /ناشر|نشر|publisher/i.test(e.role))?.id ?? null;

// Build the pipeline (write → design/shoot → publish) from engine content items.
const items = result.tasks
  .filter((t) => t.kind === "CONTENT" && t.companyId && t.type)
  .map((t) => ({
    companyId: t.companyId!,
    type: t.type as "POST" | "REEL" | "AI_REEL" | "STORY",
    assigneeId: t.assigneeId,
    publishDate: iso(t.publishDate),
    readyDate: iso(t.readyDate),
    workDate: iso(t.workDate),
    week: t.week,
    status: t.status,
  }));

const pipe = expandPipeline(items, {
  writerId,
  publisherId,
  year,
  month,
  companyName: (cid) => coName[cid] ?? "",
});

const DOW2 = (s: string | null) =>
  s ? DOW[new Date(s + "T00:00:00").getDay()] : null;
const pipelineTasks = pipe.map((t) => ({
  ...t,
  company: coName[t.companyId ?? ""] ?? "",
  dayName: DOW2(t.publishDate ?? t.workDate),
  month: data.meta.month,
  year,
}));

let n = 1;
const id = () => `x_${String(n++).padStart(3, "0")}`;

// Keep the month report (publishing is now per-item PUBLISH cards). Ad-hoc from
// engine (packed workDate). Writer plan is replaced by per-company WRITE cards.
const report = data.tasks
  .filter((t: any) => t.kind === "REPORT")
  .map((t: any) => ({ ...t, id: id() }));
const adhoc = result.tasks
  .filter((t) => t.kind === "ADHOC")
  .map((t) => ({
    kind: "ADHOC", stage: null, board: "TODO", blockedById: null, pipelineKey: null,
    type: null, title: t.title, quantity: 1,
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

data.tasks = [...pipelineTasks, ...report, ...adhoc];
data.photoSessions = sessions;
data.meta.totals = {
  contentItems: items.length,
  allTasks: data.tasks.length,
  photoSessions: sessions.length,
};
data.meta.generatedBy = "engine v3 (pipeline/kanban)";
const content = pipelineTasks; // for the log line below

writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(
  `Regenerated pipeline: ${content.length} stage-cards + ${report.length} report + ${adhoc.length} adhoc = ${data.tasks.length} tasks; ${sessions.length} sessions.`,
);
