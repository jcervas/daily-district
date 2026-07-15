# Launching Daily District — a simple runbook

Everything about the launch date is now controlled from **one place**. This doc
is the whole procedure written out. If you'd rather not do it by hand, the
simplest path is at the top.

---

## ⭐ The simplest path

Tell Claude:

> **"Set the launch date to `YYYY-MM-DD`."**

It will run the entire checklist below (edit the constants, regenerate the
teaser, reseed the puzzle database, update the recap gate, commit + push, and
re-arm the launch-day restore). Everything below is that same checklist, spelled
out for when you (or a future session) want to do it manually.

---

## Where the launch date lives

**`puzzle-schedule.mjs`** (top of the file) — two settings, and everything else
reads from them:

| Setting | What it does |
|---|---|
| `LAUNCH_EPOCH = 'YYYY-MM-DD'` | The date **puzzle No. 1** goes live. Drives the puzzle schedule, the database seeding, the teaser, the daily tweet, and the social-recap cards. |
| `LAUNCH_ANNOUNCED = true / false` | Whether the **public site shows the date**. `false` → teaser says "Coming soon" with no date. `true` → teaser announces the date everywhere. |

Change the date in **one line** (`LAUNCH_EPOCH`) and run the steps below — every
other script picks it up automatically.

---

## Right now (current state)

- **No date announced.** The live teaser says "Coming soon" (no date).
- `LAUNCH_EPOCH = 2026-07-13` — a **provisional, hidden** placeholder that just
  keeps the schedule working. Nothing public shows it.
- `LAUNCH_ANNOUNCED = false`.
- The launch-day game-restore task is **disabled**.
- The press release is **taken down**.

---

## ✅ When you decide on a date (announce it)

The game still shows the teaser after this — you're just setting the date and
putting it back on the "Coming soon" page. Go-live is the next section.

1. **Set the date.** In `puzzle-schedule.mjs`:
   ```js
   export const LAUNCH_EPOCH = '2026-09-07';   // ← your date
   export const LAUNCH_ANNOUNCED = true;       // ← show it publicly
   ```
2. **Update the teaser text:**
   ```sh
   npm run teaser
   ```
   (Rewrites the headline, title, social tags, and how-to note to
   "Launching <weekday>, <date>". Preview first with `npm run teaser -- --check`.)
3. **Reseed the puzzle database** so puzzle No. 1 lands on that date:
   ```sh
   node seed-puzzles.mjs 2026-09-07 436 > puzzles.sql
   ```
   Then run `puzzles.sql` against the Supabase project (or ask Claude to apply it).
4. **Commit + push `main`** (this deploys the dated teaser):
   ```sh
   git add -A && git commit -m "Set launch date to 2026-09-07" && git push origin main
   ```
5. **Re-arm the launch-day restore** (optional but recommended) — ask Claude:
   > "Re-enable the `daily-district-launch-restore` task for `<date>` and fix its
   > hardcoded date/expected puzzle."

---

## 🚀 On launch day (flip the teaser → the real game)

Pick one:

**Automated** — if you re-armed it in step 6 above, the
`daily-district-launch-restore` task fires at 00:05 ET on launch day and does all
of this for you.

**Manual** — two commands:
```sh
git checkout launch-index -- index.html    # the launch-ready game (Beta removed, v1.0)
git commit -am "Launch: restore game index.html" && git push origin main
```
Then confirm puzzle No. 1 is live:
```sh
curl -sS -X POST "https://itbpvqkunfeaimuxposx.supabase.co/functions/v1/today" \
  -H "apikey: sb_publishable_r1e40mdMFg02saEW_xNq2A_iTGELUcU" \
  -H "Authorization: Bearer sb_publishable_r1e40mdMFg02saEW_xNq2A_iTGELUcU" \
  -H "Content-Type: application/json" -d '{}'
# expect HTTP 200 with "puzzleNumber":1
```

(The real game lives at git tag **`launch-index`** — commit `8e0a587`.)

Then **re-enable the two X automations** (both are hard-disabled on GitHub —
see "Handy extras" below for why):
```sh
gh workflow enable daily-recap.yml    # "Yesterday's District" cards, first post the day after launch
gh workflow enable daily-tweet.yml    # daily puzzle teaser image post
```

---

## If you DON'T have a date yet (this is today's setup)

Nothing to do — you're already here. If you ever need to reset to it:
```js
export const LAUNCH_ANNOUNCED = false;   // in puzzle-schedule.mjs
```
```sh
npm run teaser
git commit -am "Teaser: dateless Coming soon" && git push origin main
```
Leave `LAUNCH_EPOCH` at any near-future date — it's hidden while
`LAUNCH_ANNOUNCED` is `false`.

---

## Handy extras

- **Bring the press release back:** `git revert 132b763` (restores the files and
  all the links in one commit), then push.
- **Preview a date without committing:** `npm run teaser -- --epoch=2026-09-07 --check`
- **Dry-run the daily recap post:** `npm run recap:dry`
- **Both X-posting GitHub Actions are hard-disabled** (`disabled_manually`) until
  launch. The daily-recap action's own guard derives from `LAUNCH_EPOCH`, which is
  a *provisional* date while unannounced — on 2026-07-14 the guard passed and it
  posted a recap for a game that wasn't live (post was deleted). Don't rely on the
  guard alone: keep the workflows disabled until launch day, then enable each with
  `gh workflow enable <file>` (see the launch-day section).
