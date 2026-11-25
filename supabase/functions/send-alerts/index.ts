// Life Board: sends task alerts as web push notifications.
// Called every minute by pg_cron (with x-cron-key), or by the app with the user's own sign-in to send a test.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { dueAlerts, localNow } from "./alerts.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let cfg: Record<string, string> | null = null;
async function config() {
  if (!cfg) {
    const { data, error } = await admin.rpc("lb_push_config");
    if (error) throw error;
    cfg = data as Record<string, string>;
    webpush.setVapidDetails("https://lewish85.github.io/life-board/", cfg.lb_vapid_public, cfg.lb_vapid_private);
  }
  return cfg;
}

type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string };
async function push(sub: Sub, payload: Record<string, unknown>) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 900, urgency: "high" });
    return true;
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subs").delete().eq("endpoint", sub.endpoint); // phone unsubscribed
    else console.error("push failed", e?.statusCode, e?.body);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const c = await config();

    // ---- test from the app: authenticate the signed-in user ----
    if (req.headers.get("x-cron-key") !== c.lb_cron_key) {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
      if (!u?.user) return json({ error: "not signed in" }, 401);
      const { data: subs } = await admin.from("push_subs").select("*").eq("user_id", u.user.id);
      let sent = 0;
      for (const s of (subs || []) as Sub[]) if (await push(s, { title: "🔔 Notifications are on", body: "You'll get a nudge 5 minutes before each task starts.", tag: "lb-test", url: "./#timeline" })) sent++;
      return json({ sent, devices: subs?.length || 0 });
    }

    // ---- every minute: find due alerts for everyone with a subscribed device ----
    const { data: subs, error } = await admin.from("push_subs").select("*");
    if (error) throw error;
    const byUser = new Map<string, Sub[]>();
    for (const s of (subs || []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]);
    let sent = 0;
    for (const [uid, list] of byUser) {
      const now = localNow(list[0].tz || "Australia/Sydney");
      const { data: docs } = await admin.from("docs").select("coll,id,data").eq("user_id", uid);
      for (const a of dueAlerts(docs || [], now)) {
        const { error: dup } = await admin.from("push_sent").insert({ user_id: uid, key: a.key });
        if (dup) continue; // already sent
        for (const s of list) if (await push(s, a)) sent++;
      }
    }
    if (new Date().getUTCMinutes() === 0) await admin.from("push_sent").delete().lt("sent_at", new Date(Date.now() - 3 * 864e5).toISOString());
    return json({ sent, users: byUser.size });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
