(function (window, document) {
  'use strict';

  const STORAGE_KEY = 'fixeo_notifications_v2';
  const LEGACY_KEY = 'fixeo_notifs';
  const MAX_NOTIFICATIONS = 150;
  const TOAST_DURATION = 4200;

  const TYPE_META = {
    new_request:      { label: 'Nouvelle demande', icon: '⚡', tone: 'warning' },
    new_reply:        { label: 'Nouvelle réponse', icon: '💬', tone: 'info' },
    mission_accepted: { label: 'Mission acceptée', icon: '🎯', tone: 'success' },
    mission_completed:{ label: 'Mission terminée', icon: '✅', tone: 'success' },
    mission_validated:{ label: 'Mission validée', icon: '🎉', tone: 'success' },
    new_message:      { label: 'Nouveau message', icon: '✉️', tone: 'info' },
    reminder:         { label: 'Relance', icon: '⏰', tone: 'warning' },
    success:          { label: 'Succès', icon: '✅', tone: 'success' },
    info:             { label: 'Information', icon: 'ℹ️', tone: 'info' },
    warning:          { label: 'Attention', icon: '⚠️', tone: 'warning' },
    error:            { label: 'Erreur', icon: '❌', tone: 'error' }
  };

  function parseJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  class NotificationSystem {
    constructor() {
      this.notifications = this.loadNotifications();
      this.container = null;
      this.panel = null;
      this.activeFilter = 'all';
      this.lastToggleAt = 0;
      this.initialized = false;
      this.init();
    }

    init() {
      if (this.initialized) return;
      this.initialized = true;
      this.injectStyles();
      this.createToastContainer();
      this.createPanel();
      this.bindGlobalEvents();
      this.runMissionReminderScan();
      this.persist(false);
      this.updateUI();
    }

    injectStyles() {
      if (document.getElementById('fixeo-notifications-runtime-style')) return;
      const style = document.createElement('style');
      style.id = 'fixeo-notifications-runtime-style';
      style.textContent = `
        .toast-container{position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column;gap:12px;z-index:1300;pointer-events:none}
        .toast{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;min-width:280px;max-width:min(360px,calc(100vw - 32px));background:rgba(17,17,27,.96);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px 14px 12px;box-shadow:0 18px 48px rgba(0,0,0,.38);backdrop-filter:blur(18px);pointer-events:auto;overflow:hidden}
        .toast.success{border-color:rgba(32,201,151,.3)}
        .toast.warning{border-color:rgba(255,196,0,.28)}
        .toast.error{border-color:rgba(255,93,115,.34)}
        .toast.info{border-color:rgba(64,93,230,.28)}
        .toast-icon{font-size:1.25rem;line-height:1;margin-top:2px}
        .toast-content{min-width:0}
        .toast-title{font-weight:800;font-size:.92rem;line-height:1.25;margin-bottom:4px;color:#fff}
        .toast-msg{font-size:.82rem;line-height:1.45;color:rgba(255,255,255,.74)}
        .toast-close{background:none;border:none;color:rgba(255,255,255,.58);font-size:1rem;cursor:pointer;padding:0;line-height:1}
        .toast-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#E1306C,#833AB4);transform-origin:left center;animation:fixeo-toast-progress ${TOAST_DURATION}ms linear forwards}
        @keyframes fixeo-toast-progress{from{transform:scaleX(1)}to{transform:scaleX(0)}}
        .notif-panel{position:fixed;top:84px;right:16px;width:min(360px,calc(100vw - 24px));max-height:min(78vh,640px);background:rgba(14,14,24,.98);border:1px solid rgba(255,255,255,.1);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.46);backdrop-filter:blur(18px);display:none;flex-direction:column;overflow:hidden;z-index:1250}
        .notif-panel.open{display:flex}
        .notif-panel-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
        .notif-panel-title{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1rem;color:#fff}
        .notif-panel-actions{display:flex;align-items:center;gap:8px}
        .notif-link-btn{background:none;border:none;color:#ff4ecd;font-weight:700;font-size:.78rem;cursor:pointer;padding:0}
        .notif-icon-btn{width:30px;height:30px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;cursor:pointer}
        .notif-panel-filters{display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
        .notif-filter{flex:1;border:none;border-radius:999px;padding:9px 12px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);font-size:.8rem;font-weight:700;cursor:pointer}
        .notif-filter.active{background:rgba(255,78,205,.16);color:#fff;border:1px solid rgba(255,78,205,.24)}
        .notif-panel-body{display:flex;flex-direction:column;gap:8px;padding:12px;overflow:auto;min-height:0}
        .notif-item{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:start;padding:12px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.04);cursor:pointer;transition:transform .18s ease,background .18s ease,border-color .18s ease}
        .notif-item:hover{transform:translateY(-1px);background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.08)}
        .notif-item.unread{background:rgba(255,78,205,.09);border-color:rgba(255,78,205,.18)}
        .notif-item-icon{font-size:1.2rem;line-height:1;margin-top:2px}
        .notif-item-content{min-width:0}
        .notif-item-title{font-size:.88rem;font-weight:800;color:#fff;line-height:1.25;margin-bottom:4px;word-break:break-word}
        .notif-item-body{font-size:.8rem;line-height:1.45;color:rgba(255,255,255,.72);word-break:break-word}
        .notif-item-time{font-size:.72rem;color:rgba(255,255,255,.44);white-space:nowrap;padding-left:4px}
        .notif-item-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
        .notif-tag{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.06);font-size:.68rem;font-weight:700;color:rgba(255,255,255,.65)}
        .notif-empty{padding:30px 18px;text-align:center;color:rgba(255,255,255,.6)}
        .notif-empty strong{display:block;font-size:1rem;margin-bottom:6px;color:#fff}
        .notif-btn,.notif-bell{position:relative}
        .notif-count,.notif-badge{position:absolute;top:-5px;right:-8px;min-width:20px;height:20px;border-radius:999px;background:#ff4ecd;color:#fff;font-size:11px;font-weight:800;padding:0 6px;display:none;align-items:center;justify-content:center;border:2px solid #0d0d1a}
        .notif-count.has-notif,.notif-badge.has-notif{display:flex}
        @media (max-width: 768px){
          .toast-container{left:16px;right:16px;bottom:16px}
          .toast{min-width:0;max-width:none}
          .notif-panel{inset:0;width:100vw;max-height:100vh;border-radius:0;top:0;right:0;border:none}
          .notif-panel-header{padding-top:20px}
          .notif-panel-body{padding:12px 14px 18px}
        }
      `;
      document.head.appendChild(style);
    }

    loadNotifications() {
      const current = parseJSON(localStorage.getItem(STORAGE_KEY), null);
      if (Array.isArray(current)) return current.map(this.normalizeNotification.bind(this));
      const legacy = parseJSON(localStorage.getItem(LEGACY_KEY), []);
      return Array.isArray(legacy) ? legacy.map(this.normalizeNotification.bind(this)) : [];
    }

    normalizeNotification(raw) {
      const type = TYPE_META[raw?.type] ? raw.type : (raw?.type || 'new_message');
      const meta = TYPE_META[type] || TYPE_META.new_message;
      const createdAt = raw?.created_at || raw?.createdAt || raw?.timestamp || new Date().toISOString();
      return {
        id: String(raw?.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        user_id: String(raw?.user_id || raw?.userId || raw?.artisan_id || raw?.client_id || 'global'),
        type: type,
        title: raw?.title || meta.label,
        message: raw?.message || raw?.body || '',
        read: !!raw?.read,
        created_at: createdAt,
        icon: raw?.icon || meta.icon,
        action_href: raw?.action_href || raw?.href || '',
        action_label: raw?.action_label || '',
        dedupe_key: raw?.dedupe_key || '',
        silent: !!raw?.silent,
        meta: raw?.meta || {}
      };
    }

    getCurrentUserIds() {
      const ids = new Set(['global']);
      const dashType = document.body?.dataset?.dashType || '';
      const storedUser = localStorage.getItem('fixeo_user') || localStorage.getItem('fixeo_session') || localStorage.getItem('user_id') || '';
      const storedRole = localStorage.getItem('fixeo_role') || localStorage.getItem('role') || '';
      const storedName = localStorage.getItem('fixeo_user_name') || '';

      if (storedUser) ids.add(String(storedUser));
      if (storedName) ids.add(String(storedName));

      if (dashType === 'artisan' || storedRole === 'artisan') {
        ids.add('art_demo_1');
        ids.add('artisan_local');
        ids.add('artisan');
      }
      if (dashType === 'client' || storedRole === 'client' || (!storedRole && dashType !== 'artisan')) {
        ids.add('client_demo_1');
        ids.add('client_local');
        ids.add('client');
      }
      if (storedRole === 'admin') ids.add('admin_local');

      return Array.from(ids).filter(Boolean);
    }

    getPrimaryUserId() {
      const ids = this.getCurrentUserIds().filter(function (id) { return id !== 'global'; });
      return ids[0] || 'global';
    }

    isVisibleForCurrentUser(notification) {
      const ids = this.getCurrentUserIds();
      return !notification.user_id || ids.includes(String(notification.user_id));
    }

    getVisibleNotifications() {
      return this.notifications
        .filter(this.isVisibleForCurrentUser.bind(this))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    getUnreadCount() {
      return this.getVisibleNotifications().filter(function (item) { return !item.read; }).length;
    }

    createToastContainer() {
      this.container = document.querySelector('.toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    }

    createPanel() {
      this.panel = document.querySelector('.notif-panel');
      if (!this.panel) {
        this.panel = document.createElement('div');
        this.panel.className = 'notif-panel notif-dropdown';
        this.panel.setAttribute('aria-label', 'Notifications Fixeo');
        document.body.appendChild(this.panel);
      }
      this.panel.innerHTML = `
        <div class="notif-panel-header">
          <div class="notif-panel-title">🔔 <span>Notifications Fixeo</span></div>
          <div class="notif-panel-actions">
            <button type="button" class="notif-link-btn" data-notif-action="mark-all">Tout lire</button>
            <button type="button" class="notif-icon-btn" data-notif-action="close" aria-label="Fermer">✕</button>
          </div>
        </div>
        <div class="notif-panel-filters">
          <button type="button" class="notif-filter active" data-filter="all">Toutes</button>
          <button type="button" class="notif-filter" data-filter="unread">Non lues</button>
        </div>
        <div class="notif-panel-body" id="notif-list"></div>
      `;

      this.panel.addEventListener('click', (event) => {
        const actionTarget = event.target.closest('[data-notif-action]');
        if (actionTarget) {
          const action = actionTarget.getAttribute('data-notif-action');
          if (action === 'mark-all') this.markAllRead();
          if (action === 'close') this.togglePanel(false);
          return;
        }

        const filterTarget = event.target.closest('[data-filter]');
        if (filterTarget) {
          this.activeFilter = filterTarget.getAttribute('data-filter') || 'all';
          this.panel.querySelectorAll('.notif-filter').forEach((button) => {
            button.classList.toggle('active', button === filterTarget);
          });
          this.renderPanel();
          return;
        }

        const item = event.target.closest('.notif-item');
        if (!item) return;
        const id = item.getAttribute('data-id');
        const href = item.getAttribute('data-href') || '';
        this.markAsRead(id);
        if (href) window.location.href = href;
      });
    }

    bindGlobalEvents() {
      document.addEventListener('click', (event) => {
        if (!this.panel || !this.panel.classList.contains('open')) return;
        const bell = event.target.closest('.notif-btn, .notif-bell');
        if (bell || this.panel.contains(event.target)) return;
        this.togglePanel(false);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.panel?.classList.contains('open')) this.togglePanel(false);
      });

      window.addEventListener('resize', () => {
        if (this.panel?.classList.contains('open')) this.positionPanel();
      });

      window.addEventListener('fixeo:missions:updated', () => {
        this.runMissionReminderScan();
      });
    }

    positionPanel() {
      if (!this.panel || window.innerWidth <= 768) return;
      const bell = document.querySelector('.notif-btn, .notif-bell');
      if (!bell) return;
      const rect = bell.getBoundingClientRect();
      const right = Math.max(16, window.innerWidth - rect.right);
      const top = Math.max(76, rect.bottom + 12);
      this.panel.style.right = `${right}px`;
      this.panel.style.top = `${top}px`;
    }

    formatDateLabel(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'À l’instant';
      const diff = Date.now() - date.getTime();
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * oneHour;
      if (diff < oneHour) {
        const minutes = Math.max(1, Math.round(diff / (60 * 1000)));
        return `Il y a ${minutes} min`;
      }
      if (diff < oneDay) {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      if (diff < oneDay * 2) return 'Hier';
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }

    renderPanel() {
      const list = this.panel?.querySelector('#notif-list');
      if (!list) return;
      const visible = this.getVisibleNotifications();
      const items = this.activeFilter === 'unread'
        ? visible.filter(function (item) { return !item.read; })
        : visible;

      if (!items.length) {
        list.innerHTML = `
          <div class="notif-empty">
            <div style="font-size:2rem;margin-bottom:10px">🔔</div>
            <strong>Aucune notification</strong>
            <span>Les actions importantes apparaîtront ici.</span>
          </div>
        `;
        return;
      }

      list.innerHTML = items.map((item) => {
        const meta = TYPE_META[item.type] || TYPE_META.new_message;
        const tags = [meta.label];
        if (item.meta?.city) tags.push(item.meta.city);
        if (item.meta?.service) tags.push(item.meta.service);
        return `
          <div class="notif-item ${item.read ? '' : 'unread'}" data-id="${escapeHtml(item.id)}" data-href="${escapeHtml(item.action_href || '')}">
            <div class="notif-item-icon">${escapeHtml(item.icon || meta.icon)}</div>
            <div class="notif-item-content">
              <div class="notif-item-title">${escapeHtml(item.title || meta.label)}</div>
              <div class="notif-item-body">${escapeHtml(item.message)}</div>
              <div class="notif-item-meta">${tags.map((tag) => `<span class="notif-tag">${escapeHtml(tag)}</span>`).join('')}</div>
            </div>
            <div class="notif-item-time">${escapeHtml(this.formatDateLabel(item.created_at))}</div>
          </div>
        `;
      }).join('');
    }

    persist(dispatchEvent = true) {
      const trimmed = this.notifications
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, MAX_NOTIFICATIONS);
      this.notifications = trimmed;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      localStorage.setItem(LEGACY_KEY, JSON.stringify(trimmed));
      localStorage.setItem('fixeo_notif_count', String(this.getUnreadCount()));
      if (dispatchEvent) this.dispatchUpdate();
    }

    dispatchUpdate() {
      window.dispatchEvent(new CustomEvent('fixeo:notifications:updated', {
        detail: {
          unread: this.getUnreadCount(),
          notifications: this.getVisibleNotifications()
        }
      }));
    }

    updateBadge() {
      const unread = this.getUnreadCount();
      document.querySelectorAll('.notif-badge, .notif-count').forEach((badge) => {
        badge.textContent = unread > 99 ? '99+' : (unread ? String(unread) : '');
        badge.classList.toggle('has-notif', unread > 0);
        badge.style.display = unread > 0 ? 'flex' : 'none';
      });
    }

    updateUI() {
      this.updateBadge();
      if (this.panel?.classList.contains('open')) {
        this.positionPanel();
        this.renderPanel();
      }
    }

    showToast(notification) {
      if (!this.container || notification.silent) return;
      const meta = TYPE_META[notification.type] || TYPE_META.info;
      const toast = document.createElement('div');
      toast.className = `toast ${meta.tone}`;
      toast.innerHTML = `
        <div class="toast-icon">${escapeHtml(notification.icon || meta.icon)}</div>
        <div class="toast-content">
          <div class="toast-title">${escapeHtml(notification.title || meta.label)}</div>
          <div class="toast-msg">${escapeHtml(notification.message)}</div>
        </div>
        <button type="button" class="toast-close" aria-label="Fermer">×</button>
        <div class="toast-progress"></div>
      `;
      toast.querySelector('.toast-close')?.addEventListener('click', () => toast.remove());
      this.container.appendChild(toast);
      window.setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(6px)';
        toast.style.transition = 'opacity .25s ease, transform .25s ease';
        window.setTimeout(() => toast.remove(), 260);
      }, TOAST_DURATION);
    }

    createNotification(userId, message, type, options) {
      const opts = options || {};
      const meta = TYPE_META[type] || TYPE_META.new_message;
      const normalizedUserId = String(userId || this.getPrimaryUserId() || 'global');

      if (opts.dedupe_key) {
        const existing = this.notifications.find((item) => item.dedupe_key === opts.dedupe_key && String(item.user_id) === normalizedUserId);
        if (existing) return existing;
      }

      const notification = this.normalizeNotification({
        id: opts.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: normalizedUserId,
        type: type,
        title: opts.title || meta.label,
        message: message,
        read: false,
        created_at: opts.created_at || new Date().toISOString(),
        icon: opts.icon || meta.icon,
        action_href: opts.action_href || '',
        action_label: opts.action_label || '',
        dedupe_key: opts.dedupe_key || '',
        silent: !!opts.silent,
        meta: opts.meta || {}
      });

      this.notifications.unshift(notification);
      this.persist();
      this.updateUI();
      this.showToast(notification);
      return notification;
    }

    push(payload) {
      if (!payload || typeof payload !== 'object') return null;
      const type = payload.type || 'new_message';
      const message = payload.message || payload.body || '';
      return this.createNotification(payload.user_id || this.getPrimaryUserId(), message, type, payload);
    }

    success(title, message) {
      return this.createNotification(this.getPrimaryUserId(), message || title || 'Action réalisée.', 'success', { title: title || 'Succès' });
    }

    info(title, message) {
      return this.createNotification(this.getPrimaryUserId(), message || title || 'Information disponible.', 'info', { title: title || 'Information' });
    }

    warning(title, message) {
      return this.createNotification(this.getPrimaryUserId(), message || title || 'Attention requise.', 'warning', { title: title || 'Attention' });
    }

    error(title, message) {
      return this.createNotification(this.getPrimaryUserId(), message || title || 'Une erreur est survenue.', 'error', { title: title || 'Erreur' });
    }

    markAsRead(notificationId) {
      const item = this.notifications.find((notification) => String(notification.id) === String(notificationId));
      if (!item || item.read) return item || null;
      item.read = true;
      this.persist();
      this.updateUI();
      return item;
    }

    markRead(notificationId) {
      return this.markAsRead(notificationId);
    }

    markAllRead() {
      const currentIds = new Set(this.getCurrentUserIds());
      this.notifications.forEach((item) => {
        if (currentIds.has(String(item.user_id))) item.read = true;
      });
      this.persist();
      this.updateUI();
    }

    togglePanel(force) {
      if (!this.panel) return;
      const now = Date.now();
      if (typeof force !== 'boolean' && now - this.lastToggleAt < 120) return;
      this.lastToggleAt = now;
      const shouldOpen = typeof force === 'boolean' ? force : !this.panel.classList.contains('open');
      this.panel.classList.toggle('open', shouldOpen);
      if (shouldOpen) {
        this.positionPanel();
        this.renderPanel();
      }
    }

    runMissionReminderScan() {
      if (!window.FixeoMissionSystem || typeof window.FixeoMissionSystem.list !== 'function') {
        this.updateUI();
        return;
      }

      const missions = window.FixeoMissionSystem.list();
      missions.forEach((mission) => {
        if (mission.status === 'pending' && (!mission.proposals || !mission.proposals.length)) {
          const ageMs = Date.now() - new Date(mission.created_at || Date.now()).getTime();
          if (ageMs >= 2 * 60 * 60 * 1000) {
            this.createNotification(
              mission.target_artisan_id || 'art_demo_1',
              `Relance : nouvelle demande ${mission.service || 'service'} à ${mission.city || 'Casablanca'} sans réponse pour l’instant.`,
              'reminder',
              {
                title: 'Répondez vite à cette demande',
                dedupe_key: `reminder:artisan:${mission.id}:reply`,
                silent: true,
                action_href: 'dashboard-artisan.html',
                meta: { mission_id: mission.id, city: mission.city, service: mission.service }
              }
            );
          }
        }

        if (mission.status === 'completed' && mission.completed_at && !mission.validated_at) {
          const ageMs = Date.now() - new Date(mission.completed_at).getTime();
          if (ageMs >= 24 * 60 * 60 * 1000) {
            this.createNotification(
              mission.client_id || 'client_demo_1',
              'Merci de confirmer la fin de mission pour clôturer votre dossier et débloquer la suite.',
              'reminder',
              {
                title: 'Validation client en attente',
                dedupe_key: `reminder:client:${mission.id}:validate`,
                silent: true,
                action_href: 'dashboard-client.html',
                meta: { mission_id: mission.id, city: mission.city, service: mission.service }
              }
            );
          }
        }
      });

      this.updateUI();
    }
  }

  const notificationSystem = new NotificationSystem();
  window.notifSystem = notificationSystem;
  window.notifications = notificationSystem;
  window.createNotification = function (userId, message, type, options) {
    return notificationSystem.createNotification(userId, message, type, options);
  };
  window.markAsRead = function (notificationId) {
    return notificationSystem.markAsRead(notificationId);
  };
})(window, document);
