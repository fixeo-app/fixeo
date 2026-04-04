/* ============================================================
   FIXEO V14 — ADMIN DASHBOARD JS — ULTIMATE FIX
   ============================================================
   CORRECTIONS V14 :
     FIX-ADMIN-1 : Bootstrap automatique compte admin au démarrage
                   (créer si inexistant, mettre à jour si rôle incorrect)
     FIX-ADMIN-2 : Synchronisation rôles multi-clés localStorage
     FIX-ADMIN-3 : checkAdminAccess → feedback amélioré
     FIX-ADMIN-4 : adminLogout → nettoyage complet de toutes les clés
   ============================================================ */

/* ── ADMIN AUTH ────────────────────────────────────────────── */
/* Identifiants admin sécurisés (SHA-256) */
const _ADMIN_EMAIL     = 'admin@fixeo.com';
const _ADMIN_PASS_HASH = 'c6d729bbfb14021b9852303540c1859737373ffbb108f5e5922246f6ac77b3da';
const _ADMIN_DISPLAY   = 'Admin Fixeo';

/* ── FIX-ADMIN-1 : BOOTSTRAP AUTOMATIQUE COMPTE ADMIN ────────
   Logique :
     • Si l'utilisateur connecté est admin@fixeo.com mais
       les flags de rôle sont manquants/incorrects → correction
     • Si des flags admin orphelins existent → nettoyage
     • Appelé AVANT tout autre code d'initialisation
   ─────────────────────────────────────────────────────────── */
(function _bootstrapAdminAccount() {
  try {
    const storedUser  = localStorage.getItem('fixeo_user')  || '';
    const storedRole  = localStorage.getItem('fixeo_role')  || '';
    const storedAdmin = localStorage.getItem('fixeo_admin') || '';
    const storedSess  = sessionStorage.getItem('fixeo_admin_auth') || '';

    /* Cas 1 : Admin connecté avec rôle manquant/incorrect → corriger */
    const isAdminEmail = storedUser.toLowerCase() === _ADMIN_EMAIL;
    if (isAdminEmail && storedRole !== 'admin') {
      console.log('[Fixeo Admin] Bootstrap: rôle admin manquant → correction automatique');
      localStorage.setItem('fixeo_role', 'admin');
      localStorage.setItem('role',       'admin');
      localStorage.setItem('fixeo_admin','1');
    }

    /* Cas 2 : Flags admin orphelins (fixeo_admin=1 mais user ≠ admin) → purge */
    if (storedAdmin === '1' && !isAdminEmail && storedUser !== '') {
      console.log('[Fixeo Admin] Bootstrap: flags admin orphelins → purge');
      localStorage.removeItem('fixeo_admin');
      sessionStorage.removeItem('fixeo_admin_auth');
      if (storedRole === 'admin') {
        localStorage.setItem('fixeo_role', 'client');
        localStorage.setItem('role',       'client');
      }
    }

    /* Cas 3 : Rôle manquant pour un utilisateur connecté → default 'client' */
    if (storedUser && !storedRole) {
      const defaultRole = isAdminEmail ? 'admin' : 'client';
      localStorage.setItem('fixeo_role', defaultRole);
      localStorage.setItem('role',       defaultRole);
      console.log('[Fixeo Admin] Bootstrap: rôle manquant → défaut', defaultRole);
    }

    /* Cas 4 : Rôle invalide pour un non-admin → forcer 'client' */
    if (storedUser && !isAdminEmail && storedRole === 'admin') {
      console.log('[Fixeo Admin] Bootstrap: rôle admin non autorisé → forcer client');
      localStorage.setItem('fixeo_role', 'client');
      localStorage.setItem('role',       'client');
      localStorage.removeItem('fixeo_admin');
      sessionStorage.removeItem('fixeo_admin_auth');
    }
  } catch (e) {
    console.warn('[Fixeo Admin] Bootstrap error (silencieux):', e.message);
  }
})();

async function _sha256admin(str) {
  const buf  = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function checkAdminAccess() {
  const emailInput = document.getElementById('admin-user')?.value.trim().toLowerCase();
  const pass  = document.getElementById('admin-pass')?.value;
  const errEl = document.getElementById('admin-gate-error');
  const btn   = document.querySelector('#admin-gate .btn');

  /* FIX-ADMIN-3 : Validation des champs avant le hash */
  if (!emailInput || !pass) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent   = '⚠️ Veuillez renseigner l\'email et le mot de passe.';
    }
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Vérification…'; }
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  const passHash = await _sha256admin(pass);

  if (emailInput === _ADMIN_EMAIL && passHash === _ADMIN_PASS_HASH) {
    /* ── FIX-ADMIN-2 : Persist admin auth — toutes les clés synchronisées ── */
    sessionStorage.setItem('fixeo_admin_auth', '1');
    localStorage.setItem('fixeo_user',      _ADMIN_EMAIL);
    localStorage.setItem('fixeo_user_name', _ADMIN_DISPLAY);
    localStorage.setItem('fixeo_role',      'admin');
    localStorage.setItem('fixeo_admin',     '1');
    localStorage.setItem('role',            'admin');   /* clé normalisée */
    localStorage.setItem('fixeo_logged_in', 'true');    /* compatibilité UI */
    /* ── Re-apply auth state to body ── */
    document.body.classList.add('is-logged-in', 'is-admin');
    document.getElementById('admin-gate').style.display = 'none';
    document.getElementById('admin-app').style.display  = 'block';
    initAdmin();
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '🔑 Connexion Admin'; }
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent   = emailInput !== _ADMIN_EMAIL
        ? '❌ Email administrateur incorrect.'
        : '❌ Mot de passe incorrect.';
    }
  }
}

/* Auto-bypass gate if already authenticated as admin */
document.addEventListener('DOMContentLoaded', () => {
  const alreadyAdmin = (
    sessionStorage.getItem('fixeo_admin_auth') === '1' ||
    localStorage.getItem('fixeo_admin') === '1'
  ) && localStorage.getItem('fixeo_role') === 'admin';

  if (alreadyAdmin) {
    document.body.classList.add('is-logged-in', 'is-admin');
    document.getElementById('admin-gate').style.display = 'none';
    document.getElementById('admin-app').style.display  = 'block';
    initAdmin();
  }
});

function adminLogout() {
  /* FIX-ADMIN-4 : Nettoyage complet de TOUTES les clés d'auth */
  [
    'fixeo_admin', 'fixeo_user', 'fixeo_user_name',
    'fixeo_role',  'role',       'fixeo_logged_in'
  ].forEach(k => localStorage.removeItem(k));
  sessionStorage.removeItem('fixeo_admin_auth');
  /* Stopper le polling au logout */
  _stopAdminOrdersPolling();
  document.body.classList.remove('is-logged-in', 'is-admin');
  const gate = document.getElementById('admin-gate');
  const app  = document.getElementById('admin-app');
  if (gate) gate.style.display = 'flex';
  if (app)  app.style.display  = 'none';
}

// Allow Enter key on gate
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const gate = document.getElementById('admin-gate');
    if (gate && gate.style.display !== 'none') checkAdminAccess();
  }
});

/* ── SECTION NAVIGATION ─────────────────────────────────────── */
function adminSection(name) {
  document.querySelectorAll('[id^="admin-section-"]').forEach(el => {
    el.style.display = el.id === 'admin-section-' + name ? 'block' : 'none';
  });
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  event?.target?.closest('.sidebar-link')?.classList.add('active');
  /* ── V20 : charger le module artisans à la demande ── */
  if (name === 'artisans' && typeof initArtisansAdmin === 'function') {
    setTimeout(initArtisansAdmin, 50);
  }
}

/* ── DATA STORES ─────────────────────────────────────────────── */
/* V20: ADMIN_ARTISANS conservé comme fallback legacy (API in admin-artisans.js) */
const ADMIN_ARTISANS = [
  { id:1, name:'Karim Benali', initials:'KB', specialty:'Plomberie', city:'Casablanca', plan:'pro', status:'active', rating:4.9, missions:127, joined:'15/01/2024', email:'karim@fixeo.ma' },
  { id:2, name:'Sara Doukkali', initials:'SD', specialty:'Peinture', city:'Casablanca', plan:'premium', status:'active', rating:4.8, missions:98, joined:'20/02/2024', email:'sara@fixeo.ma' },
  { id:3, name:'Omar Tahiri', initials:'OT', specialty:'Électricité', city:'Rabat', plan:'pro', status:'active', rating:4.7, missions:85, joined:'10/03/2024', email:'omar@fixeo.ma' },
  { id:4, name:'Fatima Zahra', initials:'FZ', specialty:'Nettoyage', city:'Marrakech', plan:'premium', status:'active', rating:4.9, missions:210, joined:'05/01/2024', email:'fatima@fixeo.ma' },
  { id:5, name:'Rachid Moussaoui', initials:'RM', specialty:'Menuiserie', city:'Fès', plan:'free', status:'active', rating:4.6, missions:67, joined:'18/04/2024', email:'rachid@fixeo.ma' },
  { id:6, name:'Hanane Benkirane', initials:'HB', specialty:'Jardinage', city:'Rabat', plan:'pro', status:'active', rating:4.8, missions:142, joined:'22/02/2024', email:'hanane@fixeo.ma' },
  { id:7, name:'Youssef Idrissi', initials:'YI', specialty:'Maçonnerie', city:'Casablanca', plan:'free', status:'active', rating:4.5, missions:54, joined:'01/05/2024', email:'youssef@fixeo.ma' },
  { id:8, name:'Amina Chraibi', initials:'AC', specialty:'Climatisation', city:'Agadir', plan:'pro', status:'active', rating:4.7, missions:89, joined:'14/03/2024', email:'amina@fixeo.ma' },
  { id:9, name:'Khalid Fassi', initials:'KF', specialty:'Serrurerie', city:'Tanger', plan:'free', status:'suspended', rating:3.8, missions:23, joined:'08/06/2024', email:'khalid@fixeo.ma' },
  { id:10, name:'Nadia Alaoui', initials:'NA', specialty:'Déménagement', city:'Casablanca', plan:'premium', status:'active', rating:4.9, missions:178, joined:'12/01/2024', email:'nadia@fixeo.ma' },
  { id:11, name:'Hassan Belhaj', initials:'HB', specialty:'Bricolage', city:'Meknès', plan:'free', status:'active', rating:4.4, missions:38, joined:'20/07/2024', email:'hassan@fixeo.ma' },
  { id:12, name:'Zineb Ouali', initials:'ZO', specialty:'Peinture', city:'Marrakech', plan:'free', status:'active', rating:4.6, missions:45, joined:'03/06/2024', email:'zineb@fixeo.ma' }
];

