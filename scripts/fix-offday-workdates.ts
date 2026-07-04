/**
 * Move open assigned tasks off each assignee's non-working days.
 *
 * This enforces the hard rule that the team's scheduled workDate must always
 * fall on one of the employee's configured workDays. Completed history is left
 * untouched by default.
 */
import { PrismaClient } from "@prisma/client";
import { backWorkday, forwardWorkday, parseWorkDays, toISODate } from "../src/lib/dates";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const includeDone = process.argv.includes("--include-done");

function snapDate(task: {
  workDate: Date;
  readyDate: Date | null;
  publishDate: Date | null;
  stage: string | null;
}, workDays: number[]) {
  if (workDays.includes(task.workDate.getDay())) return task.workDate;
  if (task.readyDate || task.publishDate || task.stage === "PUBLISH") {
    return backWorkday(task.workDate, workDays);
  }
  return forwardWorkday(task.workDate, workDays);
}

async function main() {
  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, workDays: true },
  });
  const workDaysByEmployee = new Map(
    employees.map((employee) => [employee.id, parseWorkDays(employee.workDays)]),
  );
  const nameByEmployee = new Map(employees.map((employee) => [employee.id, employee.name]));

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: { not: null },
      workDate: { not: null },
      status: { not: "CANCELED" },
    },
    select: {
      id: true,
      title: true,
      kind: true,
      stage: true,
      status: true,
      board: true,
      assigneeId: true,
      workDate: true,
      readyDate: true,
      publishDate: true,
      completedAt: true,
      finishedAt: true,
    },
  });

  const updates: {
    id: string;
    title: string | null;
    assigneeId: string;
    from: Date;
    to: Date;
  }[] = [];
  for (const task of tasks) {
    if (!task.assigneeId || !task.workDate) continue;
    if (!includeDone && isTaskDoneState(task)) continue;
    const workDays = workDaysByEmployee.get(task.assigneeId);
    if (!workDays) continue;
    const next = snapDate(task as typeof task & { workDate: Date }, workDays);
    if (toISODate(next) === toISODate(task.workDate)) continue;
    updates.push({
      id: task.id,
      title: task.title,
      assigneeId: task.assigneeId,
      from: task.workDate,
      to: next,
    });
  }

  for (const update of updates) {
    await prisma.task.update({
      where: { id: update.id },
      data: { workDate: update.to, isPinned: true },
    });
  }

  console.log(`✓ off-day workDate fix: moved ${updates.length} open task(s)`);
  for (const update of updates.slice(0, 40)) {
    console.log(
      `  - ${nameByEmployee.get(update.assigneeId) ?? update.assigneeId}: ${
        update.title ?? update.id
      } ${toISODate(update.from)} → ${toISODate(update.to)}`,
    );
  }
  if (updates.length > 40) console.log(`  ...and ${updates.length - 40} more`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
