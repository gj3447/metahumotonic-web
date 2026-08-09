import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

class FakeElement {
  constructor() {
    this.dataset = {};
    this.elements = { slug: new FakeElementStub() };
    this.hidden = false;
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
  }

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  querySelector() { return new FakeElementStub(); }
  querySelectorAll() { return []; }
  append() {}
  replaceChildren() {}
  setAttribute() {}
}

class FakeElementStub {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this.value = '';
  }

  addEventListener(type, listener) { this.listeners ??= new Map(); this.listeners.set(type, listener); }
  append(...children) { this.children.push(...children); }
  focus() {}
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute() {}
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    async json() { return payload; },
  };
}

async function harness(responses, options = {}) {
  let source = await readFile(new URL('../public/js/wiki-community.js', import.meta.url), 'utf8');
  source = source.replace(
    '  loadList();\n  if (initialSlug) loadPage(initialSlug);',
    '  globalThis.__wikiTest = { api, conflictKind, responseErrorCode, mergeRecentPages, uniquePagesBySlug, preparePageItems, makePageButton, runCreateAction, editorReturnFocusTarget, runListCommand, scheduleSearch, loadList, loadPage, showPage, loadHistory, state, elements };\n  if (initialSlug) loadPage(initialSlug);',
  );
  const calls = [];
  const root = new FakeElement();
  root.dataset.apiBase = '/api/wiki/v1';
  const context = vm.createContext({
    AbortController,
    FormData,
    Headers,
    URL,
    URLSearchParams,
    console,
    crypto: webcrypto,
    document: {
      activeElement: options.activeElement || null,
      addEventListener() {},
      createElement: () => new FakeElementStub(),
      querySelector: () => root,
    },
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      const response = responses.shift();
      assert.ok(response, `unexpected fetch ${url}`);
      return response;
    },
    history: { replaceState() {} },
    setTimeout,
    clearTimeout,
    window: {
      location: { origin: 'https://metahumotonic.com', href: 'https://metahumotonic.com/wiki/community/', search: '', pathname: '/wiki/community/' },
      matchMedia: () => ({ matches: Boolean(options.drawerMatches), addEventListener() {} }),
    },
  });
  context.window.window = context.window;
  vm.runInContext(source, context);
  return {
    api: context.__wikiTest.api,
    calls,
    classify: context.__wikiTest.conflictKind,
    mergeRecentPages: context.__wikiTest.mergeRecentPages,
    uniquePagesBySlug: context.__wikiTest.uniquePagesBySlug,
    preparePageItems: context.__wikiTest.preparePageItems,
    makePageButton: context.__wikiTest.makePageButton,
    runCreateAction: context.__wikiTest.runCreateAction,
    editorReturnFocusTarget: context.__wikiTest.editorReturnFocusTarget,
    runListCommand: context.__wikiTest.runListCommand,
    scheduleSearch: context.__wikiTest.scheduleSearch,
    loadList: context.__wikiTest.loadList,
    loadPage: context.__wikiTest.loadPage,
    showPage: context.__wikiTest.showPage,
    loadHistory: context.__wikiTest.loadHistory,
    state: context.__wikiTest.state,
    elements: context.__wikiTest.elements,
  };
}

test('expired browser session is reissued once with identical intent envelope', async () => {
  const body = { slug: 'draft', title: 'Draft', content: 'preserve me' };
  const responses = [
    jsonResponse(201, { csrf_token: 'csrf-old', actor_id: 'anonymous:old' }),
    jsonResponse(401, { detail: { code: 'invalid_session', message: 'expired' } }),
    jsonResponse(201, { csrf_token: 'csrf-new', actor_id: 'anonymous:new' }),
    jsonResponse(201, { command_id: 'accepted' }),
  ];
  const { api, calls } = await harness(responses);

  assert.deepEqual(await api('/pages', { method: 'POST', body }), { command_id: 'accepted' });
  const mutations = calls.filter((call) => call.url.endsWith('/pages'));
  assert.equal(mutations.length, 2);
  assert.equal(mutations[0].options.body, JSON.stringify(body));
  assert.equal(mutations[1].options.body, JSON.stringify(body));
  assert.equal(
    mutations[0].options.headers.get('Idempotency-Key'),
    mutations[1].options.headers.get('Idempotency-Key'),
  );
  assert.equal(mutations[0].options.headers.get('X-CSRF-Token'), 'csrf-old');
  assert.equal(mutations[1].options.headers.get('X-CSRF-Token'), 'csrf-new');
});

