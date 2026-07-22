import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// One-off "special edition" mode (/oneoff.html). Every player — signed in or
// anonymous — plays the SAME fixed district, drawn from `oneoff_events` (a
// hand-seeded row, not the daily's date-driven `puzzles` schedule). Like
// `demo`, the full puzzle payload (answer + state shapes + clues + census)
// ships up front and guesses are validated client-side — this function does
// not gate/verify guesses, unlike `today`/`guess`. Unlike `demo`, a completed
// game's outcome IS recorded (client-reported, trusted) into `oneoff_results`
// so simple aggregate stats can be shown. Read+write; anon-callable
// (verify_jwt off) — the daily's anti-cheat is unaffected since this event's
// district is not the daily's.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;

async function statsFor(admin: Admin, slug: string) {
  const { data } = await admin.from("oneoff_results").select("won, guesses").eq("event_slug", slug);
  const rows = data ?? [];
  const played = rows.length;
  const won = rows.filter((r) => r.won).length;
  const avgGuesses = played ? rows.reduce((s, r) => s + (r.guesses || 0), 0) / played : 0;
  return {
    played,
    wonPct: played ? Math.round((won / played) * 100) : 0,
    avgGuesses: Math.round(avgGuesses * 10) / 10,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // verify_jwt is disabled so anonymous players can fetch/record too. A valid
  // token still resolves to a user; otherwise the caller is anonymous.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  const admin = createClient(url, service);

  let body: {
    action?: string; event?: string; session_id?: string;
    won?: boolean; guesses?: number; seconds?: number;
  };
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }

  const sid = (typeof body.session_id === "string" && body.session_id) ? body.session_id.slice(0, 64) : null;
  const action = body.action ?? "get";

  if (action === "record") {
    const slug = body.event;
    if (!slug) return json(400, { error: "bad_request" });
    const { data: event } = await admin.from("oneoff_events").select("slug").eq("slug", slug).maybeSingle();
    if (!event) return json(404, { error: "no_event" });

    const won = !!body.won;
    const guessesRaw = Number(body.guesses);
    const guesses = Number.isFinite(guessesRaw) ? Math.max(0, Math.round(guessesRaw)) : 0;
    const secondsRaw = Number(body.seconds);
    const seconds = Number.isFinite(secondsRaw) ? Math.max(0, Math.min(86400, Math.round(secondsRaw))) : 0;

    // Record once per identity (signed-in user id, else anonymous session id). A
    // replay by the same identity hits the event_slug+user_id / event_slug+session_id
    // partial unique index and fails — that error is intentionally ignored, the same
    // best-effort pattern the `guess` function uses for anon_results.
    await admin.from("oneoff_results").insert({
      event_slug: slug,
      user_id: user?.id ?? null,
      session_id: user ? null : sid,
      won, guesses, seconds,
    });

    const stats = await statsFor(admin, slug);
    return json(200, { recorded: true, stats });
  }

  if (action !== "get") return json(400, { error: "bad_action" });

  const { data: event } = body.event
    ? await admin.from("oneoff_events").select("slug, district_id, state, title, clues, census")
        .eq("slug", body.event).maybeSingle()
    : await admin.from("oneoff_events").select("slug, district_id, state, title, clues, census")
        .eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!event) return json(404, { error: "no_event" });

  const { data: answerGeo } = await admin
    .from("district_geometries").select("geometry").eq("district_id", event.district_id).maybeSingle();

  const { data: stateRows } = await admin
    .from("district_geometries").select("district_id, state, geometry, adj").eq("state", event.state);

  const prefix = event.state + "-";
  const districts = (stateRows ?? []).map((d) => ({
    districtId: d.district_id,
    state: d.state,
    number: String(d.district_id).startsWith(prefix) ? String(d.district_id).slice(prefix.length) : d.district_id,
    geometry: d.geometry,
    adj: d.adj ?? [],
  }));

  const stats = await statsFor(admin, event.slug);

  // Has this caller already played? Prevents re-earning a "fresh" recorded result
  // on reload/replay — the client should show their existing result instead.
  let already: { won: boolean; guesses: number; seconds: number } | null = null;
  if (user) {
    const { data: mine } = await admin.from("oneoff_results").select("won, guesses, seconds")
      .eq("event_slug", event.slug).eq("user_id", user.id).maybeSingle();
    already = mine ?? null;
  } else if (sid) {
    const { data: mine } = await admin.from("oneoff_results").select("won, guesses, seconds")
      .eq("event_slug", event.slug).eq("session_id", sid).maybeSingle();
    already = mine ?? null;
  }

  return json(200, {
    slug: event.slug,
    title: event.title,
    districtId: event.district_id,
    state: event.state,
    geometry: answerGeo?.geometry ?? null,
    clues: event.clues ?? {},
    census: event.census ?? null,
    districts,
    stats,
    already,
  });
});
