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
└─ teaser-4/                        ← teaser #4 (Civics — education mission)
     teaser.template.html         template (edit copy / motion)
     teaser-4*.html               built pages  (git-ignored)
     out/daily-district-teaser-4-<aspect>[-2160].mp4   (git-ignored)
```

Every video ships in all three aspects — **16:9** (X timeline / YouTube),
**9:16** (Reels / TikTok / Stories), **1:1** (square feed) — each in standard
(1080-class) and ★ high-quality (2160-class) resolution.

**Build scripts at the repo root:** `generate-social-graphics.mjs` (PNG cards),
`build-teaser-1.mjs` (gameplay promo), `build-teaser-2.mjs` (teaser #2),
`build-teaser-3.mjs` (teaser #3), `build-teaser-4.mjs`
(teaser #4), `render-mp4.mjs` (HTML → MP4).

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
+ CTA. ~18 s, **1:1** by default (built for X).

> Built by **`build-teaser-2.mjs`** — note this is *not* `build-teaser.mjs`,
> which is unrelated (it manages the launch-date text in the pre-launch
> `index.html`).

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
everyone + your percentile), then wordmark + CTA. ~17 s, **1:1** by default.

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
(silhouette + by shape / by place / by the people), the makers line (Carnegie
Mellon University · Redistrict Network), then wordmark + CTA. ~20 s, **1:1**
by default.

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

## 5. Alternative: record a video in the browser (no render deps)

Every built page (`teaser-1*.html`, `teaser-2/4/5.html`) can
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

Both read the topojson + `data/reps_out.json` and inject `{{PLACEHOLDER}}`s /
JSON into the template. After any template/script change, re-run the build (and
re-render if you need fresh MP4s). `render-mp4.mjs` works on any of these pages.