const ADMIN_CLIENTS = [
  { id:1, name:'Mohammed Alami', email:'m.alami@email.ma', city:'Casablanca', missions:12, joined:'15/01/2024', status:'active' },
  { id:2, name:'Leila Bensouda', email:'l.bensouda@email.ma', city:'Rabat', missions:8, joined:'22/02/2024', status:'active' },
  { id:3, name:'Ahmed Tahir', email:'a.tahir@email.ma', city:'Marrakech', missions:15, joined:'10/03/2024', status:'active' },
  { id:4, name:'Yasmine Kabbaj', email:'y.kabbaj@email.ma', city:'Casablanca', missions:3, joined:'05/06/2024', status:'active' },
  { id:5, name:'Ibrahim Naciri', email:'i.naciri@email.ma', city:'Fès', missions:7, joined:'18/04/2024', status:'active' },
  { id:6, name:'Fatima Tazi', email:'f.tazi@email.ma', city:'Agadir', missions:20, joined:'01/01/2024', status:'active' },
  { id:7, name:'Soufiane Berrada', email:'s.berrada@email.ma', city:'Tanger', missions:1, joined:'10/09/2024', status:'active' },
  { id:8, name:'Hafsa Mernissi', email:'h.mernissi@email.ma', city:'Rabat', missions:9, joined:'25/03/2024', status:'suspended' }
];

const ADMIN_PAYMENTS = [
  { ref:'TXN-A8F4B2', artisan:'Sara Doukkali', plan:'Premium', method:'Stripe', amount:199, date:'14/03/2026', status:'success' },
  { ref:'TXN-C3D9E1', artisan:'Karim Benali', plan:'Pro', method:'PayPal', amount:99, date:'14/03/2026', status:'success' },
  { ref:'TXN-F7G2H8', artisan:'Omar Tahiri', plan:'Pro', method:'CMI', amount:99, date:'13/03/2026', status:'success' },
  { ref:'TXN-J1K5L3', artisan:'Fatima Zahra', plan:'Premium', method:'Stripe', amount:199, date:'12/03/2026', status:'success' },
  { ref:'TXN-M9N4O6', artisan:'Nadia Alaoui', plan:'Premium', method:'Stripe', amount:199, date:'10/03/2026', status:'success' },
  { ref:'TXN-P2Q7R8', artisan:'Hanane Benkirane', plan:'Pro', method:'PayPal', amount:99, date:'09/03/2026', status:'success' },
  { ref:'TXN-S5T1U9', artisan:'Amina Chraibi', plan:'Pro', method:'CMI', amount:99, date:'08/03/2026', status:'success' },
  { ref:'TXN-V3W8X2', artisan:'Khalid Fassi', plan:'Free', method:'—', amount:0, date:'07/03/2026', status:'refunded' },
  { ref:'TXN-Y6Z4A7', artisan:'Youssef Idrissi', plan:'Pro', method:'Stripe', amount:99, date:'01/03/2026', status:'failed' }
];

const ADMIN_SUBSCRIPTIONS = [
  { artisan:'Karim Benali', plan:'pro', start:'15/01/2024', renewal:'15/04/2026', amount:99, status:'active' },
  { artisan:'Sara Doukkali', plan:'premium', start:'20/02/2024', renewal:'20/04/2026', amount:199, status:'active' },
  { artisan:'Omar Tahiri', plan:'pro', start:'10/03/2024', renewal:'10/04/2026', amount:99, status:'active' },
  { artisan:'Fatima Zahra', plan:'premium', start:'05/01/2024', renewal:'05/04/2026', amount:199, status:'active' },
  { artisan:'Hanane Benkirane', plan:'pro', start:'22/02/2024', renewal:'22/04/2026', amount:99, status:'active' },
  { artisan:'Amina Chraibi', plan:'pro', start:'14/03/2024', renewal:'14/04/2026', amount:99, status:'active' },
  { artisan:'Nadia Alaoui', plan:'premium', start:'12/01/2024', renewal:'12/04/2026', amount:199, status:'active' },
  { artisan:'Khalid Fassi', plan:'free', start:'08/06/2024', renewal:'—', amount:0, status:'suspended' }
];

const ADMIN_REGISTRATIONS = [
  { id:1, name:'Mourad Saidi', specialty:'Plâtrerie', city:'Casablanca', email:'mourad@email.ma', phone:'+212 6 12 34 56 78', experience:'8 ans', submitted:'13/03/2026' },
  { id:2, name:'Houda Benali', specialty:'Carrelage', city:'Rabat', email:'houda@email.ma', phone:'+212 6 23 45 67 89', experience:'5 ans', submitted:'12/03/2026' },
  { id:3, name:'Tarik Lahlou', specialty:'Peinture industrielle', city:'Tanger', email:'tarik@email.ma', phone:'+212 6 34 56 78 90', experience:'12 ans', submitted:'10/03/2026' }
];

const ADMIN_REVIEWS = [
  { id:1, artisan:'Karim Benali', client:'Mohammed Alami', rating:5, text:'Excellent travail, rapide et professionnel. Je recommande vivement !', date:'14/03/2026', status:'pending' },
  { id:2, artisan:'Rachid Moussaoui', client:'Leila Bensouda', rating:2, text:'Travail médiocre, beaucoup de retards et résultat décevant.', date:'13/03/2026', status:'pending' }
];

const ADMIN_REPORTS = [
  { id:1, type:'Artisan', target:'Khalid Fassi', reporter:'Ahmed Tahir', reason:'Communication difficile et devis non respecté', date:'14/03/2026', status:'open' },
  { id:2, type:'Avis', target:'Avis #442', reporter:'Zineb Ouali', reason:'Avis non authentique, semble faux', date:'13/03/2026', status:'open' },
  { id:3, type:'Client', target:'Soufiane Berrada', reporter:'Hassan Belhaj', reason:'Paiement non effectué après prestation', date:'12/03/2026', status:'open' },
  { id:4, type:'Artisan', target:'Youssef Idrissi', reporter:'Yasmine Kabbaj', reason:'Non-respect des horaires convenus', date:'11/03/2026', status:'investigating' },
  { id:5, type:'Avis', target:'Avis #398', reporter:'Omar Tahiri', reason:'Avis diffamatoire sans fondement', date:'10/03/2026', status:'resolved' }
];

let currentArtisanId = null;

/* ── INIT ────────────────────────────────────────────────────── */
/* initAdmin defined below in the Réservations module (V10) — this placeholder ensures
   backward compat if the append fails for any reason */
function _initAdminBase() {
  updateLastTime();
  renderAdminCharts();
  renderActivityList();
  renderAdminAlerts();
  renderArtisansTable(ADMIN_ARTISANS);
  renderClientsTable();
  renderRegistrations();
  renderSubscriptions();
  renderPayments();
  renderReviews();
  renderReports();
}

function updateLastTime() {
  const el = document.getElementById('last-update-time');
  if (el) el.textContent = new Date().toLocaleTimeString('fr-FR');
}

function refreshAdminData() {
  updateLastTime();
  showToast('✅ Données actualisées', 'success');
}

