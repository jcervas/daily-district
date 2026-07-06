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
      options: {
        data: username ? { username } : {},
        // With "Confirm email" enabled in Supabase Auth, the confirmation link
        // sends the user back here; implicit flow + detectSessionInUrl then
        // establishes their session and onAuthChange fires SIGNED_IN.
        emailRedirectTo: window.location.href.split('#')[0],
      },
    });
  }
  function signOut() { return client().auth.signOut(); }
  // Re-send the signup confirmation email (e.g. the player lost the first one, or it
  // expired). Same redirect as the original signUp so the link still lands back here.
  function resendConfirmation(email) {
    return client().auth.resend({
      type: 'signup', email,
      options: { emailRedirectTo: window.location.href.split('#')[0] },
    });
  }
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
    // opts.history (anonymous only): the player's local guess history. If it proves they
    // already solved today's district, the server returns the FRESH answer/clues instead
    // of the client's stale local snapshot (signed-in callers omit it).
    const body = {};
    if (opts.reset) body.reset = true;
    if (Array.isArray(opts.history)) body.history = opts.history;
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
  // event: one of session_start|game_start|game_guess|game_complete|share|error|settings|ui_control
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

  // Cache the current access token (updated on auth changes) so the unload flush
  // below can authenticate a raw fetch synchronously, without awaiting getSession().
  let _accessToken = null;
  client().auth.getSession().then(({ data }) => { _accessToken = data?.session?.access_token ?? null; });
  client().auth.onAuthStateChange((_event, session) => { _accessToken = session?.access_token ?? null; });

  // ── Button/control tap tracking (batched; never one request per click) ─────
  // Buffered in memory and flushed periodically or on page hide, as a single
  // 'ui_control' row with a payload.controls array — not one insert per tap.
  let _controlBuffer = [];
  let _controlFlushTimer = null;
  function reportControl(name) {
    if (!name) return;
    _controlBuffer.push({ name, ts: Date.now() });
    if (!_controlFlushTimer) _controlFlushTimer = setTimeout(flushControls, 15000);
  }
  function flushControls(useBeacon) {
    if (_controlFlushTimer) { clearTimeout(_controlFlushTimer); _controlFlushTimer = null; }
    if (!_controlBuffer.length) return;
    const controls = _controlBuffer;
    _controlBuffer = [];
    const body = JSON.stringify([{
      session_id: sessionId(),
      event: 'ui_control',
      ...deviceInfo(),
      payload: { controls },
    }]);
    // On unload, fire a best-effort keepalive fetch (sendBeacon can't carry the
    // apikey/Authorization headers PostgREST requires) instead of awaiting the
    // normal supabase-js insert, which the page may not survive long enough for.
    if (useBeacon) {
      try {
        fetch(`${SUPABASE_URL}/rest/v1/telemetry`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${_accessToken || SUPABASE_ANON_KEY}`,
            Prefer: 'return=minimal',
          },
          body,
        }).catch(() => {});
      } catch (_) {}
      return;
    }
    client().from('telemetry').insert(JSON.parse(body)).then(() => {}, () => {});
  }
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushControls(true);
    });
    window.addEventListener('pagehide', () => flushControls(true));
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
  // Permanently delete the signed-in user's account: removes the auth identity,
  // profile, and telemetry server-side, while retaining their (now-anonymous)
  // game history in `results`. Caller should sign out / reload afterwards.
  async function deleteAccount() {
    const { data, error } = await client().functions.invoke('delete-account', { body: {} });
    if (error) throw error;
    return data; // { deleted: true }
  }

  // ── Web Push (opt-in daily reminder) ────────────────────────────────────────
  // Public key only — safe to ship in client code, it identifies the sender to the
  // push service. The matching private key lives only in the send-daily-push
  // Edge Function's secrets.
  const VAPID_PUBLIC_KEY = 'BNHpLXIynZUcUr0yNIt-o8JbS1VPtoe9kayzW5TnHboUTXwJ_HGj-c0I0WJXMm_ezrkvtAQ8Kb3A9hWBnfIYce4';

  function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  // iOS Safari only allows Web Push once the site is installed to the Home Screen
  // (standalone display mode) — both checks are used to decide which opt-in panel to show.
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }
  // Rough browser sniff used only to pick which "unblock notifications" steps to show —
  // not used for any feature-detection, so false positives are low-stakes.
  function browserName() {
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'edge';
    if (/OPR\//.test(ua)) return 'opera';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/CriOS\//.test(ua)) return 'chrome-ios';
    if (/Chrome\//.test(ua)) return 'chrome';
    if (/Safari\//.test(ua)) return 'safari';
    return 'other';
  }
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }
  let _swRegistration = null;
  async function registerServiceWorker() {
    if (!pushSupported()) return null;
    if (_swRegistration) return _swRegistration;
    try {
      _swRegistration = await navigator.serviceWorker.register('sw.js');
      return _swRegistration;
    } catch (_) { return null; }
  }
  async function getPushSubscription() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return reg.pushManager.getSubscription();
  }
  // Registers the service worker (if needed), requests Notification permission,
  // subscribes to the push service, and upserts the subscription server-side.
  // Throws 'permission_denied' if the player declines the browser prompt.
  async function subscribePush() {
    if (!pushSupported()) throw new Error('unsupported');
    const { data: { user } } = await client().auth.getUser();
    if (!user) throw new Error('not signed in');
    const reg = await registerServiceWorker();
    if (!reg) throw new Error('sw_registration_failed');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('permission_denied');
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const subJson = sub.toJSON();
    const { error } = await client().from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      user_agent: navigator.userAgent.slice(0, 500),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });
    if (error) throw error;
    return sub;
  }
  async function unsubscribePush() {
    const sub = await getPushSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const { data: { user } } = await client().auth.getUser();
    if (user) await client().from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
  }

  window.DistrictBackend = {
    ENABLED,
    SUPABASE_URL,
    client,
    getUser, onAuthChange,
    signInWithOAuth, signInWithEmail, signUpWithEmail, signOut, resetPassword, updatePassword, resendConfirmation,
    today, guess, stateShapes, archiveList, archivePuzzle, leaderboard,
    logTelemetry, reportControl, getProfile, updateProfile, deleteAccount,
    pushSupported, isIOS, isStandalone, browserName, registerServiceWorker, getPushSubscription, subscribePush, unsubscribePush,
  };

  // Best-effort session telemetry on load (no PII). Runs for everyone.
  if (document.readyState !== 'loading') logTelemetry('session_start');
  else document.addEventListener('DOMContentLoaded', () => logTelemetry('session_start'));
})();