test('session rejection retries only once', async () => {
  const responses = [
    jsonResponse(201, { csrf_token: 'csrf-one', actor_id: 'anonymous:one' }),
    jsonResponse(401, { detail: { code: 'session_required' } }),
    jsonResponse(201, { csrf_token: 'csrf-two', actor_id: 'anonymous:two' }),
    jsonResponse(401, { detail: { code: 'invalid_session' } }),
  ];
  const { api, calls } = await harness(responses);

  await assert.rejects(api('/pages', { method: 'POST', body: { content: 'draft' } }), /invalid_session/);
  assert.equal(calls.filter((call) => call.url.endsWith('/pages')).length, 2);
});

test('only revision_conflict enters the CAS conflict class', async () => {
  const { classify } = await harness([]);
  const error = (code) => ({ status: 409, payload: { detail: { code } } });

  assert.equal(classify(error('revision_conflict')), 'revision_conflict');
  assert.equal(classify(error('slug_taken')), 'slug_taken');
  assert.equal(classify(error('idempotency_conflict')), 'idempotency_conflict');
  assert.equal(classify(error('other_conflict')), '');
  assert.equal(classify({ status: 422, payload: { detail: { code: 'revision_conflict' } } }), '');
});

test('recent navigation keeps newest metadata, de-duplicates slugs, and stays bounded', async () => {
  const { mergeRecentPages, uniquePagesBySlug } = await harness([]);
  const previous = [
    { slug: 'alpha', title: 'Old alpha' },
    { slug: 'beta', title: 'Beta' },
  ];
  const merged = mergeRecentPages(previous, { slug: 'alpha', title: 'New alpha', updatedAt: '2026-08-09T00:00:00Z' }, 2);

  assert.equal(merged.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(merged[0])), {
    slug: 'alpha',
    title: 'New alpha',
    updatedAt: '2026-08-09T00:00:00Z',
  });
  assert.equal(merged[1].slug, 'beta');

  const deduplicated = uniquePagesBySlug([
    { slug: 'alpha', title: 'Newest' },
    { page_slug: 'alpha', title: 'Older revision' },
    { slug: 'beta', title: 'Beta' },
  ]);
  assert.deepEqual(Array.from(deduplicated, (page) => page.title), ['Newest', 'Beta']);
});

