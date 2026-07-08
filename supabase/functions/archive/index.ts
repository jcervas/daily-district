import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Server-backed archive. Lists past puzzles and serves one past puzzle's FULL data
// (answer shape + the state's district shapes + clues + answer). Only dates strictly
// BEFORE today (America/New_York) are allowed, so today's answer is never exposed —
// the anti-cheat guarantee for the live daily stays intact. Past answers are public,
// so this is callable anonymously (verify_jwt disabled).

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
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // verify_jwt is disabled so anyone (incl. anonymous players) can browse/replay past
  // puzzles. Only dates strictly before today are served, so today's answer is safe.
  let body: { date?: string } = {};
  try { body = await req.json(); } catch { /* empty body = list */ }

  const admin = createClient(url, service);
  const today = puzzleDate();

  // ── List mode: every past puzzle, newest first ──────────────────────────────
  if (!body.date) {
    const { data, error } = await admin
      .from("puzzles")
      .select("date, puzzle_number, district_id, state")
      .lt("date", today)
      .order("date", { ascending: false })
      .limit(400);
    if (error) return json(500, { error: "list_failed", detail: error.message });
    return json(200, {
      puzzles: (data ?? []).map((p) => ({
        date: p.date, puzzleNumber: p.puzzle_number, districtId: p.district_id, state: p.state,
      })),
    });
  }

  // ── Get mode: one past puzzle's full data (date must be strictly past) ───────
  const date = String(body.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: "bad_date" });
  if (date >= today) return json(403, { error: "not_past" });

  const { data: puzzle } = await admin
    .from("puzzles")
    .select("date, puzzle_number, district_id, state, clues, census")
    .eq("date", date)
    .maybeSingle();
  if (!puzzle) return json(404, { error: "no_puzzle" });

  const { data: answerGeo } = await admin
    .from("district_geometries")
    .select("geometry")
    .eq("district_id", puzzle.district_id)
    .maybeSingle();

  const { data: stateRows } = await admin
    .from("district_geometries")
    .select("district_id, state, geometry, adj")
    .eq("state", puzzle.state);

  const prefix = puzzle.state + "-";
  const districts = (stateRows ?? []).map((d) => ({
    districtId: d.district_id,
    state: d.state,
    number: String(d.district_id).startsWith(prefix) ? String(d.district_id).slice(prefix.length) : d.district_id,
    geometry: d.geometry,
    adj: d.adj ?? [],
  }));

  return json(200, {
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
