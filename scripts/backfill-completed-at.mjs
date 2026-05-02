import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const updated = await prisma.$executeRawUnsafe(
  `UPDATE Task SET completedAt = updatedAt WHERE status IN ('ready','published') AND completedAt IS NULL`,
);

console.log(`Backfilled ${updated} rows.`);
await prisma.$disconnect();
