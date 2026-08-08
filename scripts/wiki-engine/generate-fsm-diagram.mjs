import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function generateFsmDiagram(spec) {
  const lines = [
    '%% Generated from fsm-spec.json. Do not edit this diagram directly.',
    'stateDiagram-v2',
    '  direction LR',
  ];

  for (const machine of spec.machines) {
    lines.push(`  state ${machine.id} {`);
    lines.push(`    [*] --> ${machine.initial}`);
    for (const transition of machine.transitions) {
      const guard = transition.guard ? ` [${transition.guard}]` : '';
      lines.push(
        `    ${transition.from} --> ${transition.to}: ${transition.event}${guard}`,
      );
    }
    lines.push('  }');
  }

  return `${lines.join('\n')}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [specPath] = process.argv.slice(2);
  if (!specPath) {
    console.error('usage: node generate-fsm-diagram.mjs FSM_SPEC.json');
    process.exitCode = 2;
  } else {
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    process.stdout.write(generateFsmDiagram(spec));
  }
}
