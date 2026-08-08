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
}

class FakeElementStub {
  constructor() {
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this.value = '';
  }

  addEventListener() {}
  focus() {}
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    async json() { return payload; },
  };
}

async function harness(responses) {
  let source = await readFile(new URL('../public/js/wiki-community.js', import.meta.url), 'utf8');
  source = source.replace(
    '  loadList();\n  if (initialSlug) loadPage(initialSlug);',
    '  globalThis.__wikiTest = { api, conflictKind, responseErrorCode };\n  if (initialSlug) loadPage(initialSlug);',
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
    },
  });
  context.window.window = context.window;
  vm.runInContext(source, context);
  return { api: context.__wikiTest.api, calls, classify: context.__wikiTest.conflictKind };
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

test('public-beta community shell is noindex and excluded from the sitemap config', async () => {
  const page = await readFile(new URL('../src/pages/wiki/community/index.astro', import.meta.url), 'utf8');
  const config = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');

  assert.match(page, /noindex,nofollow,noarchive/);
  assert.match(config, /wiki\/community\//);
  assert.match(config, /filter:\s*\(page\)\s*=>\s*!page\.startsWith/);
});
