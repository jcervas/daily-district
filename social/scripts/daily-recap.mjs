// ============================================================
// daily-recap.mjs
// Automation entry point for the daily "Yesterday's District" X post:
// resolves yesterday's puzzle, builds the two 1:1 recap cards (profile facts
// always; gameplay stats only when real data exists), and posts BOTH to the
// @daily_district_ account with no link.
//
// Runs from .github/workflows/daily-recap.yml (cron 13:00 UTC = 8am ET winter /
// 9am ET during DST). Needs the same four X app secrets as post-daily-tweet.mjs:
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
//
// Launch guard: nothing is posted for recap dates before LAUNCH_EPOCH (the game's
// day 1, from puzzle-schedule.mjs), so this is safe to enable ahead of go-live —
// it no-ops until then. The first recap posts the day AFTER launch (recapping
// launch day), so there's just one launch date to set, in puzzle-schedule.mjs.
//
// Usage:
//   DRY_RUN=1 node social/scripts/daily-recap.mjs            # build + print plan, post nothing
//   node social/scripts/daily-recap.mjs                      # post yesterday's recap (if >= LAUNCH_EPOCH)
//   node social/scripts/daily-recap.mjs --date=2026-07-20    # recap a specific date (testing)
//   node social/scripts/daily-recap.mjs --force              # bypass the launch-date guard
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as topojson from 'topojson-client';
import { baseIds, districtIdForPuzzle, puzzleNumberFor, LAUNCH_EPOCH } from '../../scripts/puzzle-schedule.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // repo root (script lives in social/scripts/)
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const flag = k => process.argv.includes(`--${k}`);

// Public Supabase project (anon key is safe to embed — see BACKEND.md).
const SUPABASE_URL = 'https://itbpvqkunfeaimuxposx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_r1e40mdMFg02saEW_xNq2A_iTGELUcU';

const STATE_NAMES ={ AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };

function easternDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function ordinal(n, stateCount) {
  if (stateCount === 1) return 'At-Large';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Format seconds → "M:SS"; pass through if the RPC already returns a string.
function fmtTime(v) {
  if (typeof v === 'string') return v;
  const s = Math.round(Number(v) || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Yesterday's gameplay stats (real data only). Returns null unless a
// SECURITY DEFINER RPC `get_daily_recap(d date)` exists AND has data for the
// date. Until the backend records games, this stays null → profile-only post. ──
async function fetchStats(date) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_daily_recap`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ d: date }),
    });
    if (!res.ok) return null;
    const row = (await res.json());
    const r = Array.isArray(row) ? row[0] : row;
    if (!r || !r.players || Number(r.players) <= 0) return null;
    return {
      districtId: r.district_id || null,
      players: Number(r.players).toLocaleString('en-US'),
      guesses: (Math.round(Number(r.avg_guesses) * 10) / 10).toString(),
      time: fmtTime(r.avg_seconds ?? r.avg_time),
    };
  } catch { return null; }
}

function build(cardArgs) {
  const r = spawnSync('node', [path.join(DIR, 'social', 'scripts', 'build-social-card.mjs'), ...cardArgs, '--png'], { cwd: DIR, stdio: ['ignore', 'pipe', 'inherit'] });
  if (r.status !== 0) throw new Error(`build-social-card failed: ${cardArgs.join(' ')}`);
  return r.stdout.toString();
}

async function xClient() {
  const { TwitterApi } = await import('twitter-api-v2');
  const missing = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'].filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
  return new TwitterApi({
    appKey: process.env.X_API_KEY, appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN, accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
}

async function main() {
  const date = arg('date') || easternDate(-1); // default: yesterday (Eastern)

  if (!flag('force') && date < LAUNCH_EPOCH) {
    console.log(`Recap date ${date} is before launch (${LAUNCH_EPOCH}) — nothing posted.`);
    return;
  }

  const topo = JSON.parse(fs.readFileSync(path.join(DIR, 'districts-core.topojson'), 'utf8'));
  const coreFeat = topojson.feature(topo, topo.objects.districts).features;

  const stats = await fetchStats(date);
  // District: prefer whatever the DB attributes to the date (authoritative once
  // server mode is live); fall back to the client schedule.
  const districtId = stats?.districtId || districtIdForPuzzle(puzzleNumberFor(date), baseIds(topo));

  const P = coreFeat.find(f => f.properties['state-district'] === districtId)?.properties;
  if (!P) throw new Error(`No geometry for ${districtId}`);
  const [ST, DNUM] = [P.state, parseInt(districtId.split('-')[1], 10)];
  const stateCount = coreFeat.filter(f => f.properties.state === ST).length;
  const place = `${STATE_NAMES[ST] || ST}'s ${ordinal(DNUM, stateCount)} District`;

  // ── Build the card(s) ──────────────────────────────────────────────────────
  const badge = "Yesterday's District";
  build(['--district=' + districtId, `--badge=${badge}`]);
  const images = [`social/card/${districtId}-card.png`];
  const alts = [`Recap card for ${districtId} — ${place}: representative, 2024 presidential vote, demographics, and district area.`];

  if (stats) {
    build(['--district=' + districtId, `--badge=${badge}`, '--mode=play',
           `--players=${stats.players}`, `--guesses=${stats.guesses}`, `--time=${stats.time}`]);
    images.push(`social/card/${districtId}-card-stats.png`);
    alts.push(`Recap card for ${districtId} — ${place}: ${stats.players} players, ${stats.guesses} average guesses, ${stats.time} average solve time.`);
  }

  const text = `Yesterday's Daily District: ${districtId} — ${place}. 🗺️\n\n`
    + 'A new congressional district to name every single day. How fast can you place today’s?';

  console.log(`Recap ${date} → ${districtId} (${place})`);
  console.log(`Stats: ${stats ? `${stats.players} players · ${stats.guesses} guesses · ${stats.time}` : 'none yet → profile card only'}`);
  console.log(`Tweet text:\n${text}\n`);
  images.forEach((p, i) => console.log(`  media ${i + 1}: ${p}`));

  if (process.env.DRY_RUN) { console.log('\nDRY_RUN — nothing posted.'); return; }

  const client = await xClient();
  const mediaIds = [];
  for (let i = 0; i < images.length; i++) {
    const id = await client.v2.uploadMedia(fs.readFileSync(path.join(DIR, images[i])), { media_type: 'image/png' });
    try { await client.v2.createMediaMetadata(id, { alt_text: { text: alts[i] } }); }
    catch (e) { console.warn('Alt text failed (non-fatal):', e.message || e); }
    mediaIds.push(id);
  }
  const { data } = await client.v2.tweet({ text, media: { media_ids: mediaIds } });
  console.log(`Posted: https://x.com/daily_district_/status/${data.id}`);
}

main().catch(err => { console.error(err); process.exit(1); });
