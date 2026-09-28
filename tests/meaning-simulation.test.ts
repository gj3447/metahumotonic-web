import test from 'node:test';
import assert from 'node:assert/strict';
import hub from '../src/data/learning-hub.json' with { type: 'json' };
import { meaningSimulationEdges, meaningSimulationNodes, meaningSimulationRoutes } from '../src/lib/meaning-simulation.ts';

const origin = 'https://metahumotonic.com';

test('meaning simulation routes use only public, local learning-hub nodes and active directed edges', () => {
  assert.deepEqual(meaningSimulationRoutes.map(route => route.id), ['worlds', 'products', 'community', 'ai']);
  assert.deepEqual(meaningSimulationRoutes.map(route => route.steps.map(step => step.id)), [
    ['philosophy', 'axioms', 'apostles'],
    ['philosophy', 'projects', 'vexi'],
    ['philosophy', 'projects', 'soopoolim'],
    ['philosophy', 'agents', 'usl', 'hswm'],
  ]);

  for (const route of meaningSimulationRoutes) {
    for (const [index, step] of route.steps.entries()) {
      const node = hub.nodes.find(candidate => candidate.id === step.id);
      assert.ok(node?.public, step.id);
      assert.equal(step.href, new URL(node.href).pathname + new URL(node.href).search + new URL(node.href).hash);
      assert.equal(new URL(node.href).origin, origin);
      if (index === 0) assert.equal(step.edgeLabel, null);
      else {
        const previous = route.steps[index - 1];
        const edge = hub.edges.find(candidate => candidate.from === previous.id && candidate.to === step.id && candidate.status === 'ACTIVE');
        assert.ok(edge, `${previous.id} -> ${step.id}`);
        assert.equal(step.edgeLabel, edge.label);
      }
    }
  }
});

test('meaning simulation display data has unique public nodes and real graph edges without private URLs', () => {
  assert.equal(new Set(meaningSimulationNodes.map(node => node.id)).size, meaningSimulationNodes.length);
  assert.equal(new Set(meaningSimulationEdges.map(edge => edge.id)).size, meaningSimulationEdges.length);
  assert.deepEqual(meaningSimulationEdges.map(edge => `${edge.from}->${edge.to}`), [
    'philosophy->axioms', 'axioms->apostles', 'philosophy->projects', 'projects->vexi',
    'projects->soopoolim', 'philosophy->agents', 'agents->usl', 'usl->hswm',
  ]);
  assert.doesNotMatch(JSON.stringify({ meaningSimulationNodes, meaningSimulationEdges }), /https?:\/\/(?!metahumotonic\.com)|192\.168\.|10\.\d+\.\d+\.|\/home\/|password|token/i);
});
