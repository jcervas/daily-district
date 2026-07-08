import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// state-shapes: returns the congressional-district shapes for a single state.
//
// Gated so the nationwide answer can't be fingerprinted: a caller may only fetch
// a state's shapes once they have already CORRECTLY guessed that state today, or
// once today's puzzle is completed. Pre-state-guess the client ships no district
// geometry at all, so /today's mystery shape can't be matched against anything.
//
// Signed-in: gated on the persisted result. Anonymous (no token): the only state a
// legitimate player ever needs is the answer state (district phase is entered only
// after a correct state guess, and the correct state IS the answer state), so anon
// callers may fetch shapes only for the answer state.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function puzzleDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();

  let body: { state?: string };
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }
  const state = String(body.state ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return json(400, { error: "bad_request" });

  const admin = createClient(url, service);
  const date = puzzleDate();

  const { data: puzzle } = await admin
    .from("puzzles")
    .select("state")
    .eq("date", date)
    .maybeSingle();
  if (!puzzle) return json(404, { error: "no_puzzle" });

  if (user) {
    // Gate: the caller must have already correctly guessed this state today, or be done.
    const { data: result } = await admin
      .from("results")
      .select("guess_history, completed")
      .eq("user_id", user.id)
      .eq("puzzle_date", date)
      .maybeSingle();
    const history = (result?.guess_history ?? []) as Array<{ phase?: string; text?: string; correct?: boolean }>;
    const stateSolved = history.some((g) => g.phase === "state" && g.correct && String(g.text).toUpperCase() === state);
    if (!stateSolved && !result?.completed) return json(403, { error: "state_not_unlocked" });
  } else {
    // Anonymous: only the answer state's shapes are ever served.
    if (state !== String(puzzle.state).toUpperCase()) return json(403, { error: "state_not_unlocked" });
  }

  const { data: rows } = await admin
    .from("district_geometries")
    .select("district_id, state, geometry, adj")
    .eq("state", state);

  const districts = (rows ?? []).map((r) => ({
    districtId: r.district_id,
    state: r.state,
    number: String(r.district_id).slice(state.length + 1),
    geometry: r.geometry,
    adj: r.adj ?? [],
  }));

  return json(200, { state, districts });
});
