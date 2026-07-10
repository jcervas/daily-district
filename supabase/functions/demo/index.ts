import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Demo mode (/demo.html). Serves a RANDOM puzzle's FULL data (answer shape + the
// state's district shapes + clues + census + answer), regardless of date — so the
// game can be exercised end-to-end without touching the live daily, recording a
// result, or writing telemetry. Read-only; anon-callable (verify_jwt disabled).
// Every district here is "public" by design (it's a throwaway practice round), so
// returning the answer up front is fine — the daily's anti-cheat is unaffected.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  // Pick a random puzzle: count, then fetch one row at a random offset (ordered by
  // date for a stable offset). Cheaper than pulling every clue blob to shuffle client-side.
  const { count, error: cErr } = await admin
    .from("puzzles").select("date", { count: "exact", head: true });
  if (cErr) return json(500, { error: "count_failed", detail: cErr.message });
  if (!count) return json(404, { error: "no_puzzles" });

  const offset = Math.floor(Math.random() * count);
  const { data: puzzle, error: pErr } = await admin
    .from("puzzles")
    .select("date, puzzle_number, district_id, state, clues, census")
    .order("date", { ascending: true })
    .range(offset, offset)
    .maybeSingle();
  if (pErr) return json(500, { error: "pick_failed", detail: pErr.message });
  if (!puzzle) return json(404, { error: "no_puzzle" });

  const { data: answerGeo } = await admin
    .from("district_geometries").select("geometry").eq("district_id", puzzle.district_id).maybeSingle();

  const { data: stateRows } = await admin
    .from("district_geometries").select("district_id, state, geometry, adj").eq("state", puzzle.state);

  const prefix = puzzle.state + "-";
  const districts = (stateRows ?? []).map((d) => ({
    districtId: d.district_id,
    state: d.state,
    number: String(d.district_id).startsWith(prefix) ? String(d.district_id).slice(prefix.length) : d.district_id,
    geometry: d.geometry,
    adj: d.adj ?? [],
  }));

  return json(200, {
    demo: true,
    date: puzzle.date,
    puzzleNumber: puzzle.puzzle_number,
    districtId: puzzle.district_id,
    state: puzzle.state,
    geometry: answerGeo?.geometry ?? null,
    clues: puzzle.clues ?? {},
    census: puzzle.census ?? null,
    districts,
  });
});
