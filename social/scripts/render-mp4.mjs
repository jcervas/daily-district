// Render a Daily District promo HTML to a real MP4 by driving the deterministic
// JS timeline (window.__promo.seek) frame-by-frame in headless Chrome, then
// encoding the PNG frames with ffmpeg (H.264, yuv420p — universally playable).
//
// Usage: node social/scripts/render-mp4.mjs <input.html> <output.mp4> <cssW> <cssH> <dsf> [fps] [crf]
//   crf defaults to 18 (near-lossless). For flat motion graphics, 20–23 looks
//   identical but is much smaller — good for high-res (2160) posts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

const [,, inFile, outFile, W, H, DSF, FPS='30', CRF='18'] = process.argv;
const cssW = +W, cssH = +H, dsf = +DSF, fps = +FPS, crf = +CRF;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOOP_GUESS = 21;                       // seconds (overridden by page value)

// Frame dirs carry the owning PID so leftovers from a dead render can be told
// apart from a sibling's live frames — 9x16 and 1x1 renders run in parallel, and
// a blind sweep of ddframes-* would delete the frames out from under one of them.
const TMP = os.tmpdir();
const STALE_MS = 6 * 60 * 60 * 1000;
const running = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

for (const name of fs.readdirSync(TMP)) {
  if (!name.startsWith('ddframes-')) continue;
  const dir = path.join(TMP, name);
  const owner = /^ddframes-(\d+)-/.exec(name);
  try {
    // A live render creates a file every frame, so its dir mtime is always fresh;
    // the age check covers dirs predating the PID stamp and recycled-PID misses.
    const age = Date.now() - fs.statSync(dir).mtimeMs;
    if (age > STALE_MS || (owner && !running(+owner[1]))) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch { /* vanished or unreadable — leave it */ }
}

const frameDir = fs.mkdtempSync(path.join(TMP, `ddframes-${process.pid}-`));
// Cleanup on 'exit' rather than a try/finally around the loop: it also catches
// the ffmpeg-failure exit and an uncaught throw mid-render. Signals don't run
// exit handlers on their own, so route them through process.exit.
const cleanup = () => { try { fs.rmSync(frameDir, { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));

const url = 'file://' + path.resolve(inFile);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  // Puppeteer only removes its own temp profile on a clean close(), so a crash
  // leaks it. Nesting it under frameDir hands it to the same exit-handler sweep.
  userDataDir: path.join(frameDir, 'chrome-profile'),
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: cssW, height: cssH, deviceScaleFactor: dsf });
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => { document.body.classList.add('clean'); fit(); });
// The promo exposes window.__promo; teasers expose window.__teaser — accept either.
await page.evaluate(() => { window.__anim = window.__promo || window.__teaser; });
const loop = await page.evaluate(() => (window.__anim ? window.__anim.loop() : null)) || LOOP_GUESS;

const stage = await page.$('#stage');
const total = Math.round(loop * fps);
process.stdout.write(`  ${path.basename(inFile)} → ${total} frames @ ${cssW*dsf}×${cssH*dsf}\n`);

for (let i = 0; i < total; i++) {
  const t = i / fps;
  await page.evaluate(tt => window.__anim.seek(tt), t);
  // let the rAF loop apply the seeked frame before capturing
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await stage.screenshot({ path: path.join(frameDir, `f${String(i).padStart(4,'0')}.png`), type: 'png' });
  if (i % 60 === 0) process.stdout.write(`    frame ${i}/${total}\r`);
}
await browser.close();

// Encode: even dims, H.264 high, yuv420p, faststart
const args = [
  '-y', '-framerate', String(fps), '-i', path.join(frameDir, 'f%04d.png'),
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-crf', String(crf), '-preset', 'slow', '-movflags', '+faststart',
  '-r', String(fps), outFile,
];
const r = spawnSync(ffmpeg.path, args, { stdio: ['ignore', 'ignore', 'inherit'] });
if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }
const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log(`  ✓ ${path.basename(outFile)} (${kb} KB)`);