test('an explicit search cancels its pending debounce and coalesces the same in-flight query', async () => {
  const wiki = await harness([jsonResponse(200, { items: [] })]);
  wiki.elements.search.value = 'alpha';
  wiki.scheduleSearch();

  const first = wiki.runListCommand(() => wiki.loadList('alpha'));
  const duplicate = wiki.runListCommand(() => wiki.loadList('alpha'));
  await Promise.all([first, duplicate]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(wiki.calls.length, 1);
  assert.equal(new URL(wiki.calls[0].url).searchParams.get('q'), 'alpha');
});

test('mobile create closes navigation before moving focus into the editor and returns to the visible toggle', async () => {
  const { runCreateAction, editorReturnFocusTarget, elements } = await harness([], { drawerMatches: true });
  const order = [];
  const returnTarget = editorReturnFocusTarget();

  runCreateAction(
    (open, returnFocus) => order.push(`navigation:${open}:${returnFocus}`),
    (mode, target) => order.push(`editor:${mode}:${target === elements.drawerToggle}`),
    returnTarget,
  );

  assert.equal(returnTarget, elements.drawerToggle);
  assert.deepEqual(order, ['navigation:false:false', 'editor:create:true']);

  const desktopButton = new FakeElementStub();
  const desktop = await harness([], { activeElement: desktopButton });
  assert.equal(desktop.editorReturnFocusTarget(), desktopButton);
});

test('a stale history response cannot overwrite the active page history', async () => {
  let resolveAlpha;
  let resolveBeta;
  const alpha = new Promise((resolve) => { resolveAlpha = resolve; });
  const beta = new Promise((resolve) => { resolveBeta = resolve; });
  const wiki = await harness([alpha, beta]);

  wiki.state.page = { slug: 'alpha', revisionId: 'alpha-head' };
  const alphaRequest = wiki.loadHistory();
  wiki.state.page = { slug: 'beta', revisionId: 'beta-head' };
  const betaRequest = wiki.loadHistory();

  resolveBeta(jsonResponse(200, { items: [{ revision_id: 'beta-r1', edit_summary: 'Beta history' }] }));
  await betaRequest;
  assert.equal(wiki.elements.historyList.children[0].children[0].children[0].textContent, 'Beta history');

  resolveAlpha(jsonResponse(200, { items: [{ revision_id: 'alpha-r1', edit_summary: 'Alpha history' }] }));
  await alphaRequest;
  assert.equal(wiki.elements.historyList.children[0].children[0].children[0].textContent, 'Beta history');
});

test('a direct committed page invalidates an older pending page read', async () => {
  let resolveBeta;
  const beta = new Promise((resolve) => { resolveBeta = resolve; });
  const wiki = await harness([beta]);

  const pendingRead = wiki.loadPage('beta');
  wiki.showPage({
    slug: 'alpha',
    title: 'Alpha saved',
    content: 'new content',
    sanitizedHtml: '<p>new content</p>',
    revisionId: 'alpha-new',
    publication: 'unreviewed',
  });
  resolveBeta(jsonResponse(200, {
    slug: 'beta',
    title: 'Beta stale',
    content: 'old content',
    sanitized_html: '<p>old content</p>',
    head_revision_id: 'beta-old',
    publication_state: 'unreviewed',
  }));
  await pendingRead;

  assert.equal(wiki.state.page.slug, 'alpha');
  assert.equal(wiki.state.page.revisionId, 'alpha-new');
});

test('recent changes preserve same-page events while ordinary page results deduplicate', async () => {
  const { preparePageItems, makePageButton } = await harness([]);
  const events = [
    { slug: 'alpha', title: 'Alpha', revision_id: 'rev-2', edit_summary: '둘째 변경', updated_at: '2026-08-09T01:00:00Z' },
    { slug: 'alpha', title: 'Alpha', revision_id: 'rev-1', edit_summary: '첫 변경', updated_at: '2026-08-09T00:00:00Z' },
  ];

  assert.equal(preparePageItems(events, false).length, 2);
  assert.equal(preparePageItems(events, true).length, 1);
  const button = makePageButton(events[0], { meta: 'change' });
  assert.match(button.children[1].textContent, /둘째 변경/);
  assert.match(button.children[1].textContent, /revision rev-2/);
  assert.match(button.children[1].textContent, /2026/);
});

test('public-beta community shell has accessible dynamic navigation and remains noindex', async () => {
  const page = await readFile(new URL('../src/pages/wiki/community/index.astro', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/css/wiki-community.css', import.meta.url), 'utf8');
  const config = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');

  assert.match(page, /noindex,nofollow,noarchive/);
  assert.match(page, /id="community-navigation"/);
  assert.match(page, /aria-controls="community-navigation"/);
  assert.match(page, /aria-expanded="false"/);
  assert.match(page, /data-current-page/);
  assert.match(page, /data-recent-list/);
  assert.match(page, /data-document-panel[^>]+tabindex="-1"/);
  assert.match(page, /data-history-panel[^>]+tabindex="-1"/);
  assert.match(page, /data-action="create"/);
  assert.ok(page.indexOf('id="community-search"') > page.indexOf('data-navigation-drawer'));
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /--cw-focus:/);
  assert.doesNotMatch(css, /font:\s*700\s+\.72rem\/1\.3\s+inherit/);
  assert.match(config, /wiki\/community\//);
  assert.match(config, /filter:\s*\(page\)\s*=>\s*!page\.startsWith/);
});
