import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

class FakeElement {
  constructor(value = '') {
    this.value = value;
    this.checked = false;
    this.disabled = false;
    this.textContent = '';
    this.dataset = {};
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type, payload = {}) {
    for (const listener of this.listeners.get(type) || []) listener(payload);
  }

  click({ isTrusted = true } = {}) {
    this.emit('click', { isTrusted });
  }
}

function makeHarness({
  clock,
  cryptoImpl = webcrypto,
  emitProofOnStart = true,
  storageFailures = {},
  userActivation,
  workerStopPostThrows = false,
} = {}) {
  const selectors = {
    '#consent-purpose': new FakeElement(),
    '#consent-session': new FakeElement(),
    '#worker-count': new FakeElement('1'),
    '#worker-count-value': new FakeElement(),
    '#duty-cycle': new FakeElement('20'),
    '#duty-cycle-value': new FakeElement(),
    '#session-minutes': new FakeElement('10'),
    '#session-minutes-value': new FakeElement(),
    '#start-node': new FakeElement(),
    '#stop-node': new FakeElement(),
    '#download-receipt': new FakeElement(),
    '#node-state': new FakeElement(),
    '#active-workers': new FakeElement(),
    '#jobs-completed': new FakeElement(),
    '#compute-ms': new FakeElement(),
    '#receipt-output': new FakeElement(),
    '#compute-message': new FakeElement(),
  };
  const documentListeners = new Map();
  const windowListeners = new Map();
  const workers = [];
  const storage = new Map();
  const timers = [];
  const DateImpl = clock
    ? class extends Date {
      static now() {
        return clock.now;
      }
    }
    : Date;
  const navigatorObject = { hardwareConcurrency: 8 };
  if (userActivation !== undefined) navigatorObject.userActivation = userActivation;

  class FakeWorker {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.listeners = new Map();
      this.messages = [];
      this.terminated = false;
      workers.push(this);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage(message) {
      this.messages.push(message);
      if (message.type === 'stop' && workerStopPostThrows) {
        throw new Error('worker stop postMessage failed');
      }
      if (message.type === 'start' && emitProofOnStart) {
        queueMicrotask(() => this.listeners.get('message')?.({ data: { type: 'proof', compute_ms: 12 } }));
      }
    }

    emit(type, payload = {}) {
      this.listeners.get(type)?.(payload);
    }

    terminate() {
      this.terminated = true;
    }
  }

  const windowObject = {
    Worker: FakeWorker,
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
  };
  const documentObject = {
    hidden: false,
    querySelector: (selector) => selectors[selector] || null,
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    createElement: () => new FakeElement(),
  };
  const context = vm.createContext({
    Blob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    Worker: FakeWorker,
    clearTimeout: (timer) => {
      if (timer) timer.cleared = true;
    },
    console,
    crypto: cryptoImpl,
    Date: DateImpl,
    document: documentObject,
    navigator: navigatorObject,
    queueMicrotask,
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      removeItem: (key) => {
        if (storageFailures.removeItem) throw new Error('sessionStorage.removeItem denied');
        return storage.delete(key);
      },
      setItem: (key, value) => {
        if (storageFailures.setItem) throw new Error('sessionStorage.setItem denied');
        storage.set(key, value);
      },
    },
    setTimeout: (callback, delay) => {
      const timer = { callback, cleared: false, delay };
      timers.push(timer);
      return timer;
    },
    structuredClone,
    TextEncoder,
    window: windowObject,
  });
  return { context, documentListeners, documentObject, selectors, storage, timers, windowObject, workers };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

async function waitFor(predicate, maxTurns = 50) {
  if (predicate()) return;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    await settle();
    if (predicate()) return;
  }
  assert.fail(`condition was not met after ${maxTurns} event-loop turns`);
}

test('page load creates no worker and explicit consent gates start', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  const harness = makeHarness();
  vm.runInContext(source, harness.context);

  assert.equal(harness.workers.length, 0);
  assert.equal(harness.windowObject.__333Contributor.snapshot().status, 'visitor');
  assert.equal(harness.selectors['#start-node'].disabled, true);

  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  assert.equal(harness.selectors['#start-node'].disabled, true);

  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-session'].emit('change');
  assert.equal(harness.selectors['#start-node'].disabled, false);

  harness.selectors['#start-node'].click();
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');

  const active = harness.windowObject.__333Contributor.snapshot();
  assert.equal(active.status, 'active');
  assert.equal(active.active_workers, 1);
  assert.equal(harness.workers.length, 1);
  assert.equal(active.receipt.principal_action, 'trusted_user_activation_local_alpha');
  assert.equal(active.receipt.policy.workload_network_bytes_max, 0);
  assert.equal(active.receipt.policy.persistent_storage, false);
  assert.equal(active.receipt.policy.gpu, false);
  assert.equal(active.receipt.policy.hidden_tab_behavior, 'terminate');
  assert.match(harness.selectors['#compute-message'].textContent, /controller.*sessionStorage/);
});