/* ── CHARTS ──────────────────────────────────────────────────── */
function renderAdminCharts() {
  // Revenue chart
  const revCtx = document.getElementById('admin-chart-revenue');
  if (revCtx) {
    new Chart(revCtx, {
      type: 'line',
      data: {
        labels: ['Sep','Oct','Nov','Déc','Jan','Fév','Mar'],
        datasets:[{
          label:'Revenus (MAD)',
          data:[12800,15400,14200,18900,22100,25800,28450],
          borderColor:'#E1306C', backgroundColor:'rgba(225,48,108,0.12)',
          tension:0.4, fill:true, pointBackgroundColor:'#E1306C', pointRadius:4
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'rgba(255,255,255,0.5)',font:{size:11}} },
          y:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'rgba(255,255,255,0.5)',font:{size:11}} }
        }
      }
    });
  }

  // Subscriptions chart
  const subCtx = document.getElementById('admin-chart-subs');
  if (subCtx) {
    new Chart(subCtx, {
      type: 'doughnut',
      data: {
        labels: ['Free','Pro','Premium'],
        datasets:[{
          data:[6,4,2],
          backgroundColor:['rgba(255,255,255,0.15)','rgba(225,48,108,0.65)','rgba(252,175,69,0.65)'],
          borderColor:['rgba(255,255,255,0.1)','rgba(225,48,108,0.8)','rgba(252,175,69,0.8)'],
          borderWidth:2
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom', labels:{ color:'rgba(255,255,255,0.7)', font:{size:11} } } }
      }
    });
  }
}

/* ── ACTIVITY LIST ───────────────────────────────────────────── */
function renderActivityList() {
  const list = document.getElementById('admin-activity-list');
  if (!list) return;
  const activities = [
    { icon:'👷', title:'Nouvel artisan inscrit — Mourad Saidi (Plâtrerie)', time:'Il y a 2h' },
    { icon:'💳', title:'Paiement Premium reçu — Sara Doukkali (199 MAD)', time:'Il y a 3h' },
    { icon:'⭐', title:'Nouvel avis en attente de modération', time:'Il y a 5h' },
    { icon:'🚩', title:'Signalement ouvert — Khalid Fassi', time:'Il y a 6h' },
    { icon:'✅', title:'Mission complétée — Karim Benali / Mohammed Alami', time:'Il y a 8h' },
    { icon:'💳', title:'Paiement Pro reçu — Omar Tahiri (99 MAD)', time:'Il y a 12h' }
  ];
  list.innerHTML = activities.map(a => `
    <div class="admin-activity-item">
      <div class="activity-icon">${a.icon}</div>
      <div class="activity-text">
        <div class="activity-title">${a.title}</div>
        <div class="activity-time">${a.time}</div>
      </div>
    </div>
  `).join('');
}

/* ── ALERTS ──────────────────────────────────────────────────── */
function renderAdminAlerts() {
  const el = document.getElementById('admin-alerts');
  if (!el) return;
  el.innerHTML = `
    <div class="admin-alert">
      <div class="alert-icon">📝</div>
      <div class="alert-text">3 demandes d'inscription artisan en attente d'approbation</div>
      <span class="alert-action" onclick="adminSection('registrations')">Voir →</span>
    </div>
    <div class="admin-alert">
      <div class="alert-icon">⭐</div>
      <div class="alert-text">2 avis clients en attente de modération</div>
      <span class="alert-action" onclick="adminSection('reviews')">Voir →</span>
    </div>
    <div class="admin-alert">
      <div class="alert-icon">🚩</div>
      <div class="alert-text">5 signalements ouverts nécessitent une action</div>
      <span class="alert-action" onclick="adminSection('reports')">Voir →</span>
    </div>
  `;
}

/* ── ARTISANS TABLE ──────────────────────────────────────────── */
function renderArtisansTable(data) {
  const tbody = document.getElementById('artisans-admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.map(a => `
    <tr>
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar">${a.initials}</div>
          <div>
            <div class="admin-user-name">${a.name}</div>
            <div class="admin-user-sub">${a.email}</div>
          </div>
        </div>
      </td>
      <td>${a.specialty}</td>
      <td>📍 ${a.city}</td>
      <td><span class="plan-badge plan-${a.plan}">${planLabel(a.plan)}</span></td>
      <td><span class="status-badge status-${a.status}">${statusLabel(a.status)}</span></td>
      <td>⭐ ${a.rating}</td>
      <td>${a.missions}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="tbl-btn" onclick="viewArtisanDetail(${a.id})">👁 Voir</button>
        ${a.status === 'active'
          ? `<button class="tbl-btn danger" onclick="confirmAction('suspend',${a.id})">🚫 Suspendre</button>`
          : `<button class="tbl-btn success" onclick="confirmAction('activate',${a.id})">✅ Activer</button>`}
      </td>
    </tr>
  `).join('');
}

function filterAdminArtisans(query) {
  const q = query.toLowerCase();
  renderArtisansTable(ADMIN_ARTISANS.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.specialty.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q)
  ));
}

function filterAdminArtisansByStatus(status) {
  renderArtisansTable(status ? ADMIN_ARTISANS.filter(a => a.status === status) : ADMIN_ARTISANS);
}

function viewArtisanDetail(id) {
  currentArtisanId = id;
  const a = ADMIN_ARTISANS.find(x => x.id === id);
  if (!a) return;

  document.getElementById('artisan-detail-title').textContent = `👷 ${a.name}`;
  document.getElementById('artisan-detail-body').innerHTML = `
    <div class="artisan-detail-grid">
      <div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Nom complet</div><div class="artisan-detail-value">${a.name}</div></div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Spécialité</div><div class="artisan-detail-value">${a.specialty}</div></div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Ville</div><div class="artisan-detail-value">${a.city}</div></div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Email</div><div class="artisan-detail-value">${a.email}</div></div>
      </div>
      <div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Plan actuel</div><div class="artisan-detail-value"><span class="plan-badge plan-${a.plan}">${planLabel(a.plan)}</span></div></div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Statut</div><div class="artisan-detail-value"><span class="status-badge status-${a.status}">${statusLabel(a.status)}</span></div></div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Note moyenne</div><div class="artisan-detail-value">⭐ ${a.rating}/5</div></div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Missions complétées</div><div class="artisan-detail-value">${a.missions}</div></div>
        <div class="artisan-detail-row"><div class="artisan-detail-label">Inscrit le</div><div class="artisan-detail-value">${a.joined}</div></div>
      </div>
    </div>
  `;

  const approveBtn = document.getElementById('artisan-approve-btn');
  const suspendBtn = document.getElementById('artisan-suspend-btn');
  if (approveBtn) approveBtn.style.display = a.status === 'pending' ? 'inline-flex' : 'none';
  if (suspendBtn) suspendBtn.textContent = a.status === 'active' ? '🚫 Suspendre' : '✅ Réactiver';

  openModal('artisan-detail-modal');
}

function approveArtisan() {
  if (!currentArtisanId) return;
  const a = ADMIN_ARTISANS.find(x => x.id === currentArtisanId);
  if (a) { a.status = 'active'; }
  closeModal('artisan-detail-modal');
  renderArtisansTable(ADMIN_ARTISANS);
  showToast('✅ Artisan approuvé avec succès', 'success');
}

function suspendArtisan() {
  if (!currentArtisanId) return;
  const a = ADMIN_ARTISANS.find(x => x.id === currentArtisanId);
  if (a) { a.status = a.status === 'active' ? 'suspended' : 'active'; }
  closeModal('artisan-detail-modal');
  renderArtisansTable(ADMIN_ARTISANS);
  showToast('🚫 Statut artisan mis à jour', 'info');
}

/* ── CLIENTS TABLE ───────────────────────────────────────────── */
function renderClientsTable() {
  const tbody = document.getElementById('clients-admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_CLIENTS.map(c => `
    <tr>
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar" style="background:linear-gradient(135deg,#405DE6,#833AB4)">${c.name.charAt(0)}</div>
          <div class="admin-user-name">${c.name}</div>
        </div>
      </td>
      <td>${c.email}</td>
      <td>📍 ${c.city}</td>
      <td>${c.missions}</td>
      <td>${c.joined}</td>
      <td><span class="status-badge status-${c.status}">${statusLabel(c.status)}</span></td>
      <td>
        <button class="tbl-btn danger" onclick="confirmAction('ban_client',${c.id})">🚫 Bannir</button>
      </td>
    </tr>
  `).join('');
}

/* ── REGISTRATIONS ───────────────────────────────────────────── */
function renderRegistrations() {
  const el = document.getElementById('registrations-list');
  if (!el) return;
  el.innerHTML = ADMIN_REGISTRATIONS.map(r => `
    <div class="reg-card">
      <div class="reg-card-header">
        <div class="admin-avatar">${r.name.charAt(0)}</div>
        <div class="reg-card-info">
          <h4>${r.name}</h4>
          <p>${r.specialty} · 📍 ${r.city} · 📧 ${r.email}</p>
          <p style="font-size:.75rem;color:var(--text-muted)">${r.experience} d'expérience · Soumis le ${r.submitted}</p>
        </div>
        <div class="reg-actions">
          <button class="tbl-btn success" onclick="approveRegistration(${r.id})">✅ Approuver</button>
          <button class="tbl-btn danger" onclick="rejectRegistration(${r.id})">❌ Refuser</button>
        </div>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-muted)">Aucune inscription en attente.</p>';
}

function approveRegistration(id) {
  const idx = ADMIN_REGISTRATIONS.findIndex(r => r.id === id);
  if (idx > -1) {
    ADMIN_REGISTRATIONS.splice(idx, 1);
    document.getElementById('sc-regs').textContent = ADMIN_REGISTRATIONS.length;
    renderRegistrations();
    showToast('✅ Inscription approuvée ! L\'artisan peut maintenant accéder à la plateforme.', 'success');
  }
}

function rejectRegistration(id) {
  const idx = ADMIN_REGISTRATIONS.findIndex(r => r.id === id);
  if (idx > -1) {
    ADMIN_REGISTRATIONS.splice(idx, 1);
    document.getElementById('sc-regs').textContent = ADMIN_REGISTRATIONS.length;
    renderRegistrations();
    showToast('❌ Inscription refusée. Un email a été envoyé au candidat.', 'info');
  }
}

/* ── SUBSCRIPTIONS TABLE ─────────────────────────────────────── */
function renderSubscriptions() {
  const tbody = document.getElementById('subscriptions-admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_SUBSCRIPTIONS.map(s => `
    <tr>
      <td>${s.artisan}</td>
      <td><span class="plan-badge plan-${s.plan}">${planLabel(s.plan)}</span></td>
      <td>${s.start}</td>
      <td>${s.renewal}</td>
      <td>${s.amount > 0 ? s.amount + ' MAD' : '—'}</td>
      <td><span class="status-badge status-${s.status}">${statusLabel(s.status)}</span></td>
      <td>
        ${s.plan !== 'free'
          ? `<button class="tbl-btn danger" onclick="cancelSubscription('${s.artisan}')">Annuler</button>`
          : '<span style="color:var(--text-muted);font-size:.78rem">—</span>'}
      </td>
    </tr>
  `).join('');
}

function cancelSubscription(artisan) {
  showToast(`⚠️ Abonnement de ${artisan} annulé.`, 'warning');
}

/* ── PAYMENTS TABLE ──────────────────────────────────────────── */
function renderPayments() {
  const tbody = document.getElementById('payments-admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = ADMIN_PAYMENTS.map(p => `
    <tr>
      <td style="font-family:monospace;font-size:.78rem">${p.ref}</td>
      <td>${p.artisan}</td>
      <td><span class="plan-badge plan-${p.plan.toLowerCase()}">${p.plan}</span></td>
      <td>${p.method}</td>
      <td>${p.amount > 0 ? p.amount + ' MAD' : '—'}</td>
      <td>${p.date}</td>
      <td><span class="status-badge status-${p.status}">${p.status === 'success' ? '✅ Succès' : p.status === 'failed' ? '❌ Échoué' : '↩ Remboursé'}</span></td>
    </tr>
  `).join('');
}

/* ── REVIEWS MODERATION ──────────────────────────────────────── */
function renderReviews() {
  const el = document.getElementById('reviews-mod-list');
  if (!el) return;
  if (!ADMIN_REVIEWS.length) { el.innerHTML = '<p style="color:var(--text-muted)">Aucun avis en attente.</p>'; return; }
  el.innerHTML = ADMIN_REVIEWS.map(r => `
    <div class="review-mod-card">
      <div class="review-mod-header">
        <div class="admin-avatar">${r.client.charAt(0)}</div>
        <div>
          <div style="font-weight:700;font-size:.9rem">${r.client}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">Pour ${r.artisan} · ${r.date}</div>
        </div>
        <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
      </div>
      <div class="review-content">"${r.text}"</div>
      <div class="review-actions">
        <button class="tbl-btn success" onclick="approveReview(${r.id})">✅ Approuver</button>
        <button class="tbl-btn danger" onclick="rejectReview(${r.id})">🗑 Supprimer</button>
      </div>
    </div>
  `).join('');
}

function approveReview(id) {
  const idx = ADMIN_REVIEWS.findIndex(r => r.id === id);
  if (idx > -1) { ADMIN_REVIEWS.splice(idx, 1); renderReviews(); showToast('✅ Avis approuvé', 'success'); }
}
function rejectReview(id) {
  const idx = ADMIN_REVIEWS.findIndex(r => r.id === id);
  if (idx > -1) { ADMIN_REVIEWS.splice(idx, 1); renderReviews(); showToast('🗑 Avis supprimé', 'info'); }
}

/* ── REPORTS ─────────────────────────────────────────────────── */
function renderReports() {
  const el = document.getElementById('reports-list');
  if (!el) return;
  const statusColors = { open:'warning', investigating:'info', resolved:'success' };
  el.innerHTML = ADMIN_REPORTS.map(r => `
    <div class="review-mod-card">
      <div class="review-mod-header">
        <div class="admin-avatar" style="background:rgba(225,48,108,.2);color:var(--primary)">🚩</div>
        <div>
          <div style="font-weight:700;font-size:.9rem">${r.type} — ${r.target}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">Signalé par ${r.reporter} · ${r.date}</div>
        </div>
        <span class="status-badge status-${statusColors[r.status]||'pending'}">${r.status}</span>
      </div>
      <div style="font-size:.85rem;color:rgba(255,255,255,.75);margin-bottom:12px">${r.reason}</div>
      <div class="review-actions">
        ${r.status !== 'resolved' ? `<button class="tbl-btn success" onclick="resolveReport(${r.id})">✅ Résolu</button>` : ''}
        <button class="tbl-btn danger" onclick="dismissReport(${r.id})">🗑 Ignorer</button>
      </div>
    </div>
  `).join('');
}

function resolveReport(id) {
  const r = ADMIN_REPORTS.find(x => x.id === id);
  if (r) { r.status = 'resolved'; renderReports(); showToast('✅ Signalement marqué comme résolu', 'success'); }
}
function dismissReport(id) {
  const idx = ADMIN_REPORTS.findIndex(x => x.id === id);
  if (idx > -1) { ADMIN_REPORTS.splice(idx, 1); renderReports(); showToast('🗑 Signalement ignoré', 'info'); }
}

/* ── CONFIRM ACTION ──────────────────────────────────────────── */
function confirmAction(type, id) {
  const labels = {
    suspend: { title:'Suspendre l\'artisan', msg:'L\'artisan n\'aura plus accès à la plateforme. Confirmer ?', icon:'🚫' },
    activate:{ title:'Réactiver l\'artisan', msg:'L\'artisan aura de nouveau accès à la plateforme.', icon:'✅' },
    ban_client:{ title:'Bannir le client', msg:'Le client ne pourra plus utiliser Fixeo. Confirmer ?', icon:'🚫' }
  };
  const l = labels[type] || { title:'Confirmer', msg:'Cette action est irréversible.', icon:'⚠️' };
  document.getElementById('admin-confirm-icon').textContent = l.icon;
  document.getElementById('admin-confirm-title').textContent = l.title;
  document.getElementById('admin-confirm-msg').textContent = l.msg;
  const btn = document.getElementById('admin-confirm-ok');
  btn.onclick = () => {
    executeAction(type, id);
    closeModal('admin-confirm-modal');
  };
  openModal('admin-confirm-modal');
}

function executeAction(type, id) {
  if (type === 'suspend') {
    const a = ADMIN_ARTISANS.find(x => x.id === id);
    if (a) { a.status = 'suspended'; renderArtisansTable(ADMIN_ARTISANS); showToast('🚫 Artisan suspendu', 'warning'); }
  } else if (type === 'activate') {
    const a = ADMIN_ARTISANS.find(x => x.id === id);
    if (a) { a.status = 'active'; renderArtisansTable(ADMIN_ARTISANS); showToast('✅ Artisan réactivé', 'success'); }
  } else if (type === 'ban_client') {
    const c = ADMIN_CLIENTS.find(x => x.id === id);
    if (c) { c.status = 'suspended'; renderClientsTable(); showToast('🚫 Client banni', 'warning'); }
  }
}

/* ── SETTINGS ────────────────────────────────────────────────── */
function saveAdminSettings() {
  showToast('💾 Paramètres sauvegardés avec succès', 'success');
}

/* ── MODAL OPEN/CLOSE ────────────────────────────────────────── */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  let bd = document.getElementById('admin-bd');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'admin-bd';
    bd.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);z-index:999;';
    bd.onclick = () => { modal.classList.remove('open'); bd.remove(); };
    document.body.appendChild(bd);
  }
  modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal?.classList.remove('open');
  document.getElementById('admin-bd')?.remove();
}

/* ── TOAST ───────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const colors = { success:'rgba(32,201,151,.9)', warning:'rgba(252,175,69,.9)', info:'rgba(64,93,230,.9)', error:'rgba(225,48,108,.9)' };
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${colors[type]||colors.info}; color:#fff;
    padding:12px 20px; border-radius:12px;
    font-size:.85rem; font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,0.35);
    animation:slideUp .3s ease; max-width:340px; line-height:1.4;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.animation='fadeOutDown .3s ease forwards'; setTimeout(()=>t.remove(),300); }, 3500);
}

/* ── HELPERS ─────────────────────────────────────────────────── */
function planLabel(plan) {
  return { free:'🆓 Free', pro:'🏅 Pro', premium:'👑 Premium' }[plan] || plan;
}
function statusLabel(status) {
  return { active:'● Actif', pending:'● En attente', suspended:'● Suspendu', resolved:'● Résolu' }[status] || status;
}

/* CSS injection for animations */
(function(){
  const s = document.createElement('style');
  s.textContent = `
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeOutDown { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(10px)} }
  `;
  document.head.appendChild(s);
})();

/* ================================================================
   FIXEO V10 — MODULE RÉSERVATIONS ADMIN
   Intégré de façon non-destructive · Tous les systèmes existants
   restent intacts.
   ================================================================ */

/* ── TAUX DE COMMISSION FIXEO (admin uniquement) ─────────────── */
const FIXEO_COMMISSION_RATE = 0.15; // 15 %

/**
 * Calcule la commission Fixeo (15 %) et le gain artisan.
 * @param {number} price  Prix du service en MAD
 * @returns {{ commission: number, artisanEarns: number }}
 */
function _calcCommission(price, method) {
  /* COD utilise 10% de commission, les autres méthodes 15% */
  const isCOD = (method === 'Cash on Delivery' || method === 'COD');
  const rate = isCOD ? 0.10 : FIXEO_COMMISSION_RATE;
  const commission   = Math.round(price * rate);
  const artisanEarns = Math.round(price - commission);
  return { commission, artisanEarns };
}

/* ── DATA STORE RÉSERVATIONS ──────────────────────────────────── */
const ADMIN_RESERVATIONS = [
  {
    id:'RES-001', client:'Mohammed Alami', clientId:1,
    artisan:'Karim Benali', artisanId:1,
    service:'Fuite d\'eau — réparation', city:'Casablanca',
    date:'17/03/2026', time:'Matin (8h–12h)',
    status:'pending', payStatus:'pending_pay',
    price:300, method:'Stripe', type:'standard', createdAt:'16/03/2026'
  },
  {
    id:'RES-002', client:'Leila Bensouda', clientId:2,
    artisan:'Sara Doukkali', artisanId:2,
    service:'Peinture intérieure', city:'Rabat',
    date:'17/03/2026', time:'Après-midi (14h–18h)',
    status:'confirmed', payStatus:'paid',
    price:850, method:'PayPal', type:'standard', createdAt:'15/03/2026'
  },
  {
    id:'RES-003', client:'Ahmed Tahir', clientId:3,
    artisan:'Omar Tahiri', artisanId:3,
    service:'Tableau électrique', city:'Marrakech',
    date:'16/03/2026', time:'Matin (8h–12h)',
    status:'inprogress', payStatus:'paid',
    price:450, method:'CMI', type:'standard', createdAt:'14/03/2026'
  },
  {
    id:'RES-004', client:'Yasmine Kabbaj', clientId:4,
    artisan:'Fatima Zahra', artisanId:4,
    service:'Nettoyage complet domicile', city:'Casablanca',
    date:'15/03/2026', time:'Matin (8h–12h)',
    status:'completed', payStatus:'paid',
    price:200, method:'Stripe', type:'standard', createdAt:'13/03/2026'
  },
  {
    id:'RES-005', client:'Ibrahim Naciri', clientId:5,
    artisan:'Rachid Moussaoui', artisanId:5,
    service:'Portes & Fenêtres', city:'Fès',
    date:'15/03/2026', time:'Après-midi (14h–18h)',
    status:'completed', payStatus:'paid',
    price:1200, method:'Stripe', type:'standard', createdAt:'12/03/2026'
  },
  {
    id:'RES-006', client:'Fatima Tazi', clientId:6,
    artisan:'Hanane Benkirane', artisanId:6,
    service:'Taille arbres & haies', city:'Agadir',
    date:'14/03/2026', time:'Matin (8h–12h)',
    status:'completed', payStatus:'paid',
    price:350, method:'PayPal', type:'standard', createdAt:'11/03/2026'
  },
  {
    id:'RES-007', client:'Soufiane Berrada', clientId:7,
    artisan:'Amina Chraibi', artisanId:8,
    service:'Installation climatiseur', city:'Tanger',
    date:'18/03/2026', time:'Soir (18h–20h)',
    status:'pending', payStatus:'pending_pay',
    price:600, method:'CMI', type:'standard', createdAt:'17/03/2026'
  },
  {
    id:'RES-008', client:'Hafsa Mernissi', clientId:8,
    artisan:'Nadia Alaoui', artisanId:10,
    service:'Déménagement complet', city:'Rabat',
    date:'20/03/2026', time:'Matin (8h–12h)',
    status:'confirmed', payStatus:'paid',
    price:1500, method:'Stripe', type:'standard', createdAt:'16/03/2026'
  },
  {
    id:'RES-009', client:'Mohammed Alami', clientId:1,
    artisan:'Hassan Belhaj', artisanId:11,
    service:'Montage meubles IKEA', city:'Casablanca',
    date:'13/03/2026', time:'Après-midi (14h–18h)',
    status:'cancelled', payStatus:'refunded',
    price:250, method:'Stripe', type:'standard', createdAt:'10/03/2026'
  },
  {
    id:'RES-010', client:'Ahmed Tahir', clientId:3,
    artisan:'Youssef Idrissi', artisanId:7,
    service:'Carrelage & joints', city:'Marrakech',
    date:'19/03/2026', time:'Matin (8h–12h)',
    status:'confirmed', payStatus:'paid',
    price:700, method:'CMI', type:'standard', createdAt:'17/03/2026'
  },
  {
    id:'RES-EXP-001', client:'Leila Bensouda', clientId:2,
    artisan:'Karim Benali', artisanId:1,
    service:'Urgence 24/7', city:'Casablanca',
    date:'17/03/2026', time:'Dès maintenant',
    status:'inprogress', payStatus:'paid',
    price:480, method:'Stripe', type:'express', createdAt:'17/03/2026'
  },
  {
    id:'RES-EXP-002', client:'Yasmine Kabbaj', clientId:4,
    artisan:'Omar Tahiri', artisanId:3,
    service:'Urgence électrique', city:'Casablanca',
    date:'16/03/2026', time:'Dès maintenant',
    status:'completed', payStatus:'paid',
    price:360, method:'PayPal', type:'express', createdAt:'16/03/2026'
  },
  {
    id:'RES-013', client:'Ibrahim Naciri', clientId:5,
    artisan:'Zineb Ouali', artisanId:12,
    service:'Ravalement de façade', city:'Fès',
    date:'21/03/2026', time:'Matin (8h–12h)',
    status:'pending', payStatus:'pending_pay',
    price:2200, method:'CMI', type:'standard', createdAt:'17/03/2026'
  },
  {
    id:'RES-014', client:'Fatima Tazi', clientId:6,
    artisan:'Fatima Zahra', artisanId:4,
    service:'Désinfection', city:'Agadir',
    date:'22/03/2026', time:'Matin (8h–12h)',
    status:'pending', payStatus:'pending_pay',
    price:180, method:'Stripe', type:'standard', createdAt:'17/03/2026'
  },
  {
    id:'RES-015', client:'Soufiane Berrada', clientId:7,
    artisan:'Hanane Benkirane', artisanId:6,
    service:'Aménagement paysager', city:'Tanger',
    date:'10/03/2026', time:'Après-midi (14h–18h)',
    status:'completed', payStatus:'paid',
    price:900, method:'PayPal', type:'standard', createdAt:'07/03/2026'
  }
];

/* Merge reservations from localStorage (created via reservation.js / payment.js / paypal-sandbox.js) */
function _mergeLocalStorageReservations() {
  try {
    const stored = JSON.parse(localStorage.getItem('fixeo_reservations') || '[]');
    stored.forEach(r => {
      if (!ADMIN_RESERVATIONS.find(x => x.id === r.id)) {
        ADMIN_RESERVATIONS.unshift({
          id        : r.id || ('RES-LS-' + Date.now()),
          client    : r.client || r.clientName || localStorage.getItem('fixeo_user_name') || 'Client',
          clientId  : r.clientId || 0,
          artisan   : r.artisan || r.artisanName || '—',
          artisanId : r.artisanId || 0,
          service   : r.service || '—',
          city      : r.city || '—',
          date      : r.date || new Date().toLocaleDateString('fr-FR'),
          time      : r.timeSlot || r.time || '—',
          status    : r.status || 'pending',
          payStatus : r.payStatus || (r.status === 'confirmed' ? 'paid' : 'pending_pay'),
          price     : r.price || r.amount || 0,
          method    : r.method || r.paymentMethod || '—',
          txnId     : r.txnId  || r.transactionId || '',
          commission: r.commission || 0,
          netArtisan: r.netArtisan || 0,
          type      : (r.type || (r.isExpress ? 'express' : 'standard')),
          createdAt : r.createdAt || new Date().toLocaleDateString('fr-FR'),
        });
      }
    });
    // Also pull from payment history (including PayPal sandbox payments)
    const history = JSON.parse(localStorage.getItem('fixeo_payment_history') || '[]');
    history.forEach(h => {
      const hid = 'RES-' + h.id;
      if (!ADMIN_RESERVATIONS.find(x => x.id === hid)) {
        ADMIN_RESERVATIONS.unshift({
          id        : hid,
          client    : localStorage.getItem('fixeo_user_name') || 'Client',
          clientId  : 0,
          artisan   : h.artisan || '—',
          artisanId : h.artisanId || 0,
          service   : h.service || '—',
          city      : '—',
          date      : h.date || '—',
          time      : h.timeSlot || '—',
          status    : (h.status === 'confirmed' || h.status === 'paid') ? 'confirmed' : 'pending',
          payStatus : (h.payStatus || h.status === 'paid') ? 'paid' : 'pending_pay',
          price     : h.amount || 0,
          method    : h.paymentMethod || h.method || '—',
          txnId     : h.id || '',
          commission: h.commission || Math.round((h.amount || 0) * FIXEO_COMMISSION_RATE),
          netArtisan: h.netArtisan || ((h.amount || 0) - Math.round((h.amount || 0) * FIXEO_COMMISSION_RATE)),
          type      : h.type || 'standard',
          createdAt : h.transactionDate || h.date || '—',
        });
      }
    });
  } catch(e) { /* silent fail */ }
}

/* ── STATE ──────────────────────────────────────────────────────── */
let _currentResId = null;

/* ── INIT ──────────────────────────────────────────────────────── */
/* ── V10 INIT — replaces base initAdmin ─────────────────────── */
function initAdmin() {
  /* Base init */
  updateLastTime();
  renderAdminCharts();
  renderActivityList();
  renderAdminAlerts();
  renderArtisansTable(ADMIN_ARTISANS);
  renderClientsTable();
  renderRegistrations();
  renderSubscriptions();
  renderPayments();
  renderReviews();
  renderReports();
  /* Réservations module */
  _mergeLocalStorageReservations();
  renderReservations();
  _updateReservationKPIs();
  _updateReservationSidebarCount();
  _updateOverviewReservationKPI();
}

/* ── KPI UPDATE ────────────────────────────────────────────────── */
function _updateReservationKPIs() {
  const pending   = ADMIN_RESERVATIONS.filter(r => r.status === 'pending').length;
  const confirmed = ADMIN_RESERVATIONS.filter(r => r.status === 'confirmed').length;
  const inprog    = ADMIN_RESERVATIONS.filter(r => r.status === 'inprogress').length;
  const completed = ADMIN_RESERVATIONS.filter(r => r.status === 'completed').length;
  const revenue   = ADMIN_RESERVATIONS
    .filter(r => r.payStatus === 'paid')
    .reduce((sum, r) => sum + _calcCommission(r.price, r.method).commission, 0);

  _setText('res-kpi-pending',    pending);
  _setText('res-kpi-confirmed',  confirmed);
  _setText('res-kpi-inprogress', inprog);
  _setText('res-kpi-completed',  completed);
  _setText('res-kpi-revenue',    revenue.toLocaleString('fr-FR'));
}

function _updateReservationSidebarCount() {
  const pending = ADMIN_RESERVATIONS.filter(r => r.status === 'pending').length;
  _setText('sc-reservations', pending);
}

function _updateOverviewReservationKPI() {
  /* Inject a reservation KPI in the overview grid if not already present */
  const grid = document.querySelector('.admin-kpi-grid');
  if (!grid || document.getElementById('kpi-reservations-card')) return;
  const total = ADMIN_RESERVATIONS.length;
  const card = document.createElement('div');
  card.id = 'kpi-reservations-card';
  card.className = 'kpi-card admin-kpi';
  card.style.cssText = 'border-left:3px solid #5B8CFF';
  card.innerHTML = `
    <div class="kpi-header">
      <div class="kpi-icon" style="background:rgba(91,140,255,.15);color:#5B8CFF">📅</div>
      <div class="kpi-trend up">↑ +18%</div>
    </div>
    <div class="kpi-value" id="kpi-reservations">${total}</div>
    <div class="kpi-label">Réservations totales</div>
  `;
  grid.appendChild(card);
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── RENDER TABLE ──────────────────────────────────────────────── */
function renderReservations(data) {
  const tbody = document.getElementById('reservations-admin-tbody');
  if (!tbody) return;
  const src = data || ADMIN_RESERVATIONS;
  if (!src.length) {
    tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;padding:32px;color:var(--text-muted)">Aucune réservation trouvée.</td></tr>`;
    return;
  }
  tbody.innerHTML = src.map(r => {
    const { commission, artisanEarns } = _calcCommission(r.price, r.method);
    return `
    <tr>
      <td style="font-family:monospace;font-size:.75rem;white-space:nowrap">
        ${r.id}
        ${r.type === 'express' ? '<span class="res-express-badge">⚡ Express</span>' : ''}
        ${(r.method === 'Cash on Delivery' || r.method === 'COD') ? '<span class="cod-res-badge">💵 COD</span>' : ''}
      </td>
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar" style="background:linear-gradient(135deg,#405DE6,#833AB4);font-size:.72rem">${r.client.charAt(0)}</div>
          <span style="font-size:.84rem;font-weight:600">${r.client}</span>
        </div>
      </td>
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar" style="font-size:.72rem">${r.artisan.charAt(0)}</div>
          <span style="font-size:.84rem;font-weight:600">${r.artisan}</span>
        </div>
      </td>
      <td style="font-size:.82rem;max-width:160px">${r.service}</td>
      <td style="font-size:.82rem;white-space:nowrap">${r.date}</td>
      <td><span class="status-badge res-status-${r.status}">${_resStatusLabel(r.status)}</span></td>
      <td><span class="status-badge res-pay-${r.payStatus}">${_resPayLabel(r.payStatus)}</span></td>
      <td style="font-weight:700;white-space:nowrap;color:var(--success)">${r.price} MAD</td>
      <td style="font-weight:700;white-space:nowrap;color:var(--warning)">${commission} MAD</td>
      <td style="font-weight:700;white-space:nowrap;color:#20C997">${artisanEarns} MAD</td>
      <td style="white-space:nowrap">
        ${r.method === 'PayPal'
          ? '<span class="paypal-method-badge">🅿️ PayPal</span>'
          : (r.method === 'Stripe'
            ? '<span class="stripe-method-badge">💳 Stripe</span>'
            : (r.method === 'CMI'
              ? '<span class="cmi-method-badge">🇲🇦 CMI</span>'
              : (r.method || '—')))}
      </td>
      <td style="font-family:monospace;font-size:.7rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.txnId || ''}">
        ${r.txnId
          ? `<span class="res-txn-id">${r.txnId.substring(0,14)}${r.txnId.length > 14 ? '…' : ''}</span>`
          : '<span style="color:var(--text-muted)">—</span>'}
      </td>
      <td>
        ${(function(){
          if (r.status === 'cancelled' || r.status === 'completed') {
            return '<span class="slot-admin-badge-free">🟢 Libre</span>';
          }
          return '<span class="slot-admin-badge-booked">🔴 Occupé</span>';
        })()}
      </td>
      <td style="white-space:nowrap">
        <button class="tbl-btn" onclick="viewReservationDetail('${r.id}')">👁 Voir</button>
        ${r.status !== 'cancelled' && r.status !== 'completed'
          ? `<button class="tbl-btn danger" onclick="confirmCancelReservation('${r.id}')">✕ Annuler</button>`
          : ''}
      </td>
    </tr>
    `;
  }).join('');
}

/* ── FILTERS ──────────────────────────────────────────────────── */
function filterReservations() {
  const q      = (document.getElementById('res-search')?.value || '').toLowerCase();
  const status = document.getElementById('res-filter-status')?.value || '';
  const pay    = document.getElementById('res-filter-payment')?.value || '';

  const filtered = ADMIN_RESERVATIONS.filter(r => {
    const matchQ = !q || [r.id, r.client, r.artisan, r.service, r.city]
      .some(v => v.toLowerCase().includes(q));
    const matchS = !status || r.status === status;
    const matchP = !pay    || r.payStatus === pay;
    return matchQ && matchS && matchP;
  });
  renderReservations(filtered);
}

function refreshReservations() {
  _mergeLocalStorageReservations();
  renderReservations();
  _updateReservationKPIs();
  _updateReservationSidebarCount();
  document.getElementById('res-search')  && (document.getElementById('res-search').value  = '');
  document.getElementById('res-filter-status')  && (document.getElementById('res-filter-status').value  = '');
  document.getElementById('res-filter-payment') && (document.getElementById('res-filter-payment').value = '');
  showToast('✅ Réservations actualisées', 'success');
}

/* ── DETAIL MODAL ─────────────────────────────────────────────── */
function viewReservationDetail(id) {
  _currentResId = id;
  const r = ADMIN_RESERVATIONS.find(x => x.id === id);
  if (!r) return;

  const { commission, artisanEarns } = _calcCommission(r.price, r.method);

  document.getElementById('res-detail-title').textContent = `📅 Réservation ${r.id}`;

  document.getElementById('res-detail-body').innerHTML = `
    <div class="res-detail-grid">
      <!-- Bloc Infos générales -->
      <div class="res-detail-block">
        <h4 class="res-detail-section-title">📋 Informations générales</h4>
        ${_detailRow('ID Réservation', `<span style="font-family:monospace">${r.id}</span>`)}
        ${_detailRow('Type', r.type === 'express'
          ? '<span class="res-express-badge" style="font-size:.78rem">⚡ Express</span>'
          : '📋 Standard')}
        ${_detailRow('Service', r.service)}
        ${_detailRow('Ville', `📍 ${r.city}`)}
        ${_detailRow('Date', r.date)}
        ${_detailRow('Créneau', r.time)}
        ${_detailRow('Créé le', r.createdAt)}
        ${_detailRow('Statut', `<span class="status-badge res-status-${r.status}">${_resStatusLabel(r.status)}</span>`)}
      </div>

      <!-- Bloc Personnes -->
      <div class="res-detail-block">
        <h4 class="res-detail-section-title">👤 Parties concernées</h4>
        <div class="res-person-card" style="margin-bottom:12px">
          <div class="admin-avatar" style="background:linear-gradient(135deg,#405DE6,#833AB4);">${r.client.charAt(0)}</div>
          <div>
            <div style="font-weight:700;font-size:.88rem">${r.client}</div>
            <div style="font-size:.74rem;color:var(--text-muted)">Client · ID ${r.clientId}</div>
            <button class="tbl-btn" style="margin-top:6px;font-size:.72rem" onclick="contactClient('${r.client}')">✉️ Contacter</button>
          </div>
        </div>
        <div class="res-person-card">
          <div class="admin-avatar">${r.artisan.charAt(0)}</div>
          <div>
            <div style="font-weight:700;font-size:.88rem">${r.artisan}</div>
            <div style="font-size:.74rem;color:var(--text-muted)">Artisan · ID ${r.artisanId}</div>
            <button class="tbl-btn" style="margin-top:6px;font-size:.72rem" onclick="contactArtisan('${r.artisan}')">✉️ Contacter</button>
          </div>
        </div>
      </div>

      <!-- Bloc Paiement (pleine largeur) -->
      <div class="res-detail-block res-detail-block-full">
        <h4 class="res-detail-section-title">💳 Informations de paiement</h4>
        <div class="res-payment-breakdown">
          <div class="res-pay-row">
            <span class="res-pay-label">💰 Prix service</span>
            <span class="res-pay-value">${r.price} MAD</span>
          </div>
          <div class="res-pay-row">
            <span class="res-pay-label">🏢 Commission Fixeo (15%)</span>
            <span class="res-pay-value" style="color:var(--warning)">+ ${commission} MAD</span>
          </div>
          <div class="res-pay-row">
            <span class="res-pay-label">👷 Artisan reçoit</span>
            <span class="res-pay-value" style="color:var(--success)">${artisanEarns} MAD</span>
          </div>
          <div class="res-pay-divider"></div>
          <div class="res-pay-row">
            <span class="res-pay-label">💳 Méthode</span>
            <span class="res-pay-value">
              ${r.method === 'PayPal'
                ? '<span class="paypal-method-badge">🅿️ PayPal Sandbox</span>'
                : (r.method || '—')}
            </span>
          </div>
          <div class="res-pay-row">
            <span class="res-pay-label">📊 Statut paiement</span>
            <span class="status-badge res-pay-${r.payStatus}">${_resPayLabel(r.payStatus)}</span>
          </div>
          ${r.txnId ? `
          <div class="res-pay-row">
            <span class="res-pay-label">🔗 Transaction ID</span>
            <span class="res-pay-value res-txn-id" title="${r.txnId}">${r.txnId}</span>
          </div>` : ''}
        </div>
      </div>
    </div>
  `;

  /* Show/hide action buttons based on status */
  const cancelBtn = document.getElementById('res-detail-cancel-btn');
  const statusBtn = document.getElementById('res-detail-status-btn');
  if (cancelBtn) cancelBtn.style.display = (r.status === 'cancelled' || r.status === 'completed') ? 'none' : 'inline-flex';
  if (statusBtn) statusBtn.style.display = (r.status === 'cancelled' || r.status === 'completed') ? 'none' : 'inline-flex';

  openModal('reservation-detail-modal');
}

function _detailRow(label, value) {
  return `<div class="artisan-detail-row">
    <div class="artisan-detail-label">${label}</div>
    <div class="artisan-detail-value">${value}</div>
  </div>`;
}

/* ── STATUS MODAL ──────────────────────────────────────────────── */
function openStatusModal() {
  const r = ADMIN_RESERVATIONS.find(x => x.id === _currentResId);
  if (!r) return;
  /* Pre-select current status */
  const radios = document.querySelectorAll('input[name="new_status"]');
  radios.forEach(radio => { radio.checked = radio.value === r.status; });
  openModal('reservation-status-modal');
}

function applyStatusChange() {
  const selected = document.querySelector('input[name="new_status"]:checked');
  if (!selected) { showToast('⚠️ Veuillez sélectionner un statut', 'warning'); return; }
  const r = ADMIN_RESERVATIONS.find(x => x.id === _currentResId);
  if (!r) return;
  const oldStatus = r.status;
  r.status = selected.value;
  /* Persist to localStorage */
  _persistReservationUpdate(r);
  /* ── Si annulé, libérer le créneau dans SlotLock ── */
  if (r.status === 'cancelled' && window.FixeoSlotLock) {
    window.FixeoSlotLock.onReservationCancelled(r.id);
  }
  closeModal('reservation-status-modal');
  closeModal('reservation-detail-modal');
  renderReservations();
  _updateReservationKPIs();
  _updateReservationSidebarCount();
  showToast(`✅ Statut mis à jour : ${_resStatusLabel(r.status)}`, 'success');
}

/* ── CANCEL ────────────────────────────────────────────────────── */
function confirmCancelReservation(id) {
  _currentResId = id;
  const r = ADMIN_RESERVATIONS.find(x => x.id === id);
  if (!r) return;
  document.getElementById('admin-confirm-icon').textContent  = '❌';
  document.getElementById('admin-confirm-title').textContent = 'Annuler la réservation';
  document.getElementById('admin-confirm-msg').textContent   =
    `Annuler la réservation ${id} pour ${r.client} ? Le paiement sera remboursé si applicable.`;
  const btn = document.getElementById('admin-confirm-ok');
  btn.onclick = () => { _doCancelReservation(id); closeModal('admin-confirm-modal'); };
  openModal('admin-confirm-modal');
}

function cancelReservationFromModal() {
  closeModal('reservation-detail-modal');
  confirmCancelReservation(_currentResId);
}

function _doCancelReservation(id) {
  const r = ADMIN_RESERVATIONS.find(x => x.id === id);
  if (!r) return;
  r.status = 'cancelled';
  if (r.payStatus === 'paid') r.payStatus = 'refunded';
  _persistReservationUpdate(r);
  /* ── Notify SlotLock: libérer le créneau ── */
  if (window.FixeoSlotLock && typeof window.FixeoSlotLock.onReservationCancelled === 'function') {
    window.FixeoSlotLock.onReservationCancelled(id);
  }
  renderReservations();
  _updateReservationKPIs();
  _updateReservationSidebarCount();
  showToast(`❌ Réservation ${id} annulée.`, 'warning');
}

/* ── CONTACT ───────────────────────────────────────────────────── */
function contactClient(name) {
  showToast(`✉️ Email envoyé au client ${name}`, 'info');
}
function contactArtisan(name) {
  showToast(`✉️ Email envoyé à l'artisan ${name}`, 'info');
}

/* ── PERSIST ───────────────────────────────────────────────────── */
function _persistReservationUpdate(r) {
  try {
    const stored = JSON.parse(localStorage.getItem('fixeo_reservations') || '[]');
    const idx = stored.findIndex(x => x.id === r.id);
    if (idx > -1) stored[idx] = r; else stored.push(r);
    localStorage.setItem('fixeo_reservations', JSON.stringify(stored));
  } catch(e) { /* silent */ }
}

/* ── LABEL HELPERS ─────────────────────────────────────────────── */
function _resStatusLabel(status) {
  return {
    pending    : '🕐 En attente',
    confirmed  : '✅ Confirmée',
    inprogress : '🔧 En cours',
    completed  : '✔️ Terminée',
    cancelled  : '❌ Annulée',
  }[status] || status;
}

function _resPayLabel(status) {
  return {
    paid        : '💳 Payé',
    pending_pay : '⏳ En attente',
    refunded    : '↩ Remboursé',
  }[status] || status;
}

/* ── PUBLIC API (for reservation.js / payment.js integration) ──── */
window.FixeoAdminReservations = {
  /**
   * Called by reservation.js / payment.js after a booking is confirmed.
   * Automatically registers the reservation in the admin dashboard.
   */
  addReservation: function(bookingData) {
    if (!bookingData) return;
    const newRes = {
      id       : 'RES-' + Date.now().toString(36).toUpperCase(),
      client   : bookingData.clientName  || localStorage.getItem('fixeo_user_name') || 'Client',
      clientId : bookingData.clientId    || 0,
      artisan  : bookingData.artisanName || bookingData.artisan || '—',
      artisanId: bookingData.artisanId   || 0,
      service  : bookingData.service     || '—',
      city     : bookingData.city        || '—',
      date     : bookingData.date        || new Date().toLocaleDateString('fr-FR'),
      time     : bookingData.timeSlot    || bookingData.time || '—',
      status   : 'pending',
      payStatus: bookingData.paid ? 'paid' : 'pending_pay',
      price    : bookingData.price       || bookingData.amount || 0,
      method   : bookingData.paymentMethod || bookingData.method || '—',
      type     : bookingData.isExpress   ? 'express' : 'standard',
      createdAt: new Date().toLocaleDateString('fr-FR'),
    };
    /* Pré-calcul commission 15 % pour analytics */
    const _cv = _calcCommission(newRes.price, newRes.method);
    newRes.commission   = _cv.commission;
    newRes.artisanEarns = _cv.artisanEarns;
    if (!ADMIN_RESERVATIONS.find(x => x.id === newRes.id)) {
      ADMIN_RESERVATIONS.unshift(newRes);
    }
    _persistReservationUpdate(newRes);
    /* Refresh admin view if it's open */
    renderReservations();
    _updateReservationKPIs();
    _updateReservationSidebarCount();
  }
};

/* ══════════════════════════════════════════════════════════════
   FIXEO V14 — MODULE COD ADMIN
   Gère l'affichage et les actions pour les commandes
   Cash on Delivery dans le dashboard administrateur.
══════════════════════════════════════════════════════════════ */

/* ── Afficher la section COD ─────────────────────────────── */
function adminSection(section) {
  /* Cacher toutes les sections */
  document.querySelectorAll('[id^="admin-section-"]').forEach(el => {
    el.style.display = 'none';
  });
  /* Retirer .active sur les liens sidebar */
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.remove('active');
  });

  const targetId = 'admin-section-' + section;
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.style.display = 'block';
  }

  /* Si section COD → charger les données */
  if (section === 'cod-orders') {
    renderCODOrders();
    _updateCODKPIs();
  }

  /* ── V20 : charger le module artisans à la demande ── */
  if (section === 'artisans' && typeof initArtisansAdmin === 'function') {
    setTimeout(initArtisansAdmin, 50);
  }
}

