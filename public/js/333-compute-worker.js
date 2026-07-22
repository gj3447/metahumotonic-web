/* 333 browser alpha: deterministic local proof workload, no network or persistence. */
'use strict';

let running = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function proofChunk(seed, chunkMs) {
  const started = performance.now();
  let value = (seed >>> 0) || 1;
  let iterations = 0;
  while (performance.now() - started < chunkMs) {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    iterations += 1;
  }
  return { value, iterations, compute_ms: performance.now() - started };
}

async function run({ duty_cycle_percent: duty, chunk_ms: chunkMs, seed }) {
  running = true;
  let nextSeed = seed;
  const boundedDuty = Math.max(10, Math.min(50, Number(duty) || 20));
  const boundedChunk = Math.max(50, Math.min(250, Number(chunkMs) || 120));
  while (running) {
    const result = proofChunk(nextSeed, boundedChunk);
    nextSeed = result.value;
    self.postMessage({ type: 'proof', ...result });
    const yieldMs = boundedChunk * ((100 - boundedDuty) / boundedDuty);
    await wait(yieldMs);
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'start' && !running) run(event.data);
  if (event.data?.type === 'stop') running = false;
});
