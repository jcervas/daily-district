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
└─ promo/                         ← animated promo + teaser videos
     promo.template.html          gameplay-promo template (edit copy / motion)
     teaser.template.html         teaser #3 template (District Profile showcase)
     promo-video*.html            built promo pages  (git-ignored)
     teaser-3*.html               built teaser pages (git-ignored)
     out/                         ← rendered MP4s    (git-ignored)
       daily-district-<DISTRICT>-16x9.mp4      (gameplay promo)
       daily-district-<DISTRICT>-9x16.mp4
       daily-district-<DISTRICT>-1x1.mp4
       daily-district-teaser-3-1x1.mp4         (teaser #3)
```

**Build scripts at the repo root:** `generate-social-graphics.mjs` (PNG cards),
`build-promo.mjs` (gameplay promo), `build-profile-teaser.mjs` (teaser #3),
`render-mp4.mjs` (HTML → MP4).

## TL;DR — the commands

Run these from **anywhere inside the project** — `npm run` finds the project root
for you, so you don't have to `cd` to a special folder. **The `--` after the
script name is required** (it passes the flags through to the script).

```bash
npm install                                   # once (see §1)

# ── Static graphics (PNG cards) → social/out/ ──────────────────────────
npm run social -- --district=FL-14

# ── Gameplay promo → social/promo/promo-video*.html  (then render, below) ──
npm run promo -- --district=FL-14                 # 16:9
npm run promo -- --district=FL-14 --aspect=9x16   # 9:16
npm run promo -- --district=FL-14 --aspect=1x1    # 1:1

# ── Teaser #3 (District Profile showcase) → social/promo/teaser-3.html ──
npm run teaser3

# ── Render any built page → MP4  (needs render deps — see §1) ──────────
npm run render -- social/promo/teaser-3.html social/promo/out/daily-district-teaser-3-1x1.mp4 1080 1080 1 30
```

> **Note:** flag notation like `--aspect=9x16` is a real flag; if you ever see
> docs write `[--aspect=…]`, the square brackets just mean "optional" — don't
> type them (zsh treats `[…]` as a glob and errors).

> The generated files (`social/out/`, `social/promo/promo-video*.html`,
> `social/promo/out/`) are **git-ignored** — they're regenerable, so only the
> scripts and `promo.template.html` are committed. Regenerate any time with the
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
node build-promo.mjs --district=CA-19               # 16:9  (default aspect)
node build-promo.mjs --district=CA-19 --aspect=9x16 # 9:16  (Reels / TikTok / Stories)
node build-promo.mjs --district=CA-19 --aspect=1x1  # 1:1   (square feed)
```

- `--district=` accepts `CA-19` or `CA-9`. Defaults to `CA-19` if omitted.
- `--aspect=` is one of `16x9` (1280×720), `9x16` (1080×1920), `1x1` (1080×1080).

Everything district-specific (silhouette, hot/cold funnel, pick-a-district map,
win-screen stats) is generated from `districts-core.topojson`,
`districts-map.topojson`, and `data/reps_out.json` — the same data the game uses.

**Output** → `social/promo/promo-video.html` (16:9) or
`social/promo/promo-video-<aspect>.html`. The page is fully self-contained
(fonts + geometry inlined) — open it in a browser to preview the ~21 s loop.

### 3b. Render to MP4

```bash
# node render-mp4.mjs <input.html> <output.mp4> <cssW> <cssH> <deviceScaleFactor> [fps]

# 16:9 → rendered at 1.5× for true 1080p
node render-mp4.mjs social/promo/promo-video.html \
  social/promo/out/daily-district-CA-19-16x9.mp4 1280 720 1.5 30

# 9:16 → native 1080×1920
node render-mp4.mjs social/promo/promo-video-9x16.html \
  social/promo/out/daily-district-CA-19-9x16.mp4 1080 1920 1 30

# 1:1 → native 1080×1080
node render-mp4.mjs social/promo/promo-video-1x1.html \
  social/promo/out/daily-district-CA-19-1x1.mp4 1080 1080 1 30
```

`cssW`/`cssH` must match the aspect's stage size (1280×720, 1080×1920, 1080×1080).
`deviceScaleFactor` supersamples for crispness — use **1.5** for 16:9 (→1920×1080)
and **1** for the already-1080 portrait/square. Output is H.264 / yuv420p /
`+faststart` (universally playable; fits X, Reels, TikTok specs).

### Full recipe — all three aspects for one district

```bash
D=FL-14
node build-promo.mjs --district=$D
node build-promo.mjs --district=$D --aspect=9x16
node build-promo.mjs --district=$D --aspect=1x1
node render-mp4.mjs social/promo/promo-video.html      social/promo/out/daily-district-$D-16x9.mp4 1280 720 1.5 30
node render-mp4.mjs social/promo/promo-video-9x16.html social/promo/out/daily-district-$D-9x16.mp4 1080 1920 1  30
node render-mp4.mjs social/promo/promo-video-1x1.html  social/promo/out/daily-district-$D-1x1.mp4  1080 1080 1  30
```

---

## 4. Teaser #3 — District Profile showcase (standalone, for X)

A separate, standalone promo that showcases the **District Profile** feature
(not gameplay): the wordmark, then a fast montage of several real districts —
each drawing its boundary **lines** and flashing its profile cards
(representative, 2024 vote, and a distinctive "hero" stat) — then the wordmark
+ CTA. ~18 s, **1:1** by default (built for X).

> Built by **`build-profile-teaser.mjs`** — note this is *not* `build-teaser.mjs`,
> which is unrelated (it manages the launch-date text in the pre-launch
> `index.html`).

```bash
node build-profile-teaser.mjs                      # default line-up, 1:1
node render-mp4.mjs social/promo/teaser-3.html \
  social/promo/out/daily-district-teaser-3-1x1.mp4 1080 1080 1 30
```

- `--aspect=` → `1x1` (default) | `9x16` | `16x9`. Output is `teaser-3.html`
  (1:1) or `teaser-3-<aspect>.html`; render with matching `cssW cssH` (and `1.5`
  dsf for 16:9, `1` otherwise).
- `--districts=IL-04,NY-13,AK-01,GA-05,WY-01` overrides the line-up. Each
  district's "hero" card (the distinctive stat it highlights — shape, area,
  demographics, …) is curated in `DEFAULT_LINEUP` at the top of the script.

