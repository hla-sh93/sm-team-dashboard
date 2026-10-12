/**
 * عدّة الفحص العميق لمحرّك إعادة التوليد — قاعدة SQLite معزولة تنبنى من
 * `prisma/schema.prisma` نفسها (بلا `prisma/dev.db` وبلا `prisma generate`):
 * الـDDL بيطلع من `prisma migrate diff --from-empty … --script` (قراءة فقط)
 * وبينفّذ جملة جملة على ملف اسمه فيه `test` (شرط `tests/_helpers/test-database.ts`).
 *
 * الفريق مصغّر على أدوار المحرّك: كاتبة (`/كات/`)، مصمّمان، مصوّر، مونتيرة
 * (`/مونتير/`)، ناشر (`/ناشر/`) — كلهم على أسبوع الأحد→الخميس.
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

let ddl: string[] | null = null;

export function schemaStatements(): string[] {
  if (ddl) return ddl;
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  ddl = sql
    .split(/;\s*\r?\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  return ddl;
}

export async function createSchema(prisma: PrismaClient) {
  for (const stmt of schemaStatements()) await prisma.$executeRawUnsafe(stmt);
}

export function removeDb(path: string) {
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${path}${s}`, { force: true });
}

export const WORK_DAYS = JSON.stringify([0, 1, 2, 3, 4]);

export const TEAM = {
  writer: { id: "e_nawal", name: "نوال", role: "كاتبة محتوى" },
  designer: { id: "e_ayman", name: "أيمن", role: "مصمم" },
  designer2: { id: "e_sabin", name: "سابين", role: "مصمم" },
  photographer: { id: "e_majed", name: "ماجد", role: "مصور", isPhotographer: true },
  editor: { id: "e_alisar", name: "أليسار", role: "مونتيرة" },
  publisher: { id: "e_omar", name: "عمر", role: "ناشر + مدير صفحات" },
} as const;

export async function seedTeam(prisma: PrismaClient) {
  for (const e of Object.values(TEAM)) {
    await prisma.employee.create({
      data: {
        id: e.id,
        name: e.name,
        role: e.role,
        workDays: WORK_DAYS,
        isPhotographer: "isPhotographer" in e ? e.isPhotographer : false,
      },
    });
  }
}

/** تاريخ محلّي (منتصف الليل) — المحرّك بيقرأ الأيام بالتوقيت المحلّي. */
export const D = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d);
export const day = (d: Date | null | undefined) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : null;
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

let prio = 1;
export async function makeCompany(
  prisma: PrismaClient,
  id: string,
  over: Record<string, unknown> = {},
) {
  return prisma.company.create({
    data: {
      id,
      name: `شركة-${id}`,
      managed: true,
      status: "active",
      posts: 3,
      reels: 2,
      stories: 2,
      aiReels: 0,
      contractStartDate: D(2026, 9, 1),
      publishStartDate: D(2026, 9, 1),
      defaultOwnerId: TEAM.designer.id,
      photographerId: TEAM.photographer.id,
      priority: prio++,
      ...over,
    },
  });
}

export type Card = Awaited<ReturnType<PrismaClient["task"]["findMany"]>>[number];

export async function autoCards(prisma: PrismaClient, companyId: string, year?: number, month?: number) {
  return prisma.task.findMany({
    where: { companyId, isAuto: true, ...(year != null ? { year, month } : {}) },
    orderBy: [{ type: "asc" }, { pieceNo: "asc" }, { stage: "asc" }],
  });
}

export async function pieceCards(
  prisma: PrismaClient,
  companyId: string,
  type: string,
  pieceNo: number,
  bucket?: { year: number; month: number },
) {
  const rows = await prisma.task.findMany({
    where: { companyId, isAuto: true, type, pieceNo, ...(bucket ? { year: bucket.year, month: bucket.month } : {}) },
  });
  const by = (stage: string) => rows.find((r) => r.stage === stage) ?? null;
  return { production: by("DESIGN") ?? by("SHOOT"), edit: by("EDIT"), publish: by("PUBLISH"), all: rows };
}

const STAGE_RANK: Record<string, number> = { WRITE: 0, DESIGN: 1, SHOOT: 1, EDIT: 2, PUBLISH: 3 };

/** علاقات الحجز بعد التوليد: لا مؤشّر معلّق، الحاجز من نفس القطعة ومرحلته أسبق. */
export async function relationViolations(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.task.findMany({
    select: { id: true, stage: true, pipelineKey: true, blockedById: true, companyId: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: string[] = [];
  for (const r of rows) {
    if (!r.blockedById) continue;
    const b = byId.get(r.blockedById);
    if (!b) {
      out.push(`${r.id}: blockedById معلّق (${r.blockedById})`);
      continue;
    }
    if (b.companyId !== r.companyId) out.push(`${r.id}: الحاجز من شركة تانية`);
    if (b.stage !== "WRITE" && b.pipelineKey !== r.pipelineKey) out.push(`${r.id}: الحاجز من قطعة تانية`);
    if ((STAGE_RANK[b.stage ?? ""] ?? 9) >= (STAGE_RANK[r.stage ?? ""] ?? 9))
      out.push(`${r.id}: ترتيب المراحل مقلوب (${b.stage} → ${r.stage})`);
  }
  return out;
}

/** لقطة مختصرة لكل الحقول يلي بتهمّ الحفظ، لمقارنة توليدين. */
export function fingerprint(t: Card): string {
  return [
    t.board,
    t.status,
    t.isPinned,
    t.title,
    t.assigneeId,
    t.priority,
    t.quantity,
    t.pieceNo,
    day(t.workDate),
    day(t.readyDate),
    day(t.publishDate),
    day(t.manualDay),
    t.startedAt?.toISOString() ?? null,
    t.finishedAt?.toISOString() ?? null,
    t.completedAt?.toISOString() ?? null,
    t.brief,
    t.notes,
    t.pipelineKey,
    t.blockedById,
  ].join("|");
}

export async function tableSnapshot(prisma: PrismaClient, where: Record<string, unknown> = {}) {
  const rows = await prisma.task.findMany({ where });
  return new Map(rows.map((r) => [r.id, fingerprint(r)]));
}

export function diffSnapshots(a: Map<string, string>, b: Map<string, string>) {
  const changed: string[] = [];
  for (const [id, v] of a) {
    const w = b.get(id);
    if (w == null) changed.push(`${id}: انمحى`);
    else if (w !== v) changed.push(`${id}: ${v}\n   → ${w}`);
  }
  for (const id of b.keys()) if (!a.has(id)) changed.push(`${id}: جديد`);
  return changed;
}
