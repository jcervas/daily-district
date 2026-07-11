import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_GUESSES = 6;
const CLUE_SLOTS = 6;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// A *correct state* pick is a free transition into the district phase — it does NOT
// consume one of the player's MAX_GUESSES. Counted guesses = wrong picks (either
// phase) + district picks (incl. the winning one).
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
  // slot 0, the guess-earned deck only has CLUE_SLOTS-1 slots to fill. Must use the
  // same "counted guesses" metric as countGuesses()/the guessesLeft the client shows —
  // history.length also includes the free correct-state pick, which would over-reveal
  // by one clue relative to what the player's displayed guess count actually earned.
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
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // verify_jwt is disabled so anonymous players can submit guesses. A valid token
  // resolves to a signed-in user (server-authoritative, persisted, leaderboard).
  // No user => anonymous: validate statelessly from the client-supplied history and
  // persist NOTHING.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();

  let body: { phase?: string; value?: string; seconds?: number; session_id?: string; history?: Array<{ phase?: string; value?: string }> };
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }
  const phase = body.phase;
  const value = String(body.value ?? "").toUpperCase();
  if ((phase !== "state" && phase !== "district") || !value) return json(400, { error: "bad_request" });

  const admin = createClient(url, service);
  const date = puzzleDate();

  const { data: puzzle } = await admin
    .from("puzzles")
    .select("district_id, state, neighbors, state_neighbors, clues, census")
    .eq("date", date)
    .maybeSingle();
  if (!puzzle) return json(404, { error: "no_puzzle" });

  const freeClue = freeClueFrom(puzzle.census);

  // Server-authoritative evaluation of a single guess (never trusts client flags).
  const evalGuess = (ph: string, v: string) => {
    const val = String(v ?? "").toUpperCase();
    if (ph === "state") {
      return { phase: ph, text: val, correct: val === puzzle.state, adjacent: ((puzzle.state_neighbors ?? []) as string[]).includes(val) };
    }
    return { phase: ph, text: val, correct: val === puzzle.district_id, adjacent: ((puzzle.neighbors ?? []) as string[]).includes(val) };
  };

  // ---- Anonymous: stateless, recompute history from supplied values, no persist ----
  if (!user) {
    const supplied = Array.isArray(body.history) ? body.history : [];
    const prior = supplied
      .filter((g) => g && (g.phase === "state" || g.phase === "district") && g.value)
      .slice(0, MAX_GUESSES + 1)
      .map((g) => evalGuess(g.phase as string, g.value as string));
    const cur = evalGuess(phase, value);
    const newHistory = [...prior, cur];
    const guesses = countGuesses(newHistory);
    const won = phase === "district" && cur.correct;
    const completed = won || guesses >= MAX_GUESSES;

    // Record anonymous outcomes (player count + win/loss) with no profile id. Written
    // once per completed game; the partial unique index on (session_id, puzzle_date)
    // makes retries idempotent. Best-effort — a logging failure never breaks the guess.
    if (completed) {
      const sid = (typeof body.session_id === "string" && body.session_id) ? body.session_id.slice(0, 64) : null;
      const secs = Number(body.seconds);
      await admin.from("anon_results").insert({
        puzzle_date: date,
        won,
        completed: true,
        guesses,
        seconds: Number.isFinite(secs) ? Math.max(0, Math.min(86400, Math.round(secs))) : 0,
        session_id: sid,
      }); // returned error (e.g. duplicate session/day) intentionally ignored
    }

    const { unlocked, total: cluesTotal } = revealClues(puzzle.clues, newHistory, completed, freeClue);
    return json(200, {
      correct: cur.correct,
      adjacent: cur.adjacent,
      phase,
      guesses,
      guessesLeft: MAX_GUESSES - guesses,
      completed,
      won,
      clues: unlocked,
      cluesTotal,
      state: (phase === "state" && cur.correct) || completed ? puzzle.state : null,
      answer: completed ? { districtId: puzzle.district_id, state: puzzle.state, census: puzzle.census ?? null } : null,
      anonymous: true,
    });
  }

  // ---- Signed-in: server-authoritative, persisted ----
  const { data: existing } = await admin
    .from("results")
    .select("guess_history, completed, seconds")
    .eq("user_id", user.id)
    .eq("puzzle_date", date)
    .maybeSingle();

  if (existing?.completed) return json(409, { error: "already_completed" });

  const history = (existing?.guess_history ?? []) as Array<Record<string, unknown>>;
  // Out of guesses only counts non-(correct-state) picks.
  if (countGuesses(history as Array<{ phase?: string; correct?: boolean }>) >= MAX_GUESSES) {
    return json(409, { error: "no_guesses_left" });
  }

  const ev = evalGuess(phase, value);
  const correct = ev.correct, adjacent = ev.adjacent;

  const seconds = Number(body.seconds ?? existing?.seconds ?? 0);
  const entry = {
    phase, text: value, correct, adjacent,
    n: history.length + 1,
    t: seconds,
    at: new Date().toISOString(),
  };
  const newHistory = [...history, entry];
  const guesses = countGuesses(newHistory as Array<{ phase?: string; correct?: boolean }>);
  const won = phase === "district" && correct;
  const completed = won || guesses >= MAX_GUESSES;

  const { error: upsertErr } = await admin.from("results").upsert({
    user_id: user.id,
    puzzle_date: date,
    won,
    completed,
    guesses,
    seconds,
    guess_history: newHistory,
    completed_at: completed ? new Date().toISOString() : null,
  }, { onConflict: "user_id,puzzle_date" });
  if (upsertErr) return json(500, { error: "persist_failed", detail: upsertErr.message });

  const { unlocked, total: cluesTotal } = revealClues(puzzle.clues, newHistory as Array<{ phase?: string; correct?: boolean }>, completed, freeClue);

  return json(200, {
    correct,
    adjacent,
    phase,
    guesses,
    guessesLeft: MAX_GUESSES - guesses,
    completed,
    won,
    clues: unlocked,
    cluesTotal,
    state: (phase === "state" && correct) || completed ? puzzle.state : null,
    answer: completed ? { districtId: puzzle.district_id, state: puzzle.state, census: puzzle.census ?? null } : null,
    anonymous: false,
  });
});
