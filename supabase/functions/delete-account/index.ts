import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Permanently delete the caller's account: removes the auth user (which cascades
// the profile) and scrubs telemetry, while INTENTIONALLY retaining their rows in
// `results`. Those rows keep their original user_id (a random UUID) but, with the
// auth user / profile / telemetry gone and the results->auth FK dropped, they are
// no longer linked to any identity. The aggregate leaderboard still counts them.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // Resolve the caller from their JWT. A real signed-in user is required so a
  // request can only ever delete its own account.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "not_authenticated" });

  const admin = createClient(url, service);

  // Scrub the device/identity fingerprint. (FK is ON DELETE SET NULL, but delete
  // outright so no orphaned device rows remain.)
  const { error: telErr } = await admin.from("telemetry").delete().eq("user_id", user.id);
  if (telErr) return json(500, { error: "telemetry_cleanup_failed", detail: telErr.message });

  // Delete the profile explicitly (also covered by the auth-user CASCADE, but be
  // explicit so we fail loudly if anything is off).
  const { error: profErr } = await admin.from("profiles").delete().eq("user_id", user.id);
  if (profErr) return json(500, { error: "profile_cleanup_failed", detail: profErr.message });

  // Finally remove the auth identity (email, providers, session). results rows are
  // left untouched (results->auth FK was dropped) so game history is retained.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json(500, { error: "auth_delete_failed", detail: delErr.message });

  return json(200, { deleted: true });
});
