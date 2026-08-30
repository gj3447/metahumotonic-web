(() => {
  'use strict';

  const root = document.getElementById('ontology-explorer');
  if (!root) return;

  const apiBase = root.dataset.apiBase || '/api/v1/ontology';
  const projectionId = root.dataset.projectionId || '';
  const expectedSchemaVersion = 'metahumotonic-public-graph/v1';
  const expectedReleaseState = 'ACTIVE_INTERNAL_CONFLICT_AWARE';
  const expectedPublicationStatus = 'INTERNAL_ONLY';
  const sessionKeyName = 'metahumotonic.ontology.internal-key';
  const publicIdPattern = /^mtg1-[a-f0-9]{16}$/;
  const forbiddenKeys = new Set([
    'cypher',
    'exact_text',
    'kg_label',
    'kg_labels',
    'kg_uid',
    'raw_cypher',
    'source_file',
    'source_path',
    'source_paths',
    'stable_ref',
    'stable_refs',
    'user_request_sha256',
    'user_utterance',
    'verification_path',
    'verification_paths',
  ]);
  const forbiddenMarkers = ['/home/', '/users/', 'bolt://', 'file://', 'neo4j://', 'sym:'];

  const authForm = document.getElementById('ontology-auth-form');
  const keyInput = document.getElementById('ontology-key');
  const disconnectButton = document.getElementById('ontology-disconnect');
  const status = document.getElementById('ontology-status');
  const workspace = document.getElementById('ontology-workspace');
  const digest = document.getElementById('ontology-digest');
  const releaseStats = document.getElementById('ontology-release-stats');
  const apostles = document.getElementById('ontology-apostles');
  const legionCommanders = document.getElementById('ontology-legion-commanders');
  const omcCommanders = document.getElementById('ontology-omc-commanders');
  const conflicts = document.getElementById('ontology-conflicts');
  const searchForm = document.getElementById('ontology-search-form');
  const searchInput = document.getElementById('ontology-query');
  const kindInput = document.getElementById('ontology-kind');
  const searchResults = document.getElementById('ontology-search-results');
  const searchMore = document.getElementById('ontology-search-more');
  const detail = document.getElementById('ontology-detail');
  const neighbors = document.getElementById('ontology-neighbors');

  let activeKey = '';
  let searchCursor = null;
  let lastSearch = null;

  class OntologyApiError extends Error {
    constructor(statusCode, body) {
      super(body?.error?.message || `Ontology API request failed (${statusCode})`);
      this.statusCode = statusCode;
      this.body = body;
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function badge(text, tone = '') {
    return element('span', `ontology-badge${tone ? ` ontology-badge--${tone}` : ''}`, text);
  }

  function assertSafe(value, path = '$') {
    if (Array.isArray(value)) {
      value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const lowered = key.toLowerCase();
        if (forbiddenKeys.has(lowered) || (lowered.endsWith('sha256') && lowered !== 'content_sha256')) {
          throw new Error(`차단된 private field가 응답에 포함됨: ${path}.${key}`);
        }
        assertSafe(child, `${path}.${key}`);
      }
      return;
    }
    if (typeof value === 'string') {
      const lowered = value.toLowerCase();
      if (forbiddenMarkers.some((marker) => lowered.includes(marker))) {
        throw new Error(`차단된 private marker가 응답에 포함됨: ${path}`);
      }
    }
  }

  function readSessionKey() {
    try {
      return window.sessionStorage.getItem(sessionKeyName) || '';
    } catch {
      return '';
    }
  }

  function writeSessionKey(value) {
    try {
      if (value) window.sessionStorage.setItem(sessionKeyName, value);
      else window.sessionStorage.removeItem(sessionKeyName);
    } catch {
      // The explorer still works in-memory when storage is unavailable.
    }
  }

  function setStatus(message, tone = '') {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function setPanelMessage(panel, message, tone = 'empty') {
    panel.replaceChildren(element('p', `ontology-panel__message ontology-panel__message--${tone}`, message));
    panel.classList.toggle('ontology-panel--empty', tone === 'empty');
  }

  async function api(path, params = null) {
    if (!activeKey) throw new Error('내부 키가 없습니다.');
    const url = new URL(`${apiBase}${path}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-Ontology-Key': activeKey,
      },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error('Ontology API가 JSON 응답을 반환하지 않았습니다. 내부 routing 상태를 확인하세요.');
    }
    assertSafe(body);
    if (!response.ok) throw new OntologyApiError(response.status, body);
    return body;
  }

  function summaryName(item) {
    if (item?.selection_state === 'CONFLICT_PENDING') return '선택 미결';
    return typeof item?.canonical_name === 'string' && item.canonical_name
      ? item.canonical_name
      : '이름 없음';
  }

  function recordButton(item, options = {}) {
    const button = element('button', 'ontology-record');
    button.type = 'button';
    button.dataset.publicId = item.public_id;
    if (item.selection_state === 'CONFLICT_PENDING') button.classList.add('ontology-record--conflict');

    const top = element('span', 'ontology-record__top');
    top.append(
      element('small', '', options.prefix || item.kind || ''),
      badge(item.selection_state || item.status || item.binding_state || 'BOUND', item.selection_state === 'CONFLICT_PENDING' ? 'warn' : ''),
    );
    button.append(top, element('strong', '', summaryName(item)));
    const note = [];
    if (Array.isArray(item.aliases) && item.aliases.length) note.push(item.aliases.join(' · '));
    if (item.candidate_count) note.push(`후보 ${item.candidate_count}`);
    if (note.length) button.append(element('span', 'ontology-record__note', note.join(' — ')));
    button.addEventListener('click', () => loadNode(item.public_id));
    return button;
  }

  function renderRoster(items, container, prefixFor) {
    const fragment = document.createDocumentFragment();
    for (const item of items || []) {
      fragment.append(recordButton(item, { prefix: prefixFor(item) }));
    }
    container.replaceChildren(fragment);
  }

  function renderRelease(data, meta) {
    const counts = data?.counts;
    const collections = data?.collections;
    if (!counts || !collections || !Array.isArray(collections.apostles)) {
      throw new Error('Release DTO shape가 올바르지 않습니다.');
    }
    const contentDigest = meta?.content_sha256 || data.content_sha256 || '';
    digest.textContent = contentDigest ? `sha256:${contentDigest.slice(0, 12)}…` : 'digest unavailable';

    const stats = [
      ['상태', data.release_state || meta?.release_state],
      ['발행', data.publication_status || meta?.publication_status],
      ['노드 묶음', Object.values(counts.collections || {}).reduce((sum, value) => sum + Number(value || 0), 0)],
      ['관계', counts.relationships],
      ['충돌', counts.conflicts],
    ];
    releaseStats.replaceChildren(...stats.map(([label, value]) => {
      const card = element('div');
      card.append(element('small', '', label), element('strong', '', value ?? '—'));
      return card;
    }));

    renderRoster(
      [...collections.apostles].sort((a, b) => Number(a.position) - Number(b.position)),
      apostles,
      (item) => `#${item.position}`,
    );
    renderRoster(
      [...(collections.legion_commanders || [])].sort((a, b) => Number(a.position) - Number(b.position)),
      legionCommanders,
      (item) => `L${item.position}`,
    );
    renderRoster(collections.omc_commanders || [], omcCommanders, () => 'OMC');
    renderConflicts(data.conflicts || []);
  }

  function validatePinnedRelease(body) {
    const meta = body?.meta;
    const data = body?.data;
    if (!meta || !data) throw new Error('Release envelope가 올바르지 않습니다.');
    const checks = [
      [meta.schema_version, expectedSchemaVersion, 'schema_version'],
      [meta.projection_id, projectionId, 'projection_id'],
      [meta.release_state, expectedReleaseState, 'release_state'],
      [meta.publication_status, expectedPublicationStatus, 'publication_status'],
      [data.schema_version, expectedSchemaVersion, 'release.schema_version'],
      [data.projection_id, projectionId, 'release.projection_id'],
      [data.release_state, expectedReleaseState, 'release.release_state'],
      [data.publication_status, expectedPublicationStatus, 'release.publication_status'],
    ];
    for (const [observed, expected, field] of checks) {
      if (observed !== expected) {
        throw new Error(`고정 release ${field} 불일치로 렌더링을 중단했습니다.`);
      }
    }
    if (!/^[a-f0-9]{64}$/.test(meta.content_sha256 || '')) {
      throw new Error('고정 release content digest가 올바르지 않습니다.');
    }
  }

  function renderConflicts(items) {
    if (!items.length) {
      conflicts.replaceChildren(element('p', '', '열린 충돌이 없습니다.'));
      return;
    }
    conflicts.replaceChildren(...items.map((item) => {
      const article = element('article');
      const heading = element('div', 'ontology-conflict__head');
      heading.append(
        element('strong', '', item.conflict_id || 'conflict'),
        badge(item.severity || 'UNKNOWN', item.severity === 'BLOCK_PUBLIC_DEFAULT' ? 'danger' : 'warn'),
      );
      article.append(
        heading,
        element('p', '', item.detail || '설명 없음'),
        element('small', '', item.status || ''),
      );
      if (item.subject_public_id) {
        const button = element('button', 'ontology-link-button', item.subject_public_id);
        button.type = 'button';
        button.addEventListener('click', () => loadNode(item.subject_public_id));
        article.append(button);
      }
      return article;
    }));
  }

  function definitionList(rows) {
    const list = element('dl', 'ontology-facts');
    for (const [label, value] of rows) {
      if (value === undefined || value === null || value === '') continue;
      const wrapper = element('div');
      wrapper.append(element('dt', '', label), element('dd', '', Array.isArray(value) ? value.join(' · ') : value));
      list.append(wrapper);
    }
    return list;
  }

  function renderNode(item) {
    const entity = item.kind === 'apostle' && item.entity && typeof item.entity === 'object'
      ? item.entity
      : item;
    const name = entity.canonical_name || item.canonical_name || '이름 없음';
    const header = element('div', 'ontology-detail__head');
    const title = element('div');
    title.append(element('small', '', item.kind), element('h3', '', name));
    const badges = element('div', 'ontology-detail__badges');
    for (const value of [item.selection_state, item.status, entity.binding_state, entity.identity_authority]) {
      if (value) badges.append(badge(value));
    }
    header.append(title, badges);

    const rows = [
      ['public_id', item.public_id],
      ['position', item.position],
      ['현재 약어', entity.canonical_abbreviation],
      ['alias', entity.aliases],
      ['구조 그룹', item.structural_group],
      ['동사', item.verb],
      ['본문 정책', entity.body_policy || item.body_policy],
      ['내용 권위', entity.content_authority],
      ['정의', item.definition],
      ['범위', item.scope_note],
      ['정체성 규칙', item.identity_rule],
    ];
    detail.classList.remove('ontology-panel--empty', 'ontology-panel--conflict');
    detail.replaceChildren(header, definitionList(rows));
  }

  function renderPendingConflict(payload) {
    const header = element('div', 'ontology-detail__head');
    const title = element('div');
    title.append(element('small', '', `apostle #${payload.position}`), element('h3', '', '선택 미결'));
    header.append(title, badge('CONFLICT_PENDING', 'danger'));

    const notice = element('p', 'ontology-conflict-notice', '후보 중 어느 것도 기본값으로 제공하지 않습니다.');
    const candidates = element('div', 'ontology-candidates');
    for (const candidate of payload.candidates || []) {
      const card = element('article');
      card.append(
        element('strong', '', candidate.canonical_name || '후보'),
        badge(candidate.authority || 'UNKNOWN'),
        element('small', '', `${candidate.binding_state || ''} · default_servable=false`),
      );
      candidates.append(card);
    }
    detail.classList.remove('ontology-panel--empty');
    detail.classList.add('ontology-panel--conflict');
    detail.replaceChildren(header, notice, candidates);
  }

  function renderNeighbors(items) {
    if (!items.length) {
      setPanelMessage(neighbors, '정제된 1-hop 관계가 없습니다.');
      return;
    }
    const list = element('div', 'ontology-neighbor-list');
    for (const item of items) {
      const row = element('button', 'ontology-neighbor');
      row.type = 'button';
      row.addEventListener('click', () => loadNode(item.node.public_id));
      const relation = item.relationship || {};
      row.append(
        badge(item.direction === 'out' ? 'OUT →' : '← IN'),
        element('span', 'ontology-neighbor__predicate', relation.predicate || 'RELATED'),
        element('strong', '', summaryName(item.node)),
        element('small', '', item.node.kind || ''),
      );
      list.append(row);
    }
    neighbors.classList.remove('ontology-panel--empty');
    neighbors.replaceChildren(list);
  }

  async function loadNeighbors(publicId) {
    setPanelMessage(neighbors, '관계를 불러오는 중…');
    try {
      const body = await api(`/nodes/${encodeURIComponent(publicId)}/neighbors`, {
        direction: 'both',
        limit: 100,
      });
      renderNeighbors(body?.data?.items || []);
    } catch (error) {
      setPanelMessage(neighbors, error.message || '관계 조회 실패', 'error');
    }
  }

  async function loadNode(publicId) {
    if (!publicIdPattern.test(publicId)) {
      setPanelMessage(detail, '올바르지 않은 public_id입니다.', 'error');
      return;
    }
    setPanelMessage(detail, '노드를 불러오는 중…');
    setPanelMessage(neighbors, '관계를 기다리는 중…');
    try {
      const body = await api(`/nodes/${encodeURIComponent(publicId)}`);
      renderNode(body.data);
    } catch (error) {
      if (error instanceof OntologyApiError && error.statusCode === 409 && error.body?.error?.code === 'CONFLICT_PENDING') {
        renderPendingConflict(error.body.error.details || {});
      } else {
        setPanelMessage(detail, error.message || '노드 조회 실패', 'error');
      }
    }
    const current = new URL(window.location.href);
    current.searchParams.set('id', publicId);
    window.history.replaceState(null, '', `${current.pathname}${current.search}${current.hash}`);
    await loadNeighbors(publicId);
  }

  function renderSearch(items, append) {
    if (!append) searchResults.replaceChildren();
    if (!items.length && !append) {
      searchResults.append(element('p', 'ontology-search-results__empty', '검색 결과가 없습니다.'));
      return;
    }
    for (const item of items) searchResults.append(recordButton(item));
  }

  async function runSearch({ append = false } = {}) {
    const query = lastSearch?.query || searchInput.value.normalize('NFKC').trim();
    const kind = lastSearch?.kind ?? kindInput.value;
    if (query.length < 2) {
      searchResults.replaceChildren(element('p', 'ontology-search-results__error', '검색어는 2자 이상 입력하세요.'));
      return;
    }
    if (!append) {
      lastSearch = { query, kind };
      searchCursor = null;
      searchResults.replaceChildren(element('p', '', '검색 중…'));
    }
    searchMore.hidden = true;
    try {
      const body = await api('/search', {
        q: query,
        kind,
        limit: 20,
        cursor: append ? searchCursor : null,
      });
      renderSearch(body?.data?.items || [], append);
      searchCursor = body?.page?.next_cursor || null;
      searchMore.hidden = !searchCursor;
    } catch (error) {
      searchResults.replaceChildren(element('p', 'ontology-search-results__error', error.message || '검색 실패'));
    }
  }

  async function connect(candidateKey) {
    const normalizedKey = String(candidateKey || '');
    if (new TextEncoder().encode(normalizedKey).length < 32) {
      setStatus('내부 키는 32 bytes 이상이어야 합니다.', 'error');
      return;
    }
    activeKey = normalizedKey;
    setStatus('검증된 release를 확인하는 중…');
    try {
      const body = await api(`/releases/${encodeURIComponent(projectionId)}`);
      validatePinnedRelease(body);
      renderRelease(body.data, body.meta);
      writeSessionKey(activeKey);
      keyInput.value = '';
      workspace.hidden = false;
      disconnectButton.hidden = false;
      setStatus('내부 snapshot 연결됨', 'ok');
      const selectedId = new URL(window.location.href).searchParams.get('id');
      if (selectedId && publicIdPattern.test(selectedId)) await loadNode(selectedId);
    } catch (error) {
      activeKey = '';
      writeSessionKey('');
      workspace.hidden = true;
      disconnectButton.hidden = true;
      if (error instanceof OntologyApiError && error.statusCode === 401) {
        setStatus('키가 올바르지 않습니다.', 'error');
      } else if (error instanceof OntologyApiError && error.statusCode === 503) {
        setStatus('내부 ontology runtime이 비활성 상태입니다.', 'error');
      } else {
        setStatus(error.message || '내부 API에 연결할 수 없습니다.', 'error');
      }
    }
  }

  function disconnect() {
    activeKey = '';
    writeSessionKey('');
    keyInput.value = '';
    workspace.hidden = true;
    disconnectButton.hidden = true;
    setStatus('연결 해제됨');
    setPanelMessage(detail, '슬롯이나 검색 결과를 선택하세요.');
    setPanelMessage(neighbors, '선택한 노드의 정제 관계만 표시합니다.');
  }

  authForm.addEventListener('submit', (event) => {
    event.preventDefault();
    connect(keyInput.value);
  });
  disconnectButton.addEventListener('click', disconnect);
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    lastSearch = null;
    runSearch();
  });
  searchMore.addEventListener('click', () => runSearch({ append: true }));

  const restoredKey = readSessionKey();
  if (restoredKey) connect(restoredKey);
})();
