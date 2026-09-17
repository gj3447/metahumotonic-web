import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function assertSupportedNode(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match || Number(match[1]) < 22 || (Number(match[1]) === 22 && Number(match[2]) < 12)) {
    throw new Error(`Node >=22.12.0 required; got ${version}. Use the development user's Node from .node-version, not the system administrator's default PATH.`);
  }
}

// Pagefind/Rayon otherwise size their pools from the host, not the PID budget.
export function buildEnvironment(parent) {
  return { ...parent, RAYON_NUM_THREADS: '2', TOKIO_WORKER_THREADS: '2', ASTRO_TELEMETRY_DISABLED: '1' };
}

export function main() {
  assertSupportedNode(process.versions.node);
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve('astro/package.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const binary = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.astro;
  const env = buildEnvironment(process.env);
  for (const args of [[resolve(dirname(packagePath), binary), 'build'], ['scripts/build/assemble-site.mjs']]) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
