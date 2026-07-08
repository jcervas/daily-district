import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const CLUE_SLOTS = 6;

// Accounts allowed to wipe their own daily result for repeated playtesting —
// comma-separated addresses in the TEST_EMAILS function secret (keeps real
// emails out of the public repo). Unset => nobody gets the reset button.
const TEST_EMAILS = (Deno.env.get("TEST_EMAILS") ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// A *correct state* pick is a free transition into the district phase — it does NOT
// consume one of the player's MAX_GUESSES. Counted guesses = wrong picks (either
// phase) + district picks (incl. the winning one). Mirrors the same helper in the
// guess edge function — revealClues() must use this, not raw history.length, or the
// clue bar runs one card ahead of what the displayed "guesses used" actually earned.
function countGuesses(history: Array<{ phase?: string; correct?: boolean }>): number {
  return history.filter((g) => !(g.phase === "state" && g.correct)).length;
}

// Free clue: visible from the very start, before any guess — the district's raw land
// area in sq mi. Occupies slot 0 of the fixed CLUE_SLOTS-card hint bar (see revealClues),
// so the guess-earned deck only ever fills the remaining CLUE_SLOTS-1 slots — total card
// count always matches MAX_GUESSES, it doesn't grow a 7th slot.
function freeClueFrom(census: unknown): { icon: string; label: string; value: string } | null {
  const c = (census ?? {}) as Record<string, unknown>;
  const raw = c.area_sqmi;
  const area = raw != null ? Math.round(Number(raw)) : NaN;
  if (!Number.isFinite(area) || area <= 0) return null;
  return { icon: "ruler", label: "District area", value: `${area.toLocaleString("en-US")} sq mi` };
}

// Fixed CLUE_SLOTS-card hint bar: all hidden at the start except slot 0, which is the
// always-on free clue (when present). Each guess reveals the next card. While the state
// is unsolved the revealed cards are STATE clues; once the state is solved every further
// reveal (including the solving guess) is a DISTRICT clue. Total is always CLUE_SLOTS so
// the bar never grows or resets.
function revealClues(
  clues: unknown,
  history: Array<{ phase?: string; correct?: boolean }>,
  completed: boolean,
  freeClue: { icon: string; label: string; value: string } | null,
): { unlocked: unknown[]; total: number } {
  const cl = (clues ?? {}) as Record<string, unknown>;
  const stateDeck = Array.isArray(cl) ? (cl as unknown[]) : (Array.isArray(cl.state) ? cl.state as unknown[] : []);
  const districtDeck = Array.isArray(cl) ? [] : (Array.isArray(cl.district) ? cl.district as unknown[] : []);
  const stateSolved = history.some((g) => g.phase === "state" && g.correct);
  const wrongState = history.filter((g) => g.phase === "state" && !g.correct).length;

  // One reveal per counted guess (all filled at game over). If a free clue occupies
  // slot 0, the guess-earned deck only has CLUE_SLOTS-1 slots to fill.
  const realSlots = freeClue ? CLUE_SLOTS - 1 : CLUE_SLOTS;
  const guessesUsed = countGuesses(history);
  const nReveal = completed ? realSlots : Math.min(guessesUsed, realSlots);

  let unlocked: unknown[];
  if (!stateSolved) {
    unlocked = stateDeck.slice(0, Math.min(nReveal, stateDeck.length));
  } else {
    const nState = Math.min(wrongState, stateDeck.length);
    const nDistrict = Math.max(0, Math.min(nReveal - nState, districtDeck.length));
    unlocked = [...stateDeck.slice(0, nState), ...districtDeck.slice(0, nDistrict)];
  }
  if (freeClue) unlocked = [freeClue, ...unlocked];
  return { unlocked, total: CLUE_SLOTS };
}

function puzzleDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // verify_jwt is disabled so anonymous (not-signed-in) players can fetch the puzzle.
  // A valid Authorization token still resolves to a user; otherwise the caller is
  // anonymous and we never read or write any per-user result.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();

  let reqBody: { reset?: boolean; history?: Array<{ phase?: string; correct?: boolean; text?: string }> } = {};
  try { reqBody = await req.json(); } catch { /* GET / empty body */ }

  const admin = createClient(url, service);
  const date = puzzleDate();

  const isTester = !!user?.email && TEST_EMAILS.includes(user.email.toLowerCase());
  let didReset = false;
  if (reqBody.reset === true && isTester && user) {
    await admin.from("results").delete().eq("user_id", user.id).eq("puzzle_date", date);
    didReset = true;
  }

  const { data: puzzle } = await admin
    .from("puzzles")
    .select("date, puzzle_number, district_id, state, clues, census")
    .eq("date", date)
    .maybeSingle();
  if (!puzzle) return json(404, { error: "no_puzzle" });

  const { data: geo } = await admin
    .from("district_geometries")
    .select("geometry")
    .eq("district_id", puzzle.district_id)
    .maybeSingle();

  // Per-user result only exists for signed-in players. Anonymous players always
  // start fresh (their progress, if any, lives only in their browser).
  let result: { won: boolean; completed: boolean; guesses: number; seconds: number; guess_history: unknown } | null = null;
  if (user) {
    const { data } = await admin
      .from("results")
      .select("won, completed, guesses, seconds, guess_history")
      .eq("user_id", user.id)
      .eq("puzzle_date", date)
      .maybeSingle();
    result = data ?? null;
  }

  let history = (result?.guess_history ?? []) as Array<{ phase?: string; correct?: boolean; text?: string }>;
  let completed = !!result?.completed;

  // Anonymous players have no server-side result, so on reload they would otherwise
  // restore a stale answer snapshot from their browser. If an anonymous caller passes
  // their local guess history AND it proves they already solved THIS district (the
  // winning district guess equals the answer's id, which only a solver can produce),
  // reveal the FRESH answer + clues so any same-day data change is reflected. No leak:
  // you must already know the answer to satisfy the check.
  if (!user && !completed && Array.isArray(reqBody.history)) {
    const solved = reqBody.history.some((g) =>
      g && g.phase === "district" && g.correct === true && g.text === puzzle.district_id);
    if (solved) {
      history = reqBody.history;
      completed = true;
    }
  }

  const freeClue = freeClueFrom(puzzle.census);
  const { unlocked, total: cluesTotal } = revealClues(puzzle.clues, history, completed, freeClue);

  return json(200, {
    date: puzzle.date,
    puzzleNumber: puzzle.puzzle_number,
    geometry: geo?.geometry ?? null,
    clues: unlocked,
    cluesTotal,
    result: result ?? null,
    answer: completed ? { districtId: puzzle.district_id, state: puzzle.state, census: puzzle.census ?? null } : null,
    anonymous: !user,
    tester: isTester,
    didReset,
  });
});
