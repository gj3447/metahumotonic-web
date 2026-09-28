import hub from '../data/learning-hub.json' with { type: 'json' };

const origin = 'https://metahumotonic.com';

type HubNode = (typeof hub.nodes)[number];
type HubEdge = (typeof hub.edges)[number];

export type MeaningSimulationStep = Readonly<{
  id: string;
  title: string;
  summary: string;
  href: string;
  edgeLabel: string | null;
}>;

export type MeaningSimulationRoute = Readonly<{
  id: 'worlds' | 'products' | 'community' | 'ai';
  label: string;
  title: string;
  summary: string;
  accent: string;
  steps: readonly MeaningSimulationStep[];
}>;

export type MeaningSimulationEdge = Readonly<{
  id: string;
  from: string;
  to: string;
  label: string;
}>;

const routeDefinitions = [
  {
    id: 'worlds' as const,
    label: '세계관',
    title: '공리에서 사도로',
    summary: '선의 공리와 12사도를 차례로 읽습니다.',
    accent: '#efa7d9',
    nodeIds: ['philosophy', 'axioms', 'apostles'],
  },
  {
    id: 'products' as const,
    label: '프로젝트',
    title: '철학에서 버엑시로',
    summary: '철학의 입구에서 프로젝트 소개와 버엑시 소개로 이어집니다.',
    accent: '#f2db91',
    nodeIds: ['philosophy', 'projects', 'vexi'],
  },
  {
    id: 'community' as const,
    label: '수풀림',
    title: '철학에서 수풀림으로',
    summary: '철학의 입구에서 프로젝트와 수풀림 소개로 이어집니다.',
    accent: '#b9e1ad',
    nodeIds: ['philosophy', 'projects', 'soopoolim'],
  },
  {
    id: 'ai' as const,
    label: 'AI · 연구',
    title: '에이전트에서 HSWM으로',
    summary: '에이전트 소개에서 USL과 HSWM 소개를 차례로 읽습니다.',
    accent: '#9bdfe8',
    nodeIds: ['philosophy', 'agents', 'usl', 'hswm'],
  },
] as const;

const nodesById = new Map(hub.nodes.map(node => [node.id, node]));
const activeEdges = hub.edges.filter(edge => edge.status === 'ACTIVE');
const localHref = (href: string): string => {
  const url = new URL(href);
  if (url.origin !== origin) throw new Error(`Meaning simulation node must be same-origin: ${href}`);
  return `${url.pathname}${url.search}${url.hash}`;
};

const publicNode = (id: string): HubNode => {
  const node = nodesById.get(id);
  if (!node || !node.public) throw new Error(`Meaning simulation node must be public: ${id}`);
  localHref(node.href);
  return node;
};

const directedEdge = (from: string, to: string): HubEdge => {
  const edge = activeEdges.find(candidate => candidate.from === from && candidate.to === to);
  if (!edge) throw new Error(`Meaning simulation edge is missing: ${from} -> ${to}`);
  return edge;
};

const buildRoute = (definition: (typeof routeDefinitions)[number]): MeaningSimulationRoute => {
  const nodes = definition.nodeIds.map(publicNode);
  const edges = nodes.slice(1).map((node, index) => directedEdge(nodes[index].id, node.id));
  return {
    id: definition.id,
    label: definition.label,
    title: definition.title,
    summary: definition.summary,
    accent: definition.accent,
    steps: nodes.map((node, index) => ({
      id: node.id,
      title: node.title,
      summary: node.summary,
      href: localHref(node.href),
      edgeLabel: index === 0 ? null : edges[index - 1].label,
    })),
  };
};

export const meaningSimulationRoutes: readonly MeaningSimulationRoute[] = routeDefinitions.map(buildRoute);

export const meaningSimulationNodes: readonly MeaningSimulationStep[] = [
  ...new Map(meaningSimulationRoutes.flatMap(route => route.steps).map(step => [step.id, step])).values(),
];

export const meaningSimulationEdges: readonly MeaningSimulationEdge[] = [
  ...new Map(meaningSimulationRoutes.flatMap(route => route.steps.slice(1).map((step, index) => {
    const from = route.steps[index];
    const edge = directedEdge(from.id, step.id);
    return [edge.id, { id: edge.id, from: edge.from, to: edge.to, label: edge.label }] as const;
  }))).values(),
];
