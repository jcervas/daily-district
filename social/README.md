# Social & promo media

Everything for making Daily District's shareable media — static graphics and
the animated promo videos. All the **scripts live at the repo root** (next to
the other `build-*.mjs`), and everything they generate lands under `social/`.

**Easiest way to run everything: the `npm run` scripts in the [TL;DR](#tldr--the-commands)
below — they work from _any_ folder in the project (`cd`ing into `social/` is
fine).** The raw `node …` commands in the later sections are equivalent but must
be run **from the project root**.

```
social/
├─ README.md                      ← you are here
├─ fonts/                         Barlow (bundled; used by both generators)
├─ out/                           ← static graphics output  (git-ignored)
│    <DISTRICT>-16x9.png
│    <DISTRICT>-9x16.png
├─ teaser-1/                         ← gameplay promo video
│    teaser.template.html          template (edit copy / motion)
│    teaser-1*.html            built pages  (git-ignored)
│    out/                         ← rendered MP4s  (git-ignored)
│      daily-district-<DISTRICT>-<aspect>.mp4        aspect = 16x9 | 9x16 | 1x1
│      daily-district-<DISTRICT>-<aspect>-2160.mp4   ★ high-quality (see cheat-sheet)
├─ teaser-2/                        ← teaser #2 (District Profile showcase)
│    teaser.template.html         template (edit copy / motion)
│    teaser-2*.html               built pages  (git-ignored)
│    out/daily-district-teaser-2-<aspect>[-2160].mp4   (git-ignored)
├─ teaser-3/                        ← teaser #3 (Compete — stats/leaderboard)
│    teaser.template.html         template (edit copy / motion)
│    teaser-3*.html               built pages  (git-ignored)
│    out/daily-district-teaser-3-<aspect>[-2160].mp4   (git-ignored)
├─ teaser-4/                        ← teaser #4 (Civics — education mission)
│    teaser.template.html         template (edit copy / motion)
│    teaser-4*.html               built pages  (git-ignored)
│    out/daily-district-teaser-4-<aspect>[-2160].mp4   (git-ignored)
├─ teaser-5/                        ← teaser #5 (Daily habit / ritual)
│    teaser.template.html         template (edit copy / motion)
│    teaser-5*.html               built pages  (git-ignored)
│    out/daily-district-teaser-5-<aspect>[-2160].mp4   (git-ignored)
├─ teaser-6/                        ← teaser #6 (Play to Win — basketball)
│    teaser.template.html         template (edit copy / motion)
│    teaser-6*.html               built pages  (git-ignored)
│    out/daily-district-teaser-6-<aspect>[-2160].mp4   (git-ignored)
├─ teaser-7/                        ← teaser #7 (Wordle for geography nerds)
│    teaser.template.html         template (edit copy / motion)
│    teaser-7*.html               built pages  (git-ignored)
│    out/daily-district-teaser-7-<aspect>[-2160].mp4   (git-ignored)
├─ teaser-8/                        ← teaser #8 (Drawing the district)
│    teaser.template.html         template (edit copy / motion)
│    teaser-8*.html               built pages  (git-ignored)
│    out/daily-district-teaser-8-<aspect>[-2160].mp4   (git-ignored)
└─ teaser-9/                        ← teaser #9 (Sudden Death — soccer)
     teaser.template.html         template (edit copy / motion)
     teaser-9*.html               built pages  (git-ignored)
     out/daily-district-teaser-9-<aspect>[-2160].mp4   (git-ignored)
```

Every video ships in all three aspects — **16:9** (X timeline / YouTube),
**9:16** (Reels / TikTok / Stories), **1:1** (square feed) — each in standard
(1080-class) and ★ high-quality (2160-class) resolution.

**Every teaser ends on the same pattern:** the wordmark + CTA scene *holds*
(no swipe-out) while **end-card confetti** fires, falls, and settles — the
scene's duration is computed from the confetti physics (`CONF_FIRE` +
last-piece-landed + a 3 s hold), so the final frame is always a clean,
settled logo. This lives in each `teaser.template.html` as the
`CONFETTI`/`renderConfetti` block + a `{name:'cta', …, hold:true}` scene — copy
that block verbatim into a new teaser to keep the ending consistent.

