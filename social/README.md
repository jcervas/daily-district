# Social & promo media

Everything for making Daily District's shareable media — static graphics and
the animated promo videos. All the **scripts live at the repo root** (next to
the other `build-*.mjs`), and everything they generate lands under `social/`.

Run every command below **from the repo root**.

```
social/
├─ README.md                      ← you are here
├─ fonts/                         Barlow (bundled; used by both generators)
├─ out/                           ← static graphics output  (git-ignored)
│    <DISTRICT>-16x9.png
│    <DISTRICT>-9x16.png
└─ promo/                         ← animated promo video
     promo.template.html          source template (edit copy / motion here)
     promo-video.html             built 16:9 page  (git-ignored)
     promo-video-9x16.html        built 9:16 page  (git-ignored)
     promo-video-1x1.html         built 1:1 page   (git-ignored)
     out/                         ← rendered MP4s  (git-ignored)
       daily-district-<DISTRICT>-16x9.mp4
       daily-district-<DISTRICT>-9x16.mp4
       daily-district-<DISTRICT>-1x1.mp4
```

> The generated files (`social/out/`, `social/promo/promo-video*.html`,
> `social/promo/out/`) are **git-ignored** — they're regenerable, so only the
> scripts and `promo.template.html` are committed. Regenerate any time with the
> commands below.

---

## 1. One-time setup

```bash
npm install                       # d3-geo, topojson-client, @resvg/resvg-js — for graphics + promo HTML
```

That's all you need for **graphics** and for **building** the promo HTML.

To **render MP4s** you also need a headless-Chrome driver, an ffmpeg binary, and
Google Chrome installed:

```bash
npm install --save-dev puppeteer-core @ffmpeg-installer/ffmpeg
```

`render-mp4.mjs` drives your installed **Google Chrome** (default path
`/Applications/Google Chrome.app/…` on macOS — edit the `CHROME` constant at the
top of the script if yours is elsewhere). If you only need the interactive
promo page, you can skip this and use the in-browser recorder (§4).

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

## 4. Alternative: record the promo in the browser (no render deps)

Every built `promo-video*.html` can export a video itself — no `render-mp4.mjs`,
no ffmpeg:

1. Open the built HTML (e.g. `social/promo/promo-video.html`) in **Chrome**.
2. Click **● Record video** and share **“This Tab.”**
3. It records exactly one clean loop at the stage's native size and downloads the
   file. (Also: **Hide UI** hides the controls; **↻ Restart** restarts the loop.)

---

## 5. Editing the promo

- **Copy, timing, scenes, motion** → `social/promo/promo.template.html`
  (a single deterministic JS timeline; scene windows are in the `SCENES` array).
  Rebuild with `build-promo.mjs` to apply.
- **Per-district data / new fields** → `build-promo.mjs` (reads the topojson +
  `data/reps_out.json`, computes the stats, and injects `{{PLACEHOLDER}}`s).

After any template/script change, re-run the build (and re-render if you need
fresh MP4s).
