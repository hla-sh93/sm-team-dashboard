// One-off: move any photo-shoot date off Thursday/Friday back to the nearest
// photographer working day (Sat→Wed) in prisma/seed-data.json. Shooting never
// happens Thu/Fri (user rule); delivery dates are left untouched.
import { readFileSync, writeFileSync } from "fs";

const PATH = "prisma/seed-data.json";
const PHOTO_DAYS = [6, 0, 1, 2, 3]; // Sat..Wed
const data = JSON.parse(readFileSync(PATH, "utf8"));

function backWorkday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  let guard = 0;
  while (!PHOTO_DAYS.includes(dt.getDay()) && guard < 7) {
    dt.setDate(dt.getDate() - 1);
    guard++;
  }
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

let changed = [];
for (const s of data.photoSessions) {
  const next = backWorkday(s.shootDate);
  if (next !== s.shootDate) {
    changed.push(`${s.id}: shoot ${s.shootDate} → ${next}`);
    s.shootDate = next;
  }
}
for (const t of data.tasks) {
  if (t.type === "REEL" && t.workDate) {
    const next = backWorkday(t.workDate);
    if (next !== t.workDate) {
      changed.push(`${t.id}: reel workDate ${t.workDate} → ${next}`);
      t.workDate = next;
    }
  }
}

writeFileSync(PATH, JSON.stringify(data, null, 2) + "\n");
console.log(`Adjusted ${changed.length} dates off Thu/Fri:`);
changed.forEach((c) => console.log("  " + c));