/* ── Extraire les commandes COD depuis ADMIN_RESERVATIONS ─── */
function _getCODOrders() {
  return ADMIN_RESERVATIONS.filter(r =>
    r.method === 'Cash on Delivery' ||
    r.method === 'COD' ||
    r.payStatus === 'pending_cod' ||
    r.payStatus === 'cod_paid' ||
    (r.id && r.id.startsWith('COD-'))
  );
}

/* ── Mettre à jour les KPIs COD ──────────────────────────── */
function _updateCODKPIs() {
  const orders = _getCODOrders();

  const total      = orders.length;
  const pending    = orders.filter(r => r.status === 'pending' || r.payStatus === 'pending_cod').length;
  const confirmed  = orders.filter(r => r.status === 'confirmed').length;
  const revenue    = orders.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  const commission = orders.reduce((s, r) => s + (r.commission || Math.round((parseFloat(r.price) || 0) * 0.10)), 0);

  _setKPI('cod-kpi-total',      total);
  _setKPI('cod-kpi-pending',    pending);
  _setKPI('cod-kpi-confirmed',  confirmed);
  _setKPI('cod-kpi-revenue',    revenue.toLocaleString('fr-FR') + ' MAD');
  _setKPI('cod-kpi-commission', commission.toLocaleString('fr-FR') + ' MAD');

  /* Badge sidebar */
  const badge = document.getElementById('sc-cod');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
}