test('synthetic clicks and inactive user activation cannot grant compute', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  const synthetic = makeHarness();
  vm.runInContext(source, synthetic.context);
  synthetic.selectors['#consent-purpose'].checked = true;
  synthetic.selectors['#consent-session'].checked = true;
  synthetic.selectors['#consent-purpose'].emit('change');
  synthetic.selectors['#consent-session'].emit('change');
  synthetic.selectors['#start-node'].emit('click', { isTrusted: false });
  await settle();

  const deniedSynthetic = synthetic.windowObject.__333Contributor.snapshot();
  assert.equal(deniedSynthetic.status, 'visitor');
  assert.equal(deniedSynthetic.active_workers, 0);
  assert.equal(deniedSynthetic.receipt, null);
  assert.equal(synthetic.workers.length, 0);

  const userActivation = { isActive: false };
  const inactive = makeHarness({ userActivation });
  vm.runInContext(source, inactive.context);
  inactive.selectors['#consent-purpose'].checked = true;
  inactive.selectors['#consent-session'].checked = true;
  inactive.selectors['#consent-purpose'].emit('change');
  inactive.selectors['#consent-session'].emit('change');
  inactive.selectors['#start-node'].click();
  await settle();
  assert.equal(inactive.workers.length, 0);
  assert.equal(inactive.windowObject.__333Contributor.snapshot().receipt, null);

  userActivation.isActive = true;
  inactive.selectors['#start-node'].click();
  await waitFor(() => inactive.windowObject.__333Contributor.snapshot().status === 'active');
  assert.equal(
    inactive.windowObject.__333Contributor.snapshot().receipt.principal_action,
    'trusted_user_activation_local_alpha',
  );
});

test('principal revoke and hidden tab terminate every worker', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  const harness = makeHarness();
  vm.runInContext(source, harness.context);
  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  harness.selectors['#consent-session'].emit('change');
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');

  harness.selectors['#stop-node'].click();
  const stopped = harness.windowObject.__333Contributor.snapshot();
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.active_workers, 0);
  assert.equal(harness.workers[0].terminated, true);
  assert.equal(stopped.receipt.stop_reason, 'principal_revoked');
  assert.equal(harness.storage.has('333:active-consent'), false);

  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  harness.selectors['#consent-session'].emit('change');
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');
  harness.documentObject.hidden = true;
  harness.documentListeners.get('visibilitychange')();
  const hidden = harness.windowObject.__333Contributor.snapshot();
  assert.equal(hidden.active_workers, 0);
  assert.equal(hidden.receipt.stop_reason, 'tab_hidden');
  assert.equal(harness.workers.at(-1).terminated, true);

  harness.documentObject.hidden = false;
  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  harness.selectors['#consent-session'].emit('change');
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');
  harness.selectors['#consent-purpose'].checked = false;
  harness.selectors['#consent-purpose'].emit('change');
  const withdrawn = harness.windowObject.__333Contributor.snapshot();
  assert.equal(withdrawn.status, 'stopped');
  assert.equal(withdrawn.active_workers, 0);
  assert.equal(withdrawn.receipt.stop_reason, 'principal_revoked');
  assert.equal(harness.workers.at(-1).terminated, true);
});

test('storage and stop-signal failures cannot strand state or prevent worker termination', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  const harness = makeHarness({
    emitProofOnStart: false,
    storageFailures: { removeItem: true, setItem: true },
    workerStopPostThrows: true,
  });
  vm.runInContext(source, harness.context);
  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  harness.selectors['#consent-session'].emit('change');
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');

  assert.equal(harness.workers.length, 1);
  harness.selectors['#stop-node'].click();
  const stopped = harness.windowObject.__333Contributor.snapshot();
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.active_workers, 0);
  assert.equal(stopped.receipt.state, 'revoked');
  assert.equal(stopped.receipt.stop_reason, 'principal_revoked');
  assert.equal(harness.workers[0].terminated, true);
  assert.equal(harness.timers[0].cleared, true);
});

