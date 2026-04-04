/* ================================================================
   FIXEO V18 — AUTH GLOBAL (js/auth-global.js)
   ─────────────────────────────────────────────────────────────────
   Script global chargé sur TOUTES les pages.

   RÔLE :
     1. Lit l'état auth depuis localStorage (multi-clés robuste)
     2. Gère #auth-container → remplace login/register si connecté
     3. Gère les IDs du dashboard : header-avatar, header-username,
        logout-btn, login-btn, register-btn (brief v18)
     4. Met à jour le chip navbar (nav-avatar-initials / header-avatar,
        nav-user-name / header-username)
     5. Met à jour les sidebar mini-profiles avec les vraies données
     6. Expose window.logout() / window.fixeoGlobalLogout() global
     7. Déclenche un re-apply après DOMContentLoaded pour sécurité

   CLÉS LOCALSTORAGE SUPPORTÉES :
     • user            → JSON { id, name, role, avatar }  (normalisé)
     • fixeo_user      → email                             (Fixeo)
     • fixeo_user_name → nom affiché                       (Fixeo)
     • fixeo_role      → rôle (client/artisan/admin)
     • role            → rôle (alias)
   ================================================================ */

(function (window) {
  'use strict';

  /* ── 1. LECTURE ROBUSTE DU USER ──────────────────────────────── */
  function getAuthUser() {
    var name   = '';
    var role   = '';
    var email  = '';
    var avatar = '';

    /* Essai 1 : objet JSON normalisé 'user' */
    try {
      var raw = localStorage.getItem('user');
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && (obj.name || obj.id)) {
          name   = obj.name   || '';
          role   = obj.role   || '';
          email  = obj.email  || '';
          avatar = obj.avatar || '';
        }
      }
    } catch (e) {}

    /* Essai 2 : clés Fixeo individuelles (prioritaires sur le nom) */
    var fixeoName   = localStorage.getItem('fixeo_user_name') || '';
    var fixeoRole   = localStorage.getItem('fixeo_role') || localStorage.getItem('role') || '';
    var fixeoUser   = localStorage.getItem('fixeo_user') || '';
    var fixeoAvatar = localStorage.getItem('fixeo_avatar') || '';

    if (fixeoName)   name   = fixeoName;
    if (fixeoRole)   role   = fixeoRole;
    if (fixeoUser && !email) email = fixeoUser;
    if (fixeoAvatar) avatar = fixeoAvatar;

    /* Pas d'utilisateur du tout */
    if (!name && !email && !fixeoUser) return null;

    /* Fallback nom → email prefix */
    if (!name && email) name = email.split('@')[0];
    if (!name) name = 'Utilisateur';

    /* Normalisation du rôle */
    var VALID_ROLES = ['admin', 'artisan', 'client'];
    if (VALID_ROLES.indexOf(role) === -1) role = 'client';

    return { name: name, role: role, email: email, avatar: avatar };
  }

  /* ── 2. LABELS RÔLES ─────────────────────────────────────────── */
  function getRoleLabel(role) {
    if (role === 'artisan') return '🔧 Artisan';
    if (role === 'admin')   return '🛡 Admin';
    return '👤 Client';
  }

  /* ── 3. ESCAPE HTML ──────────────────────────────────────────── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── 4. GESTION #auth-container ─────────────────────────────── */
  function updateAuthContainer(user) {
    var container = document.getElementById('auth-container');
    if (!container) return;

    if (user) {
      var initial   = user.name.charAt(0).toUpperCase();
      var roleLabel = getRoleLabel(user.role);
      container.innerHTML =
        '<div class="fixeo-user-box">' +
          '<div class="fixeo-avatar">' + initial + '</div>' +
          '<div class="fixeo-user-info">' +
            '<span class="fixeo-user-name">' + escHtml(user.name) + '</span>' +
            '<small class="fixeo-user-role">' + roleLabel + '</small>' +
          '</div>' +
          '<button class="fixeo-logout-btn" onclick="fixeoGlobalLogout()">🚪 Déconnexion</button>' +
        '</div>';
    } else {
      container.innerHTML =
        '<a href="auth.html" class="btn-nav btn-nav-outline">Connexion</a>' +
        '<a href="auth.html#signup" class="btn-nav btn-nav-primary">Inscription</a>';
    }
  }

  /* ── 5. MET À JOUR LE CHIP NAVBAR ────────────────────────────── */
  /*   Compatible header-unified.js ET IDs du brief (v18)           */
  function updateNavChip(user) {

    /* ── Avatar : supporte header-avatar ET nav-avatar-initials ─── */
    var avatarEl = document.getElementById('global-avatar') || document.getElementById('header-avatar') || 
                   document.getElementById('nav-avatar-initials');
    if (avatarEl && user) {
      if (user.avatar) {
        /* Photo réelle : remplacer le contenu par un <img> */
        var img = document.createElement('img');
        img.src    = user.avatar;
        img.alt    = escHtml(user.name);
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
        avatarEl.innerHTML = '';
        avatarEl.appendChild(img);
      } else {
        /* Initiale */
        avatarEl.textContent = user.name.charAt(0).toUpperCase();
      }
    }

    /* ── Nom affiché : supporte header-username ET .nav-user-name ─ */
    var nameEl = document.getElementById('global-username') || document.getElementById('header-username') || 
                 document.querySelector('.nav-user-name');
    if (nameEl && user) {
      var roleLabel = getRoleLabel(user.role);
      nameEl.textContent = 'Bonjour, ' + user.name + ' (' + roleLabel + ')';
    } else if (nameEl && !user) {
      nameEl.textContent = 'Bonjour, Invité';
    }

    /* ── Rôle affiché : global-role ───────────────────────────── */
    var roleDisplayEl = document.getElementById('global-role');
    if (roleDisplayEl) {
      roleDisplayEl.textContent = user ? getRoleLabel(user.role) : '';
    }

    /* ── Bouton logout : supporte logout-btn et onclick inline ─── */
    /* (le onclick="logout()" du HTML appelle déjà fixeoGlobalLogout) */

    /* ── Boutons guest : masquer si connecté ─────────────────────── */
    var loginBtn    = document.getElementById('login-btn');
    var registerBtn = document.getElementById('register-btn');
    var logoutBtn   = document.getElementById('logout-btn');

    if (user) {
      if (loginBtn)    loginBtn.style.display    = 'none';
      if (registerBtn) registerBtn.style.display = 'none';
      if (logoutBtn)   logoutBtn.style.display   = 'inline-flex';
    } else {
      if (loginBtn)    loginBtn.style.display    = '';
      if (registerBtn) registerBtn.style.display = '';
      if (logoutBtn)   logoutBtn.style.display   = 'none';
    }

    /* ── #user-info dans le dropdown ─────────────────────────────── */
    var userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
      if (user) {
        var rl = getRoleLabel(user.role);
        userInfoEl.innerHTML =
          '<span style="display:inline-flex;align-items:center;gap:6px;font-size:.82rem;' +
          'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);' +
          'padding:4px 10px;border-radius:20px;color:rgba(255,255,255,0.85);">' +
          rl + ' <strong>' + escHtml(user.name) + '</strong></span>';
        userInfoEl.style.display = 'inline-block';
      } else {
        userInfoEl.innerHTML = '';
        userInfoEl.style.display = 'none';
      }
    }
  }

  /* ── 6. MET À JOUR LA SIDEBAR MINI-PROFILE ───────────────────── */
  function updateSidebarProfile(user) {
    /* Éléments avec IDs dédiés sidebar (ajoutés dans les HTML) */
    var sidebarAvatar   = document.getElementById('sidebar-avatar');
    var sidebarUsername = document.getElementById('sidebar-username');
    var sidebarRole     = document.getElementById('sidebar-role');

    if (!sidebarAvatar && !sidebarUsername) return; /* page sans sidebar */

    if (user) {
      /* Avatar sidebar */
      if (sidebarAvatar) {
        if (user.avatar) {
          sidebarAvatar.innerHTML =
            '<img src="' + escHtml(user.avatar) + '" ' +
            'style="width:100%;height:100%;border-radius:50%;object-fit:cover;" ' +
            'alt="' + escHtml(user.name) + '">';
        } else {
          /* Initiale centrée */
          sidebarAvatar.style.cssText =
            'width:42px;height:42px;border-radius:50%;' +
            'background:var(--grad-primary,linear-gradient(135deg,#E1306C,#833AB4));' +
            'display:flex;align-items:center;justify-content:center;' +
            'font-size:1.1rem;font-weight:700;color:#fff;flex-shrink:0;';
          sidebarAvatar.textContent = user.name.charAt(0).toUpperCase();
        }
      }

      /* Nom sidebar */
      if (sidebarUsername) {
        sidebarUsername.textContent = user.name;
      }

      /* Rôle sidebar */
      if (sidebarRole) {
        var rl = getRoleLabel(user.role);
        if (user.role === 'admin') {
          sidebarRole.innerHTML = '<span style="color:var(--accent-red,#E1306C)">● ' + rl + '</span>';
        } else if (user.role === 'artisan') {
          sidebarRole.textContent = rl + ' ⭐';
        } else {
          sidebarRole.textContent = rl + ' ⭐';
        }
      }
    }
  }

  /* ── 7. ÉTAT AUTH BODY CLASSES ───────────────────────────────── */
  function applyBodyClasses(user) {
    var isLoggedIn = !!user;
    var isAdmin    = !!(user && user.role === 'admin' &&
                       (localStorage.getItem('fixeo_admin') === '1' ||
                        sessionStorage.getItem('fixeo_admin_auth') === '1'));

    document.body.classList.toggle('is-logged-in', isLoggedIn);
    document.body.classList.toggle('is-admin',     isAdmin);
  }

  /* ── 8. LIEN DASHBOARD DYNAMIQUE SELON RÔLE ─────────────────── */
  function updateDashboardLinks(user) {
    if (!user) return;
    var dashLink = user.role === 'artisan'
      ? 'dashboard-artisan.html'
      : (user.role === 'admin' ? 'admin.html' : 'dashboard-client.html');

    var links = document.querySelectorAll('a[data-role="dashboard"]');
    for (var i = 0; i < links.length; i++) {
      links[i].href = dashLink;
    }
  }

  /* ── 9. LOGOUT GLOBAL ────────────────────────────────────────── */
  window.fixeoGlobalLogout = async function () {
    try {
      if (window.FixeoSupabase && typeof window.FixeoSupabase.logout === 'function') {
        await window.FixeoSupabase.logout({ redirectTo: 'index.html' });
        return;
      }
    } catch (e) {}

    [
      'fixeo_user', 'fixeo_token', 'fixeo_session', 'fixeo_logged',
      'fixeo_role', 'fixeo_admin', 'fixeo_user_name', 'fixeo_notif_count',
      'fixeo_avatar', 'user', 'role', 'fixeo_profile'
    ].forEach(function (k) { localStorage.removeItem(k); });

    ['fixeo_admin_auth', 'fixeo_session'].forEach(function (k) {
      sessionStorage.removeItem(k);
    });

    document.body.classList.remove('is-logged-in', 'is-admin');

    /* Vider le user-info si présent */
    var userInfoEl = document.getElementById('user-info');
    if (userInfoEl) { userInfoEl.innerHTML = ''; userInfoEl.style.display = 'none'; }

    window.location.href = 'index.html';
  };

  /* Alias compatibilité */
  window.fixeoLogout = window.fixeoGlobalLogout;
  window.logout      = window.fixeoGlobalLogout; /* alias brief v18 */

  /* ── 10. INIT PRINCIPALE ─────────────────────────────────────── */
  function init() {
    var user = getAuthUser();

    applyBodyClasses(user);
    updateAuthContainer(user);
    updateNavChip(user);
    updateSidebarProfile(user);
    updateDashboardLinks(user);
  }

  /* ── 11. EXÉCUTION ───────────────────────────────────────────── */
  /* Immédiat pour les body classes */
  init();

  /* Re-exécution après DOMContentLoaded pour les éléments DOM */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
