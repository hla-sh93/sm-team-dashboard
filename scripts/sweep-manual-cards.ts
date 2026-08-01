import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { isTaskDoneState } from "../src/lib/constants";
const prisma = new PrismaClient();

const ROOT = "C:/Users/hla2-/Downloads/Telegram Desktop/ChatExport_2026-08-01";
const all = JSON.parse(readFileSync(`${ROOT}/result.json`, "utf8")).messages as any[];
const byId = new Map(all.map((m) => [m.id, m]));
const roots = new Set(all.filter((m) => m.action === "topic_created").map((m) => m.id));
const topicTitle = new Map(all.filter((m) => m.action === "topic_created").map((m) => [m.id, m.title]));
const topicOf = (m: any) => { let c = m, h = 0; while (c && h++ < 200) { if (roots.has(c.id)) return c.id; if (!c.reply_to_message_id) return null; c = byId.get(c.reply_to_message_id); } return null; };
const txt = (m: any) => (typeof m.text === "string" ? m.text : Array.isArray(m.text) ? m.text.map((x: any) => (typeof x === "string" ? x : x.text)).join("") : "");

// كلمات دالة من عنوان الكرت (منشيل الكلمات العامة)
const STOP = new Set(["تصميم", "تصاميم", "مهمة", "متابعة", "إعداد", "كتابة", "محتوى", "على", "مع", "بوستات", "ريل", "ستوري"]);
const keywords = (title: string) =>
  title.split(/[\s:—–-]+/).filter((w) => w.length > 2 && !STOP.has(w)).slice(0, 4);

async function main() {
  const open = await prisma.task.findMany({
    where: { kind: { in: ["ADHOC"] }, status: { notIn: ["CANCELED"] } },
    include: { assignee: true, company: true },
  });
  const stillOpen = open.filter((t) => !isTaskDoneState(t) && t.title && !t.id.startsWith("jobsplan_") && !t.id.startsWith("course_"));
  console.log(`كروت يدوية مفتوحة (بلا خطة الإطلاق والدورات): ${stillOpen.length}\n`);
  for (const t of stillOpen) {
    const kws = keywords(t.title!);
    const hits = all.filter((m) => {
      const s = `${m.file_name ?? ""} ${txt(m)}`;
      return m.date >= "2026-06-15" && kws.some((k) => s.includes(k));
    });
    console.log(`⬜ «${t.title}» · ${t.assignee?.name ?? "—"} · ${t.company?.name ?? "بلا شركة"} · موعده ${t.workDate?.toISOString().slice(5, 10) ?? "—"}`);
    for (const h of hits.slice(0, 4))
      console.log(`     ↪ ${h.date.slice(0, 10)} | ${topicTitle.get(topicOf(h)) ?? "عام"} | ${(h.from ?? "").slice(0, 14)} | ${(h.file_name ?? txt(h)).replace(/\n/g, " ").slice(0, 60)}`);
    if (!hits.length) console.log("     (ولا إشارة بالتصدير)");
  }
}
main().finally(() => prisma.$disconnect());
