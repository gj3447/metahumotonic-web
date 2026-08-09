(() => {
  'use strict';

  const root = document.querySelector('[data-community-wiki]');
  if (!root) return;

  const apiBase = String(root.dataset.apiBase || '/api/wiki/v1').replace(/\/$/, '');
  const $ = (selector) => root.querySelector(selector);
  const elements = {
    search: $('#community-search'),
    list: $('[data-page-list]'),
    listState: $('[data-list-state]'),
    listTitle: $('[data-list-title]'),
    resultCount: $('[data-result-count]'),
    drawer: $('[data-navigation-drawer]'),
    drawerToggle: $('[data-action="toggle-navigation"]'),
    allPagesAction: $('[data-action="all-pages"]'),
    recentAction: $('[data-action="recent"]'),
    currentSection: $('[data-current-section]'),
    currentList: $('[data-current-page]'),
    recentList: $('[data-recent-list]'),
    recentEmpty: $('[data-recent-empty]'),
    documentPanel: $('[data-document-panel]'),
    documentState: $('[data-document-state]'),
    documentTitle: $('[data-document-title]'),
    documentMessage: $('[data-document-message]'),
    documentView: $('[data-document-view]'),
    pageTitle: $('[data-page-title]'),
    pageSlug: $('[data-page-slug]'),
    headRevision: $('[data-head-revision]'),
    publicationState: $('[data-publication-state]'),
    renderState: $('[data-render-state]'),
    rendered: $('[data-sanitized-document]'),
    historyPanel: $('[data-history-panel]'),
    historyList: $('[data-history-list]'),
    diffPanel: $('[data-diff-panel]'),
    diffOutput: $('[data-diff-output]'),
    editorPanel: $('[data-editor-panel]'),
    editorTitle: $('[data-editor-title]'),
    editorForm: $('[data-editor-form]'),
    saveButton: $('[data-save-button]'),
    conflictBox: $('[data-conflict-box]'),
    conflictMessage: $('[data-conflict-message]'),
    status: $('[data-global-status]'),
    sessionNote: $('[data-session-note]'),
  };

  const state = {
    page: null,
    csrfToken: '',
    actorLabel: '',
    editorMode: 'create',
    listAbort: null,
    pageAbort: null,
    historyAbort: null,
    diffAbort: null,
    sessionPromise: null,
    listRequestKey: '',
    recentPages: [],
    drawerReturnFocus: null,
    editorReturnFocus: null,
    historyReturnFocus: null,
  };

  const recentStorageKey = 'metahumotonic.communityWiki.recentPages.v1';

  const pick = (object, ...keys) => {
    for (const key of keys) {
      if (object && object[key] !== undefined && object[key] !== null) return object[key];
    }
    return undefined;
  };

  function sameOriginUrl(path, params) {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error('Cross-origin wiki request blocked.');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      });
    }
    return url;
  }

  async function readJson(response) {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) return {};
    try { return await response.json(); } catch { return {}; }
  }

  function responseErrorMessage(payload, status) {
    const detail = pick(payload, 'detail', 'message', 'reason');
    if (typeof detail === 'string' && detail) return detail;
    if (detail && typeof detail === 'object') {
      return String(pick(detail, 'message', 'reason', 'code') || `요청 실패 (${status})`);
    }
    return `요청 실패 (${status})`;
  }

  function responseErrorCode(payload) {
    const detail = pick(payload, 'detail');
    if (detail && typeof detail === 'object') return String(pick(detail, 'code') || '');
    return String(pick(payload, 'code') || '');
  }

  function conflictKind(error) {
    if (error?.status !== 409) return '';
    const code = String(error.code || responseErrorCode(error.payload));
    return ['revision_conflict', 'slug_taken', 'idempotency_conflict'].includes(code) ? code : '';
  }

  async function api(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const initialHeaders = new Headers(options.headers || {});
    const idempotencyKey = unsafe
      ? (initialHeaders.get('Idempotency-Key') || crypto.randomUUID())
      : '';
    const serializedBody = options.body === undefined ? undefined : JSON.stringify(options.body);

    async function send(attempt) {
      const headers = new Headers(initialHeaders);
      if (serializedBody !== undefined) headers.set('Content-Type', 'application/json');
      if (unsafe) {
        headers.set('Idempotency-Key', idempotencyKey);
        if (!options.skipCsrf) {
          if (!state.csrfToken) await ensureWriteSession();
          headers.set('X-CSRF-Token', state.csrfToken);
        }
      }
      const response = await fetch(sameOriginUrl(`${apiBase}${path}`, options.params), {
        method,
        headers,
        body: serializedBody,
        credentials: 'same-origin',
        mode: 'same-origin',
        signal: options.signal,
      });
      const payload = await readJson(response);
      if (!response.ok) {
        const code = responseErrorCode(payload);
        const sessionRejected = unsafe
          && !options.skipCsrf
          && attempt === 0
          && ((response.status === 401 && ['invalid_session', 'session_required'].includes(code))
            || (response.status === 403 && code === 'csrf_failed'));
        if (sessionRejected) {
          state.csrfToken = '';
          state.actorLabel = '';
          await ensureWriteSession();
          return send(1);
        }
        const error = new Error(responseErrorMessage(payload, response.status));
        error.status = response.status;
        error.code = code;
        error.payload = payload;
        throw error;
      }
      return payload;
    }

    return send(0);
  }

  async function ensureWriteSession() {
    if (state.csrfToken) return;
    if (state.sessionPromise) return state.sessionPromise;
    state.sessionPromise = (async () => {
      setStatus('안전한 편집 세션을 발급하는 중…');
      const payload = await api('/sessions', { method: 'POST', body: {}, skipCsrf: true });
      state.csrfToken = String(pick(payload, 'csrf_token', 'csrfToken') || '');
      state.actorLabel = String(pick(payload, 'actor_id', 'actorId', 'actor') || 'anonymous editor');
      if (!state.csrfToken) throw new Error('서버가 CSRF 토큰을 발급하지 않았습니다.');
      elements.sessionNote.textContent = `${state.actorLabel} 세션 · 브라우저를 닫아도 원문 이력에는 익명 작성자 ID가 남습니다.`;
      setStatus('편집 세션이 준비됐습니다.', 'success');
    })();
    try {
      return await state.sessionPromise;
    } finally {
      state.sessionPromise = null;
    }
  }

  function setStatus(message, kind = '') {
    elements.status.textContent = message || '';
    elements.status.dataset.kind = kind;
  }

  function setListState(message, kind = 'loading') {
    elements.listState.hidden = !message;
    elements.listState.textContent = message || '';
    elements.listState.dataset.state = kind;
  }

  function setDocumentEmpty(title, message, kind = 'empty') {
    elements.documentView.hidden = true;
    elements.historyPanel.hidden = true;
    elements.documentState.hidden = false;
    elements.documentState.dataset.state = kind;
    elements.documentTitle.textContent = title;
    elements.documentMessage.textContent = message;
  }

  function normalizePage(item) {
    const revision = pick(item, 'revision', 'head_revision', 'headRevision') || {};
    return {
      slug: String(pick(item, 'slug', 'page_slug', 'pageSlug') || ''),
      title: String(pick(item, 'title', 'name') || pick(item, 'slug') || '제목 없음'),
      content: String(pick(item, 'content', 'raw_content', 'rawContent') ?? pick(revision, 'content') ?? ''),
      sanitizedHtml: pick(item, 'sanitized_html', 'sanitizedHtml') ?? pick(revision, 'sanitized_html', 'sanitizedHtml'),
      revisionId: String(pick(item, 'head_revision_id', 'headRevisionId', 'revision_id', 'revisionId') || pick(revision, 'revision_id', 'revisionId', 'id') || ''),
      contentHash: String(pick(item, 'head_content_hash', 'headContentHash', 'content_hash', 'contentHash') || pick(revision, 'content_hash', 'contentHash') || ''),
      publication: String(pick(item, 'review_status', 'reviewStatus', 'publication_state', 'publicationState', 'publication') || 'UNREVIEWED'),
      updatedAt: String(pick(item, 'updated_at', 'updatedAt', 'occurred_at', 'occurredAt') || ''),
      summary: String(pick(item, 'edit_summary', 'editSummary', 'summary') || ''),
    };
  }

  function mergeRecentPages(items, page, limit = 6) {
    const candidate = {
      slug: String(page?.slug || ''),
      title: String(page?.title || page?.slug || '제목 없음'),
      updatedAt: String(page?.updatedAt || ''),
    };
    if (!candidate.slug) return Array.isArray(items) ? items.slice(0, limit) : [];
    const previous = Array.isArray(items) ? items : [];
    return [candidate, ...previous.filter((item) => String(item?.slug || '') !== candidate.slug)]
      .filter((item) => item.slug)
      .slice(0, limit);
  }

  function uniquePagesBySlug(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      const slug = normalizePage(item).slug;
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
  }

  function preparePageItems(items, deduplicate = true) {
    const pages = Array.isArray(items) ? items : [];
    return deduplicate ? uniquePagesBySlug(pages) : pages.slice();
  }

  function readRecentPages() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(recentStorageKey) || '[]');
      return (Array.isArray(parsed) ? parsed : [])
        .map((item) => ({
          slug: String(item?.slug || ''),
          title: String(item?.title || item?.slug || '제목 없음'),
          updatedAt: String(item?.updatedAt || ''),
        }))
        .filter((item) => item.slug)
        .slice(0, 6);
    } catch {
      return [];
    }
  }

  function writeRecentPages(items) {
    try { window.localStorage.setItem(recentStorageKey, JSON.stringify(items)); } catch { /* local preference only */ }
  }

  function pagePath(slug, suffix = '') {
    return `/pages/${encodeURIComponent(slug)}${suffix}`;
  }

  function updatePageQuery(slug) {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set('page', slug); else url.searchParams.delete('page');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function makePageButton(raw, options = {}) {
    const page = normalizePage(raw);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.slug = page.slug;
    button.dataset.pageLink = '';
    button.setAttribute('aria-current', state.page?.slug === page.slug ? 'page' : 'false');
    const title = document.createElement('strong');
    title.textContent = page.title;
    const meta = document.createElement('small');
    if (options.meta === 'date') {
      meta.textContent = page.updatedAt ? formatDate(page.updatedAt) : page.slug;
    } else if (options.meta === 'change') {
      const parts = [page.summary || '변경 기록'];
      if (page.revisionId) parts.push(`revision ${page.revisionId}`);
      parts.push(page.updatedAt ? formatDate(page.updatedAt) : '시간 미상');
      meta.textContent = parts.join(' · ');
    } else {
      meta.textContent = `${page.slug || 'no-slug'}${page.updatedAt ? ` · ${formatDate(page.updatedAt)}` : ''}`;
    }
    button.append(title, meta);
    button.addEventListener('click', () => {
      loadPage(page.slug, { focusDocument: true });
      setNavigationOpen(false);
    });
    return button;
  }

  function markActivePage(slug) {
    root.querySelectorAll('[data-page-link]').forEach((button) => {
      button.setAttribute('aria-current', button.dataset.slug === slug ? 'page' : 'false');
    });
  }

  function renderCurrentPage(page) {
    elements.currentList.replaceChildren();
    elements.currentSection.hidden = !page?.slug;
    if (page?.slug) elements.currentList.append(makePageButton(page));
  }

  function renderRecentPages() {
    elements.recentList.replaceChildren();
    elements.recentEmpty.hidden = state.recentPages.length > 0;
    state.recentPages.forEach((page) => elements.recentList.append(makePageButton(page, { meta: 'date' })));
  }

  function rememberViewedPage(page) {
    state.recentPages = mergeRecentPages(state.recentPages, page);
    writeRecentPages(state.recentPages);
    renderRecentPages();
  }

  function setNavigationMode(mode) {
    const recent = mode === 'recent';
    elements.allPagesAction.setAttribute('aria-pressed', String(!recent));
    elements.recentAction.setAttribute('aria-pressed', String(recent));
  }

  function renderPageList(items, options = {}) {
    const pages = preparePageItems(items, options.deduplicate !== false);
    elements.list.replaceChildren();
    elements.resultCount.textContent = `${pages.length}개`;
    if (!pages.length) {
      setListState('조건에 맞는 커뮤니티 문서가 없습니다.', 'empty');
      return;
    }
    setListState('');
    pages.forEach((raw) => elements.list.append(makePageButton(raw, { meta: options.meta })));
  }

  async function loadList(query = '') {
    const requestKey = `pages:${query}`;
    if (state.listRequestKey === requestKey) return;
    state.listAbort?.abort();
    const controller = new AbortController();
    state.listAbort = controller;
    state.listRequestKey = requestKey;
    elements.listTitle.textContent = query ? '검색 결과' : '문서 목록';
    setNavigationMode('pages');
    setListState('문서를 불러오는 중…');
    try {
      const payload = await api('/pages', { params: { q: query, limit: 50 }, signal: controller.signal });
      if (state.listAbort !== controller) return;
      renderPageList(pick(payload, 'items', 'pages', 'results') || (Array.isArray(payload) ? payload : []));
    } catch (error) {
      if (error.name === 'AbortError' || state.listAbort !== controller) return;
      setListState(error.message || '문서 목록을 불러오지 못했습니다.', 'error');
    } finally {
      if (state.listAbort === controller) {
        state.listAbort = null;
        state.listRequestKey = '';
      }
    }
  }

  async function loadRecent() {
    const requestKey = 'recent';
    if (state.listRequestKey === requestKey) return;
    state.listAbort?.abort();
    const controller = new AbortController();
    state.listAbort = controller;
    state.listRequestKey = requestKey;
    elements.listTitle.textContent = '최근 변경';
    setNavigationMode('recent');
    setListState('최근 변경을 불러오는 중…');
    try {
      const payload = await api('/recent-changes', { params: { limit: 50 }, signal: controller.signal });
      if (state.listAbort !== controller) return;
      renderPageList(
        pick(payload, 'items', 'changes', 'results') || (Array.isArray(payload) ? payload : []),
        { deduplicate: false, meta: 'change' },
      );
    } catch (error) {
      if (error.name === 'AbortError' || state.listAbort !== controller) return;
      setListState(error.message || '최근 변경을 불러오지 못했습니다.', 'error');
    } finally {
      if (state.listAbort === controller) {
        state.listAbort = null;
        state.listRequestKey = '';
      }
    }
  }

  function showPage(page, options = {}) {
    const pageRequestController = options.pageRequestController || null;
    if (state.pageAbort && state.pageAbort !== pageRequestController) {
      state.pageAbort.abort();
      state.pageAbort = null;
    }
    state.historyAbort?.abort();
    state.diffAbort?.abort();
    state.historyAbort = null;
    state.diffAbort = null;
    state.page = page;
    elements.documentState.hidden = true;
    elements.documentView.hidden = false;
    elements.historyPanel.hidden = true;
    elements.pageTitle.textContent = page.title;
    elements.pageSlug.textContent = page.slug;
    elements.headRevision.textContent = page.revisionId || 'unknown';
    elements.publicationState.textContent = page.publication.toUpperCase();
    elements.rendered.replaceChildren();
    elements.renderState.textContent = '';
    elements.renderState.dataset.state = '';

    if (typeof page.sanitizedHtml !== 'string') {
      elements.renderState.textContent = '서버가 검증된 HTML을 반환하지 않아 본문 표시를 차단했습니다.';
      elements.renderState.dataset.state = 'error';
    } else {
      // The API contract guarantees this field is server-sanitized. No other
      // server or user value is ever assigned through innerHTML in this client.
      elements.rendered.innerHTML = page.sanitizedHtml;
    }
    updatePageQuery(page.slug);
    rememberViewedPage(page);
    renderCurrentPage(page);
    markActivePage(page.slug);
    if (options.focusDocument) {
      if (options.announce !== false) setStatus(`${page.title} 문서를 열었습니다.`, 'success');
      elements.documentPanel.focus({ preventScroll: false });
    }
  }

  async function loadPage(slug, options = {}) {
    if (!slug) return;
    state.pageAbort?.abort();
    const controller = new AbortController();
    state.pageAbort = controller;
    setDocumentEmpty('문서를 불러오는 중…', slug, 'loading');
    try {
      const payload = await api(pagePath(slug), { signal: controller.signal });
      if (state.pageAbort !== controller) return null;
      showPage(
        normalizePage(pick(payload, 'page') || payload),
        { ...options, pageRequestController: controller },
      );
      return state.page;
    } catch (error) {
      if (error.name === 'AbortError' || state.pageAbort !== controller) return null;
      setDocumentEmpty('문서를 열지 못했습니다', error.message || '잠시 뒤 다시 시도해 주세요.', 'error');
      setStatus(error.message || '문서를 열지 못했습니다.', 'error');
      if (options.focusDocument) elements.documentPanel.focus({ preventScroll: false });
      return null;
    } finally {
      if (state.pageAbort === controller) state.pageAbort = null;
    }
  }

  function openEditor(mode, returnFocus = document.activeElement) {
    state.editorReturnFocus = returnFocus;
    state.editorMode = mode;
    elements.conflictBox.hidden = true;
    const form = elements.editorForm.elements;
    if (mode === 'edit' && state.page) {
      elements.editorTitle.textContent = `${state.page.title} 편집`;
      form.title.value = state.page.title;
      form.slug.value = state.page.slug;
      form.slug.readOnly = true;
      form.content.value = state.page.content;
      form.edit_summary.value = '';
      form.expected_head_revision_id.value = state.page.revisionId;
    } else {
      elements.editorTitle.textContent = '새 커뮤니티 문서';
      elements.editorForm.reset();
      form.slug.readOnly = false;
    }
    elements.editorPanel.hidden = false;
    elements.editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.title.focus();
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (!elements.editorForm.reportValidity()) return;
    const form = new FormData(elements.editorForm);
    const slug = String(form.get('slug') || '').trim();
    const common = {
      title: String(form.get('title') || '').trim(),
      content: String(form.get('content') || ''),
      edit_summary: String(form.get('edit_summary') || '').trim(),
    };
    const creating = state.editorMode === 'create';
    const body = creating ? { slug, ...common } : {
      ...common,
      expected_head_revision_id: String(form.get('expected_head_revision_id') || ''),
    };
    elements.saveButton.disabled = true;
    elements.conflictBox.hidden = true;
    setStatus('revision을 저장하는 중…');
    try {
      const payload = await api(creating ? '/pages' : pagePath(slug, '/revisions'), { method: 'POST', body });
      const page = normalizePage(pick(payload, 'page') || payload);
      elements.editorPanel.hidden = true;
      setStatus('COMMUNITY revision이 저장됐습니다. 정전에는 반영되지 않았습니다.', 'success');
      await loadList(elements.search.value.trim());
      if (page.slug && page.revisionId) showPage(page); else await loadPage(slug);
      elements.documentPanel.focus({ preventScroll: false });
      state.editorReturnFocus = null;
    } catch (error) {
      const conflict = conflictKind(error);
      if (conflict === 'revision_conflict') {
        const actual = pick(error.payload, 'actual_head_revision_id', 'actualHeadRevisionId', 'current_head_revision_id', 'currentHeadRevisionId');
        elements.conflictMessage.textContent = `작성 중인 내용은 그대로 보존했습니다.${actual ? ` 서버 최신판은 ${actual}입니다.` : ''} 최신판을 확인하고 변경을 합친 뒤 저장하세요.`;
        elements.conflictBox.hidden = false;
        elements.conflictBox.focus?.();
        setStatus('동시 편집 충돌: 자동 덮어쓰기를 중단했습니다.', 'error');
      } else if (conflict === 'slug_taken') {
        setStatus('이미 사용 중인 slug입니다. 작성 내용은 유지했으니 다른 slug로 다시 저장하세요.', 'error');
        elements.editorForm.elements.slug.focus();
      } else if (conflict === 'idempotency_conflict') {
        setStatus('이전 요청 키와 내용이 충돌했습니다. 작성 내용은 유지됐으며 다시 저장할 수 있습니다.', 'error');
      } else {
        setStatus(error.message || 'revision을 저장하지 못했습니다.', 'error');
      }
    } finally {
      elements.saveButton.disabled = false;
    }
  }

  async function loadHistory() {
    if (!state.page) return;
    const pageContext = { slug: state.page.slug, revisionId: state.page.revisionId };
    state.historyAbort?.abort();
    state.diffAbort?.abort();
    const controller = new AbortController();
    state.historyAbort = controller;
    state.diffAbort = null;
    state.historyReturnFocus = document.activeElement;
    elements.documentView.hidden = true;
    elements.historyPanel.hidden = false;
    elements.historyList.textContent = '이력을 불러오는 중…';
    elements.diffPanel.hidden = true;
    elements.historyPanel.focus({ preventScroll: false });
    try {
      const payload = await api(pagePath(pageContext.slug, '/history'), { signal: controller.signal });
      if (
        state.historyAbort !== controller
        || state.page?.slug !== pageContext.slug
        || state.page?.revisionId !== pageContext.revisionId
      ) return;
      const items = pick(payload, 'items', 'revisions', 'history') || [];
      elements.historyList.replaceChildren();
      if (!items.length) {
        elements.historyList.textContent = '기록된 revision이 없습니다.';
        return;
      }
      items.forEach((item) => {
        const revisionId = String(pick(item, 'revision_id', 'revisionId', 'id') || 'unknown');
        const wrapper = document.createElement('div');
        wrapper.className = 'history-item';
        const copy = document.createElement('div');
        const name = document.createElement('p');
        name.textContent = String(pick(item, 'edit_summary', 'editSummary', 'summary') || revisionId);
        const meta = document.createElement('small');
        meta.textContent = `${revisionId} · ${String(pick(item, 'author_id', 'authorId', 'actor_id', 'actorId') || 'unknown actor')} · ${formatDate(pick(item, 'committed_at', 'committedAt', 'occurred_at', 'occurredAt'))}`;
        copy.append(name, meta);
        const compare = document.createElement('button');
        compare.type = 'button';
        compare.className = 'button button--quiet';
        compare.textContent = '현재판과 비교';
        compare.disabled = revisionId === pageContext.revisionId;
        compare.addEventListener('click', () => loadDiff(pageContext, revisionId, pageContext.revisionId));
        wrapper.append(copy, compare);
        elements.historyList.append(wrapper);
      });
    } catch (error) {
      if (error.name === 'AbortError' || state.historyAbort !== controller) return;
      elements.historyList.textContent = error.message || '이력을 불러오지 못했습니다.';
    } finally {
      if (state.historyAbort === controller) state.historyAbort = null;
    }
  }

  async function loadDiff(pageContext, fromRevisionId, toRevisionId) {
    if (
      !pageContext?.slug
      || state.page?.slug !== pageContext.slug
      || state.page?.revisionId !== pageContext.revisionId
    ) return;
    state.diffAbort?.abort();
    const controller = new AbortController();
    state.diffAbort = controller;
    elements.diffPanel.hidden = false;
    elements.diffOutput.textContent = '차이를 계산하는 중…';
    try {
      const payload = await api(pagePath(pageContext.slug, '/diff'), {
        params: { from_revision_id: fromRevisionId, to_revision_id: toRevisionId },
        signal: controller.signal,
      });
      if (
        state.diffAbort !== controller
        || state.page?.slug !== pageContext.slug
        || state.page?.revisionId !== pageContext.revisionId
      ) return;
      elements.diffOutput.textContent = String(pick(payload, 'unified_diff', 'unifiedDiff', 'diff') || '변경 내용이 없습니다.');
      elements.diffOutput.focus();
    } catch (error) {
      if (error.name === 'AbortError' || state.diffAbort !== controller) return;
      elements.diffOutput.textContent = error.message || '판 비교를 불러오지 못했습니다.';
    } finally {
      if (state.diffAbort === controller) state.diffAbort = null;
    }
  }

  async function submitReview() {
    if (!state.page) return;
    if (!window.confirm('현재 COMMUNITY revision을 KG 검토 대기열에 제출할까요? 제출만으로 정전이 되지는 않습니다.')) return;
    const pageContext = {
      slug: state.page.slug,
      revisionId: state.page.revisionId,
      contentHash: state.page.contentHash,
    };
    setStatus('KG 검토 요청을 제출하는 중…');
    try {
      await api(pagePath(pageContext.slug, '/submit-review'), {
        method: 'POST',
        body: { revision_id: pageContext.revisionId, content_hash: pageContext.contentHash },
      });
      if (
        state.page?.slug !== pageContext.slug
        || state.page?.revisionId !== pageContext.revisionId
      ) {
        setStatus(`${pageContext.slug} revision의 검토 요청을 제출했습니다. 현재 문서는 그대로 유지합니다.`, 'success');
        return;
      }
      const refreshed = await loadPage(pageContext.slug, { focusDocument: true, announce: false });
      if (refreshed) {
        setStatus('검토 요청을 제출했습니다. 아직 COMMUNITY이며 정전이 아닙니다.', 'success');
      } else {
        setStatus('검토 요청은 제출됐지만 문서 새로고침에 실패했습니다. 다시 열어 확인해 주세요.', 'error');
      }
    } catch (error) {
      setStatus(error.message || '검토 요청을 제출하지 못했습니다.', 'error');
    }
  }

  async function reportPage() {
    if (!state.page) return;
    const reason = window.prompt('신고 사유를 입력하세요. 신고 내용은 공개 이력에 노출되지 않습니다.');
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setStatus('신고 사유를 입력해 주세요.', 'error');
      return;
    }
    if (trimmed.length > 2000) {
      setStatus('신고 사유는 2,000자 이하여야 합니다.', 'error');
      return;
    }
    setStatus('운영 검토 대기열에 신고를 기록하는 중…');
    try {
      await api(pagePath(state.page.slug, '/report'), {
        method: 'POST',
        body: { reason: trimmed },
      });
      setStatus('신고를 접수했습니다. 신고 사유는 공개 문서 이력에 표시되지 않습니다.', 'success');
    } catch (error) {
      setStatus(error.message || '신고를 접수하지 못했습니다.', 'error');
    }
  }

  function formatDate(value) {
    if (!value) return '시간 미상';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function isDrawerViewport() {
    return Boolean(window.matchMedia?.('(max-width: 1100px)').matches);
  }

  function setNavigationOpen(open, returnFocus = true) {
    const next = Boolean(open && isDrawerViewport());
    if (next) state.drawerReturnFocus = document.activeElement;
    elements.drawer.dataset.open = String(next);
    elements.drawerToggle.setAttribute('aria-expanded', String(next));
    if (next) {
      setTimeout(() => elements.search.focus(), 0);
    } else {
      const returnTarget = state.drawerReturnFocus;
      state.drawerReturnFocus = null;
      if (returnFocus) returnTarget?.focus?.();
    }
  }

  function editorReturnFocusTarget() {
    return isDrawerViewport() ? elements.drawerToggle : document.activeElement;
  }

  function runCreateAction(
    closeDrawer = setNavigationOpen,
    showEditor = openEditor,
    returnTarget = editorReturnFocusTarget(),
  ) {
    closeDrawer(false, false);
    showEditor('create', returnTarget);
  }

  function closeEditor() {
    elements.editorPanel.hidden = true;
    state.editorReturnFocus?.focus?.();
    state.editorReturnFocus = null;
  }

  function closeHistory() {
    state.historyAbort?.abort();
    state.diffAbort?.abort();
    state.historyAbort = null;
    state.diffAbort = null;
    elements.historyPanel.hidden = true;
    elements.documentView.hidden = false;
    state.historyReturnFocus?.focus?.();
    state.historyReturnFocus = null;
  }

  let searchTimer;
  function cancelScheduledSearch() {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }

  function runListCommand(command) {
    cancelScheduledSearch();
    return command();
  }

  function scheduleSearch() {
    cancelScheduledSearch();
    searchTimer = setTimeout(() => {
      searchTimer = undefined;
      loadList(elements.search.value.trim());
    }, 250);
  }

  elements.search.addEventListener('input', () => {
    scheduleSearch();
  });
  elements.search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runListCommand(() => loadList(elements.search.value.trim()));
    }
  });
  elements.editorForm.addEventListener('submit', saveEditor);
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'search') runListCommand(() => loadList(elements.search.value.trim()));
    if (action === 'recent') runListCommand(loadRecent);
    if (action === 'all-pages') {
      elements.search.value = '';
      runListCommand(loadList);
    }
    if (action === 'toggle-navigation') setNavigationOpen(elements.drawer.dataset.open !== 'true');
    if (action === 'close-navigation') setNavigationOpen(false);
    if (action === 'clear-viewed') {
      state.recentPages = [];
      writeRecentPages([]);
      renderRecentPages();
    }
    if (action === 'create') runCreateAction();
    if (action === 'edit') openEditor('edit');
    if (action === 'history') loadHistory();
    if (action === 'close-history') closeHistory();
    if (action === 'cancel-edit') closeEditor();
    if (action === 'submit-review') submitReview();
    if (action === 'report') reportPage();
    if (action === 'reload-latest' && state.page) window.open(`${window.location.pathname}?page=${encodeURIComponent(state.page.slug)}`, '_blank', 'noopener');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.drawer.dataset.open === 'true') setNavigationOpen(false);
  });
  const drawerMedia = window.matchMedia?.('(max-width: 1100px)');
  drawerMedia?.addEventListener?.('change', () => setNavigationOpen(false, false));

  const initialSlug = new URLSearchParams(window.location.search).get('page');
  state.recentPages = readRecentPages();
  renderRecentPages();
  loadList();
  if (initialSlug) loadPage(initialSlug);
})();
