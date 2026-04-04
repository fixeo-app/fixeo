/* ================================================================
   FIXEO V10 — JS HEADER UNIFIED (js/header-unified.js)
   • Sticky scroll + hero-visible transparency
   • Auth state → visibilité Dashboard / Admin
   • Hamburger toggle + fermeture intelligente
   • Dropdown hover/click (desktop + touch)
   • Active nav-link par page courante
   • Quick-search shortcut (/)
   ================================================================ */

(function () {
  'use strict';

  /* ── UTILS ─────────────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ── AUTH STATE ────────────────────────────────────────────── */
  /**
   * Détecte si l'utilisateur est connecté ou admin
   * à partir du localStorage (clés standard Fixeo).
   * Étend le body avec les classes .is-logged-in / .is-admin.
   */
  function applyAuthState() {
    /* ── Lire les clés Fixeo (fixeo_*) ── */
    const userRaw = (
      localStorage.getItem('fixeo_user') ||
      localStorage.getItem('fixeo_session') ||
      localStorage.getItem('fixeo_token') ||
      localStorage.getItem('fixeo_logged')
    );
    const role = localStorage.getItem('fixeo_role') || localStorage.getItem('role') || '';
    const admin = (
      role === 'admin' ||
      localStorage.getItem('fixeo_admin') === '1' ||
      sessionStorage.getItem('fixeo_admin_auth') === '1'
    );

    /* ── Lire aussi l'objet normalisé 'user' (JSON) ── */
    let userObj = null;
    try {
      const userJSON = localStorage.getItem('user');
      if (userJSON) userObj = JSON.parse(userJSON);
    } catch(e) {}

    /* Simulated demo mode — detect URL param ?demo=user|admin */
    const urlParams = new URLSearchParams(window.location.search);
    const demoMode = urlParams.get('demo');

    const loggedIn = !!(userRaw || userObj) || demoMode === 'user' || demoMode === 'admin';
    const adminMode = admin || demoMode === 'admin';

    document.body.classList.toggle('is-logged-in', loggedIn);
    document.body.classList.toggle('is-admin', adminMode);

    /* ── Update user chip : nom + rôle ── */
    const nameEl = document.getElementById('global-username') || document.getElementById('header-username') || $('.nav-user-name');
    if (nameEl && loggedIn) {
      const storedName = localStorage.getItem('fixeo_user_name') || userObj?.name || 'Mon Compte';
      const storedRole = localStorage.getItem('fixeo_role') || userObj?.role || 'client';
      const roleLabel  = storedRole === 'artisan' ? '🔧 Artisan'
                        : storedRole === 'admin'   ? '🛡 Admin'
                        : '👤 Client';
      nameEl.textContent = `${storedName} (${roleLabel})`;
    }

    /* ── Update avatar initiales ── */
    const avatarEl = document.getElementById('global-avatar') || document.getElementById('header-avatar') || document.getElementById('nav-avatar-initials');
    if (avatarEl && loggedIn) {
      const storedName = localStorage.getItem('fixeo_user_name') || userObj?.name || 'U';
      avatarEl.textContent = storedName.charAt(0).toUpperCase();
    }

    /* ── Afficher le rôle dans #user-info si présent ── */
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
      if (loggedIn) {
        const storedName = localStorage.getItem('fixeo_user_name') || userObj?.name || 'Utilisateur';
        const storedRole = localStorage.getItem('fixeo_role') || userObj?.role || 'client';
        const roleLabel  = storedRole === 'artisan' ? '🔧 Artisan'
                          : storedRole === 'admin'   ? '🛡 Admin'
                          : '👤 Client';
        userInfoEl.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:.82rem;
            background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
            padding:4px 10px;border-radius:20px;color:rgba(255,255,255,0.85);">
            ${roleLabel} <strong>${storedName}</strong>
          </span>
        `;
        userInfoEl.style.display = 'inline-block';
      } else {
        userInfoEl.innerHTML = '';
        userInfoEl.style.display = 'none';
      }
    }

    /* Show badge notification count if any */
    const notifCount = parseInt(localStorage.getItem('fixeo_notif_count') || '0', 10);
    $$('.notif-badge').forEach(badge => {
      if (notifCount > 0) {
        badge.classList.add('has-notif');
        badge.textContent = notifCount > 99 ? '99+' : notifCount;
      } else {
        badge.classList.remove('has-notif');
        badge.textContent = '';
      }
    });
  }

  /* ── STICKY + HERO VISIBILITY ──────────────────────────────── */
  function initSticky() {
    const navbar = $('.navbar');
    if (!navbar) return;

    const hero = $('section.hero, #home, .hero');

    function onScroll() {
      const scrolled = window.scrollY > 50;
      navbar.classList.toggle('scrolled', scrolled);

      /* hero-visible: hero section partially in view */
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom;
        navbar.classList.toggle('hero-visible', heroBottom > 0 && !scrolled);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); /* run once on load */
  }

  /* ── ACTIVE NAV LINK ───────────────────────────────────────── */
  function setActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const currentHash = window.location.hash;

    $$('.navbar-nav .nav-link, .mobile-nav .nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      const linkPage = href.split('#')[0].split('/').pop();
      const linkHash = href.includes('#') ? '#' + href.split('#')[1] : '';

      link.classList.remove('active');

      /* Exact page match */
      if (linkPage === currentPage && linkPage !== '') {
        if (!linkHash || linkHash === currentHash) {
          link.classList.add('active');
        }
      }
      /* index.html + Accueil */
      if ((currentPage === '' || currentPage === 'index.html') &&
          (href === '#home' || href === 'index.html' || href === './')) {
        link.classList.add('active');
      }
    });

    /* Scroll-spy for index page hash links */
    if (currentPage === '' || currentPage === 'index.html') {
      const sections = $$('section[id]');
      if (!sections.length) return;

      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = '#' + entry.target.id;
            $$('.navbar-nav .nav-link[href="' + id + '"], .mobile-nav .nav-link[href="' + id + '"]').forEach(l => {
              $$('.navbar-nav .nav-link, .mobile-nav .nav-link').forEach(x => x.classList.remove('active'));
              l.classList.add('active');
            });
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });

      sections.forEach(s => observer.observe(s));
    }
  }

  /* ── HAMBURGER ─────────────────────────────────────────────── */
  function initHamburger() {
    if (window.FixeoMobileMenu && window.FixeoMobileMenu.initialized) return;
    const hamburgers = $$('.hamburger');
    const mobileNav = $('.mobile-nav');
    if (!mobileNav) return;

    function toggleMenu(forceClose = false) {
      const isOpen = mobileNav.classList.contains('open');
      const nextState = forceClose ? false : !isOpen;

      mobileNav.classList.toggle('open', nextState);
      hamburgers.forEach(h => {
        h.classList.toggle('open', nextState);
        h.setAttribute('aria-expanded', String(nextState));
      });

      /* Prevent body scroll when menu open */
      document.body.style.overflow = nextState ? 'hidden' : '';
    }

    hamburgers.forEach(h => {
      h.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
      });
    });

    /* Close on mobile nav link click */
    $$('.mobile-nav .nav-link').forEach(link => {
      link.addEventListener('click', () => toggleMenu(true));
    });

    /* Close on outside click */
    document.addEventListener('click', (e) => {
      if (
        mobileNav.classList.contains('open') &&
        !mobileNav.contains(e.target) &&
        !hamburgers.some(h => h.contains(e.target))
      ) {
        toggleMenu(true);
      }
    });

    /* Close on Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        toggleMenu(true);
      }
    });

    /* Close on resize to desktop */
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) toggleMenu(true);
    });
  }

  /* ── DROPDOWN MENUS ────────────────────────────────────────── */
  function initDropdowns() {
    const dropdownParents = $$('.nav-has-dropdown');

    dropdownParents.forEach(parent => {
      const dropdown = $('.nav-dropdown', parent);
      if (!dropdown) return;

      /* Desktop: hover already handled by CSS,
         but also support keyboard and touch */
      parent.addEventListener('focusin', () => parent.classList.add('open'));
      parent.addEventListener('focusout', (e) => {
        if (!parent.contains(e.relatedTarget)) parent.classList.remove('open');
      });

      /* Touch devices: toggle on tap */
      parent.addEventListener('click', (e) => {
        /* Only toggle if the click is on the parent link (not a dropdown item) */
        if (!dropdown.contains(e.target)) {
          e.preventDefault();
          const isOpen = parent.classList.contains('open');
          /* Close all other dropdowns */
          dropdownParents.forEach(p => p.classList.remove('open'));
          if (!isOpen) parent.classList.add('open');
        }
      });

      /* Close on outside click */
      document.addEventListener('click', (e) => {
        if (!parent.contains(e.target)) parent.classList.remove('open');
      });
    });
  }

  /* ── QUICK-SEARCH KEYBOARD SHORTCUT ────────────────────────── */
  function initQuickSearchShortcut() {
    document.addEventListener('keydown', (e) => {
      /* Press "/" to open Quick Search (when not focused in input) */
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        if (window.QuickSearchModal?.open) {
          window.QuickSearchModal.open();
        }
      }
    });
  }

  /* ── AUTH FORMS — persist on login ────────────────────────── */
  /**
   * Listen for auth.html form submissions to set localStorage flags.
   * Only active on auth.html.
   */
  function listenAuthForms() {
    const loginBtn = document.getElementById('btn-login');
    const signupBtn = document.getElementById('btn-signup');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        /* After successful login (the existing auth.js handles redirect),
           we set flags so the header shows correctly on return. */
        const email = document.getElementById('login-email')?.value?.trim() || '';
        const role = document.querySelector('input[name="role"]:checked')?.value || 'client';
        if (email) {
          localStorage.setItem('fixeo_user', email);
          localStorage.setItem('fixeo_user_name', email.split('@')[0]);
          localStorage.setItem('fixeo_role', role);
        }
      });
    }

    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        const name = document.getElementById('signup-name')?.value?.trim() || '';
        const email = document.getElementById('signup-email')?.value?.trim() || '';
        const role = document.querySelector('input[name="signup-role"]:checked')?.value || 'client';
        if (email) {
          localStorage.setItem('fixeo_user', email);
          localStorage.setItem('fixeo_user_name', name || email.split('@')[0]);
          localStorage.setItem('fixeo_role', role);
        }
      });
    }
  }

  /* ── LOGOUT helper (exposed globally) ─────────────────────── */
  window.fixeoLogout = function () {
    /* Clear all auth-related keys from localStorage */
    ['fixeo_user', 'fixeo_token', 'fixeo_session', 'fixeo_logged',
     'fixeo_role', 'fixeo_admin', 'fixeo_user_name', 'fixeo_notif_count',
     'user', 'role' /* clés normalisées */
    ].forEach(k => {
      localStorage.removeItem(k);
    });
    /* Clear sessionStorage admin flags */
    ['fixeo_admin_auth', 'fixeo_session'].forEach(k => {
      sessionStorage.removeItem(k);
    });
    document.body.classList.remove('is-logged-in', 'is-admin');
    /* Vider le user-info si présent */
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) { userInfoEl.innerHTML = ''; userInfoEl.style.display = 'none'; }
    window.location.href = 'index.html';
  };

  /* ── INIT ───────────────────────────────────────────────────── */
  function init() {
    applyAuthState();
    initSticky();
    setActiveLink();
    initHamburger();
    initDropdowns();
    initQuickSearchShortcut();
    listenAuthForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
