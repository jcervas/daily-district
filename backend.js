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
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return _client;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  async function getUser() {
    const { data } = await client().auth.getUser();
    return data?.user ?? null;
  }
  function onAuthChange(cb) {
    return client().auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
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

  // ── API (Edge Functions) ───────────────────────────────────────────────────
  // Both require a signed-in session; functions-js attaches the auth header.
  async function today() {
    const { data, error } = await client().functions.invoke('today', { body: {} });
    if (error) throw error;
    return data; // { date, puzzleNumber, clues, cluesTotal, result, answer }
  }
  async function guess(phase, value, seconds) {
    const { data, error } = await client().functions.invoke('guess', {
      body: { phase, value, seconds },
    });
    if (error) throw error;
    return data; // { correct, adjacent, phase, guesses, guessesLeft, completed, won, clues, answer }
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
    signInWithOAuth, signInWithEmail, signUpWithEmail, signOut,
    today, guess, leaderboard,
    logTelemetry, getProfile, updateProfile,
  };

  // Best-effort session telemetry on load (no PII). Runs for everyone.
  if (document.readyState !== 'loading') logTelemetry('session_start');
  else document.addEventListener('DOMContentLoaded', () => logTelemetry('session_start'));
})();