test('hiding the tab while a grant is being prepared starts no worker', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  const harness = makeHarness();
  vm.runInContext(source, harness.context);
  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  harness.selectors['#consent-session'].emit('change');

  harness.selectors['#start-node'].click();
  harness.documentObject.hidden = true;
  harness.documentListeners.get('visibilitychange')();
  await settle();
  await settle();

  const stopped = harness.windowObject.__333Contributor.snapshot();
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.active_workers, 0);
  assert.equal(harness.workers.length, 0);
});

test('withdrawing a checkbox while policy digest is pending aborts the grant', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  let resolveDigest;
  const digest = new Promise((resolve) => {
    resolveDigest = resolve;
  });
  const harness = makeHarness({
    cryptoImpl: {
      randomUUID: () => webcrypto.randomUUID(),
      subtle: { digest: () => digest },
    },
  });
  vm.runInContext(source, harness.context);
  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  harness.selectors['#consent-session'].emit('change');

  harness.selectors['#start-node'].click();
  assert.equal(harness.windowObject.__333Contributor.snapshot().status, 'granting');
  harness.selectors['#consent-session'].checked = false;
  resolveDigest(new Uint8Array(32).buffer);
  await settle();
  await settle();

  const stopped = harness.windowObject.__333Contributor.snapshot();
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.active_workers, 0);
  assert.equal(stopped.receipt, null);
  assert.equal(harness.workers.length, 0);
  assert.equal(harness.storage.has('333:active-consent'), false);
});

test('digest latency is deducted from TTL and expired grants create no worker', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  const clock = { now: 10_000 };
  let resolveDigest;
  const digest = new Promise((resolve) => {
    resolveDigest = resolve;
  });
  const harness = makeHarness({
    clock,
    cryptoImpl: {
      randomUUID: () => webcrypto.randomUUID(),
      subtle: { digest: () => digest },
    },
    emitProofOnStart: false,
  });
  vm.runInContext(source, harness.context);
  harness.selectors['#session-minutes'].value = '1';
  harness.selectors['#consent-purpose'].checked = true;
  harness.selectors['#consent-session'].checked = true;
  harness.selectors['#consent-purpose'].emit('change');
  harness.selectors['#consent-session'].emit('change');
  harness.selectors['#start-node'].click();
  clock.now = 25_000;
  resolveDigest(new Uint8Array(32).buffer);
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');

  assert.equal(harness.timers.length, 1);
  assert.equal(harness.timers[0].delay, 45_000);
  assert.equal(
    harness.windowObject.__333Contributor.snapshot().receipt.policy.expires_at,
    new Date(70_000).toISOString(),
  );

  const expiredClock = { now: 100_000 };
  let resolveExpiredDigest;
  const expiredDigest = new Promise((resolve) => {
    resolveExpiredDigest = resolve;
  });
  const expiredHarness = makeHarness({
    clock: expiredClock,
    cryptoImpl: {
      randomUUID: () => webcrypto.randomUUID(),
      subtle: { digest: () => expiredDigest },
    },
    emitProofOnStart: false,
  });
  vm.runInContext(source, expiredHarness.context);
  expiredHarness.selectors['#session-minutes'].value = '1';
  expiredHarness.selectors['#consent-purpose'].checked = true;
  expiredHarness.selectors['#consent-session'].checked = true;
  expiredHarness.selectors['#consent-purpose'].emit('change');
  expiredHarness.selectors['#consent-session'].emit('change');
  expiredHarness.selectors['#start-node'].click();
  expiredClock.now = 160_001;
  resolveExpiredDigest(new Uint8Array(32).buffer);
  await settle();
  await settle();

  const expired = expiredHarness.windowObject.__333Contributor.snapshot();
  assert.equal(expired.status, 'expired');
  assert.equal(expired.active_workers, 0);
  assert.equal(expired.receipt, null);
  assert.equal(expiredHarness.workers.length, 0);
  assert.equal(expiredHarness.timers.length, 0);
});

