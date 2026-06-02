// KG live hydration — replaces build-time snapshot numbers with live values
// from the backend API (metahumotonic_web_back, /api/stats). Graceful: on any
// failure the build-time numbers stay. KG: CONTRACT_Web_API, web-back-api
(function () {
  'use strict';

  function fmt(value, mode) {
    if (value == null || isNaN(value)) return null;
    if (mode === 'k') return Math.round(value / 1000) + 'K';
    if (mode === 'raw') return String(value);
    return Number(value).toLocaleString(); // default: thousands separators
  }

  async function hydrate() {
    let stats;
    try {
      const res = await fetch('/api/stats', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      stats = await res.json();
    } catch (e) {
      return; // keep build-time snapshot numbers
    }
    document.querySelectorAll('[data-kg-stat]').forEach(function (el) {
      var key = el.getAttribute('data-kg-stat');
      var mode = el.getAttribute('data-kg-fmt') || 'loc';
      var out = fmt(stats[key], mode);
      if (out !== null && el.textContent !== out) {
        el.textContent = out;
        el.setAttribute('data-kg-live', '1');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
