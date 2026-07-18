// ============================================================
// post-social-cards.mjs
// Posts a multi-image tweet (no link) to the @daily_district_ X account —
// built for the "yesterday's district" recap cards from build-social-card.mjs.
//
// Needs the same four X app credentials as post-daily-tweet.mjs:
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
// (GitHub repo secrets — export them into your shell to post locally.)
//
// Usage:
//   DRY_RUN=1 node social/scripts/post-social-cards.mjs                 # print text + list media, post nothing
//   node social/scripts/post-social-cards.mjs                           # post the two 1:1 recap cards
//   node social/scripts/post-social-cards.mjs --images=a.png,b.png      # post specific images (max 4)
//   node social/scripts/post-social-cards.mjs --text="..."              # custom caption
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // repo root (script lives in social/scripts/)
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');

// Default: the two square recap cards (profile facts + gameplay stats).
const DEFAULT_IMAGES = [
  'social/card/WV-01-card.png',
  'social/card/WV-01-card-stats.png',
];
const images = (arg('images') ? arg('images').split(',') : DEFAULT_IMAGES).map(p => p.trim());
if (images.length === 0 || images.length > 4) throw new Error('Provide 1–4 images.');

// Caption — no link, per request.
const DEFAULT_TEXT =
  "Yesterday's Daily District: WV-01 — West Virginia's 1st. 🗺️\n\n"
  + 'A new congressional district to name every single day. How fast can you place today’s?';
const text = arg('text') || DEFAULT_TEXT;

const ALT = [
  'Recap card: West Virginia’s 1st District (WV-01) — representative, 2024 presidential vote, demographics, and district area.',
  'Recap card: West Virginia’s 1st District (WV-01) — number of players, average guesses, and average solve time.',
];

async function xClient() {
  const { TwitterApi } = await import('twitter-api-v2');
  const missing = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET']
    .filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
  return new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
}

async function main() {
  const paths = images.map(p => path.isAbsolute(p) ? p : path.join(DIR, p));
  for (const p of paths) if (!fs.existsSync(p)) throw new Error(`Missing image: ${p}`);

  console.log(`Tweet text:\n${text}\n`);
  console.log('Media:');
  paths.forEach((p, i) => console.log(`  ${i + 1}. ${path.relative(DIR, p)} (${(fs.statSync(p).size / 1024).toFixed(0)} KB)`));

  if (process.env.DRY_RUN) { console.log('\nDRY_RUN — nothing posted.'); return; }

  const client = await xClient();
  const mediaIds = [];
  for (let i = 0; i < paths.length; i++) {
    const id = await client.v2.uploadMedia(fs.readFileSync(paths[i]), { media_type: 'image/png' });
    if (ALT[i]) {
      try { await client.v2.createMediaMetadata(id, { alt_text: { text: ALT[i] } }); }
      catch (e) { console.warn('Alt text failed (non-fatal):', e.message || e); }
    }
    mediaIds.push(id);
  }
  const { data } = await client.v2.tweet({ text, media: { media_ids: mediaIds } });
  console.log(`Posted: https://x.com/daily_district_/status/${data.id}`);
}

main().catch(err => { console.error(err); process.exit(1); });
