(function (window, document) {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function renderAdminMissionPanel() {
    const FixeoMissionSystem = window.FixeoMissionSystem;
    const container = document.getElementById('fixeo-admin-missions-panel');
    if (!FixeoMissionSystem || !container) return;
    const missions = FixeoMissionSystem.list();
    const metrics = FixeoMissionSystem.getMetrics();
    const rows = missions.map(function (mission) {
      const status = FixeoMissionSystem.getStatusMeta(mission.status);
      const validationDate = mission.validated_at ? new Date(mission.validated_at).toLocaleString('fr-FR') : '—';
      const finalPrice = mission.final_price ? FixeoMissionSystem.formatMad(mission.final_price) : '—';
      const commission = mission.status === 'validated' ? FixeoMissionSystem.formatMad(mission.commission_amount) : '—';
      return `
        <tr>
          <td><strong>${FixeoMissionSystem.escapeHtml(mission.client_name || 'Client')}</strong></td>
          <td>${FixeoMissionSystem.escapeHtml(mission.artisan_name || 'En attente')}</td>
          <td>${FixeoMissionSystem.escapeHtml(mission.service || '—')}</td>
          <td>${finalPrice}</td>
          <td>${commission}</td>
          <td><span class="fixeo-status-badge" style="color:${status.color};background:${status.bg};border-color:${status.color}33">${status.label}</span></td>
          <td>${validationDate}</td>
          <td>${mission.status === 'validated' ? (mission.commission_paid ? 'Oui' : 'Non') : '—'}</td>
          <td style="white-space:nowrap">
            ${mission.status === 'validated' ? `<button class="btn btn-sm ${mission.commission_paid ? 'btn-secondary' : 'btn-primary'}" data-admin-action="toggle-commission" data-mission-id="${mission.id}" data-paid="${mission.commission_paid ? '0' : '1'}">${mission.commission_paid ? 'Remettre en dû' : 'Marquer payé'}</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <section class="fixeo-cod-shell">
        <div class="fixeo-admin-kpis">
          <div class="fixeo-admin-kpi"><strong>${metrics.pending}</strong><span>Missions en attente</span></div>
          <div class="fixeo-admin-kpi"><strong>${metrics.validated}</strong><span>Missions validées</span></div>
          <div class="fixeo-admin-kpi"><strong>${FixeoMissionSystem.formatMad(metrics.commissions_unpaid_total)}</strong><span>Commissions dues</span></div>
          <div class="fixeo-admin-kpi"><strong>${metrics.reminders_due}</strong><span>Artisans / clients à relancer</span></div>
          <div class="fixeo-admin-kpi"><strong>${metrics.issues_open}</strong><span>Problèmes signalés</span></div>
        </div>
        <div class="chart-card" style="padding:0;overflow:hidden">
          <table class="fixeo-admin-mini-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Artisan</th>
                <th>Service</th>
                <th>Prix final</th>
                <th>Commission</th>
                <th>Statut mission</th>
                <th>Date validation</th>
                <th>Paiement commission artisan</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="9">Aucune mission.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function patchLabels() {
    const sidebarLink = document.getElementById('sidebar-cod-link');
    if (sidebarLink) {
      const label = sidebarLink.querySelector('span:nth-child(2)');
      if (label) label.textContent = 'Missions & commissions';
    }
    document.querySelectorAll('*').forEach(function (node) {
      if (node.childNodes && node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) {
        node.textContent = node.textContent.replace('Commission (10%)', 'Commission (15%)');
      }
    });
  }

  function bindActions(root) {
    root.addEventListener('click', function (event) {
      const target = event.target.closest('[data-admin-action]');
      if (!target || !window.FixeoMissionSystem) return;
      const missionId = target.getAttribute('data-mission-id');
      const paid = target.getAttribute('data-paid') === '1';
      window.FixeoMissionSystem.markCommissionPaid(missionId, paid);
      window.showToast?.(paid ? '✅ Commission marquée payée' : '↩ Commission repassée en due', 'success');
    });
  }

  function renderAll() {
    patchLabels();
    renderAdminMissionPanel();
  }

  ready(function () {
    if (document.body.dataset.dashType !== 'admin') return;
    if (!window.FixeoMissionSystem) return;
    bindActions(document.body);
    const mountTarget = document.getElementById('admin-section-cod-orders');
    if (mountTarget && !document.getElementById('fixeo-admin-missions-panel')) {
      mountTarget.innerHTML = '<h2 style="font-size:1.3rem;margin-bottom:14px">🛡️ Panel admin minimum — missions COD</h2><div id="fixeo-admin-missions-panel"></div>';
    }
    renderAll();
    window.addEventListener('fixeo:missions:updated', renderAll);
  });
})(window, document);
