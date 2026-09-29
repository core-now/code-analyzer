/**
 * Authentication & User Session State + Pro-Account Gating
 * Handles JWT tokens, GitHub OAuth, login/registration, and Pro-Feature gates.
 */

    // --- Authentication & User Session State ---
    let authState = {
      token: localStorage.getItem('corenow_auth_token') || null,
      user: null,
      mode: 'login' // 'login' or 'register'
    };
    let isGithubAuthAvailable = false;

    function getAuthHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      if (authState.token) {
        headers['Authorization'] = `Bearer ${authState.token}`;
      }
      return headers;
    }

    async function checkAuthConfig() {
      try {
        const res = await fetch('/api/auth/config');
        if (res.ok) {
          const cfg = await res.json();
          isGithubAuthAvailable = !!cfg.github_oauth_enabled;
          const ghHint = document.getElementById('authGithubHint');
          if (ghHint) {
            if (!cfg.github_client_id_set) {
              ghHint.innerText = 'ℹ️ GitHub SSO benötigt GITHUB_CLIENT_ID in .env';
              ghHint.classList.remove('hidden');
            } else if (!isGithubAuthAvailable) {
              ghHint.innerText = 'ℹ️ GITHUB_CLIENT_SECRET fehlt in .env';
              ghHint.classList.remove('hidden');
            } else {
              ghHint.classList.add('hidden');
            }
          }
        }
      } catch (e) {
        console.warn('Could not check auth config:', e);
      }
    }

    async function checkAuthSession() {
      if (!authState.token) {
        updateAuthHeaderUI(null);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const user = await res.json();
          authState.user = user;
          updateAuthHeaderUI(user);
        } else {
          // Token expired or invalid
          authState.token = null;
          authState.user = null;
          localStorage.removeItem('corenow_auth_token');
          updateAuthHeaderUI(null);
        }
      } catch (err) {
        console.warn("Auth check failed:", err);
      }
    }

    function checkUrlAuthParams() {
      const params = new URLSearchParams(window.location.search);
      let stateChanged = false;

      if (params.has('token')) {
        const tokenVal = params.get('token');
        if (tokenVal) {
          localStorage.setItem('corenow_auth_token', tokenVal);
          authState.token = tokenVal;
        }
        params.delete('token');
        stateChanged = true;
      }

      if (params.has('login_success')) {
        showToast('🐱 Erfolgreich mit GitHub angemeldet!', 'success');
        params.delete('login_success');
        stateChanged = true;
      }

      if (params.has('auth_error')) {
        const err = params.get('auth_error');
        showToast('GitHub Login fehlgeschlagen: ' + err, 'error');
        params.delete('auth_error');
        stateChanged = true;
      }

      if (stateChanged) {
        authState.token = localStorage.getItem('corenow_auth_token') || null;
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        checkAuthSession();
      }
    }

    function updateAuthHeaderUI(user) {
      const loggedOut = document.getElementById('loggedOutSection');
      const loggedIn = document.getElementById('loggedInSection');
      const usernameSpan = document.getElementById('headerUsernameDisplay');

      if (user) {
        if (loggedOut) loggedOut.classList.add('hidden');
        if (loggedIn) loggedIn.classList.remove('hidden');
        if (usernameSpan) usernameSpan.innerText = user.username;
      } else {
        if (loggedOut) loggedOut.classList.remove('hidden');
        if (loggedIn) loggedIn.classList.add('hidden');
      }
      if (window.lucide) lucide.createIcons();
    }

    function openAuthModal(mode = 'login', customFeature = null) {
      if (mode === 'pro' || mode === 'upgrade') {
        authState.mode = 'login';
      } else {
        authState.mode = mode;
      }
      authState.mode = mode;
      const modal = document.getElementById('authModal');
      const title = document.getElementById('authModalTitle');
      const subtitle = document.getElementById('authModalSubtitle');
      const emailGroup = document.getElementById('authEmailGroup');
      const emailInput = document.getElementById('authEmailInput');
      const submitText = document.getElementById('authSubmitBtnText');
      const toggleHint = document.getElementById('authToggleHint');
      const toggleBtn = document.getElementById('authToggleBtn');
      const errorBanner = document.getElementById('authErrorBanner');
      const successBanner = document.getElementById('authSuccessBanner');

      if (errorBanner) errorBanner.classList.add('hidden');
      if (successBanner) successBanner.classList.add('hidden');

      const proBanner = document.getElementById('authProFeatureBanner');
      if (mode === 'pro' || mode === 'upgrade' || customFeature) {
        if (proBanner) {
          proBanner.classList.remove('hidden');
          const featureNameEl = document.getElementById('authProFeatureName');
          if (featureNameEl) {
            featureNameEl.textContent = customFeature || 'Cloud-Sync, Snapshot-Sharing & Multi-User';
          }
        }
      } else {
        if (proBanner) proBanner.classList.add('hidden');
      }

      if (mode === 'register') {
        if (title) title.innerText = 'DEVELOPER REGISTRIERUNG';
        if (subtitle) subtitle.innerText = 'Neuen Account für Multi-User Snapshots erstellen';
        if (emailGroup) emailGroup.classList.remove('hidden');
        if (emailInput) emailInput.setAttribute('required', 'true');
        if (submitText) submitText.innerText = 'Konto erstellen';
        if (toggleHint) toggleHint.innerText = 'Bereits registriert?';
        if (toggleBtn) toggleBtn.innerText = 'Jetzt anmelden';
      } else {
        if (title) title.innerText = 'DEVELOPER LOGIN';
        if (subtitle) subtitle.innerText = 'Zugang zu eigenen Projekten & Snapshots';
        if (emailGroup) emailGroup.classList.add('hidden');
        if (emailInput) emailInput.removeAttribute('required');
        if (submitText) submitText.innerText = 'Anmelden';
        if (toggleHint) toggleHint.innerText = 'Noch kein Account?';
        if (toggleBtn) toggleBtn.innerText = 'Kostenlos registrieren';
      }

      checkAuthConfig();
      if (modal) modal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }

    function closeAuthModal() {
      const modal = document.getElementById('authModal');
      if (modal) modal.classList.add('hidden');
    }

    function toggleAuthMode() {
      openAuthModal(authState.mode === 'login' ? 'register' : 'login');
    }

    function loginWithGithub() {
      handleGithubAuthClick();
    }
    window.loginWithGithub = loginWithGithub;
    window.handleGithubAuthClick = handleGithubAuthClick;

    function handleGithubAuthClick() {
      const errorBanner = document.getElementById('authErrorBanner');
      if (!isGithubAuthAvailable && document.getElementById('authGithubHint') && !document.getElementById('authGithubHint').classList.contains('hidden')) {
        if (errorBanner) {
          errorBanner.innerHTML = '<span>⚠️ GitHub SSO benötigt <code>GITHUB_CLIENT_ID</code> und <code>GITHUB_CLIENT_SECRET</code> in der <code>.env</code>.</span>';
          errorBanner.classList.remove('hidden');
        }
        return;
      }
      window.location.href = '/api/auth/github';
    }

    async function handleAuthSubmit(e) {
      e.preventDefault();
      const usernameInput = document.getElementById('authUsernameInput');
      const passwordInput = document.getElementById('authPasswordInput');
      const emailInput = document.getElementById('authEmailInput');
      const errorBanner = document.getElementById('authErrorBanner');
      const successBanner = document.getElementById('authSuccessBanner');
      const submitBtn = document.getElementById('authSubmitBtn');
      const submitText = document.getElementById('authSubmitBtnText');

      if (errorBanner) errorBanner.classList.add('hidden');
      if (successBanner) successBanner.classList.add('hidden');

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      const email = emailInput ? emailInput.value.trim() : '';

      if (!username) {
        if (errorBanner) {
          errorBanner.innerText = 'Bitte gib deinen Benutzernamen oder deine E-Mail-Adresse ein.';
          errorBanner.classList.remove('hidden');
        }
        return;
      }

      const isRegister = authState.mode === 'register';

      if (isRegister) {
        if (!email) {
          if (errorBanner) {
            errorBanner.innerText = 'Bitte gib eine gültige E-Mail-Adresse ein.';
            errorBanner.classList.remove('hidden');
          }
          return;
        }
        if (!password || password.length < 6) {
          if (errorBanner) {
            errorBanner.innerText = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
            errorBanner.classList.remove('hidden');
          }
          return;
        }
      } else {
        if (!password) {
          if (errorBanner) {
            errorBanner.innerText = 'Bitte gib dein Passwort ein.';
            errorBanner.classList.remove('hidden');
          }
          return;
        }
      }

      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister ? { username, email, password } : { username, password };

      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.innerText = isRegister ? 'Erstelle Konto...' : 'Melde an...';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({ error: 'Ungültige Serverantwort.' }));

        if (!res.ok) {
          if (errorBanner) {
            errorBanner.innerText = data.error || (isRegister ? 'Registrierung fehlgeschlagen.' : 'Ungültiger Benutzername/E-Mail oder falsches Passwort.');
            errorBanner.classList.remove('hidden');
          }
          if (submitBtn) submitBtn.disabled = false;
          if (submitText) submitText.innerText = isRegister ? 'Konto erstellen' : 'Anmelden';
          return;
        }

        authState.token = data.token;
        authState.user = data.user;
        localStorage.setItem('corenow_auth_token', data.token);
        updateAuthHeaderUI(data.user);

        if (successBanner) {
          successBanner.innerText = isRegister
            ? `🎉 Account '${data.user.username}' erfolgreich erstellt!`
            : `✅ Willkommen zurück, ${data.user.username}!`;
          successBanner.classList.remove('hidden');
        }

        showToast(isRegister ? `Konto erstellt: ${data.user.username}` : `Eingeloggt als ${data.user.username}`, 'success');

        setTimeout(() => {
          closeAuthModal();
          if (submitBtn) submitBtn.disabled = false;
          if (submitText) submitText.innerText = isRegister ? 'Konto erstellen' : 'Anmelden';
        }, 500);

      } catch (err) {
        if (errorBanner) {
          errorBanner.innerText = 'Verbindungsfehler zum Auth-Server: ' + err.message;
          errorBanner.classList.remove('hidden');
        }
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.innerText = isRegister ? 'Konto erstellen' : 'Anmelden';
      }
    }

    function handleUserLogout() {
      if (confirm('Möchtest du dich wirklich abmelden?')) {
        const prevUser = authState.user ? authState.user.username : 'Benutzer';
        authState.token = null;
        authState.user = null;
        localStorage.removeItem('corenow_auth_token');
        updateAuthHeaderUI(null);
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        showToast(`Abgemeldet (${prevUser})`, 'info');
      }
    }



