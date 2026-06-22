# Daily District — Backend (Supabase)

Server-authoritative backend that keeps the answer and clue values off the client
until they're earned. Static GitHub Pages site + Supabase (Auth + Postgres + Edge
Functions).

## Project

| | |
|---|---|
| Project | `daily-district` |
| Ref / ID | `itbpvqkunfeaimuxposx` |
| URL | `https://itbpvqkunfeaimuxposx.supabase.co` |
| Region | `us-east-2` |
| Publishable (anon) key | `sb_publishable_r1e40mdMFg02saEW_xNq2A_iTGELUcU` — safe to ship in client JS |

> The **service_role** key is NOT in this repo and must never be. Only the Edge
> Functions use it (auto-injected by Supabase as `SUPABASE_SERVICE_ROLE_KEY`).

## Why this hides the answer

A static site can't keep secrets — anyone can read shipped JS/JSON. So the
answer identity and clue *values* live only in Postgres `puzzles`, which has RLS
enabled with **no policies** (anon/authenticated can't read it at all). The Edge
Functions read it with `service_role` and return only what the player has earned:

- `/today` and `/guess` require a valid auth JWT (`verify_jwt = true`). Verified:
  unauthenticated calls return **401**.
- Clues are gated server-side: first clue always shown, **+1 per wrong guess**.
- The answer key is withheld until the player **wins or uses all 6 guesses**.
- Guesses are validated server-side; `results` is written only by the `guess`
  function (service_role), so a client can't fabricate a win or replay — the
  `(user_id, puzzle_date)` row enforces once-per-day regardless of localStorage.

## Schema (`public`)

- `profiles(user_id PK → auth.users, username, created_at)` — auto-created on
  signup by the `handle_new_user` trigger. RLS: read/update/insert own row.
- `puzzles(date PK, puzzle_number, district_id, state, neighbors,
  state_neighbors, clues, created_at)` — **server-only** (deny-all RLS).
  `clues` is an ordered array of `{icon, label, value}` in reveal order;
  `neighbors`/`state_neighbors` drive hot/cold without shipping the adjacency graph.
- `results(user_id, puzzle_date) PK, won, completed, guesses, seconds,
  guess_history, started_at, completed_at` — RLS: read own only; writes via the
  Edge Function (service_role).
- `profiles` also carries optional standard fields: `email, display_name, phone,
  city, region, country, marketing_opt_in, updated_at`. `email`/`display_name`
  are captured from auth on signup; the rest are user-entered via the profile
  modal (`getProfile`/`updateProfile`). RLS: read/update own only.
- `telemetry(id, user_id?, session_id, event, puzzle_date, device, viewport_w,
  viewport_h, dpr, user_agent, language, timezone, referrer, payload, created_at)`
  — **write-only** UI analytics, no PII. RLS: INSERT only (constrained: caller may
  only attribute to self/anon, known event types); no client read. `DistrictBackend.logTelemetry()`
  fires `session_start` on load for everyone. Read aggregates via service_role/SQL.

### Stats / leaderboard
- `get_leaderboard()` RPC (SECURITY DEFINER, anon-callable) → `{ user, today,
  allTime }`. `user` = caller's own stats (auth.uid); today/allTime = aggregates
  across all players (aggregate numbers only). The leaderboard UI is fully
  DB-backed (no local stats).

### Privacy note
`telemetry` fires for **all** visitors and `profiles` stores phone/city — pair
this with a short privacy notice / consent line before/at launch (GDPR/CCPA).
Telemetry can be gated behind login or a consent toggle if preferred.

## Edge Functions

### `POST /functions/v1/today`
Returns the current puzzle for the signed-in user.
```json
{ "date":"2026-06-22", "puzzleNumber":519,
  "clues":[{"icon","label","value"}, ...],   // only unlocked-so-far
  "cluesTotal":7,
  "result": { "won","completed","guesses","seconds","guess_history" } | null,
  "answer": { "districtId","state" } | null    // only when completed
}
```

### `POST /functions/v1/guess`
Body: `{ "phase":"state"|"district", "value":"NV"|"NV-02", "seconds":123 }`
```json
{ "correct":false, "adjacent":true, "phase":"state",
  "guesses":2, "guessesLeft":4, "completed":false, "won":false,
  "clues":[ ...unlocked... ],
  "answer": { "districtId","state" } | null    // only when completed
}
```
`409 already_completed` if the day is already finished.

Puzzle date is the calendar day in **America/New_York** (all players share one).

## Verified end-to-end (2026-06-22)

Exercised with a real signed-in JWT against the live functions:
- `/today` (fresh) → puzzle 519, **1 of 12** clues, **answer withheld**.
- wrong `CA` state guess → cold (`adjacent:false`), unlocks a 2nd clue.
- wrong `IA` state guess → **hot** (`adjacent:true`, IA borders NE) — server neighbor logic.
- correct `NE-01` → `won/completed`, **answer revealed only now**.
- another guess → **409 already_completed** (once-per-day, server-enforced).
- signup trigger auto-created the `profiles` row; cascade delete cleaned it up.

## Done so far

- ✅ Schema + RLS + signup trigger (advisor-clean).
- ✅ `today` + `guess` Edge Functions (verified above; 401 without auth).
- ✅ Puzzle-seeding loader `seed-puzzles.mjs` — replicates the client schedule
  (`seededIndex/dateSeed`) + FACT_DEFS clue text exactly by extracting the real
  maps from `script.js`. **26 days seeded** (2026-06-21 … 2026-07-16).
- ✅ Client auth foundation: `backend.js` (Supabase client + auth + `today`/`guess`
  wrappers) and `login.js` + `#login-modal`. Gated by `DistrictBackend.ENABLED`
  (currently **false** → legacy client-only mode; loads clean, game unaffected).

## Remaining work

1. **Enable an auth provider** (yours to do — needs console credentials):
   Supabase → Authentication → Providers. Email is on by default; Google/Apple/SSO
   each need an OAuth client ID+secret from their console pasted in. Then set
   `ENABLED = true` in `backend.js`.
2. **Client data swap** (`script.js`) — when `DistrictBackend.ENABLED`:
   - On start, after auth, call `DistrictBackend.today()` → use `puzzleNumber`,
     render clues from the returned `clues[]` (instead of `FACT_DEFS`), and
     restore from `result`. Do **not** pick the answer client-side.
   - Route each guess through `DistrictBackend.guess(phase, value, seconds)` and
     use `{correct, adjacent, clues, completed, won, answer}` instead of local
     comparison / `getDistrictCensusData()`.
   - Keep `districts.topojson` shapes/names client-side (not spoilers).
   - Drop the client `seededIndex/dateSeed` answer pick and the once-per-day
     `localStorage` gate (server is now authoritative).
3. **Extend the puzzle runway** — re-run `node seed-puzzles.mjs <startDate> <days>`
   periodically (or as a scheduled job) so `puzzles` always has upcoming dates.
   Currently filled through **2026-07-16**.
4. **Move the Census API key** in `acs_by_state.R` / `acs_by_district.R` to the
   `CENSUS_API_KEY` env var before any public push.