function _setKPI(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Rendu de la table COD ───────────────────────────────── */
function renderCODOrders(data) {
  const tbody = document.getElementById('cod-admin-tbody');
  if (!tbody) return;

  const src = data || _getCODOrders();

  if (!src.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:32px;color:rgba(255,255,255,.4)">
      💵 Aucune commande Cash on Delivery.<br/>
      <small style="font-size:.8rem;opacity:.6">Les commandes COD apparaîtront ici dès qu'un client choisit le paiement à la livraison.</small>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = src.map(r => {
    const commission = r.commission != null
      ? r.commission
      : Math.round((parseFloat(r.price) || 0) * 0.10);
    const netArtisan = r.netArtisan != null
      ? r.netArtisan
      : Math.round((parseFloat(r.price) || 0) * 0.90);

    const slotLockHtml = (r.slotLock === true || r.slotLock === 'true')
      ? '<span class="slot-admin-badge-booked">🔴 Verrouillé</span>'
      : '<span class="slot-admin-badge-free">🟢 Libre</span>';

    const payStatusHtml = {
      pending_cod : '<span class="status-badge" style="background:rgba(255,193,7,.15);color:#ffc107;border:1px solid rgba(255,193,7,.3)">💵 En attente COD</span>',
      cod_paid    : '<span class="status-badge" style="background:rgba(32,201,151,.15);color:#20C997;border:1px solid rgba(32,201,151,.3)">✅ COD Encaissé</span>',
      paid        : '<span class="status-badge" style="background:rgba(32,201,151,.15);color:#20C997">✅ Payé</span>',
    }[r.payStatus] || `<span class="status-badge">${r.payStatus || '—'}</span>`;

    return `
    <tr>
      <td style="font-family:monospace;font-size:.75rem;white-space:nowrap">
        <span style="color:#20C997;font-weight:700">${r.id}</span>
      </td>
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar" style="background:linear-gradient(135deg,#20C997,#17a884);font-size:.72rem;color:#000">${r.client ? r.client.charAt(0) : '?'}</div>
          <span style="font-size:.84rem;font-weight:600">${r.client || '—'}</span>
        </div>
      </td>
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar" style="font-size:.72rem">${r.artisan ? r.artisan.charAt(0) : '?'}</div>
          <span style="font-size:.84rem;font-weight:600">${r.artisan || '—'}</span>
        </div>
      </td>
      <td style="font-size:.82rem;max-width:150px">${r.service || '—'}</td>
      <td style="font-size:.8rem;white-space:nowrap">
        <div>${r.date || '—'}</div>
        <div style="color:rgba(255,255,255,.45);font-size:.73rem">${r.time || r.timeSlot || '—'}</div>
      </td>
      <td><span class="status-badge res-status-${r.status}">${_resStatusLabel(r.status)}</span></td>
      <td>${payStatusHtml}</td>
      <td style="font-weight:700;color:var(--success);white-space:nowrap">${(parseFloat(r.price) || 0).toLocaleString('fr-FR')} MAD</td>
      <td style="font-weight:700;color:var(--warning);white-space:nowrap">${commission.toLocaleString('fr-FR')} MAD</td>
      <td style="font-weight:700;color:#20C997;white-space:nowrap">${netArtisan.toLocaleString('fr-FR')} MAD</td>
      <td>${slotLockHtml}</td>
      <td style="white-space:nowrap">
        ${r.payStatus === 'pending_cod'
          ? `<button class="tbl-btn" style="background:rgba(32,201,151,.2);color:#20C997" onclick="confirmCODPayment('${r.id}')">✅ Confirmer paiement</button>`
          : ''}
        ${r.status !== 'cancelled' && r.status !== 'completed'
          ? `<button class="tbl-btn danger" onclick="cancelCODOrder('${r.id}')">✕ Annuler</button>`
          : ''}
        <button class="tbl-btn" onclick="viewReservationDetail('${r.id}')">👁 Voir</button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Filtrer les commandes COD ───────────────────────────── */
function filterCODOrders() {
  const q      = (document.getElementById('cod-search')?.value || '').toLowerCase();
  const status = document.getElementById('cod-filter-status')?.value || '';
  const all    = _getCODOrders();
  const filtered = all.filter(r => {
    const matchQ = !q || [r.id, r.client, r.artisan, r.service].some(v => v && v.toLowerCase().includes(q));
    const matchS = !status || r.status === status;
    return matchQ && matchS;
  });
  renderCODOrders(filtered);
}

/* ── Rafraîchir ─────────────────────────────────────────── */
function refreshCODOrders() {
  _mergeLocalStorageReservations();
  /* Tenter d'abord un fetch API (backend) */
  _fetchAdminOrdersFromAPI(function (ok) {
    renderCODOrders();
    _updateCODKPIs();
    _updateCODSidebarBadge();
    if (typeof showToast === 'function') showToast('✅ Commandes COD actualisées', 'success');
  });
}

/* ── Confirmer le paiement COD (encaissement) ────────────── */
function confirmCODPayment(id) {
  const r = ADMIN_RESERVATIONS.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`✅ Confirmer l'encaissement COD pour :\n${r.client} → ${r.artisan}\nService : ${r.service}\nMontant : ${r.price} MAD`)) return;

  r.payStatus = 'cod_paid';
  r.status    = r.status === 'pending' ? 'confirmed' : r.status;
  r.slotLock  = false; /* libérer le slot après encaissement */

  /* Persister dans localStorage */
  _persistReservationUpdate(r);

  renderCODOrders();
  renderReservations();
  _updateCODKPIs();
  _updateReservationKPIs();
  if (typeof showToast === 'function') showToast('✅ Paiement COD encaissé — ' + id, 'success');
}

/* ── Annuler une commande COD ────────────────────────────── */
function cancelCODOrder(id) {
  const r = ADMIN_RESERVATIONS.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`❌ Annuler la commande COD :\n${r.client} → ${r.artisan}\nService : ${r.service}\nDate : ${r.date} ?`)) return;

  r.status    = 'cancelled';
  r.slotLock  = false;

  /* Libérer le créneau via FixeoSlotLock */
  if (window.FixeoSlotLock && typeof window.FixeoSlotLock.onReservationCancelled === 'function') {
    window.FixeoSlotLock.onReservationCancelled(id);
  }

  _persistReservationUpdate(r);
  renderCODOrders();
  renderReservations();
  _updateCODKPIs();
  _updateReservationKPIs();
  if (typeof showToast === 'function') showToast('❌ Commande COD annulée — ' + id, 'error');
}

