/**
 * فحص صحة اتصال البوت — قراءة فقط، ما بيغيّر ولا إعداد.
 *
 * `getUpdates` **ممنوعة** عن قصد: لما يكون في ويبهوك مسجّل بترجع 409، وإلغاء
 * الويبهوك مشان تشغيلها بيوقف استقبال الإنتاج. المسموح: هوية البوت وحالة
 * الويبهوك — وهنن بيكشفوا كل أعطال الاتصال العملية.
 *
 *   npx tsx --env-file=.env.local scripts/telegram-health.ts
 */
const API = "https://api.telegram.org";

async function call(token: string, method: string) {
  const res = await fetch(`${API}/bot${token}/${method}`);
  return (await res.json()) as { ok: boolean; result?: Record<string, unknown>; description?: string };
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) { console.log("❌ ما في TELEGRAM_BOT_TOKEN بالبيئة"); process.exit(1); }
  console.log(`التوكن: موجود (${token.split(":")[0]}:…)  ← الرقم العام بس`);

  const me = await call(token, "getMe");
  console.log(me.ok ? `✅ البوت حي: @${me.result?.username} (${me.result?.first_name})` : `❌ getMe: ${me.description}`);

  const wh = await call(token, "getWebhookInfo");
  if (!wh.ok) { console.log(`❌ getWebhookInfo: ${wh.description}`); return; }
  const r = wh.result ?? {};
  const url = String(r.url ?? "");
  console.log(url ? `✅ الويبهوك مسجّل: ${url}` : "❌ ما في ويبهوك مسجّل — ولا رسالة بتوصل النظام");
  console.log(`   تحديثات معلّقة: ${r.pending_update_count ?? 0}`);
  if (r.last_error_message)
    console.log(`   ⚠️ آخر خطأ: ${r.last_error_message} (${new Date(Number(r.last_error_date) * 1000).toISOString().slice(0, 16)})`);
  else console.log("   ✅ ولا خطأ مسجّل");
  if (r.max_connections) console.log(`   أقصى اتصالات: ${r.max_connections}`);
  if (Array.isArray(r.allowed_updates) && r.allowed_updates.length)
    console.log(`   أنواع مسموحة: ${r.allowed_updates.join("، ")}`);
}
main().catch((e) => { console.error(String(e).slice(0, 200)); process.exit(1); });
