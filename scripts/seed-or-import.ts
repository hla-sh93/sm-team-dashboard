/**
 * Vercel build helper.
 *
 * With IMPORT_LOCAL_SNAPSHOT=1 the build makes production mirror the exported
 * local snapshot. The import is HASH-GUARDED (see
 * import-snapshot-to-postgres.ts): it replaces prod only the first time it sees
 * a given snapshot, then records its hash. So the flag is safe to leave on
 * permanently —
 *   • new snapshot committed → one destructive import → prod = local, then
 *   • every later deploy (same snapshot) → import self-skips (exit 3) → no-op,
 *     so prod keeps mirroring the last local export (the seed is intentionally
 *     NOT run here, so it can never resurrect an entity deleted locally).
 * Without the flag, deploys just run the non-destructive seed as before.
 */
import { spawnSync } from "child_process";
import { resolve } from "path";

const tsxCli = resolve("node_modules", "tsx", "dist", "cli.mjs");
const importLocal = process.env.IMPORT_LOCAL_SNAPSHOT === "1";
const EXIT_SKIPPED = 3;

function run(args: string[]) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

if (importLocal) {
  console.log("↥ import mode: making prod mirror the local snapshot (hash-guarded)");
  const imported = run([
    tsxCli,
    "scripts/import-snapshot-to-postgres.ts",
    "backups/local-db-snapshot.json",
    "--confirm",
  ]);
  if (imported.error) throw imported.error;
  // 0 = fresh import done · 3 = already imported (prod already matches). Both
  // are success; never seed on this path so prod stays an exact mirror.
  process.exit(imported.status === EXIT_SKIPPED ? 0 : (imported.status ?? 1));
}

console.log("↥ running seed");
const seeded = run([tsxCli, "prisma/seed.ts"]);
if (seeded.error) throw seeded.error;
process.exit(seeded.status ?? 1);
