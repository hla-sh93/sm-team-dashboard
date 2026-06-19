// مخبر د.نور (c_noor) shoots on TUESDAY (client only free then). Snap its REEL
// sessions + reel-task workdates back to the nearest Tuesday on/before the
// current date. Photoshoot (session 1) is left as-is.
import { readFileSync, writeFileSync } from "fs";

const PATH = "prisma/seed-data.json";
const COMPANY = "c_noor";
const TUESDAY = 2;
const data = JSON.parse(readFileSync(PATH, "utf8"));

function snapToTuesday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  let guard = 0;
  while (dt.getDay() !== TUESDAY && guard < 7) {
    dt.setDate(dt.getDate() - 1);
    guard++;
  }
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const changed = [];
for (const s of data.photoSessions) {
  if (s.companyId !== COMPANY || s.kind !== "REELS") continue;
  const next = snapToTuesday(s.shootDate);
  if (next !== s.shootDate) {
    changed.push(`${s.id}: ${s.shootDate} → ${next}`);
    s.shootDate = next;
  }
}
for (const t of data.tasks) {
  // Only the SHOOT stage moves to Tuesday — never the PUBLISH card (its
  // workDate is the publish day) or other types.
  if (t.companyId !== COMPANY || t.type !== "REEL" || !t.workDate) continue;
  if (t.stage && t.stage !== "SHOOT") continue;
  const next = snapToTuesday(t.workDate);
  if (next !== t.workDate) {
    changed.push(`${t.id}: reel ${t.workDate} → ${next}`);
    t.workDate = next;
  }
}

writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(`مخبر → Tuesday: adjusted ${changed.length}`);
changed.forEach((c) => console.log("  " + c));
