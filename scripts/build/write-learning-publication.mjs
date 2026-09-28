import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Deterministic artifact identity, independently checked by the Python verifier.
// No timestamp or self-reported PASS status belongs in this publication manifest.
const root = resolve('dist');
const paths = ['index.html', 'learn/index.html', 'learn/data.json', 'learn/graph.jsonld', 'learn/usl.json'];
const files = {};
for (const path of paths) {
  const content = await readFile(resolve(root, path));
  if (!content.length || content.length > 3 * 1024 * 1024) throw new Error(`invalid public artifact size: ${path}`);
  files[path] = createHash('sha256').update(content).digest('hex');
}
const catalog = JSON.parse(await readFile(resolve(root, 'learn/data.json'), 'utf8'));
if (!/^sha256:[a-f0-9]{64}$/.test(catalog.sourceDigest)) throw new Error('missing publication source identity');
await writeFile(resolve(root, 'learn/publication.json'), JSON.stringify({
  schema: 'metahumotonic/hub-publication@1', sourceDigest: catalog.sourceDigest, files,
}, null, 2) + '\n');
console.log('learning-publication=written; independent verification still required');