**Build scripts at the repo root:** `generate-social-graphics.mjs` (PNG cards),
`build-teaser-1.mjs` (gameplay promo), `build-teaser-2.mjs` (teaser #2),
`build-teaser-3.mjs` (teaser #3), `build-teaser-4.mjs` (teaser #4),
`build-teaser-5.mjs` (teaser #5), `build-teaser-6.mjs` (teaser #6),
`build-teaser-7.mjs` (teaser #7), `build-teaser-8.mjs` (teaser #8),
`build-teaser-9.mjs` (teaser #9), `render-mp4.mjs` (HTML → MP4).

**Three teasers (#4, #6, #9) morph one district silhouette into another** using
the `flubber` npm package (already a project dependency — `node_modules/flubber/build/flubber.min.js`
is read and inlined into the built HTML by their build scripts, so the output
page has no external dependency at runtime). Pattern: precompute
`SIL_PATHS` (one path string per district, all fit to the same viewBox so
point counts/positions line up reasonably), then in the template
`flubber.interpolate(SIL_PATHS[i], SIL_PATHS[i+1])` returns a `t ⇒ path`
function used to tween between them frame-by-frame.

## TL;DR — the commands

Run these from **anywhere inside the project** — `npm run` finds the project root
for you, so you don't have to `cd` to a special folder. **The `--` after the
script name is required** (it passes the flags through to the script).

```bash
npm install                                   # once (see §1)

# ── Static graphics (PNG cards) → social/out/ ──────────────────────────
npm run social -- --district=FL-14

# ── Gameplay promo → social/teaser-1/teaser-1*.html  (then render, below) ──
npm run teaser1 -- --district=FL-14                 # 16:9
npm run teaser1 -- --district=FL-14 --aspect=9x16   # 9:16
npm run teaser1 -- --district=FL-14 --aspect=1x1    # 1:1

# ── Teaser #2 (District Profile showcase) → social/teaser-2/teaser-2*.html ──
npm run teaser2                                   # 1:1
npm run teaser2 -- --aspect=9x16                  # 9:16
npm run teaser2 -- --aspect=16x9                  # 16:9

# ── Teaser #3 (Compete — stats/leaderboard) → social/teaser-3/teaser-3*.html ──
npm run teaser3                                   # 1:1
npm run teaser3 -- --aspect=9x16                  # 9:16
npm run teaser3 -- --aspect=16x9                  # 16:9

# ── Teaser #4 (Civics — education mission) → social/teaser-4/teaser-4*.html ──
npm run teaser4                                   # 1:1 (also --aspect=9x16 | 16x9)

# ── Teaser #5 (Daily habit / ritual) → social/teaser-5/teaser-5*.html ──
npm run teaser5                                   # 1:1 (also --aspect=9x16 | 16x9)

# ── Teaser #6 (Play to Win — basketball) → social/teaser-6/teaser-6*.html ──
npm run teaser6                                   # 1:1 (also --aspect=9x16 | 16x9)

# ── Teaser #7 (Wordle for geography nerds) → social/teaser-7/teaser-7*.html ──
npm run teaser7                                   # 1:1 (also --aspect=9x16 | 16x9)

# ── Teaser #8 (Drawing the district) → social/teaser-8/teaser-8*.html ──
npm run teaser8                                   # 1:1 (also --aspect=9x16 | 16x9)

# ── Teaser #9 (Sudden Death — soccer) → social/teaser-9/teaser-9*.html ──
npm run teaser9                                   # 1:1 (also --aspect=9x16 | 16x9)

# ── Render any built page → MP4  (needs render deps — see §1) ──────────
# args: <input.html> <output.mp4> <cssW> <cssH> <dsf> <fps>
npm run render -- social/teaser-2/teaser-2.html social/teaser-2/out/daily-district-teaser-2-1x1.mp4 1080 1080 1 30
npm run render -- social/teaser-3/teaser-3.html social/teaser-3/out/daily-district-teaser-3-1x1.mp4 1080 1080 1 30
```

### Render size cheat-sheet (`cssW cssH dsf`)

The page's CSS size is fixed per aspect; the **device-scale-factor (dsf)**
multiplies it into the output resolution. Use the standard row for everyday
posts and the ★ high-quality row for maximum sharpness (name it `-2160`):

| Aspect | args (std) | output | args (★ hi-q) | output |
|---|---|---|---|---|
| 16:9 | `1280 720 1.5 30` | 1920×1080 | `1280 720 3 30` | 3840×2160 (4K) |
| 9:16 | `1080 1920 1 30` | 1080×1920 | `1080 1920 2 30` | 2160×3840 |
| 1:1  | `1080 1080 1 30` | 1080×1080 | `1080 1080 2 30` | 2160×2160 |

All renders are H.264 `crf 18` — already near-lossless; dsf only adds pixels.

> **Note:** flag notation like `--aspect=9x16` is a real flag; if you ever see
> docs write `[--aspect=…]`, the square brackets just mean "optional" — don't
> type them (zsh treats `[…]` as a glob and errors).
>
> **Pasting blocks with `#` comments:** macOS zsh chokes on `#` lines by default
> (`unknown file attribute` errors). Either paste commands one at a time without
> the comment lines, or enable comments once:
> `echo 'setopt interactive_comments' >> ~/.zshrc && source ~/.zshrc`

> The generated files (`social/out/`, `social/teaser-1/teaser-1*.html`,
> `social/teaser-1/out/`) are **git-ignored** — they're regenerable, so only the
> scripts and `teaser.template.html` are committed. Regenerate any time with the
> commands below.

---

## 1. One-time setup

```bash
npm install
```

That installs everything — the graphics/HTML deps (`d3-geo`, `topojson-client`,
`@resvg/resvg-js`) **and** the MP4-render deps (`puppeteer-core`,
`@ffmpeg-installer/ffmpeg`, in `devDependencies`).

Rendering additionally needs **Google Chrome** installed. `render-mp4.mjs` drives
it at the default macOS path `/Applications/Google Chrome.app/…` — edit the
`CHROME` constant at the top of the script if yours is elsewhere. If you only
need the interactive HTML preview, you can skip Chrome and use the in-browser
recorder (§5).

> If `npm install` warns about root-owned files in `~/.npm`, clear it once with
> `sudo chown -R $(id -u):$(id -g) ~/.npm`.

---

## 2. Static social graphics (PNG)

`generate-social-graphics.mjs` renders two promo cards per district straight from
the topojson — a 16:9 link/preview card and a 9:16 Reels/Stories card.

```bash
node generate-social-graphics.mjs                  # today's puzzle district
node generate-social-graphics.mjs --district=IL-3  # a specific district (IL-3 or IL-03)
node generate-social-graphics.mjs --date=2026-07-04 # the district for a given date
node generate-social-graphics.mjs --all            # every base district (all 435)
node generate-social-graphics.mjs --out=some/dir   # override output directory
```

**Output** → `social/out/<DISTRICT>-16x9.png` (3200 px wide) and
`social/out/<DISTRICT>-9x16.png` (2160 px wide).

---

## 3. Promo video (MP4)

Two steps: **build** the self-contained HTML page for a district + aspect, then
**render** it to MP4.

**Scenes** (`data-scene` name — refer to these by name or number when asking
for an edit, e.g. "on scene 6 (win), make the confetti bigger"):

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline, multi-directional entrance, floating district-code pills |
| 2 | `silhouette` | 3.0s | Today's mystery district — just the shape |
| 3 | `board` | 5.9s | The full game board (state grid + guesses) |
| 4 | `hotcold` | 9.2s | Hot/cold elimination in action |
| 5 | `pick` | 12.7s | Picking the district within the state |
| 6 | `win` | 15.0s | Win screen — **confetti fires here** (not on the CTA, unlike teasers #2–5) |
| 7 | `cta` | 18.6s | Wordmark + CTA, floating pills |

Total loop: **21.0s** (fixed — this is the one teaser without a confetti-driven
hold; see §"end-card confetti" note above).

### 3a. Build the HTML

```bash
node build-teaser-1.mjs --district=CA-19               # 16:9  (default aspect)
node build-teaser-1.mjs --district=CA-19 --aspect=9x16 # 9:16  (Reels / TikTok / Stories)
node build-teaser-1.mjs --district=CA-19 --aspect=1x1  # 1:1   (square feed)
```

- `--district=` accepts `CA-19` or `CA-9`. Defaults to `CA-19` if omitted.
- `--aspect=` is one of `16x9` (1280×720), `9x16` (1080×1920), `1x1` (1080×1080).

Everything district-specific (silhouette, hot/cold funnel, pick-a-district map,
win-screen stats) is generated from `districts-core.topojson`,
`districts-map.topojson`, and `data/reps_out.json` — the same data the game uses.

**Output** → `social/teaser-1/teaser-1.html` (16:9) or
`social/teaser-1/teaser-1-<aspect>.html`. The page is fully self-contained
(fonts + geometry inlined) — open it in a browser to preview the ~21 s loop.

### 3b. Render to MP4

```bash
# node render-mp4.mjs <input.html> <output.mp4> <cssW> <cssH> <deviceScaleFactor> [fps]

# 16:9 → rendered at 1.5× for true 1080p
node render-mp4.mjs social/teaser-1/teaser-1.html \
  social/teaser-1/out/daily-district-CA-19-16x9.mp4 1280 720 1.5 30

# 9:16 → native 1080×1920
node render-mp4.mjs social/teaser-1/teaser-1-9x16.html \
  social/teaser-1/out/daily-district-CA-19-9x16.mp4 1080 1920 1 30

# 1:1 → native 1080×1080
node render-mp4.mjs social/teaser-1/teaser-1-1x1.html \
  social/teaser-1/out/daily-district-CA-19-1x1.mp4 1080 1080 1 30
```

`cssW`/`cssH` must match the aspect's stage size (1280×720, 1080×1920, 1080×1080).
`deviceScaleFactor` supersamples for crispness — use **1.5** for 16:9 (→1920×1080)
and **1** for the already-1080 portrait/square. Output is H.264 / yuv420p /
`+faststart` (universally playable; fits X, Reels, TikTok specs).

### Full recipe — all three aspects for one district

```bash
D=FL-14
node build-teaser-1.mjs --district=$D
node build-teaser-1.mjs --district=$D --aspect=9x16
node build-teaser-1.mjs --district=$D --aspect=1x1
node render-mp4.mjs social/teaser-1/teaser-1.html      social/teaser-1/out/daily-district-$D-16x9.mp4 1280 720 1.5 30
node render-mp4.mjs social/teaser-1/teaser-1-9x16.html social/teaser-1/out/daily-district-$D-9x16.mp4 1080 1920 1  30
node render-mp4.mjs social/teaser-1/teaser-1-1x1.html  social/teaser-1/out/daily-district-$D-1x1.mp4  1080 1080 1  30
```

---

## 4. Teaser #2 — District Profile showcase (standalone, for X)

A separate, standalone promo that showcases the **District Profile** feature
(not gameplay): the wordmark, then a fast montage of several real districts —
each drawing its boundary **lines** and flashing its profile cards
(representative, 2024 vote, and a distinctive "hero" stat) — then the wordmark
+ CTA + **end-card confetti** (holds on the logo until every piece has landed,
+3 s). ~25 s, **1:1** by default (built for X).

> Built by **`build-teaser-2.mjs`** — note this is *not* `build-teaser.mjs`,
> which is unrelated (it manages the launch-date text in the pre-launch
> `index.html`).

**Scenes** — the district scenes (`d0`, `d1`, …) are generated dynamically,
one per entry in `DEFAULT_LINEUP` (or `--districts=`), so the count/order/start
times below reflect the **default 5-district line-up**:

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline |
| 2 | `d0` | 2.4s | 1st curated district — default **IL-04** (Shape: Irregular) |
| 3 | `d1` | 5.1s | 2nd curated district — default **NY-13** (District Area) |
| 4 | `d2` | 7.8s | 3rd curated district — default **AK-01** (District Area: largest in the U.S.) |
| 5 | `d3` | 10.5s | 4th curated district — default **GA-05** (Demographics) |
| 6 | `d4` | 13.2s | 5th curated district — default **WY-01** (House seats: 1 of 435) |
| 7 | `cta` | 15.9s | Wordmark + CTA + end-card confetti (holds until settled) |

Total loop: **~25.4s** with the default line-up; changes with `--districts=`.

```bash
node build-teaser-2.mjs                      # default line-up, 1:1
node render-mp4.mjs social/teaser-2/teaser-2.html \
  social/teaser-2/out/daily-district-teaser-2-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all three have tuned
  layouts. Output is `teaser-2.html` (1:1) or `teaser-2-<aspect>.html`; render
  with the matching args from the cheat-sheet in the TL;DR.
- `--districts=IL-04,NY-13,AK-01,GA-05,WY-01` overrides the line-up. Each
  district's "hero" card (the distinctive stat it highlights — shape, area,
  demographics, …) is curated in `DEFAULT_LINEUP` at the top of the script.

The built `teaser-2.html` also has the same in-browser **● Record video** button
(§5) if you'd rather not render from the CLI.

---

## 4b. Teaser #3 — Compete showcase (standalone, for X)

A standalone promo that showcases the **competitive / stats** features (not a
single puzzle): the wordmark, then the results **Guesses**, your personal stats
(Played · Win Rate · Current/Max Streak), the **Guess Distribution** histogram
(bars grow, your solve highlighted), and the **leaderboard** (compete with
everyone + your percentile), then wordmark + CTA — with drifting **district
pills** and **end-card confetti** both layered behind/over the logo (holds
until every confetti piece has landed, +3 s). ~24 s, **1:1** by default.

**Scenes:**

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline |
| 2 | `guesses` | 2.4s | Results-modal "Guesses" list |
| 3 | `stats` | 5.3s | Personal stats (Played, Win Rate, streaks) |
| 4 | `hist` | 8.2s | Guess Distribution histogram |
| 5 | `board` | 11.3s | Leaderboard |
| 6 | `cta` | 14.4s | Wordmark + CTA + drifting district pills + end-card confetti |

Total loop: **~23.9s**.

```bash
node build-teaser-3.mjs                  # 1:1
node render-mp4.mjs social/teaser-3/teaser-3.html \
  social/teaser-3/out/daily-district-teaser-3-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all three have tuned
  layouts. Output is `teaser-3.html` (1:1) or `teaser-3-<aspect>.html`; render
  with the matching args from the cheat-sheet in the TL;DR.
- The sample numbers (stats, histogram counts, leaderboard) are illustrative and
  live directly in `social/teaser-3/teaser.template.html` — edit them there.

---

## 4c. Teaser #4 — Civics / education mission (standalone)

The mission-driven teaser, with calmer pacing: the wordmark, then the **real
U.S. map with all 435 district lines** (count-up + "each ≈ 761,000 people"),
the redistricting fact ("redrawn every 10 years"), the learn-by-playing beat
(a single silhouette that **flubber-morphs through ~30 district shapes**,
accelerating, alongside "by shape / by place / by the people"), the makers
line (Carnegie Mellon University · Redistrict Network), then wordmark + CTA.
~35 s, **1:1** by default — the longest of the five (the `learn` beat alone
runs 10s to let the morph breathe).

**Scenes:**

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline |
| 2 | `map` | 3.2s | U.S. map, all 435 district lines drawing in, live count-up to 435 |
| 3 | `fact` | 9.0s | "Redrawn every 10 years" fact card |
| 4 | `learn` | 12.4s | Silhouette morphs through ~30 districts (starts on CO-03) + "by shape / by place / by the people" chips |
| 5 | `makers` | 22.5s | Makers credit (Carnegie Mellon University · Redistrict Network) |
| 6 | `cta` | 25.1s | Wordmark + CTA + end-card confetti |

Total loop: **~34.6s**.

```bash
node build-teaser-4.mjs                       # 1:1
node render-mp4.mjs social/teaser-4/teaser-4.html \
  social/teaser-4/out/daily-district-teaser-4-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all tuned; render with the
  cheat-sheet args.
- `--learn=CO-03` swaps the silhouette in the learn-by-playing beat.
- The U.S. map is generated from `districts-map.topojson` (national outline +
  state borders + all district lines); copy lives in
  `social/teaser-4/teaser.template.html`.

---

## 4d. Teaser #5 — Daily habit / ritual (standalone)

The habit hook, high-energy: the wordmark, then **kinetic words flying at the
viewer** ("EVERY. SINGLE. DAY." — each dollies in from far away, then blows
past the camera), a **calendar filling day by day** with an honest "Day N"
counter (last day gold-ringed), the midnight ritual (lines flying in from
**opposite directions**: "a new district drops at midnight ET" / "the same
puzzle for everyone"), then wordmark + CTA + **end-card confetti** (holds on
the logo until every piece has landed, +3 s). ~22 s, **1:1** by default.

**Scenes:**

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline |
| 2 | `zoom` | 2.7s | Kinetic zoom words ("EVERY. SINGLE. DAY.") flying at the viewer |
| 3 | `cal` | 5.6s | Calendar filling day by day, live "Day N" counter, last day gold-ringed |
| 4 | `ritual` | 9.6s | Opposite-direction line flies ("midnight ET" from one side / "same puzzle" from the other) |
| 5 | `cta` | 12.8s | Wordmark + CTA + end-card confetti |

Total loop: **~22.3s**.

```bash
node build-teaser-5.mjs                       # 1:1
node render-mp4.mjs social/teaser-5/teaser-5.html \
  social/teaser-5/out/daily-district-teaser-5-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all tuned; render with the
  cheat-sheet args.
- All copy, the zoom words, and the calendar size (28 days) live in
  `social/teaser-5/teaser.template.html`.

---

## 4e. Teaser #6 — Play to Win (standalone, basketball)

The playful, high-energy one: the wordmark, then a **basketball arcs in with
a 3D effect** (grows large as it "approaches the camera" mid-flight — scale
swings 0.2×→1.45×→0.32×, spins continuously, motion-blurs, casts a contact
shadow — then shrinks and drops through a district silhouette styled as the
hoop/net), a **swish flash** + district label + running scoreboard, and the
shape **flubber-morphs** into the next district for the next shot — repeated
for a curated line-up — then wordmark + CTA ("Play to win.") + end-card
confetti. ~25 s, **1:1** by default.

```bash
node build-teaser-6.mjs                       # default line-up, 1:1
node render-mp4.mjs social/teaser-6/teaser-6.html \
  social/teaser-6/out/daily-district-teaser-6-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all tuned; render with the
  cheat-sheet args.
- `--districts=IL-04,MD-03,TX-35,NC-01,LA-02` overrides the line-up (any
  count — the `hoop` scene's duration scales automatically, `N_SHOTS × 2.6s`).
- Everything — the arc trajectory, scale/blur curve, hoop/net SVG, per-shot
  timing (`SHOT_DUR`/`ARC_DUR`/`MORPH_START`) — lives in
  `social/teaser-6/teaser.template.html`; the district selection lives in
  `build-teaser-6.mjs` (`DEFAULT_IDS`).

**Scenes:**

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline |
| 2 | `hoop` | 2.7s | Ball arcs in (3D grow/shrink + spin), swishes through the district-as-net, shape morphs to the next district, repeats for each district in the line-up (5 × 2.6s by default) |
| 3 | `cta` | 15.7s | Wordmark + "Play to win." + end-card confetti |

Total loop: **~25.2s** with the default 5-district line-up; scales with
`--districts=`.

---

## 4f. Teaser #7 — Wordle for geography nerds (standalone)

The comparison hook, aimed squarely at the Wordle audience: the wordmark
("Wordle for map nerds"), a kinetic **"ONE PUZZLE. / SIX GUESSES. / NO
LETTERS."** beat (same zoom-word mechanic as teaser #5), the real results-modal
**guess rows** (borrowed verbatim from teaser #3 — a cold miss, a hot guess,
then the win), then the app's actual **"copy results" share text** (`✗ ○ ✓`,
"solved in 3/6 guesses") rendered as a Wordle-style tile row (gray miss / gold
"close" / green win), then wordmark + CTA + end-card confetti. ~22 s, **1:1**
by default.

```bash
node build-teaser-7.mjs                       # 1:1
node render-mp4.mjs social/teaser-7/teaser-7.html \
  social/teaser-7/out/daily-district-teaser-7-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all tuned; render with the
  cheat-sheet args.
- The illustrative guess sequence (Texas → cold, Virginia → hot, VA-08 → win)
  lives in `build-teaser-7.mjs` (`GUESSES`); all copy, the zoom words, and the
  share-card tile styling live in `social/teaser-7/teaser.template.html`.

**Scenes:**

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline ("Wordle for map nerds") |
| 2 | `sixguesses` | 2.6s | Kinetic zoom words — "ONE PUZZLE." / "SIX GUESSES." / "NO LETTERS." |
| 3 | `guesses` | 5.5s | Results-modal "Guesses" list (cold → hot → win) |
| 4 | `share` | 8.8s | The real "copy results" text as a Wordle-style tile row (`✗ ○ ✓`, solved in 3/6) |
| 5 | `cta` | 12.4s | Wordmark + CTA + end-card confetti |

Total loop: **~22.0s**.

---

## 4g. Teaser #8 — Drawing the district (standalone)

The reveal hook. It opens cold — no wordmark intro, straight onto a slow,
oversized **comet racing the full screen right-to-left**, joined by another
**left-to-right**, then a **vertical** sweep (top-to-bottom) — pure kinetic
buildup, not tied to any real geometry. Each is a glowing spark + fading tail
with flying, fading embers — the same visual language as the live game's
post-game "spark trace" (`script.js` `_runGameoverSparkTrace`/`emitEmber`), not
a flat line — and each travels far enough past its own margin that the *whole*
comet, tail included, is off-stage before it's hidden (a bare margin around the
head alone still left long tails visibly hanging on screen).

**The fourth line isn't a comet at all — it's the district itself**, already
drawing, with its tip starting outside the viewBox and flying in (bottom → top)
to dead centre. That's the whole trick, and it's why there's no hand-off left to
get wrong: the trail streaming behind that tip *is* the real boundary, so the
line that flies in and the line that keeps drawing are literally the same
object. Earlier versions had a synthetic 4th comet land on the spark and pass
the baton, which meant two separate things had to agree on an angle to the
degree — and when they didn't, it visibly "started drawing in a different
direction". One object can't disagree with itself.

Two camera modes make that work, joined seamlessly at `FLY_LEN`:

- **Fly-in** — the district is held *static* and only the ink grows, so the tip
  walks its own boundary in from off-stage and the trail lies exactly along the
  tip's path. (Locking the tip at centre during the fly-in instead — the obvious
  thing — makes the ink swing *around* the tip rather than trail it, and it
  reads as a squiggle sliding sideways, not a line flying in.)
- **Tip-locked** — thereafter **the spark holds still at dead center and the
  district turns underneath it**: the content is translated, scaled, and rotated
  to keep the current point under that fixed spark. The turn (`TURN`/`turnSince`)
  starts as the boundary's own smoothed, unwrapped tangent — so the ink trails
  straight out behind the spark — and blends to an even one-lap-per-length turn
  as the spark fades and the pen picks up speed. Either way it winds exactly one
  lap (`LAP`), which is what lands the shape upright for the morph.

At the join both modes place `pt(FLY_LEN)` at centre with the same rotation
(`ROT_K` carries the fly-in's rotation across, then unwinds over the zoom-out so
the base term's exact one-lap turn still lands the shape upright). The reveal
runs in **three beats**:

1. **Tight** (`ZOOM_START`, 4 s) — the camera holds its tight crop and follows
   the spark, so the comet fills the frame and the drawing reads as genuinely
   *happening*. The already-drawn part simply runs off the frame at that zoom —
   `.draw-svg` is `overflow:visible`, so it's clipped by the stage's own edge
   like a camera panning across a big drawing, not by an inner box edge.
2. **Zoom** (`DRAW_T2`, ~2.2 s) — the camera pulls back, bringing the off-frame
   strokes home, and completes at `ZOOM_MID` (**half the path drawn**). The pen's
   *apparent* speed does not change at all across this, by construction.
3. **Sprint** (`DRAW_T3`, ~1.8 s) — camera parked at 1×; now, and only now, the
   pen genuinely accelerates to `DRAW_BOOST`.

Zoom first, *then* sprint. Doing both at once (the obvious single blended
pull-back) gives the speed-up nothing to be measured against — and, because the
camera tracks the tangent, it whips the frame around every zigzag exactly when
the pen is fastest. Separated, the pull-back reads as a reveal and the speed-up
reads as a speed-up.

Then, once the code + state have popped in
and had a beat to be read, the fully-revealed shape doesn't just disappear:
it **morphs** (shrinks + fades) directly into the faint outline that frames
the wordmark for the rest of the video, so the cta scene starts exactly as
the morph finishes — one continuous element the whole way through, not a
hand-off between two separate ones. The district fills as much of the
frame as it can — on **9:16** the district is fit to its own natural (usually
landscape) aspect ratio and the whole box is **rotated 90°** so a wide
district still runs the full height of the tall frame, rather than being
squeezed into the narrow width. ~26 s, **1:1** by default.

**The pen's pace is derived, not dialled** (`drawProgress()`). `PEN_PACE` — the
linear rate while zoomed in — is the only speed chosen by eye; every other rate
and *every duration* falls out of an integral. Beat 2's rate is held proportional
to `1/scale`, so as the camera retreats `TRACE_SCALE`× the same arc-length covers
proportionally less screen and path progress speeds up by exactly that factor
*for free*, with apparent speed provably flat. Beat 3 then ramps to a genuine
`DRAW_BOOST` (1.7×) with the camera parked. `DRAW_T2` is exactly as long as it
takes to draw from `DRAW_FRAC` to `ZOOM_MID` at steady apparent speed — that's
what pins "fully zoomed out" to "about half drawn" — and `DRAW_T3` likewise
finishes the path. The pen's pace and how long the reveal takes are the same
fact. **`ZOOM_START` is the one dial**, and it has a floor (the fly-in must land
first; 9x16 needs ~2.3 s) and a ceiling (`DRAW_T2` goes negative past ~9 s).
Re-check all three aspects if you touch it — 16x9 alone will not tell you.

Traps here, all of which looked fine on paper:

- **Don't hand-pick the beat-2 curve.** A quadratic matched to beat 1's rate
  at the join surged to **1.8× mid-pull-back and then slowed again** — the eased
  zoom lags a quadratic draw, so they don't cancel. Deriving the rate from the
  very `scale()` the camera uses makes them cancel by construction. (If you
  change `zoomP`'s easing, `P2_SCALE` must change with it.)
- **Never hardcode the lap as ±360°** (`LAP`). Which sign the boundary winds is a
  property of the ring's orientation in the source geometry — MD-03 winds **+360**.
  Assuming −360 set the rotation target spinning the wrong way and dumped ~720°
  of extra spin into the sprint. It still landed **upright** (±360 both read as
  0°), and `settledRotMod360` still said `0` — nothing caught it but the spin
  itself. Read the lap off `UNWRAPPED`.
- **Wrap `ROT_K` to ±180°.** Any `ROT_K±360k` puts the district in the identical
  pose at both ends of the unwind, so no assertion downstream can see the
  difference — but unwrapped it spins a needless extra revolution during the
  pull-back (**1x1 turned −391° where −32° reaches the same place**). Aspects
  differ: `ROT_STATIC` depends on the fly-in heading, so 16x9 landed inside ±180°
  by luck and looked fine while 1x1 and 9x16 did not.
- **To smooth the camera at speed, low-pass the turn RATE — not the heading, and
  not the turn value.** Tangent-tracking costs (turn per unit length) × (pen
  speed *along the path*), and that rises 4× through the pull-back even though
  apparent speed never changes. Widening `ROT_SMOOTH` is a low-pass on the
  *heading*: only the wiggle's amplitude falls while its rate still climbs with
  the pen. Lerping the turn *value* between two targets is worse — they drift
  ~100° apart mid-path, so crossing between them sweeps the camera through that
  gap on top of the real turn (**spiked the pull-back to 308°/s**). Blend the
  rate and integrate (`TURN`): that can only change how much each increment of
  length turns the view.
- **The fast rotation target has to be `UNIFORM`, not a low-passed tangent.**
  This district has hairpin tendrils that turn ~180° within a few samples; any
  window still narrow enough to *be* the tangent leaves those in, and at sprint
  speed one hairpin alone whips the frame **~700°/s**. Uniform is the only target
  with no hairpin left in it, and it costs nothing real: it lands within ~2° of
  the low-passed tangent's total turn (−219° vs −241°) with **zero reversals**.
- **Hand the tangent off when the SPARK fades, not at `ZOOM_MID`.** The tangent's
  entire job is making the ink trail behind the spark; every frame it stays on
  past the spark's death is wiggle at a pen speed that's already climbing.
  Carrying it to `ZOOM_MID` left ~70% tangent while the pen was at 2× — **526°/s
  on 1x1**. `ROT_FAST_TO` is derived from `SPARK_FADE` so the two can't drift.
- **Never ease the draw itself.** An ease eases *out* as well as in: `easeInOut`
  drew only ~1.9 % of the boundary in its final sixth versus ~35 % mid-stroke,
  an ~18× swing, and the line visibly crawled to a halt. The camera eases; the
  hand doesn't.
- **Don't ease the comets either.** They dawdle at both ends — and both ends are
  off-stage — so each burnt ~2/3 of its schedule invisible, leaving **4.4 s of
  dead frame in a 7.4 s opening**. Linear travel plus a *negative* `COMET_GAP`
  (they overlap) cut that to 0.76 s and nearly doubled each one's time on screen
  without changing its duration.

Two earlier attempts at the
zoom/reveal failed instructively, and are worth not re-inventing: ramping the
zoom from t=0 left the view already wide while only a short comet tail was ever
visible — a tiny squiggle adrift in a big empty frame, which read as "nothing
is being built"; and lighting only a trailing window that *widened* during the
pull-back meant the start of the visible dash slid backwards as it opened,
which read as the district building itself **in reverse**. Hence the current
shape of it: the dash only ever grows forward from 0, and `overflow:visible`
does the job the moving window used to.

Two more traps around the fly-in, both of which look right on paper:

**`FLY_LEN` is solved, not chosen.** The pen's pace is fixed (linear), so how
long the fly-in lasts and how far off-stage it starts are the *same* number —
you can't pick them independently. The code walks forward to the first length
where `START_PT` clears the frame and stops there. Overshooting isn't harmless:
it starts the tip proportionally further out and buys dead seconds of empty
frame before anything appears.

**The chord has to cross two scales, and the edge distance is directional.**
Getting `START_PT` off-stage means converting viewBox units → stage px through
*both* the zoom (`TRACE_SCALE`) **and** the svg's own viewBox→css `SVG_SCALE`;
missing the second put the tip 1254 px below a 720 px-tall stage. And the
distance to the edge along the flight heading is *not* the half-diagonal —
for a vertical entry the diagonal overshoots ~1.8×, hence `FLY_EDGE`. Both
`SVG_SCALE` and `FLY_EDGE` differ per aspect, so this is solved per aspect
rather than fixed: 16:9 lands on a 1.26 s fly-in starting 142 px below the
stage, 9:16 on 2.27 s starting 156 px below — each just barely off-stage.

```bash
node build-teaser-8.mjs                       # default district (MD-03), 1:1
node render-mp4.mjs social/teaser-8/teaser-8.html \
  social/teaser-8/out/daily-district-teaser-8-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all tuned; render with the
  cheat-sheet args.
- `--district=NC-01` swaps the featured district (any district code; defaults
  to `MD-03`). The build script fits it to its own aspect ratio and decides
  per-output-aspect whether to rotate 90° — no manual tuning needed per district.
- The three synthetic comets' sizing and timing (`COMETS`, `N_EMBER`), the
  district's fly-in (`FLY_TRAVEL` — the heading it enters on; `FLY_EDGE`/`FLY_D`
  /`FLY_LEN`/`FLY_DUR`, all *derived* from it so they can't disagree; `ROT_STATIC`
  rotates the shape onto that heading and `ROT_K` carries it across the join),
  the reveal's timing/zoom (`ZOOM_START` — the one dial, how long it draws
  tight-zoomed before the pull-back begins; `ZOOM_MID`/`PEN_PACE`/`DRAW_BOOST`,
  with `DRAW_T2`/`DRAW_T3`/`REVEAL_DUR` all *derived*; `TRACE_TIGHT`,
  `ROT_SMOOTH`/`LAP`/`TURN` for the camera's turn), and the morph
  timing (`MORPH_HOLD`, `MORPH_DUR`, `MORPH_SMALL_SCALE`) live in
  `social/teaser-8/teaser.template.html`; the district's natural-aspect fit +
  rotation decision (`TRACE_VB_W/H`, `ROTATE`) and the default district live
  in `build-teaser-8.mjs`.
- The persistent shape (`#shape-overlay` in the template) is rendered outside
  the normal per-scene system entirely, updated every frame regardless of
  which `.scene` is visible — that's what lets it stay mounted and morph
  smoothly across the draw→cta boundary instead of two separate elements
  (a big reveal + a separate static cta-frame) handing off.

**Scenes:**

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `draw` | 0.0s | Three spark-and-ember comets sweep the full screen (horizontal ×2, vertical ×1), then the **district itself** is the 4th line — tip starting outside the viewBox, drawing as it flies in bottom→top to centre (lands by 1.3–2.3 s, per aspect). From there the spark holds at centre and the district turns underneath it, drawing tight-zoomed until 9.8 s, then the camera pulls back at unchanged apparent speed and is fully out by 12.0 s / **half the path**; only then does the pen sprint to 1.7×, finishing the boundary at 13.8 s. Fills, code + state pop in, then morphs into the CTA's background frame |
| 2 | `cta` | 16.2s | Wordmark + CTA, the just-morphed district outline framing the logo, + end-card confetti |

Total loop: **~25.7s** (the boundary itself draws in 8.0 s, `REVEAL_DUR`).

**This is the one teaser with no `intro` scene** — it opens cold on the comets
rather than on the wordmark, so the lines are the first thing on screen. (The
`draw` scene therefore carries `dynamicIntro:true`, which suppresses the shared
engine's slide-in so the opening scene doesn't whip in from the side out of
nowhere.) The wordmark still closes the video on the `cta` scene as usual.

---

## 4h. Teaser #9 — Sudden Death (standalone, soccer / free-kick shootout)

The soccer take on teaser #6's shot-loop, built for the World Cup moment: the
wordmark ("Bend it in"), then a ball **curls in on a bending free-kick path**
(3D — grows as it "approaches camera" mid-flight, spins, motion-blurs, tilts
away in perspective) and rips directly INTO a district silhouette rendered as
a **net** (a diagonal net-mesh pattern over the shape — the district itself is
the goal, no separate frame graphic), with a **net-ripple + "GOAL" flash** at
impact and a **running shootout scoreboard** (one dot per round, filling gold
as each kick scores — a nod to Daily District's own guess-limit mechanic), and
the shape **flubber-morphs** into the next district for the next kick —
repeated for a curated 5-district line-up (mirroring a standard penalty
shootout) — then wordmark + CTA ("Sudden death, every day.") + end-card
confetti. The ball is a vector (true pentagon/hexagon seam layout, white
sphere shading) — no photo asset. ~20 s, **1:1** by default. Copy is
evergreen (no date/team references) so the asset stays usable beyond any
single tournament.

```bash
node build-teaser-9.mjs                       # default line-up, 1:1
node render-mp4.mjs social/teaser-9/teaser-9.html \
  social/teaser-9/out/daily-district-teaser-9-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9` — all tuned; render with the
  cheat-sheet args.
- `--districts=IL-04,MD-03,TX-35,NC-01,LA-02` overrides the line-up (any
  count — the `goal` scene's duration scales automatically, `N_SHOTS × 1.5s`).
- Everything — the curl trajectory, scale/blur curve, net-mesh pattern,
  scoreboard dots, per-round timing (`SHOT_DUR`/`ARC_DUR`/`MORPH_START`) —
  lives in `social/teaser-9/teaser.template.html`; the district selection
  lives in `build-teaser-9.mjs` (`DEFAULT_IDS`).

**Scenes:**

| # | Scene | ~Start | What it shows |
|---|---|---|---|
| 1 | `intro` | 0.0s | Wordmark + tagline ("Bend it in") |
| 2 | `goal` | 2.7s | Ball curls in (3D grow/shrink + spin), rips into the district-as-net, net ripples, "GOAL" flash, scoreboard dot fills, shape morphs to the next district, repeats for each district in the line-up (5 × 1.5s by default) |
| 3 | `cta` | 10.2s | Wordmark + "Sudden death, every day." + end-card confetti |

Total loop: **~19.9s** with the default 5-district line-up; scales with
`--districts=`.

---

## 5. Alternative: record a video in the browser (no render deps)

Every built page (`teaser-1*.html`, `teaser-2/3/4/5/6/7/8/9.html`) can
export a video itself — no `render-mp4.mjs`, no ffmpeg:

1. Open the built HTML (e.g. `social/teaser-2/teaser-2.html`) in **Chrome**.
2. Click **● Record video** and share **“This Tab.”**
3. It records exactly one clean loop at the stage's native size and downloads the
   file. (Also: **Hide UI** hides the controls; **↻ Restart** restarts the loop.)

---

## 6. Editing the videos

- **Gameplay promo** — copy/timing/motion in `social/teaser-1/teaser.template.html`
  (`SCENES` array); per-district data in `build-teaser-1.mjs`. Rebuild with
  `build-teaser-1.mjs`.
- **Teaser #2** — copy/timing/motion in `social/teaser-2/teaser.template.html`;
  the district line-up + each "hero" stat in `build-teaser-2.mjs`
  (`DEFAULT_LINEUP`). Rebuild with `build-teaser-2.mjs`.
- **Teaser #3** — copy/timing/motion **and** the sample stats/histogram/
  leaderboard numbers all live in `social/teaser-3/teaser.template.html`. Rebuild
  with `build-teaser-3.mjs`.
- **Teaser #4** — copy/timing/motion in `social/teaser-4/teaser.template.html`;
  the learn-beat silhouette via `--learn=`. Rebuild with
  `build-teaser-4.mjs`.
- **Teaser #5** — everything (copy, zoom words, calendar size, timings) lives in
  `social/teaser-5/teaser.template.html`. Rebuild with `build-teaser-5.mjs`.
- **Teaser #6** — the ball arc/scale/hoop visuals and per-shot timing live in
  `social/teaser-6/teaser.template.html`; the district line-up in
  `build-teaser-6.mjs` (`DEFAULT_IDS`). Rebuild with `build-teaser-6.mjs`.
- **Teaser #7** — copy/timing/motion and the share-card tile styling live in
  `social/teaser-7/teaser.template.html`; the illustrative guess sequence in
  `build-teaser-7.mjs` (`GUESSES`). Rebuild with `build-teaser-7.mjs`.
- **Teaser #8** — the comet sweeps, reveal camera/timing, and CTA frame
  styling live in `social/teaser-8/teaser.template.html`; the featured
  district via `--district=` (default in `build-teaser-8.mjs`). Rebuild with
  `build-teaser-8.mjs`.
- **Teaser #9** — the ball curl/scale/net-mesh visuals, scoreboard dots, and
  per-round timing live in `social/teaser-9/teaser.template.html`; the
  district line-up in `build-teaser-9.mjs` (`DEFAULT_IDS`). Rebuild with
  `build-teaser-9.mjs`.

Both read the topojson + `data/reps_out.json` and inject `{{PLACEHOLDER}}`s /
JSON into the template. After any template/script change, re-run the build (and
re-render if you need fresh MP4s). `render-mp4.mjs` works on any of these pages.

**Every video's section above (§3, §4, §4b–h) has a numbered Scenes table** —
`#`, `data-scene` name, start time, and what it shows. Use those to point at a
specific beat instead of describing it ("scene 4 of teaser #5" / "the `hist`
scene in teaser #3"). **When you add a new teaser, add the same kind of table
to its section** — pull the scene list straight from its `DEF`/`SCENES` array
(or `window.__teaser.loop()` + inspecting `SCENES` in a browser console for the
exact start times) rather than estimating; a stale table is worse than none.