/* ── Badge sidebar COD ───────────────────────────────────── */
function _updateCODSidebarBadge() {
  const orders = _getCODOrders();
  const pending = orders.filter(r => r.payStatus === 'pending_cod').length;
  const badge = document.getElementById('sc-cod');
  if (badge) {
    badge.textContent = pending > 0 ? pending : orders.length;
    badge.style.display = orders.length > 0 ? 'inline-flex' : 'none';
  }
}

/* ══════════════════════════════════════════════════════════════
   ADMIN ORDERS — Récupération API + Polling automatique
   ─────────────────────────────────────────────────────────────
   • Endpoint  : GET /api/admin/orders
   • Polling   : toutes les 10 secondes
   • Fallback  : localStorage si backend indisponible
══════════════════════════════════════════════════════════════ */

/* ── Base URL API (même logique que cod-payment.js) ─────── */
const _ADMIN_API_BASE = (function () {
  const h = window.location.hostname;
  const proto = window.location.protocol;
  if (h.includes('ngrok') || h.includes('tunnel') || h.includes('loca.lt')) return window.location.origin;
  if (h === 'localhost' || h === '127.0.0.1') return proto + '//' + h + ':3001';
  return window.location.origin;
})();

let _adminOrdersPollingTimer = null;

/**
 * _fetchAdminOrdersFromAPI(onDone)
 * Appelle GET /api/admin/orders et merge les commandes
 * reçues dans ADMIN_RESERVATIONS (sans doublon).
 * @param {Function} [onDone] callback(ok: bool, count: number)
 */
