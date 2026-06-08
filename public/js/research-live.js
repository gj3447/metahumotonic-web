// Live research feed — fetches the crystallized research body from the backend
// (metahumotonic_web_back, /api/research/*) and renders it client-side. Graceful:
// on any failure the page keeps its skeleton + a "연결 대기" notice. The summary's
// `source` flag (live|snapshot) drives an honest live-vs-offline indicator.
// KG: CONTRACT_Web_API, web-back-api, ResearchFinding, Lesson, Paper, Consensus
(function () {
  'use strict';

  var FEED = document.getElementById('research-feed');
  var STATUS = document.getElementById('research-status');
  if (!FEED) return;

  var kgLive = false; // set by hydrateSummary from summary.source === 'live'

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // URL-scheme allowlist: only http(s) hrefs survive, so a KG value like
  // `javascript:...` / `data:...` can never become a click-to-fire XSS sink.
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }
  function loc(n) {
    return (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString();
  }
  function date(s) {
    return s ? esc(String(s).slice(0, 10)) : '';
  }
  async function get(path) {
    var res = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // --- summary counts in the hero (with honest live/snapshot signal) ---
  async function hydrateSummary() {
    try {
      var s = await get('/api/research/summary');
      kgLive = s.source === 'live';
      document.querySelectorAll('[data-research-stat]').forEach(function (el) {
        var k = el.getAttribute('data-research-stat');
        if (s[k] != null) {
          el.textContent = loc(s[k]);
          // only paint a chip "live" (cyan) when the KG actually answered
          el.setAttribute('data-live', kgLive ? '1' : '0');
        }
      });
    } catch (e) {
      kgLive = false; // keep skeleton numbers; treat as not-live
    }
  }

  // --- per-type card renderers ---
  var TYPE_LABEL = {
    finding: 'FINDING', lesson: 'LESSON', paper: 'PAPER',
    consensus: 'CONSENSUS', validation: 'VALIDATION', decision: 'DECISION',
  };

  function badge(type) {
    return '<span class="rc-badge rc-' + esc(type) + '">' +
      esc(TYPE_LABEL[type] || type) + '</span>';
  }
  function meta(bits) {
    var parts = bits.filter(Boolean).map(function (b) {
      return '<span class="rc-meta-item">' + b + '</span>';
    });
    return parts.length ? '<div class="rc-meta">' + parts.join('') + '</div>' : '';
  }

  function cardRecent(it) {
    return '<article class="rc">' + badge(it.type) +
      '<h3 class="rc-title">' + esc(it.title || it.name) + '</h3>' +
      (it.summary ? '<p class="rc-body">' + esc(it.summary) + '</p>' : '') +
      meta([date(it.createdAt), '<code>' + esc(it.name) + '</code>']) +
      '</article>';
  }
  function cardFinding(f) {
    var su = safeUrl(f.citationUrl);
    var cite = su
      ? '<a href="' + esc(su) + '" target="_blank" rel="noopener noreferrer">출처</a>' : '';
    return '<article class="rc">' + badge('finding') +
      '<p class="rc-body">' + esc(f.finding) + '</p>' +
      meta([
        f.axis ? esc(f.axis) + (f.subAxis ? ' · ' + esc(f.subAxis) : '') : '',
        f.confidence ? 'conf: ' + esc(f.confidence) : '',
        f.verified === true ? '✓ verified' : '',
        f.cycleId ? '<code>' + esc(f.cycleId) + '</code>' : '',
        f.lakatosMechanism ? esc(f.lakatosMechanism) : '',
        date(f.createdAt), cite,
      ]) + '</article>';
  }
  function cardLesson(l) {
    var pair = (l.wrongAssumption || l.truth)
      ? '<p class="rc-body"><span class="rc-wrong">' + esc(l.wrongAssumption || '?') +
        '</span> <span class="rc-arrow">→</span> <span class="rc-truth">' +
        esc(l.truth || '?') + '</span></p>'
      : (l.solution ? '<p class="rc-body">' + esc(l.solution) + '</p>' : '');
    return '<article class="rc">' + badge('lesson') +
      '<h3 class="rc-title">' + esc(l.problem || l.name) + '</h3>' + pair +
      meta([
        l.category ? esc(l.category) : '',
        l.severity ? esc(l.severity) : '',
        l.lakatosMechanism ? esc(l.lakatosMechanism) : '',
        date(l.createdAt),
      ]) + '</article>';
  }
  function cardPaper(p) {
    // DOIs are 10.xxxx/... — only link when it looks like one (avoids any
    // attacker-controlled scheme reaching the href).
    var doi = (p.doi && /^10\.\S+\/\S+$/.test(String(p.doi)))
      ? '<a href="https://doi.org/' + esc(p.doi) + '" target="_blank" rel="noopener noreferrer">DOI</a>' : '';
    return '<article class="rc">' + badge('paper') +
      '<h3 class="rc-title">' + esc(p.title) + '</h3>' +
      (p.coreThesis ? '<p class="rc-body">' + esc(p.coreThesis) + '</p>' : '') +
      meta([
        p.author ? esc(p.author) : '',
        p.year ? esc(p.year) : '',
        p.journal ? esc(p.journal) : '',
        p.domain ? esc(p.domain) : '', doi,
      ]) + '</article>';
  }
  function cardConsensus(c) {
    return '<article class="rc">' + badge('consensus') +
      '<h3 class="rc-title">' + esc(c.name) + '</h3>' +
      (c.summary ? '<p class="rc-body">' + esc(c.summary) + '</p>' : '') +
      meta([date(c.createdAt)]) + '</article>';
  }

  var TABS = {
    recent:    { path: '/api/research/recent?limit=40',    render: cardRecent },
    findings:  { path: '/api/research/findings?limit=40',  render: cardFinding },
    lessons:   { path: '/api/research/lessons?limit=40',   render: cardLesson },
    papers:    { path: '/api/research/papers?limit=40',    render: cardPaper },
    consensus: { path: '/api/research/consensus?limit=40', render: cardConsensus },
  };

  function setStatus(msg, live) {
    if (!STATUS) return;
    STATUS.textContent = msg;
    STATUS.setAttribute('data-live', live ? '1' : '0');
  }

  var current = 'recent';
  var loading = false;
  async function loadTab(tab) {
    var spec = TABS[tab];
    if (!spec) return;
    current = tab;
    loading = true;
    FEED.setAttribute('aria-busy', 'true');
    setStatus('불러오는 중…', false);
    try {
      var items = await get(spec.path);
      if (!items.length) {
        // honest empty: distinguish a real 0-result from a KG outage (which
        // also returns [] with 200). kgLive comes from summary.source.
        if (kgLive) {
          FEED.innerHTML = '<p class="rc-empty">이 분류에 표시할 항목이 없습니다.</p>';
          setStatus('라이브 · 0건', true);
        } else {
          FEED.innerHTML = '<p class="rc-empty">라이브 KG 연결 대기 중입니다. ' +
            '잠시 후 새로고침해 주세요.</p>';
          setStatus('스냅샷 — KG 연결 대기', false);
        }
      } else {
        FEED.innerHTML = items.map(spec.render).join('');
        setStatus((kgLive ? '라이브' : '스냅샷') + ' · ' + items.length +
          '건 (metahumotonic KG)', kgLive);
      }
    } catch (e) {
      FEED.innerHTML = '<p class="rc-empty">라이브 KG 연결 대기 중입니다. ' +
        '잠시 후 새로고침해 주세요.</p>';
      setStatus('연결 대기', false);
    } finally {
      loading = false;
      FEED.setAttribute('aria-busy', 'false');
    }
  }

  function wireTabs() {
    document.querySelectorAll('[data-research-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (loading) return;
        var tab = btn.getAttribute('data-research-tab');
        document.querySelectorAll('[data-research-tab]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        loadTab(tab);
      });
    });
  }

  async function start() {
    wireTabs();
    await hydrateSummary(); // learn live-vs-snapshot before phrasing the feed
    loadTab(current);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
