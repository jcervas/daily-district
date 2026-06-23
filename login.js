// ============================================================
// login.js — auth UI: the login gate, the account menu (initials → dropdown),
// and the profile modal (collect on first sign-in, edit anytime).
//
// The account menu + profile editing run whenever a user is signed in, in any
// mode. The forced login gate only appears when the backend is active
// (DistrictBackend.ENABLED, or the ?login=1 test hatch).
// ============================================================
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function initialsFor(profile, user) {
    const name = (profile && (profile.display_name || profile.username)) || '';
    if (name.trim()) {
      const parts = name.trim().split(/\s+/);
      return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
    }
    const email = (profile && profile.email) || (user && user.email) || '';
    return (email[0] || '?').toUpperCase();
  }

  ready(async function () {
    const B = window.DistrictBackend;
    if (!B) return;

    const $ = (id) => document.getElementById(id);
    const active = B.ENABLED || new URLSearchParams(location.search).get('login') === '1';

    // When login is required, hide the game (and welcome splash) until signed in
    // so there is nothing to interact with behind the gate. Locked synchronously
    // up front to avoid a flash of the game before the auth check resolves.
    const lock = () => document.body.classList.add('auth-locked');
    const unlock = () => document.body.classList.remove('auth-locked');
    if (active) lock();

    // ---- Profile modal (shared: first-time collection + later editing) ------
    const pModal = $('profile-modal');
    const pErr = $('profile-error');
    const hideProfile = () => pModal.classList.add('hidden');

    function fillProfileForm(prof) {
      $('profile-display-name').value = (prof && prof.display_name) || '';
      $('profile-phone').value   = (prof && prof.phone)   || '';
      $('profile-city').value    = (prof && prof.city)    || '';
      $('profile-region').value  = (prof && prof.region)  || '';
      $('profile-country').value = (prof && prof.country) || '';
      $('profile-marketing').checked = !!(prof && prof.marketing_opt_in);
    }
    async function openProfile(isEdit) {
      pErr.textContent = '';
      let prof = null;
      try { prof = await B.getProfile(); } catch (_) {}
      fillProfileForm(prof);
      $('profile-skip').textContent = isEdit ? 'Cancel' : 'Skip for now';
      pModal.classList.remove('hidden');
    }
    // Shown once after first sign-in if profile not yet filled.
    async function maybePromptProfile() {
      if (localStorage.getItem('dd_profile_done') === '1') return;
      let prof;
      try { prof = await B.getProfile(); } catch (_) { return; }
      if (!prof) return;
      if (prof.city || prof.phone) { localStorage.setItem('dd_profile_done', '1'); return; }
      openProfile(false);
    }

    $('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      pErr.textContent = '';
      const val = (id) => $(id).value.trim() || null;
      try {
        await B.updateProfile({
          display_name: val('profile-display-name'),
          phone: val('profile-phone'),
          city: val('profile-city'),
          region: val('profile-region'),
          country: val('profile-country'),
          marketing_opt_in: $('profile-marketing').checked,
        });
        localStorage.setItem('dd_profile_done', '1');
        hideProfile();
        refreshAccount();
      } catch (ex) { pErr.textContent = (ex && ex.message) || 'Could not save'; }
    });
    $('profile-skip').addEventListener('click', () => {
      localStorage.setItem('dd_profile_done', '1');
      hideProfile();
    });

    // ---- Account menu (initials avatar → dropdown) --------------------------
    const accBtn = $('account-btn');
    const accMenu = $('account-menu');
    const closeMenu = () => { accMenu.classList.add('hidden'); accBtn.setAttribute('aria-expanded', 'false'); };

    accBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = accMenu.classList.toggle('hidden') === false;
      accBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!accMenu.classList.contains('hidden') && !accMenu.contains(e.target) && e.target !== accBtn) closeMenu();
    });
    $('account-edit').addEventListener('click', () => { closeMenu(); openProfile(true); });
    $('account-signout').addEventListener('click', async () => {
      closeMenu();
      try { await B.signOut(); } catch (_) {}
    });

    async function refreshAccount() {
      const user = await B.getUser();
      if (!user) { accBtn.classList.add('hidden'); closeMenu(); return; }
      let prof = null;
      try { prof = await B.getProfile(); } catch (_) {}
      $('account-initials').textContent = initialsFor(prof, user);
      $('account-name').textContent  = (prof && (prof.display_name || prof.username)) || '';
      $('account-email').textContent = (prof && prof.email) || user.email || '';
      accBtn.classList.remove('hidden');
    }

    // ---- Login form (opened on demand from the welcome splash) --------------
    // The splash is the always-present fallback, so the login form is dismissable.
    const modal = $('login-modal');
    const err = $('login-error');
    const showGate = () => modal.classList.remove('hidden');
    const hideGate = () => modal.classList.add('hidden');
    const fail = (e) => { err.textContent = (e && e.message) || 'Something went wrong'; };

    modal.querySelectorAll('.login-provider-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        err.textContent = '';
        try { await B.signInWithOAuth(btn.dataset.provider); } catch (e) { fail(e); }
      });
    });
    $('login-email-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        const { error } = await B.signInWithEmail($('login-email').value.trim(), $('login-password').value);
        if (error) throw error;
      } catch (ex) { fail(ex); }
    });
    $('login-signup').addEventListener('click', async () => {
      err.textContent = '';
      const email = $('login-email').value.trim();
      const pw = $('login-password').value;
      if (!email || pw.length < 6) { err.textContent = 'Enter an email and a 6+ character password.'; return; }
      try {
        const { error } = await B.signUpWithEmail(email, pw);
        if (error) throw error;
        err.textContent = 'Check your email to confirm, then sign in.';
      } catch (ex) { fail(ex); }
    });
    // Close returns to the welcome splash (which still has the Sign-in button).
    $('login-close').addEventListener('click', () => { err.textContent = ''; hideGate(); });
    $('welcome-signin-btn').addEventListener('click', () => { err.textContent = ''; showGate(); });

    // When locked, make sure the welcome splash is the visible fallback.
    const showSplash = () => $('welcome-modal').classList.remove('hidden');

    // ---- React to auth state ------------------------------------------------
    B.onAuthChange((user) => {
      refreshAccount();
      if (user) {
        unlock();
        hideGate();
        maybePromptProfile();
        window.dispatchEvent(new CustomEvent('district-auth', { detail: { user } }));
      } else if (active) {
        lock();
        hideGate();
        showSplash();
      }
    });

    const user = await B.getUser();
    refreshAccount();
    if (user) { unlock(); maybePromptProfile(); }
    else if (active) { lock(); showSplash(); }
  });
})();
