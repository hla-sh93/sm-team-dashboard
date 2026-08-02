/**
 * DATA INTEGRITY AUDIT — read-only checks against the REAL database.
 *
 * Every other test file works on hand-built fixtures, so a fixture can be
 * perfect while the actual `prisma/dev.db` (or production Postgres, if
 * DATABASE_URL points there) has drifted: orphan rows left by a half-finished
 * migration, duplicate deterministic keys after a botched regenerate, renewals
 * JSON hand-edited into nonsense, work dated before a contract exists.
 *
 * These tests answer "is the data the app is running on actually sane?" — they
 * never write. They open their OWN Prisma client bound to the same DATABASE_URL
 * rather than the app singleton, so they can never be pointed at a scratch DB by
 * another test file that mutates `process.env`.
 *
 * A failure here is a DATA problem to fix with a script, not necessarily a code
 * bug. Skips itself when the database is empty/unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  BOARDS,
  CONTENT_TYPES,
  STAGES,
  STATUSES,
  TASK_KINDS,
  isTaskDoneState,
} from "../src/lib/constants";
import { cyclesOf, cycleForBucket, parseRenewals } from "../src/lib/contract";
import { toISODate, parseWorkDays } from "../src/lib/dates";

/**
 * Resolve the app's real DATABASE_URL without depending on dotenv (not a
 * dependency here) and without trusting `process.env`, which a sibling test
 * file may have repointed at a scratch database.
 */
function realDatabaseUrl(): string {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8");
      const line = raw
        .split(/\r?\n/)
        .find((l) => l.trim().replace(/^﻿/, "").startsWith("DATABASE_URL"));
      if (!line) continue;
      const value = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
      if (value) return value;
    } catch {
      /* file missing — try the next one */
    }
  }
  return process.env.DATABASE_URL ?? "file:./prisma/dev.db";
}

const prisma = new PrismaClient({ datasources: { db: { url: realDatabaseUrl() } } });

type Row = Record<string, any>;
let employees: Row[] = [];
let companies: Row[] = [];
let tasks: Row[] = [];
let sessions: Row[] = [];
let seeded = false;