The built `teaser-3.html` also has the same in-browser **● Record video** button
(§5) if you'd rather not render from the CLI.

---

## 5. Alternative: record a video in the browser (no render deps)

Every built page (`promo-video*.html`, `teaser-3.html`) can export a video
itself — no `render-mp4.mjs`, no ffmpeg:

1. Open the built HTML (e.g. `social/promo/teaser-3.html`) in **Chrome**.
2. Click **● Record video** and share **“This Tab.”**
3. It records exactly one clean loop at the stage's native size and downloads the
   file. (Also: **Hide UI** hides the controls; **↻ Restart** restarts the loop.)

---

## 6. Editing the videos

- **Gameplay promo** — copy/timing/motion in `social/promo/promo.template.html`
  (`SCENES` array); per-district data in `build-promo.mjs`. Rebuild with
  `build-promo.mjs`.
- **Teaser #3** — copy/timing/motion in `social/promo/teaser.template.html`;
  the district line-up + each "hero" stat in `build-profile-teaser.mjs`
  (`DEFAULT_LINEUP`). Rebuild with `build-profile-teaser.mjs`.

Both read the topojson + `data/reps_out.json` and inject `{{PLACEHOLDER}}`s /
JSON into the template. After any template/script change, re-run the build (and
re-render if you need fresh MP4s). `render-mp4.mjs` works on any of these pages.
