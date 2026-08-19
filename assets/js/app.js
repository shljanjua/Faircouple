/* FairCouples — progressive enhancement only. Every page works without this. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ Dark mode */

  var root = document.documentElement;

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
    try { localStorage.setItem('fc-theme', theme); } catch (e) { /* private mode */ }

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      var isDark = theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      button.setAttribute('aria-pressed', String(isDark));
      button.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      var label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
    });
  }

  function currentTheme() {
    var stored;
    try { stored = localStorage.getItem('fc-theme'); } catch (e) { stored = null; }
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-theme-toggle]');
    if (!toggle) return;
    event.preventDefault();
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  applyTheme(currentTheme());

  /* --------------------------------------------------------- Menu toggles */

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-toggle]');
    if (trigger) {
      var target = document.getElementById(trigger.getAttribute('data-toggle'));
      if (target) {
        var open = target.classList.toggle('is-open');
        if (target.hasAttribute('hidden') || target.classList.contains('dropdown-menu')) {
          target.hidden = !open;
        }
        trigger.setAttribute('aria-expanded', String(open));
      }
      return;
    }

    // Close open dropdowns when clicking elsewhere.
    document.querySelectorAll('.dropdown-menu.is-open').forEach(function (menu) {
      if (!menu.contains(event.target)) {
        menu.classList.remove('is-open');
        menu.hidden = true;
        var owner = document.querySelector('[data-toggle="' + menu.id + '"]');
        if (owner) owner.setAttribute('aria-expanded', 'false');
      }
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.is-open').forEach(function (element) {
      element.classList.remove('is-open');
      if (element.classList.contains('dropdown-menu')) element.hidden = true;
    });
  });

  /* ------------------------------------------------------ Confirm & submit */

  document.addEventListener('submit', function (event) {
    var form = event.target;

    var confirmText = form.getAttribute('data-confirm');
    if (confirmText && !window.confirm(confirmText)) {
      event.preventDefault();
      return;
    }

    // Stop double submissions without disabling the button before it submits.
    var submit = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submit && !form.hasAttribute('data-no-lock')) {
      window.setTimeout(function () {
        submit.classList.add('is-loading');
        submit.setAttribute('aria-busy', 'true');
      }, 0);
    }
  });

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-confirm]');
    if (link && !window.confirm(link.getAttribute('data-confirm'))) {
      event.preventDefault();
    }
  });

  /* --------------------------------------------------------- Range outputs */

  document.querySelectorAll('input[type="range"][data-output]').forEach(function (range) {
    var output = document.getElementById(range.getAttribute('data-output'));
    if (!output) return;
    var sync = function () { output.textContent = range.value; };
    range.addEventListener('input', sync);
    sync();
  });

  /* ------------------------------------------------ Country → currency */

  var country = document.querySelector('[data-country-select]');
  var currency = document.querySelector('[data-currency-select]');
  if (country && currency) {
    country.addEventListener('change', function () {
      var option = country.options[country.selectedIndex];
      var suggested = option && option.getAttribute('data-currency');
      if (suggested) currency.value = suggested;
    });
  }

  /* --------------------------------------------------------- Emoji picker */

  document.addEventListener('click', function (event) {
    var emoji = event.target.closest('[data-emoji]');
    if (!emoji) return;
    event.preventDefault();
    var field = document.getElementById(emoji.getAttribute('data-emoji-target') || 'message-body');
    if (!field) return;
    field.value += emoji.getAttribute('data-emoji');
    field.focus();
  });

  /* ------------------------------------------------------- Message polling */

  var chatLog = document.getElementById('chat-log');
  if (chatLog && chatLog.dataset.pollUrl) {
    chatLog.scrollTop = chatLog.scrollHeight;

    var poll = function () {
      if (document.hidden) return;

      var url = chatLog.dataset.pollUrl + '&after=' + encodeURIComponent(chatLog.dataset.after || '');
      fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (payload) {
          if (!payload || !payload.messages || !payload.messages.length) return;
          var atBottom = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 120;
          payload.messages.forEach(function (message) {
            if (document.getElementById('msg-' + message.id)) return;
            chatLog.insertAdjacentHTML('beforeend', message.html);
          });
          chatLog.dataset.after = payload.after || chatLog.dataset.after;
          if (atBottom) chatLog.scrollTop = chatLog.scrollHeight;
        })
        .catch(function () { /* offline — try again on the next tick */ });
    };

    window.setInterval(poll, 6000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  }

  /* ------------------------------------------------------- Cookie banner */

  /* Runs the tag initialisers that analytics.php queued behind consent, and
     tells Google Consent Mode the visitor has agreed. */
  function grantConsent() {
    window.fcConsentGranted = true;

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
      });
    }

    var queue = window.fcConsentQueue || [];
    window.fcConsentQueue = [];
    for (var i = 0; i < queue.length; i++) {
      try { queue[i](); } catch (e) { /* one bad tag must not stop the rest */ }
    }
  }

  var banner = document.getElementById('cookie-banner');
  if (banner) {
    var choice = null;
    try { choice = localStorage.getItem('fc-consent'); } catch (e) { choice = null; }

    if (choice === 'granted') {
      // analytics.php already ran the queue inline; nothing to show.
    } else if (choice === 'denied') {
      // Respect the refusal silently on every later visit.
    } else {
      banner.hidden = false;

      banner.querySelector('[data-cookie-accept]').addEventListener('click', function () {
        try { localStorage.setItem('fc-consent', 'granted'); } catch (e) { /* ignore */ }
        banner.hidden = true;
        grantConsent();
      });

      var decline = banner.querySelector('[data-cookie-decline]');
      if (decline) {
        decline.addEventListener('click', function () {
          try { localStorage.setItem('fc-consent', 'denied'); } catch (e) { /* ignore */ }
          banner.hidden = true;
          window.fcConsentQueue = [];
        });
      }
    }
  }

  /* ------------------------------------------------------------ Copy links */

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy]');
    if (!button) return;
    event.preventDefault();

    var value = button.getAttribute('data-copy');
    var done = function () {
      var original = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(function () { button.textContent = original; }, 1600);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).then(done, function () { window.prompt('Copy this link:', value); });
    } else {
      window.prompt('Copy this link:', value);
    }
  });

  /* ---------------------------------------------------- Local time on load */

  var timezone = document.querySelector('input[name="timezone"]');
  if (timezone && !timezone.value) {
    try { timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { timezone.value = 'UTC'; }
  }

  /* ------------------------------------------------------------- Lightbox */

  document.addEventListener('click', function (event) {
    var thumb = event.target.closest('[data-lightbox]');
    if (!thumb) return;
    event.preventDefault();

    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.88);display:flex;' +
      'align-items:center;justify-content:center;padding:1.5rem;cursor:zoom-out';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<img src="' + thumb.getAttribute('data-lightbox') + '" alt="" ' +
      'style="max-width:100%;max-height:100%;border-radius:12px;object-fit:contain">';

    overlay.addEventListener('click', function () { overlay.remove(); });
    document.addEventListener('keydown', function once(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', once); }
    });

    document.body.appendChild(overlay);
  });
})();
