import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSupportedNode, buildEnvironment } from '../scripts/build/build-site.mjs';
for (const version of ['20.19.2', '22.11.0', 'invalid']) {
  test(`unsupported runtime ${version} fails before build`, () => assert.throws(() => assertSupportedNode(version), /Node >=22.12.0 required/));
}
for (const version of ['22.12.0', '24.20.0']) {
  test(`supported runtime ${version}`, () => assert.doesNotThrow(() => assertSupportedNode(version)));
}
test('build pools are bounded without mutating parent environment', () => {
  const parent = Object.freeze({ PATH: '/example', RAYON_NUM_THREADS: '128' });
  const env = buildEnvironment(parent);
  assert.equal(parent.RAYON_NUM_THREADS, '128');
  assert.equal(env.RAYON_NUM_THREADS, '2');
  assert.equal(env.TOKIO_WORKER_THREADS, '2');
  assert.equal(env.PATH, parent.PATH);
});