// --- Pro Feature Gating & Upgrade Helpers ---

/**
 * Checks if current user is authenticated.
 * If not, shows a toast warning and opens the Auth/Upgrade modal with Pro context.
 * @param {string} featureName
 * @param {Function} callback
 * @returns {boolean}
 */
function requireAuthOrPro(featureName = 'Cloud-Sync & Sharing', callback = null) {
  if (!authState.user) {
    if (typeof showToast === 'function') {
      showToast(`⚡ PRO FEATURE: Für ${featureName} bitte einloggen oder registrieren.`, 'warning');
    }
    openAuthModal('pro', featureName);
    return false;
  }
  if (callback && typeof callback === 'function') {
    callback();
  }
  return true;
}

/**
 * Opens the Auth / Upgrade modal in Pro mode
 * @param {string} featureName
 */
function openUpgradeModal(featureName = 'Pro Features') {
  openAuthModal('pro', featureName);
}

// Attach to window for global access
window.authState = authState;
window.getAuthHeaders = getAuthHeaders;
window.checkAuthConfig = checkAuthConfig;
window.checkAuthSession = checkAuthSession;
window.checkUrlAuthParams = checkUrlAuthParams;
window.updateAuthHeaderUI = updateAuthHeaderUI;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.loginWithGithub = loginWithGithub;
window.handleGithubAuthClick = handleGithubAuthClick;
window.handleAuthSubmit = handleAuthSubmit;
window.handleLogout = handleLogout;
window.requireAuthOrPro = requireAuthOrPro;
window.openUpgradeModal = openUpgradeModal;