test('aborting a regrant cannot reuse or mutate the previous run receipt', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  let resolveRegrantDigest;
  const regrantDigest = new Promise((resolve) => {
    resolveRegrantDigest = resolve;
  });
  let digestCalls = 0;
  const harness = makeHarness({
    cryptoImpl: {
      randomUUID: () => webcrypto.randomUUID(),
      subtle: {
        digest: () => {
          digestCalls += 1;
          return digestCalls === 1
            ? Promise.resolve(new Uint8Array(32).buffer)
            : regrantDigest;
        },
      },
    },
    emitProofOnStart: false,
  });
  vm.runInContext(source, harness.context);
  const purpose = harness.selectors['#consent-purpose'];
  const session = harness.selectors['#consent-session'];
  purpose.checked = true;
  session.checked = true;
  purpose.emit('change');
  session.emit('change');
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');

  harness.selectors['#stop-node'].click();
  const previousReceipt = harness.storage.get('333:last-receipt');
  assert.ok(previousReceipt);
  assert.equal(JSON.parse(previousReceipt).state, 'revoked');

  purpose.checked = true;
  session.checked = true;
  purpose.emit('change');
  session.emit('change');
  harness.selectors['#start-node'].click();
  const granting = harness.windowObject.__333Contributor.snapshot();
  assert.equal(granting.status, 'granting');
  assert.equal(granting.receipt, null);
  assert.equal(granting.jobs_completed, 0);
  assert.equal(granting.compute_ms, 0);

  session.checked = false;
  resolveRegrantDigest(new Uint8Array(32).buffer);
  await settle();
  await settle();

  const aborted = harness.windowObject.__333Contributor.snapshot();
  assert.equal(aborted.status, 'stopped');
  assert.equal(aborted.receipt, null);
  assert.equal(harness.storage.get('333:last-receipt'), previousReceipt);
  assert.equal(harness.storage.has('333:active-consent'), false);
});

test('late proof and error from an old worker cannot mutate or stop a new run', async () => {
  const source = await readFile(new URL('../public/js/333-contributor.js', import.meta.url), 'utf8');
  const harness = makeHarness({ emitProofOnStart: false });
  vm.runInContext(source, harness.context);
  const purpose = harness.selectors['#consent-purpose'];
  const session = harness.selectors['#consent-session'];
  purpose.checked = true;
  session.checked = true;
  purpose.emit('change');
  session.emit('change');
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');

  const oldWorker = harness.workers[0];
  harness.selectors['#stop-node'].click();
  purpose.checked = true;
  session.checked = true;
  purpose.emit('change');
  session.emit('change');
  harness.selectors['#start-node'].click();
  await waitFor(() => harness.windowObject.__333Contributor.snapshot().status === 'active');

  const newWorker = harness.workers[1];
  const newConsentId = harness.windowObject.__333Contributor.snapshot().receipt.consent_id;
  oldWorker.emit('message', { data: { type: 'proof', compute_ms: 999 } });
  oldWorker.emit('error', new Error('late old-worker failure'));

  const unchanged = harness.windowObject.__333Contributor.snapshot();
  assert.equal(unchanged.status, 'active');
  assert.equal(unchanged.active_workers, 1);
  assert.equal(unchanged.jobs_completed, 0);
  assert.equal(unchanged.compute_ms, 0);
  assert.equal(unchanged.receipt.consent_id, newConsentId);
  assert.deepEqual(unchanged.receipt.usage, {
    jobs_completed: 0,
    compute_ms: 0,
    workload_network_bytes_reported: 0,
  });
  assert.equal(newWorker.terminated, false);
  assert.equal(harness.storage.has('333:active-consent'), true);

  newWorker.emit('message', { data: { type: 'proof', compute_ms: 7 } });
  const updated = harness.windowObject.__333Contributor.snapshot();
  assert.equal(updated.jobs_completed, 1);
  assert.equal(updated.compute_ms, 7);
});

test('public discovery denies autonomous compute and install', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/.well-known/333-compute.json', import.meta.url), 'utf8'));
  assert.equal(manifest.protocol.kind, 'custom-discovery-only');
  assert.equal(manifest.protocol.a2a_endpoint_available, false);
  assert.equal(manifest.protocol.enrollment_api_available, false);
  assert.equal(manifest.discovery.may_start_worker, false);
  assert.equal(manifest.discovery.may_open_p2p_transport, false);
  assert.equal(manifest.discovery.may_install_software, false);
  assert.equal(manifest.enrollment.resource_grant_required, true);
  assert.ok(manifest.enrollment.agent_may_not.includes('grant_consent'));
  assert.ok(manifest.enrollment.agent_may_not.includes('install_native_node'));
  assert.equal(manifest.compensation.enabled, false);
});

test('worker workload has no network or persistence primitive', async () => {
  const source = await readFile(new URL('../public/js/333-compute-worker.js', import.meta.url), 'utf8');
  const forbiddenPrimitives = [
    'fetch(',
    'self.fetch',
    'XMLHttpRequest',
    'EventSource',
    'WebSocket',
    'RTCPeerConnection',
    'importScripts',
    'sendBeacon',
    'indexedDB',
    'caches.open',
  ];
  for (const forbidden of forbiddenPrimitives) {
    assert.equal(source.includes(forbidden), false, `forbidden worker primitive: ${forbidden}`);
  }
});