beforeAll(async () => {
  try {
    [employees, companies, tasks, sessions] = await Promise.all([
      prisma.employee.findMany(),
      prisma.company.findMany(),
      prisma.task.findMany(),
      prisma.photoSession.findMany(),
    ]);
    seeded = companies.length > 0;
  } catch {
    seeded = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Marks a test as vacuously passing on an empty DB instead of failing. */
const skipIfEmpty = () => {
  if (!seeded) console.warn("DB empty/unavailable — integrity checks skipped");
  return !seeded;
};

const nameOf = (id: string | null) => companies.find((c) => c.id === id)?.name ?? id ?? "—";
const live = () => tasks.filter((t) => t.status !== "CANCELED");
/** Auto-generated content pieces — the rows the engine owns and can be judged on. */
const autoContent = () =>
  live().filter((t) => t.isAuto && t.kind === "CONTENT" && t.type && t.companyId);

describe("referential integrity", () => {
  it("every task points at a company that exists", () => {
    if (skipIfEmpty()) return;
    const ids = new Set(companies.map((c) => c.id));
    const orphans = tasks.filter((t) => t.companyId && !ids.has(t.companyId));
    expect(orphans.map((t) => `${t.id} → ${t.companyId}`)).toEqual([]);
  });

  it("every task points at an employee that exists (or nobody)", () => {
    if (skipIfEmpty()) return;
    const ids = new Set(employees.map((e) => e.id));
    const orphans = tasks.filter((t) => t.assigneeId && !ids.has(t.assigneeId));
    expect(orphans.map((t) => `${t.id} → ${t.assigneeId}`)).toEqual([]);
  });

  it("every blockedById points at a task that exists", () => {
    if (skipIfEmpty()) return;
    const ids = new Set(tasks.map((t) => t.id));
    const dangling = tasks.filter((t) => t.blockedById && !ids.has(t.blockedById));
    expect(dangling.map((t) => `${t.id} ⇢ ${t.blockedById}`)).toEqual([]);
  });

  it("no task is blocked by itself", () => {
    if (skipIfEmpty()) return;
    expect(tasks.filter((t) => t.blockedById === t.id).map((t) => t.id)).toEqual([]);
  });

  it("every photo session points at a company that exists", () => {
    if (skipIfEmpty()) return;
    const ids = new Set(companies.map((c) => c.id));
    expect(sessions.filter((s) => !ids.has(s.companyId)).map((s) => s.id)).toEqual([]);
  });

  it("every company owner reference points at an employee that exists", () => {
    if (skipIfEmpty()) return;
    const ids = new Set(employees.map((e) => e.id));
    const bad: string[] = [];
    for (const c of companies) {
      for (const k of [
        "postOwnerId",
        "storyOwnerId",
        "aiReelOwnerId",
        "defaultOwnerId",
        "photographerId",
      ]) {
        if (c[k] && !ids.has(c[k])) bad.push(`${c.name}.${k} → ${c[k]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("enum / shape validity", () => {
  it("task kind, status, board and stage are all known values", () => {
    if (skipIfEmpty()) return;
    const bad: string[] = [];
    for (const t of tasks) {
      if (!TASK_KINDS.includes(t.kind)) bad.push(`${t.id} kind=${t.kind}`);
      // CANCELED is a soft-delete marker outside the spec's STATUSES list.
      if (![...STATUSES, "CANCELED"].includes(t.status)) bad.push(`${t.id} status=${t.status}`);
      if (!BOARDS.includes(t.board)) bad.push(`${t.id} board=${t.board}`);
      if (t.stage && !STAGES.includes(t.stage)) bad.push(`${t.id} stage=${t.stage}`);
      if (t.type && !CONTENT_TYPES.includes(t.type)) bad.push(`${t.id} type=${t.type}`);
    }
    expect(bad).toEqual([]);
  });

  it("months are 0-based and years are sane", () => {
    if (skipIfEmpty()) return;
    const bad = tasks.filter((t) => t.month < 0 || t.month > 11 || t.year < 2020 || t.year > 2100);
    expect(bad.map((t) => `${t.id} ${t.year}-${t.month}`)).toEqual([]);
  });

  it("employee workDays and rates parse as valid JSON", () => {
    if (skipIfEmpty()) return;
    const bad: string[] = [];
    for (const e of employees) {
      const days = parseWorkDays(e.workDays);
      if (!Array.isArray(days) || days.length === 0) bad.push(`${e.name}.workDays=${e.workDays}`);
      if (days.some((d) => d < 0 || d > 6)) bad.push(`${e.name}.workDays out of range`);
      if (e.rates) {
        try {
          const r = JSON.parse(e.rates);
          if (typeof r !== "object" || r === null) bad.push(`${e.name}.rates not an object`);
        } catch {
          bad.push(`${e.name}.rates invalid JSON`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("plan numbers are non-negative", () => {
    if (skipIfEmpty()) return;
    const bad = companies.filter(
      (c) => c.posts < 0 || c.reels < 0 || c.stories < 0 || c.aiReels < 0 || c.contractValue < 0,
    );
    expect(bad.map((c) => c.name)).toEqual([]);
  });
});

describe("contract cycles", () => {
  it("renewals is valid JSON, an array of parseable dates", () => {
    if (skipIfEmpty()) return;
    const bad: string[] = [];
    for (const c of companies) {
      if (!c.renewals) continue;
      let arr: unknown;
      try {
        arr = JSON.parse(c.renewals);
      } catch {
        bad.push(`${c.name}: renewals is not JSON — ${c.renewals}`);
        continue;
      }
      if (!Array.isArray(arr)) {
        bad.push(`${c.name}: renewals is not an array`);
        continue;
      }
      for (const v of arr as unknown[]) {
        if (typeof v !== "string" || Number.isNaN(new Date(v).getTime())) {
          bad.push(`${c.name}: bad renewal entry ${JSON.stringify(v)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("a company with renewals also has a contractStartDate", () => {
    if (skipIfEmpty()) return;
    // Renewals are cycle starts AFTER the first — meaningless with no first.
    const bad = companies.filter(
      (c) => !c.contractStartDate && parseRenewals(c as any).length > 0,
    );
    expect(bad.map((c) => c.name)).toEqual([]);
  });

  it("cycles are strictly ordered, non-overlapping and never empty", () => {
    if (skipIfEmpty()) return;
    const bad: string[] = [];
    for (const c of companies) {
      const cycles = cyclesOf(c as any);
      for (let i = 0; i < cycles.length; i++) {
        const cy = cycles[i];
        if (cy.end.getTime() <= cy.start.getTime()) {
          bad.push(`${c.name} cycle ${i}: end ≤ start`);
        }
        if (cy.days.length === 0) bad.push(`${c.name} cycle ${i}: no days`);
        const next = cycles[i + 1];
        if (next && next.start.getTime() < cy.end.getTime()) {
          bad.push(`${c.name}: cycle ${i} overlaps cycle ${i + 1}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("no cycle begins on/after an explicit contractEndedAt", () => {
    if (skipIfEmpty()) return;
    const bad: string[] = [];
    for (const c of companies.filter((x) => x.contractEndedAt)) {
      const cutoff = new Date(c.contractEndedAt).getTime();
      for (const cy of cyclesOf(c as any)) {
        if (cy.start.getTime() >= cutoff) {
          bad.push(`${c.name}: cycle starting ${toISODate(cy.start)} is past the cutoff`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("scheduling rules hold on the stored data", () => {
  /**
   * The floor applies to what is still SCHEDULED, not to what already happened.
   *
   * وصل's start moved 13/7 → 21/7 (the lead: «وصل 21/7 بلشنا»), and two design
   * cards stayed on 16/7 — finished, pinned, and publishing on 28 and 30/7.
   * That is not a scheduling error: production legitimately runs ahead of the
   * publishing window, and a finished card is recorded history that regeneration
   * must never rewrite. Only PUBLISHING is truly gated by the contract start.
   */
  it("no auto-generated work is still scheduled before its company's contract start", () => {
    if (skipIfEmpty()) return;
    const byId = new Map(companies.map((c) => [c.id, c]));
    const bad: string[] = [];
    for (const t of autoContent()) {
      const co = byId.get(t.companyId!);
      if (!co?.contractStartDate) continue;
      if (isTaskDoneState(t) || t.isPinned) continue; // history, not a plan
      const floor = new Date(co.contractStartDate);
      const floorMid = new Date(floor.getFullYear(), floor.getMonth(), floor.getDate()).getTime();
      for (const k of ["publishDate", "workDate", "readyDate"] as const) {
        const d = t[k] as Date | null;
        if (d && d.getTime() < floorMid) {
          bad.push(`${nameOf(t.companyId)} ${t.stage ?? t.kind} ${k}=${toISODate(d)} < العقد ${toISODate(floor)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("nothing is PUBLISHED before its company's contract start", () => {
    if (skipIfEmpty()) return;
    const byId = new Map(companies.map((c) => [c.id, c]));
    const bad: string[] = [];
    for (const t of autoContent()) {
      const co = byId.get(t.companyId!);
      if (!co?.contractStartDate || t.stage !== "PUBLISH" || !t.publishDate) continue;
      const floor = new Date(co.contractStartDate);
      const floorMid = new Date(floor.getFullYear(), floor.getMonth(), floor.getDate()).getTime();
      if (t.publishDate.getTime() < floorMid)
        bad.push(`${nameOf(t.companyId)} نشر ${toISODate(t.publishDate)} < العقد ${toISODate(floor)}`);
    }
    expect(bad).toEqual([]);
  });

  it("no auto-generated piece is scheduled to publish on a Friday", () => {
    if (skipIfEmpty()) return;
    const bad = autoContent().filter((t) => t.publishDate && t.publishDate.getDay() === 5);
    expect(bad.map((t) => `${nameOf(t.companyId)} ${toISODate(t.publishDate)}`)).toEqual([]);
  });

  it("every auto-generated piece falls inside one of its company's cycles", () => {
    if (skipIfEmpty()) return;
    const byId = new Map(companies.map((c) => [c.id, c]));
    const bad: string[] = [];
    for (const t of autoContent()) {
      const co = byId.get(t.companyId!);
      if (!co?.contractStartDate || !t.publishDate) continue;
      // Pinned rows are manual authority and are deliberately never clamped.
      if (t.isPinned) continue;
      const cyc = cycleForBucket(co as any, t.year, t.month);
      if (!cyc) {
        bad.push(`${co.name}: بند مولّد في bucket ${t.year}-${t.month + 1} بلا دورة`);
        continue;
      }
      const p = t.publishDate.getTime();
      if (p < cyc.start.getTime() || p >= cyc.end.getTime()) {
        bad.push(
          `${co.name}: نشر ${toISODate(t.publishDate)} خارج الدورة ${toISODate(cyc.start)}→${toISODate(cyc.end)}`,
        );
      }
    }
    expect(bad).toEqual([]);
  });

  it("engine-scheduled work never starts after its own deadline", () => {
    if (skipIfEmpty()) return;
    // PINNED rows are excluded on purpose: a manual edit is the lead's authority
    // and is never clamped (PROJECT.md §11). Deliberately parking a late piece
    // on a later work day is normal — the app models that as lateness, not
    // corruption. Only the ENGINE's own output must satisfy work ≤ deadline.
    const bad = live().filter(
      (t) =>
        !t.isPinned &&
        t.workDate &&
        t.readyDate &&
        t.workDate.getTime() > t.readyDate.getTime(),
    );
    expect(
      bad.map((t) => `${nameOf(t.companyId)} ${t.stage}: ${toISODate(t.workDate)} > ${toISODate(t.readyDate)}`),
    ).toEqual([]);
  });

  it("photo sessions deliver on/after the shoot and belong to a reel company", () => {
    if (skipIfEmpty()) return;
    const byId = new Map(companies.map((c) => [c.id, c]));
    const bad: string[] = [];
    for (const s of sessions) {
      if (s.deliverBy.getTime() < s.shootDate.getTime()) {
        bad.push(`${nameOf(s.companyId)}: تسليم ${toISODate(s.deliverBy)} قبل التصوير ${toISODate(s.shootDate)}`);
      }
      if (s.reelCount < 0) bad.push(`${nameOf(s.companyId)}: reelCount سالب`);
      const co = byId.get(s.companyId);
      if (co && co.reels === 0 && s.kind === "REELS") {
        bad.push(`${nameOf(s.companyId)}: جلسة ريلز لشركة بلا ريلات بالخطة`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("deterministic keys and piece numbering", () => {
  it("detKey is unique among live auto-generated tasks of the same stage", () => {
    if (skipIfEmpty()) return;
    const seen = new Map<string, number>();
    for (const t of live()) {
      if (!t.detKey || !t.isAuto) continue;
      const key = `${t.detKey}|${t.stage ?? ""}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1);
    expect(dupes.map(([k, n]) => `${k} ×${n}`)).toEqual([]);
  });

  it("piece numbers do not repeat within one (company, type, cycle, stage)", () => {
    if (skipIfEmpty()) return;
    const seen = new Map<string, number>();
    for (const t of live()) {
      if (t.pieceNo == null || !t.companyId || !t.type) continue;
      const key = `${t.companyId}|${t.type}|${t.year}-${t.month}|${t.stage ?? ""}|${t.pieceNo}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1);
    expect(dupes.map(([k, n]) => `${nameOf(k.split("|")[0])} ${k.split("|").slice(1).join("|")} ×${n}`)).toEqual([]);
  });

  it("piece numbers start at 1 per cycle and have no gaps", () => {
    if (skipIfEmpty()) return;
    const groups = new Map<string, number[]>();
    for (const t of live()) {
      if (t.pieceNo == null || !t.companyId || !t.type || t.stage !== "PUBLISH") continue;
      const key = `${t.companyId}|${t.type}|${t.year}-${t.month}`;
      groups.set(key, [...(groups.get(key) ?? []), t.pieceNo]);
    }
    // A DELETED piece keeps its number and stays CANCELED (§6.1), so a gap is
    // correct exactly when a canceled piece holds the missing number.
    const canceled = new Set(
      tasks
        .filter((t) => t.status === "CANCELED" && t.pieceNo != null && t.companyId && t.type)
        .map((t) => `${t.companyId}|${t.type}|${t.year}-${t.month}|${t.pieceNo}`),
    );
    const bad: string[] = [];
    for (const [key, nums] of groups) {
      const sorted = [...nums].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        for (let missing = sorted[i - 1] + 1; missing < sorted[i]; missing++) {
          if (!canceled.has(`${key}|${missing}`)) {
            bad.push(`${nameOf(key.split("|")[0])} ${key.split("|")[1]}: الرقم ${missing} مفقود بلا إلغاء`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("workflow state consistency", () => {
  it("a task on the DONE board is in a done status (and vice-versa)", () => {
    if (skipIfEmpty()) return;
    const bad = live().filter((t) => t.board === "DONE" && !isTaskDoneState(t as any));
    expect(bad.map((t) => `${t.id} board=DONE status=${t.status}`)).toEqual([]);
  });

  it("a finished task also carries a start timestamp", () => {
    if (skipIfEmpty()) return;
    // finishedAt without startedAt leaves /reports with no actual duration.
    // The `jun_x_*` rows are the hand-entered June actuals — their real start
    // was never known, and PROJECT.md §12 already accepts "—" there. Every
    // task the app itself moves through the board must have both.
    const bad = live().filter(
      (t) => t.finishedAt && !t.startedAt && !String(t.id).startsWith("jun_x_"),
    );
    expect(bad.map((t) => `${nameOf(t.companyId)} ${t.stage ?? t.kind} (${t.id})`)).toEqual([]);
  });

  it("work never finishes before it starts", () => {
    if (skipIfEmpty()) return;
    const bad = live().filter(
      (t) => t.startedAt && t.finishedAt && t.finishedAt.getTime() < t.startedAt.getTime(),
    );
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  it("canceled tasks stay pinned so a regenerate cannot resurrect them", () => {
    if (skipIfEmpty()) return;
    const bad = tasks.filter((t) => t.status === "CANCELED" && t.isAuto && !t.isPinned);
    expect(bad.map((t) => `${nameOf(t.companyId)} ${t.stage ?? t.kind} (${t.id})`)).toEqual([]);
  });
});

describe("plan vs ownership completeness", () => {
  it("every managed active company has an owner for each type it plans", () => {
    if (skipIfEmpty()) return;
    const missing: string[] = [];
    for (const c of companies) {
      if (!c.managed || c.status !== "active") continue;
      if (c.posts > 0 && !(c.postOwnerId ?? c.defaultOwnerId)) missing.push(`${c.name}: بوست`);
      if (c.stories > 0 && !(c.storyOwnerId ?? c.defaultOwnerId)) missing.push(`${c.name}: ستوري`);
      if (c.aiReels > 0 && !(c.aiReelOwnerId ?? c.defaultOwnerId)) missing.push(`${c.name}: ريل AI`);
      if (c.reels > 0 && !c.photographerId) missing.push(`${c.name}: مصوّر للريلات`);
    }
    expect(missing).toEqual([]);
  });

  it("a company assigned as photographer target is actually a photographer", () => {
    if (skipIfEmpty()) return;
    const photographers = new Set(employees.filter((e) => e.isPhotographer).map((e) => e.id));
    const bad = companies.filter((c) => c.photographerId && !photographers.has(c.photographerId));
    expect(bad.map((c) => `${c.name} → ${c.photographerId}`)).toEqual([]);
  });
});
