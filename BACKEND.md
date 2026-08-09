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
  Edge Function (service_role). **Signed-in players only.**
- `anon_results(id PK, puzzle_date, won, completed, guesses, seconds, session_id,
  created_at)` — one row per **completed anonymous (not-signed-in) game**, so player
  count + win/loss are measurable without a profile id. Written by the `guess` Edge
  Function (service_role) when an anon game completes; a partial unique index on
  `(session_id, puzzle_date)` makes it idempotent. **Deny-all RLS (no policies)** — no
  client read/write. Throwaway: `truncate public.anon_results` anytime you only want
  signed-in stats. DDL:
  ```sql
  create table public.anon_results (
    id uuid primary key default gen_random_uuid(), puzzle_date date not null,
    won boolean not null, completed boolean not null default true,
    guesses integer not null default 0, seconds integer not null default 0,
    session_id text, created_at timestamptz not null default now());
  create unique index anon_results_session_date_uidx
    on public.anon_results (session_id, puzzle_date) where session_id is not null;
  alter table public.anon_results enable row level security;
  ```
- `oneoff_events(slug PK, district_id, state, title, clues, census, active, created_at)` —
  hand-seeded "special edition" rows for the one-off game at `/mica.html`, where every
  player (signed in or anonymous) plays the SAME fixed district instead of the daily's
  date-driven pick. Same shape as `puzzles.clues`/`census` but keyed by an arbitrary slug,
  not a date. **Deny-all RLS** — only the `oneoff` Edge Function reads it (service_role).
  Seeded via `scripts/seed-oneoff.mjs <district_id> <slug> [title]`; `active` marks which
  event the endpoint serves when no `event` slug is passed (only one expected at a time).
- `oneoff_results(id PK, event_slug, user_id, session_id, won, guesses, seconds,
  created_at)` — one row per **identity per event** (signed-in `user_id` OR anonymous
  `session_id`, never both). Unlike `results`/`anon_results`, this is **client-scored and
  client-reported** (trusted, not server-validated) — the tradeoff for a simple one-off
  mode with no new secure guess-gating function. `user_id` is intentionally NOT a FK to
  `auth.users` (mirrors `results`: survives account deletion). Partial unique indexes on
  `(event_slug, user_id)` and `(event_slug, session_id)` make recording idempotent — a
  replay of the same event by the same identity is silently ignored (first result stands).
  **Deny-all RLS** — only the `oneoff` Edge Function writes it (service_role).
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

Source for every deployed function is committed under
[supabase/functions/](supabase/functions/) (one `index.ts` per function) — keep it
in sync when redeploying.

### Admin loaders: `load-puzzles`, `load-geometries`
One-shot loaders that (re)populate `puzzles` / `district_geometries`. Guarded by a
`?secret=` query param checked against the **`LOAD_SECRET` function secret**
(Dashboard → Edge Functions → Secrets). The secret is NOT set yet after the
2026-07-08 rotation (the old value was hardcoded in the function source and had to
go before committing the source publicly), so both loaders currently return 403 —
set `LOAD_SECRET` before the next seeding run, or load via SQL instead
(`scripts/seed-puzzles.mjs` can emit upsert SQL).

### `POST /functions/v1/today`
Returns the current puzzle for the signed-in user. Playtest accounts allowed to
reset their own daily result come from the **`TEST_EMAILS` function secret**
(comma-separated addresses — kept out of the public repo; unset = no testers).
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

### `POST /functions/v1/demo`
Backs `/demo.html`. Returns a **random** puzzle's FULL data (answer shape + the
state's district shapes + clues + census + answer), regardless of date — the same
payload shape as the archive's get-mode. Read-only, `verify_jwt` disabled, anon-callable.
Used only for throwaway practice rounds, so returning the answer up front is fine and the
daily's anti-cheat is unaffected. The client (`DistrictBackend.demoPuzzle()`) plays it via
the unofficial archive-replay path and records nothing (demo mode disables all telemetry).

### `POST /functions/v1/oneoff`
Backs `/mica.html` — the one-off "special edition" mode where every player plays the
SAME fixed district (an `oneoff_events` row), not the daily's date-driven puzzle.
Read+write, `verify_jwt` disabled, anon-callable. Two actions via `body.action`:

- `{ "action": "get", "event"?: "slug", "session_id"?: "..." }` — defaults to whichever
  event has `active = true` when `event` is omitted. Returns the same full-data shape as
  `demo` (answer + state shapes + clues + census up front — guesses validate client-side,
  same tradeoff as demo) plus `stats: { played, wonPct, avgGuesses }` and, if this caller
  (by JWT user id, else the passed `session_id`) already has a recorded result, `already:
  { won, guesses, seconds }`.
- `{ "action": "record", "event": "slug", "won", "guesses", "seconds", "session_id"? }` —
  inserts one row into `oneoff_results` (client-reported outcome, trusted) and returns the
  refreshed `stats`. Idempotent per identity via `oneoff_results`'s partial unique indexes;
  a duplicate insert's error is intentionally ignored (same best-effort pattern `guess`
  uses for `anon_results`).

The client (`DistrictBackend.oneoffPuzzle()`/`oneoffResult()`) plays it via the same
unofficial archive-replay path as demo (`startOneoffGame()` → `startServerArchive(...,
{ oneoff: true })` in script.js) — but unlike demo, the outcome IS recorded. Telemetry
stays on (real traffic, not a throwaway round). `mica.html` is **generated** from
`index.html` by `build-mica.mjs`, the same way `demo.html` is generated by
`build-demo.mjs`, and keeps the real sign-in UI visible (a player can play anonymously or
sign in before/mid-game).

### `POST /functions/v1/send-daily-push`
Sends the opt-in daily Web Push reminder to every row in `push_subscriptions`.

- Invoked daily at **13:00 UTC (9am ET)** by the pg_cron job `invoke-send-daily-push`
  (pg_net `http_post`). Not user-callable: `verify_jwt` is off, auth is the
  `x-cron-secret` header checked against the `CRON_SECRET` function secret (same
  value stored in Vault as `dd_push_cron_secret` for the cron job to read).
- Needs `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (+ optional `VAPID_SUBJECT`)
  function secrets. The keys are `.trim()`ed before use — the stored secrets have
  stray whitespace that made `setVapidDetails` throw and killed every send until
  2026-07-08.
- Returns `{ total, sent, removed, failed, errors, puzzleDate }`; dead
  subscriptions (404/410) are deleted. To check the last cron run:
  `select * from net._http_response order by created desc` (rows purge after ~6h).

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
- ✅ Puzzle-seeding loader `scripts/seed-puzzles.mjs` — replicates the client schedule
  (`seededIndex/dateSeed`) + FACT_DEFS clue text exactly by extracting the real
  maps from `script.js`. **Launch reseed (v2.14.0):** DB wiped (puzzles/results/
  telemetry; accounts kept) and refilled with a full 436-day non-repeating cycle,
  **puzzle No. 1 = 2026-07-13 … No. 436 = 2027-09-21**. Seed epoch is now `2026-07-13`.
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
3. **Extend the puzzle runway** — re-run `node scripts/seed-puzzles.mjs <startDate> <days>`
   periodically (or as a scheduled job) so `puzzles` always has upcoming dates.
   Currently filled through **2027-09-21** (No. 436).
4. **Move the Census API key** in `acs_by_state.R` / `acs_by_district.R` to the
   `CENSUS_API_KEY` env var before any public push.
