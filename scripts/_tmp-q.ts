import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
const prisma = new PrismaClient();
const name = process.argv[2];
(async () => {
  const co = await prisma.company.findFirst({ where: { name: { contains: name } } });
  if(!co){console.log("no co");return;}
  console.log(co.name, "| contractStart:", co.contractStartDate, "| posts",co.posts,"reels",co.reels,"stories",co.stories);
  const ts = await prisma.task.findMany({ where: { companyId: co.id, status: { not: "CANCELED" } }, orderBy: [{year:"asc"},{month:"asc"},{stage:"asc"},{type:"asc"},{pieceNo:"asc"}] });
  for (const t of ts) {
    console.log(`${isTaskDoneState(t)?"✅":"⬜"} ${t.year}-${String(t.month+1).padStart(2,"0")} ${String(t.kind).padEnd(8)} ${String(t.stage).padEnd(8)} ${String(t.type??"").padEnd(7)} #${t.pieceNo??"-"} [${t.status}] ${t.title??""} | wd=${t.workDate?.toISOString?.().slice(0,10)} | ${(t.brief??"").replace(/\s+/g," ").slice(0,80)}`);
  }
  await prisma.$disconnect();
})();
