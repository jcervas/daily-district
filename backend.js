// ============================================================
// backend.js — Daily District server backend client
//
// Wraps Supabase Auth + the `today` / `guess` Edge Functions so the answer and
// clue values stay server-side (see BACKEND.md). Exposes a single global
// `DistrictBackend`. Requires the supabase-js UMD bundle loaded first.
//
// Activation is gated by DistrictBackend.ENABLED. Leave it false until at least
// one auth provider is configured in the Supabase dashboard; the game then runs
// in its legacy client-only mode. Flip to true to require login + server clues.
// ============================================================
(function () {
  const SUPABASE_URL = 'https://itbpvqkunfeaimuxposx.supabase.co';
  // Publishable (anon) key — safe to ship in client code.
  const SUPABASE_ANON_KEY = 'sb_publishable_r1e40mdMFg02saEW_xNq2A_iTGELUcU';

  // Login required for everyone. (Google + email providers are configured.)
  const ENABLED = true;

  let _client = null;
  function client() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('supabase-js not loaded before backend.js');
    }
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // Implicit flow (tokens in the URL hash) instead of the default PKCE: on
      // mobile the PKCE code_verifier saved in localStorage at sign-in time is
      // often gone when the OAuth redirect returns (in-app browser / fresh tab),
      // which yields "OAuth state not found or expired" and bounces back to the
      // splash. Implicit flow delivers tokens directly, no cross-context storage.
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    });
    return _client;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  async function getUser() {
    const { data, error } = await client().auth.getUser();
    if (error) {
      // A stored session whose user no longer exists server-side (e.g. deleted in
      // the dashboard) returns "User from sub claim in JWT does not exist" and keeps
      // failing on every refresh — wedging the app on the login splash. Purge the
      // dead session locally so a fresh sign-in can take hold.
      //
      // BUT never purge while an OAuth redirect is being processed: the tokens in the
      // URL may not have been exchanged into a session yet, and signing out here would
      // wipe the session that's about to be established (bouncing back to the splash).
      const url = location.hash + location.search;
      const midOAuth = /[#&?](access_token|refresh_token|code|provider_token)=/.test(url);
      const msg = (error && error.message) || '';
      if (!midOAuth && /sub claim|does not exist|not found|user_not_found/i.test(msg)) {
        try { await client().auth.signOut({ scope: 'local' }); } catch (_) {}
      }
      return null;
    }
    return data?.user ?? null;
  }
  function onAuthChange(cb) {
    // Pass the event too (e.g. 'PASSWORD_RECOVERY') — existing callers ignore the 2nd arg.
    return client().auth.onAuthStateChange((event, session) => cb(session?.user ?? null, event));
  }
  function signInWithOAuth(provider) {
    // provider: 'google' | 'apple' | 'azure' | 'github' | ...
    return client().auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href.split('#')[0] },
    });
  }
  function signInWithEmail(email, password) {
    return client().auth.signInWithPassword({ email, password });
  }
  function signUpWithEmail(email, password, username) {
    return client().auth.signUp({
      email, password,
      options: { data: username ? { username } : {} },
    });
  }
  function signOut() { return client().auth.signOut(); }
  // Email a password-reset link back to the app; on return Supabase fires PASSWORD_RECOVERY.
  function resetPassword(email) {
    return client().auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
  }
  // Set a new password for the current (recovery or signed-in) session.
  function updatePassword(password) { return client().auth.updateUser({ password }); }

  // ── API (Edge Functions) ───────────────────────────────────────────────────
  // Both require a signed-in session; functions-js attaches the auth header.
  async function today(opts = {}) {
    // opts.reset:true asks the server to wipe today's result first so the puzzle can
    // be replayed (gated server-side to allowlisted test accounts; ignored otherwise).
    const body = opts.reset ? { reset: true } : {};
    const { data, error } = await client().functions.invoke('today', { body });
    if (error) throw error;
    return data; // { date, puzzleNumber, clues, cluesTotal, result, answer, tester, didReset }
  }
  async function guess(phase, value, seconds, opts = {}) {
    // opts.history (anonymous only): the player's prior guesses as [{ phase, value }].
    // The server (verify_jwt off) recomputes correctness from these values and persists
    // nothing — signed-in callers omit it and the server uses the stored result instead.
    const body = { phase, value, seconds };
    if (Array.isArray(opts.history)) body.history = opts.history;
    const { data, error } = await client().functions.invoke('guess', { body });
    if (error) throw error;
    return data; // { correct, adjacent, phase, guesses, guessesLeft, completed, won, clues, state, answer, anonymous }
  }
  // District shapes for one state — gated server-side: only returns once the
  // caller has correctly guessed that state today (or completed the puzzle).
  async function stateShapes(state) {
    const { data, error } = await client().functions.invoke('state-shapes', {
      body: { state },
    });
    if (error) throw error;
    return data; // { state, districts: [{ districtId, state, number, geometry, adj }] }
  }

  // Archive: list past puzzles, or fetch one past puzzle's full data for replay.
  // The server only serves dates strictly before today, so today's answer is never
  // exposed (archive replays are unofficial — not saved or counted).
  async function archiveList() {
    const { data, error } = await client().functions.invoke('archive', { body: {} });
    if (error) throw error;
    return data; // { puzzles: [{ date, puzzleNumber, districtId, state }] }
  }
  async function archivePuzzle(date) {
    const { data, error } = await client().functions.invoke('archive', { body: { date } });
    if (error) throw error;
    return data; // { date, puzzleNumber, districtId, state, geometry, clues, census, districts:[…] }
  }

  // Leaderboard: { user, today, allTime }. `user` is the signed-in player's own
  // stats (null if signed out); today/allTime are aggregates across all players.
  // Callable by anon, so aggregates show even when signed out.
  async function leaderboard() {
    const { data, error } = await client().rpc('get_leaderboard');
    if (error) throw error;
    return data;
  }

  // ── Telemetry (write-only; no PII — viewport / device class / locale) ──────
  function sessionId() {
    try {
      let s = sessionStorage.getItem('dd_session');
      if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); sessionStorage.setItem('dd_session', s); }
      return s;
    } catch (_) { return null; }
  }
  function deviceInfo() {
    const w = window.innerWidth, h = window.innerHeight;
    const ua = navigator.userAgent || '';
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const minDim = Math.min(w, h);
    let device = 'desktop';
    if (/iPad|Tablet/i.test(ua) || (touch && minDim >= 600 && minDim < 900)) device = 'tablet';
    else if (/Mobi|Android|iPhone|iPod/i.test(ua) || (touch && minDim < 600)) device = 'mobile';
    let tz = null; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) {}
    return {
      device, viewport_w: w, viewport_h: h,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      user_agent: ua.slice(0, 2048),
      language: navigator.language || null,
      timezone: tz,
      referrer: (document.referrer || '').slice(0, 2048) || null,
    };
  }
  // event: one of session_start|game_start|game_guess|game_complete|share|error
  async function logTelemetry(event, opts = {}) {
    try {
      const { data } = await client().auth.getUser();
      await client().from('telemetry').insert({
        user_id: data?.user?.id ?? null,
        session_id: sessionId(),
        event,
        puzzle_date: opts.puzzleDate ?? null,
        ...deviceInfo(),
        payload: opts.payload ?? {},
      });
    } catch (_) { /* best-effort; never disrupt gameplay */ }
  }

  // ── Profile (standard fields; all optional, user-editable) ─────────────────
  async function getProfile() {
    const { data: { user } } = await client().auth.getUser();
    if (!user) return null;
    const { data, error } = await client().from('profiles').select('*').eq('user_id', user.id).single();
    if (error) throw error;
    return data;
  }
  async function updateProfile(fields) {
    const { data: { user } } = await client().auth.getUser();
    if (!user) throw new Error('not signed in');
    const allowed = ['username', 'display_name', 'phone', 'city', 'region', 'country', 'marketing_opt_in'];
    const patch = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in fields) patch[k] = fields[k];
    const { data, error } = await client().from('profiles').update(patch).eq('user_id', user.id).select().single();
    if (error) throw error;
    return data;
  }

  window.DistrictBackend = {
    ENABLED,
    SUPABASE_URL,
    client,
    getUser, onAuthChange,
    signInWithOAuth, signInWithEmail, signUpWithEmail, signOut, resetPassword, updatePassword,
    today, guess, stateShapes, archiveList, archivePuzzle, leaderboard,
    logTelemetry, getProfile, updateProfile,
  };

  // Best-effort session telemetry on load (no PII). Runs for everyone.
  if (document.readyState !== 'loading') logTelemetry('session_start');
  else document.addEventListener('DOMContentLoaded', () => logTelemetry('session_start'));
})();
