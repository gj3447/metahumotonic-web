import { readFileSync } from 'node:fs';

import { generateFsmDiagram } from './generate-fsm-diagram.mjs';

const [specPath, diagramPath] = process.argv.slice(2);
if (!specPath || !diagramPath) {
  console.error('usage: node verify-generated-diagram.mjs FSM_SPEC.json FSM_DIAGRAM.mmd');
  process.exitCode = 2;
} else {
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const expected = generateFsmDiagram(spec);
  const actual = readFileSync(diagramPath, 'utf8');
  if (actual !== expected) {
    console.error(`${diagramPath} is stale; regenerate it from ${specPath}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${diagramPath} matches ${specPath}`);
  }
}
