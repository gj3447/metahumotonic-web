(() => {
  'use strict';

  const DISCLOSURE_VERSION = '333-browser-resource-grant/v1';
  const MAX_WORKERS = 4;
  const state = {
    status: 'visitor',
    workers: [],
    receipt: null,
    jobsCompleted: 0,
    computeMs: 0,
    expiresTimer: null,
    runGeneration: 0,
  };

  const el = {
    purpose: document.querySelector('#consent-purpose'),
    session: document.querySelector('#consent-session'),
    workerCount: document.querySelector('#worker-count'),
    workerCountValue: document.querySelector('#worker-count-value'),
    dutyCycle: document.querySelector('#duty-cycle'),
    dutyCycleValue: document.querySelector('#duty-cycle-value'),
    sessionMinutes: document.querySelector('#session-minutes'),
    sessionMinutesValue: document.querySelector('#session-minutes-value'),
    start: document.querySelector('#start-node'),
    stop: document.querySelector('#stop-node'),
    download: document.querySelector('#download-receipt'),
    nodeState: document.querySelector('#node-state'),
    activeWorkers: document.querySelector('#active-workers'),
    jobsCompleted: document.querySelector('#jobs-completed'),
    computeMs: document.querySelector('#compute-ms'),
    receipt: document.querySelector('#receipt-output'),
    message: document.querySelector('#compute-message'),
  };

  if (Object.values(el).some((value) => !value)) return;

  const hardwareCap = Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) * 0.25));
  el.workerCount.max = String(Math.min(MAX_WORKERS, hardwareCap));
  el.workerCount.value = '1';

  const iso = (value) => new Date(value).toISOString();
  const snapshot = () => ({
    status: state.status,
    active_workers: state.workers.length,
    jobs_completed: state.jobsCompleted,
    compute_ms: Math.round(state.computeMs),
    receipt: state.receipt ? structuredClone(state.receipt) : null,
  });

  function render() {
    el.nodeState.textContent = state.status.toUpperCase();
    el.nodeState.dataset.state = state.status;
    el.activeWorkers.textContent = String(state.workers.length);
    el.jobsCompleted.textContent = String(state.jobsCompleted);
    el.computeMs.textContent = String(Math.round(state.computeMs));
    el.receipt.textContent = JSON.stringify(state.receipt || {
      state: 'no_grant',
      workers_created: 0,
      workload_network_bytes_reported: 0,
    }, null, 2);
    el.start.disabled = ['granting', 'active'].includes(state.status) || !(el.purpose.checked && el.session.checked);
    el.stop.disabled = state.status !== 'active';
    el.download.disabled = !state.receipt;
  }

  function updateLabels() {
    el.workerCountValue.textContent = el.workerCount.value;
    el.dutyCycleValue.textContent = `${el.dutyCycle.value}%`;
    el.sessionMinutesValue.textContent = `${el.sessionMinutes.value} min`;
  }

  async function digestPolicy(policy) {
    const bytes = new TextEncoder().encode(JSON.stringify(policy));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function bestEffortSessionStorage(action) {
    try {
      action();
    } catch {
      // Receipt persistence is a controller-local log and must never control execution safety.
    }
  }

  function stop(reason = 'principal_revoked') {
    state.runGeneration += 1;
    if (state.expiresTimer) clearTimeout(state.expiresTimer);
    state.expiresTimer = null;
    for (const worker of state.workers) {
      try {
        worker.postMessage({ type: 'stop' });
      } catch {
        // A cooperative stop signal is best effort; termination remains authoritative.
      } finally {
        try {
          worker.terminate();
        } catch {
          // Continue terminating the remaining workers and complete the state transition.
        }
      }
    }
    state.workers = [];
    if (state.receipt) {
      state.receipt.state = reason === 'ttl_expired' ? 'expired' : 'revoked';
      state.receipt.stopped_at = iso(Date.now());
      state.receipt.stop_reason = reason;
      state.receipt.usage = {
        jobs_completed: state.jobsCompleted,
        compute_ms: Math.round(state.computeMs),
        workload_network_bytes_reported: 0,
      };
      bestEffortSessionStorage(() => sessionStorage.setItem('333:last-receipt', JSON.stringify(state.receipt)));
    }
    bestEffortSessionStorage(() => sessionStorage.removeItem('333:active-consent'));
    state.status = reason === 'ttl_expired' ? 'expired' : 'stopped';
    el.purpose.checked = false;
    el.session.checked = false;
    el.message.textContent = reason === 'tab_hidden'
      ? '탭이 숨겨져 모든 Worker를 종료했습니다. 다시 시작하려면 새 동의가 필요합니다.'
      : 'ResourceGrant가 철회되어 모든 Worker를 종료했습니다.';
    render();
  }

  async function start(event) {
    if (!event?.isTrusted) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    if (!(el.purpose.checked && el.session.checked) || ['granting', 'active'].includes(state.status)) return;
    state.receipt = null;
    state.jobsCompleted = 0;
    state.computeMs = 0;
    state.status = 'granting';
    const generation = ++state.runGeneration;
    el.message.textContent = 'ResourceGrant 정책을 고정하고 있습니다.';
    render();
    if (!('Worker' in window) || typeof crypto === 'undefined' || !crypto.subtle) {
      state.status = 'unsupported';
      el.message.textContent = '이 브라우저는 필요한 Worker 또는 Web Crypto 기능을 지원하지 않습니다.';
      render();
      return;
    }

    const now = Date.now();
    const workers = Math.min(Number(el.workerCount.value), hardwareCap, MAX_WORKERS);
    const dutyCycle = Number(el.dutyCycle.value);
    const ttlMs = Number(el.sessionMinutes.value) * 60_000;
    const expiresAt = now + ttlMs;
    const policy = {
      disclosure_version: DISCLOSURE_VERSION,
      runtime: 'browser_foreground_session',
      purpose: 'local_deterministic_integer_transform_proof',
      workers,
      duty_cycle_percent: dutyCycle,
      memory_mib_per_job: 128,
      workload_network_bytes_max: 0,
      persistent_storage: false,
      gpu: false,
      hidden_tab_behavior: 'terminate',
      reward: 'none_prototype',
      expires_at: iso(expiresAt),
    };
    let policyHash;
    try {
      policyHash = await digestPolicy(policy);
    } catch (error) {
      if (generation !== state.runGeneration) return;
      state.status = 'unsupported';
      el.message.textContent = `ResourceGrant 해시 생성 실패: ${error instanceof Error ? error.message : String(error)}`;
      render();
      return;
    }
    if (generation !== state.runGeneration || state.status !== 'granting') return;
    if (!(el.purpose.checked && el.session.checked)) {
      stop('principal_revoked');
      return;
    }
    if (document.hidden) {
      stop('tab_hidden');
      return;
    }
    const remainingTtlMs = expiresAt - Date.now();
    if (remainingTtlMs <= 0) {
      stop('ttl_expired');
      return;
    }
    state.receipt = {
      schema: '333.consent-receipt/v1',
      consent_id: crypto.randomUUID(),
      state: 'active',
      granted_at: iso(now),
      principal_action: 'trusted_user_activation_local_alpha',
      policy,
      policy_sha256: policyHash,
      usage: { jobs_completed: 0, compute_ms: 0, workload_network_bytes_reported: 0 },
    };
    state.status = 'active';
    bestEffortSessionStorage(() => sessionStorage.setItem('333:active-consent', JSON.stringify(state.receipt)));
    state.expiresTimer = setTimeout(() => {
      if (generation === state.runGeneration) stop('ttl_expired');
    }, remainingTtlMs);

    try {
      for (let index = 0; index < workers; index += 1) {
        const worker = new Worker('/js/333-compute-worker.js', { name: `333-session-${index}` });
        worker.addEventListener('message', (event) => {
          if (generation !== state.runGeneration || state.status !== 'active') return;
          if (event.data?.type !== 'proof') return;
          state.jobsCompleted += 1;
          state.computeMs += Number(event.data.compute_ms || 0);
          state.receipt.usage = {
            jobs_completed: state.jobsCompleted,
            compute_ms: Math.round(state.computeMs),
            workload_network_bytes_reported: 0,
          };
          render();
        });
        worker.addEventListener('error', () => {
          if (generation !== state.runGeneration || state.status !== 'active') return;
          stop('worker_error');
        });
        state.workers.push(worker);
        worker.postMessage({ type: 'start', duty_cycle_percent: dutyCycle, chunk_ms: 120, seed: index + 1 });
      }
    } catch (error) {
      stop('worker_start_failed');
      el.message.textContent = `Worker 시작 실패: ${error instanceof Error ? error.message : String(error)}`;
      return;
    }

    el.message.textContent = 'workload 코드에는 네트워크·영구 저장소 primitive가 없으며 GPU를 사용하지 않습니다. controller는 영수증 로그에 sessionStorage를 사용할 수 있습니다.';
    render();
  }

  function downloadReceipt() {
    if (!state.receipt) return;
    const blob = new Blob([JSON.stringify(state.receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `333-receipt-${state.receipt.consent_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleConsentChange() {
    if (!(el.purpose.checked && el.session.checked) && ['granting', 'active'].includes(state.status)) {
      stop('principal_revoked');
      return;
    }
    render();
  }

  for (const input of [el.purpose, el.session]) input.addEventListener('change', handleConsentChange);
  for (const input of [el.workerCount, el.dutyCycle, el.sessionMinutes]) input.addEventListener('input', updateLabels);
  el.start.addEventListener('click', start);
  el.stop.addEventListener('click', () => stop('principal_revoked'));
  el.download.addEventListener('click', downloadReceipt);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['granting', 'active'].includes(state.status)) stop('tab_hidden');
  });
  window.addEventListener('pagehide', () => {
    if (['granting', 'active'].includes(state.status)) stop('page_closed');
  });

  window.__333Contributor = Object.freeze({ snapshot, stop });
  updateLabels();
  render();
})();
