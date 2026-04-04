(function() {
  'use strict';

  const STORAGE_KEY = 'fixeo_client_requests';
  const FIXEO_WHATSAPP_NUMBER = '212660484415';
  const REDIRECT_DELAY_MS = 1000;
  const MAX_STORED_REQUESTS = 50;
  let redirectTimer = null;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function getFormPayload(form, triggerMode) {
    const urgenceValue = form.querySelector('input[name="urgence"]:checked')?.value || 'Normal';
    return {
      problem: ($('#request-problem', form)?.value || '').trim(),
      ville: ($('#request-city', form)?.value || '').trim(),
      urgence: urgenceValue,
      budget: ($('#request-budget', form)?.value || '').trim(),
      telephone: ($('#request-phone', form)?.value || '').trim(),
      source: triggerMode || 'default'
    };
  }

  function buildStoredRequest(payload) {
    const timestamp = Date.now();
    return {
      id: timestamp,
      probleme: payload.problem,
      ville: payload.ville,
      urgence: payload.urgence || 'Normal',
      telephone: payload.telephone,
      date: new Date(timestamp).toISOString()
    };
  }

  function saveRequest(payload) {
    const storedRequest = buildStoredRequest(payload);

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const safeList = Array.isArray(existing) ? existing : [];
      safeList.unshift(storedRequest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeList.slice(0, MAX_STORED_REQUESTS)));
    } catch (err) {
      console.warn('Fixeo request storage unavailable', err);
    }

    console.log('Fixeo client request:', storedRequest);
    return storedRequest;
  }

  function buildWhatsappMessage(payload) {
    const lines = ['Bonjour, je viens de publier une demande sur Fixeo :'];

    if (payload.problem) lines.push('Problème : ' + payload.problem);
    if (payload.ville) lines.push('Ville : ' + payload.ville);
    if (payload.urgence) lines.push('Urgence : ' + payload.urgence);
    if (payload.telephone) lines.push('Téléphone : ' + payload.telephone);

    lines.push('');
    lines.push('Pouvez-vous me proposer un artisan rapidement ?');

    return lines.join('\n');
  }

  function buildWhatsappLink(payload) {
    const message = buildWhatsappMessage(payload);
    return 'https://wa.me/' + FIXEO_WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
  }

  function clearRedirectTimer() {
    if (redirectTimer) {
      window.clearTimeout(redirectTimer);
      redirectTimer = null;
    }
  }

  function showSuccess(whatsappLink) {
    const form = $('#request-form');
    const success = $('#request-success');
    const successTitle = $('#request-success h4');
    const successText = $('#request-success p');
    const whatsappBtn = $('#request-whatsapp-link');
    if (!form || !success) return;

    form.hidden = true;
    success.hidden = false;

    if (successTitle) successTitle.textContent = 'Votre demande a bien été préparée';
    if (successText) successText.textContent = 'Redirection vers WhatsApp en cours…';
    if (whatsappBtn) {
      whatsappBtn.href = whatsappLink;
      whatsappBtn.setAttribute('aria-label', 'Continuer sur WhatsApp');
    }
  }

  function resetRequestModal() {
    const form = $('#request-form');
    const success = $('#request-success');
    if (form) {
      form.hidden = false;
      form.reset();
      const normal = form.querySelector('input[name="urgence"][value="Normal"]');
      if (normal) normal.checked = true;
    }
    if (success) success.hidden = true;
    clearRedirectTimer();
  }

  function redirectToWhatsapp(url) {
    if (!url) return;
    window.location.href = url;
  }

  function openRequestModal(trigger) {
    const mode = trigger && typeof trigger.getAttribute === 'function'
      ? (trigger.getAttribute('data-request-mode') || 'default')
      : 'default';
    resetRequestModal();
    const modal = $('#request-modal');
    if (modal) modal.setAttribute('data-request-mode', mode);
    if (window.openModal) window.openModal('request-modal');
    else modal?.classList.add('open');
    setTimeout(() => $('#request-problem')?.focus(), 60);
  }

  function bindTriggers() {
    document.querySelectorAll('[data-open-request-form="true"]').forEach((btn) => {
      btn.addEventListener('click', () => openRequestModal(btn));
    });
  }

  function bindForm() {
    const form = $('#request-form');
    const newOneBtn = $('#request-new-one');
    const modal = $('#request-modal');
    const whatsappBtn = $('#request-whatsapp-link');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const triggerMode = modal?.getAttribute('data-request-mode') || 'default';
      const payload = getFormPayload(form, triggerMode);
      const whatsappLink = buildWhatsappLink(payload);

      saveRequest(payload);
      showSuccess(whatsappLink);
      form.reset();

      clearRedirectTimer();
      redirectTimer = window.setTimeout(() => {
        redirectToWhatsapp(whatsappLink);
      }, REDIRECT_DELAY_MS);
    });

    newOneBtn?.addEventListener('click', () => {
      resetRequestModal();
      $('#request-problem')?.focus();
    });

    whatsappBtn?.addEventListener('click', () => {
      clearRedirectTimer();
    });
  }

  function init() {
    bindTriggers();
    bindForm();
    window.FixeoClientRequest = Object.assign(window.FixeoClientRequest || {}, {
      open: openRequestModal,
      reset: resetRequestModal,
      buildWhatsappLink,
      storageKey: STORAGE_KEY
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
