import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Invoked once daily by a pg_cron + pg_net job (see the invoke-send-daily-push cron
// job) — not by a signed-in player, so there's no user JWT. verify_jwt is disabled at
// the platform level and this shared-secret header stands in for auth instead.
function puzzleDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json(401, { error: "unauthorized" });
  }

  // Everything below runs behind the cron secret, so surfacing the raw error
  // message here is safe and beats the opaque 500 the default handler returns.
  try {
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:RedistrictNetwork@gmail.com";
    if (!vapidPublic || !vapidPrivate) return json(500, { error: "vapid_not_configured" });

    webpush.setVapidDetails(vapidSubject, vapidPublic.trim(), vapidPrivate.trim());

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth");
    if (error) return json(500, { error: error.message });

    const date = puzzleDate();
    const { data: puzzle } = await admin
      .from("puzzles")
      .select("puzzle_number")
      .eq("date", date)
      .maybeSingle();

    const payload = JSON.stringify({
      title: "Daily District",
      body: puzzle?.puzzle_number
        ? `Puzzle #${puzzle.puzzle_number} is live — can you guess today's district?`
        : "Today's district is live — come guess it!",
      url: "/",
    });

    let sent = 0, removed = 0, failed = 0;
    const errors: string[] = [];
    await Promise.all((subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const statusCode = (err && typeof err === "object" && "statusCode" in err)
          ? (err as { statusCode?: number }).statusCode
          : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        } else {
          failed++;
          errors.push(`${sub.id}: ${statusCode ?? ""} ${err instanceof Error ? err.message : String(err)}`.trim());
          console.error("push failed", sub.id, err);
        }
      }
    }));

    return json(200, { total: (subs ?? []).length, sent, removed, failed, errors, puzzleDate: date });
  } catch (err) {
    console.error("send-daily-push crashed", err);
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return json(500, { error: "unhandled", message });
  }
});