function _fetchAdminOrdersFromAPI(onDone) {
  const url  = _ADMIN_API_BASE + '/api/admin/orders';
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const tmo  = ctrl ? setTimeout(function () { ctrl.abort(); }, 5000) : null;

  fetch(url, { signal: ctrl ? ctrl.signal : undefined })
    .then(function (r) {
      if (tmo) clearTimeout(tmo);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (body) {
      if (!body.success || !Array.isArray(body.orders)) return;

      /* Merge : ajouter uniquement les nouveaux orderIDs */
      body.orders.forEach(function (o) {
        const id = o.orderID || o.bookingRef;
        if (!id) return;
        if (ADMIN_RESERVATIONS.find(function (x) { return x.id === id; })) return;

        ADMIN_RESERVATIONS.unshift({
          id           : id,
          bookingRef   : o.bookingRef || id,
          client       : (o.clientDetails && o.clientDetails.name) || 'Client',
          artisan      : (o.clientDetails && o.clientDetails.artisanName) || '—',
          artisanId    : (o.clientDetails && o.clientDetails.artisanId) || 0,
          service      : (o.clientDetails && o.clientDetails.service) || '—',
          date         : (o.clientDetails && o.clientDetails.date) || o.createdAt || '—',
          timeSlot     : (o.clientDetails && (o.clientDetails.timeSlot || o.clientDetails.time)) || '—',
          address      : (o.clientDetails && o.clientDetails.address) || '—',
          phone        : (o.clientDetails && o.clientDetails.phone) || '—',
          price        : o.totalAmount || 0,
          commission   : o.commission  || 0,
          netArtisan   : o.netArtisan  || 0,
          paymentMethod: o.paymentMethod || 'Cash on Delivery',
          method       : o.paymentMethod || 'Cash on Delivery',
          payStatus    : o.orderStatus  || 'pending_cod',
          status       : (o.orderStatus === 'completed') ? 'completed' : 'pending',
          slotLock     : !!o.slotLock,
          isExpress    : false,
          createdAt    : o.createdAt || new Date().toLocaleDateString('fr-FR'),
          transactionDate: o.createdAt || new Date().toLocaleDateString('fr-FR'),
          _fromAPI     : true,
        });
      });

      renderCODOrders();
      _updateCODKPIs();
      _updateCODSidebarBadge();
      console.log('[Fixeo Admin] ✅ Commandes API chargées — ' + body.count + ' ordre(s) (COD: ' + body.codCount + ', PayPal: ' + body.paypalCount + ')');
      if (typeof onDone === 'function') onDone(true, body.count);
    })
    .catch(function (err) {
      if (tmo) clearTimeout(tmo);
      console.warn('[Fixeo Admin] ⚠️ /api/admin/orders indisponible — fallback localStorage. Err:', err.message);
      if (typeof onDone === 'function') onDone(false, 0);
    });
}

/**
 * Démarre le polling automatique (toutes les 10 secondes).
 * Déclenche aussi un premier fetch immédiat.
 */
function _startAdminOrdersPolling() {
  if (_adminOrdersPollingTimer) clearInterval(_adminOrdersPollingTimer);
  _fetchAdminOrdersFromAPI(); /* premier appel immédiat */
  _adminOrdersPollingTimer = setInterval(function () {
    _fetchAdminOrdersFromAPI();
  }, 10000); /* ← polling toutes les 10 secondes */
  console.log('[Fixeo Admin] 🔄 Polling commandes démarré (10s)');
}

/** Arrête le polling (appelé au logout). */
function _stopAdminOrdersPolling() {
  if (_adminOrdersPollingTimer) {
    clearInterval(_adminOrdersPollingTimer);
    _adminOrdersPollingTimer = null;
    console.log('[Fixeo Admin] ⏹ Polling commandes arrêté');
  }
}

/* ── Hook initAdmin : COD init + polling API ─────────────── */
const _origInitAdmin = typeof initAdmin === 'function' ? initAdmin : function(){};
function initAdmin() {
  _origInitAdmin();
  /* Appeler les KPIs COD + démarrer le polling API */
  setTimeout(function() {
    _mergeLocalStorageReservations();
    _updateCODKPIs();
    _updateCODSidebarBadge();
    _startAdminOrdersPolling(); /* ← polling auto toutes les 10 secondes */
  }, 150);
}
