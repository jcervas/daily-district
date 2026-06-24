// ============================================================
// login.js — auth UI: the login gate, the account menu (initials → dropdown),
// and the profile modal (collect on first sign-in, edit anytime).
//
// The account menu + profile editing run whenever a user is signed in. Sign-in is
// optional: there is no forced gate — anonymous players can play (nothing is recorded
// for them), and the welcome splash / results screen offer a way to sign in.
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

    // Sign-in is OPTIONAL: anyone can play anonymously (the game records nothing for
    // them). Signing in binds the daily result to an account and the leaderboard. The
    // game UI is never gated behind auth — the welcome splash offers a "Sign in" link,
    // and the results screen invites anonymous players to sign in afterwards.
    const signinBtn = $('welcome-signin-btn');
    // Show the splash "Sign in" affordance only while signed out.
    const updateSigninAffordance = (user) => { if (signinBtn) signinBtn.hidden = !!user; };

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
      // Delete-account "danger zone" only makes sense for an existing account.
      $('profile-danger').classList.toggle('hidden', !isEdit);
      $('profile-delete-confirm').classList.add('hidden');
      $('profile-delete').classList.remove('hidden');
      $('profile-delete-error').textContent = '';
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

    // ---- Delete account (two-step confirm) ----------------------------------
    $('profile-delete').addEventListener('click', () => {
      $('profile-delete').classList.add('hidden');
      $('profile-delete-confirm').classList.remove('hidden');
      $('profile-delete-error').textContent = '';
    });
    $('profile-delete-cancel').addEventListener('click', () => {
      $('profile-delete-confirm').classList.add('hidden');
      $('profile-delete').classList.remove('hidden');
    });
    $('profile-delete-yes').addEventListener('click', async () => {
      const btn = $('profile-delete-yes');
      $('profile-delete-error').textContent = '';
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = 'Deleting…';
      try {
        await B.deleteAccount();
        // Clear local identity + cached game state so the app reopens as a clean,
        // signed-out device.
        try {
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith('districtguess_') || k.startsWith('dd_')) localStorage.removeItem(k);
          }
        } catch (_) {}
        try { await B.signOut(); } catch (_) {}
        location.reload();
      } catch (ex) {
        btn.disabled = false;
        btn.textContent = prev;
        $('profile-delete-error').textContent = (ex && ex.message) || 'Could not delete account';
      }
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

    const signinBtnHeader = $('header-signin-btn');
    async function refreshAccount() {
      const user = await B.getUser();
      if (!user) {
        accBtn.classList.add('hidden');
        signinBtnHeader && signinBtnHeader.classList.remove('hidden');  // show Sign in
        closeMenu();
        return;
      }
      signinBtnHeader && signinBtnHeader.classList.add('hidden');       // signed in → hide Sign in
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
        const { data, error } = await B.signUpWithEmail(email, pw);
        if (error) throw error;
        // With email confirmation enforced, signUp returns a user but NO session
        // until the link is clicked. (If confirmation is off, a session comes back
        // and onAuthChange signs them straight in.)
        if (data && data.session) {
          err.textContent = '';
        } else {
          err.textContent = 'Almost there — check your email for a confirmation link to finish signing up.';
        }
      } catch (ex) { fail(ex); }
    });
    // Forgot password: email a reset link to the address in the email field.
    $('login-forgot-password').addEventListener('click', async () => {
      const email = $('login-email').value.trim();
      if (!email) { err.textContent = 'Enter your email above, then tap "Forgot password?".'; return; }
      err.textContent = '';
      try {
        const { error } = await B.resetPassword(email);
        if (error) throw error;
        err.textContent = 'Check your email for a password-reset link.';
      } catch (ex) { fail(ex); }
    });
    // ---- Set-new-password modal (after following a reset link) ---------------
    const newpwModal = $('newpw-modal');
    const newpwErr = $('newpw-error');
    $('newpw-close').addEventListener('click', () => newpwModal.classList.add('hidden'));
    $('newpw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      newpwErr.textContent = '';
      try {
        const { error } = await B.updatePassword($('newpw-password').value);
        if (error) throw error;
        newpwModal.classList.add('hidden');
      } catch (ex) { newpwErr.textContent = (ex && ex.message) || 'Could not update password'; }
    });

    // Close returns to the welcome splash (which still has the Sign-in button).
    $('login-close').addEventListener('click', () => { err.textContent = ''; hideGate(); });
    $('welcome-signin-btn').addEventListener('click', () => { err.textContent = ''; showGate(); });
    signinBtnHeader && signinBtnHeader.addEventListener('click', () => { err.textContent = ''; showGate(); });

    // ---- React to auth state ------------------------------------------------
    B.onAuthChange((user, event) => {
      // Followed a reset link → Supabase opens a recovery session; prompt for a new password.
      if (event === 'PASSWORD_RECOVERY') { hideGate(); newpwModal.classList.remove('hidden'); return; }
      refreshAccount();
      updateSigninAffordance(user);
      if (user) {
        hideGate();
        maybePromptProfile();
        // script.js listens for this to re-bind an in-progress anonymous game to the
        // newly signed-in account.
        window.dispatchEvent(new CustomEvent('district-auth', { detail: { user } }));
      }
    });

    const user = await B.getUser();
    refreshAccount();
    updateSigninAffordance(user);
    if (user) maybePromptProfile();
  });
})();
