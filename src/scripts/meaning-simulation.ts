import type { MeaningSimulationRoute } from '../lib/meaning-simulation.ts';

const root = document.querySelector<HTMLElement>('[data-meaning-simulation]');
if (root) {
  let routes: readonly MeaningSimulationRoute[] = [];
  try { routes = JSON.parse(root.dataset.routes ?? '[]') as readonly MeaningSimulationRoute[]; } catch { /* The server-rendered first path remains usable. */ }
  const routeLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-route-id]')];
  const graphNodes = [...root.querySelectorAll<HTMLElement>('[data-node-id]')];
  const graphEdges = [...root.querySelectorAll<SVGPathElement>('[data-edge-from][data-edge-to]')];
  const mobileTrack = root.querySelector<HTMLElement>('[data-meaning-mobile-track]');
  const visualNames = new Map(graphNodes.map(node => [node.dataset.nodeId, node.querySelector('strong')?.textContent?.trim()]));
  const title = root.querySelector<HTMLElement>('[data-meaning-title]');
  const summary = root.querySelector<HTMLElement>('[data-meaning-summary]');
  const pathNumber = root.querySelector<HTMLElement>('[data-meaning-path-number]');
  const controlNumber = root.querySelector<HTMLElement>('[data-meaning-control-number]');
  const stepList = root.querySelector<HTMLOListElement>('[data-meaning-steps]');
  const status = root.querySelector<HTMLElement>('[data-meaning-status]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let firstFrame = 0;
  let secondFrame = 0;
  let finishTimer = 0;

  const stopMotion = (): void => {
    cancelAnimationFrame(firstFrame);
    cancelAnimationFrame(secondFrame);
    clearTimeout(finishTimer);
    root.classList.remove('is-running');
  };

  const makeStep = (step: MeaningSimulationRoute['steps'][number], index: number): HTMLLIElement => {
    const item = document.createElement('li');
    item.style.setProperty('--step-order', String(index));
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    const body = document.createElement('div');
    if (step.edgeLabel) {
      const relation = document.createElement('small');
      relation.textContent = step.edgeLabel;
      body.append(relation);
    }
    const link = document.createElement('a');
    link.href = step.href;
    link.append(document.createTextNode(`${step.title} `));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    link.append(arrow);
    body.append(link);
    item.append(number, body);
    return item;
  };

  const makeTrackItem = (step: MeaningSimulationRoute['steps'][number], index: number): HTMLSpanElement => {
    const item = document.createElement('span');
    item.className = 'meaning-track-item';
    item.style.setProperty('--step-order', String(index));
    const number = document.createElement('b');
    number.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('small');
    name.textContent = visualNames.get(step.id) || step.title;
    item.append(number, name);
    return item;
  };

  const selectRoute = (route: MeaningSimulationRoute, animate: boolean): void => {
    stopMotion();
    const index = routes.findIndex(candidate => candidate.id === route.id);
    const edgeOrder = new Map(route.steps.slice(1).map((step, stepIndex) => [`${route.steps[stepIndex].id}->${step.id}`, stepIndex]));
    root.dataset.activeRoute = route.id;
    root.style.setProperty('--meaning-route-accent', route.accent);
    routeLinks.forEach(link => {
      if (link.dataset.routeId === route.id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    graphNodes.forEach(node => {
      const order = route.steps.findIndex(step => step.id === node.dataset.nodeId);
      node.classList.toggle('is-in-route', order !== -1);
      if (order !== -1) node.style.setProperty('--node-order', String(order));
      else node.style.removeProperty('--node-order');
    });
    graphEdges.forEach(edge => {
      const order = edgeOrder.get(`${edge.dataset.edgeFrom}->${edge.dataset.edgeTo}`);
      edge.classList.toggle('is-in-route', order !== undefined);
      if (order !== undefined) edge.style.setProperty('--edge-order', String(order));
      else edge.style.removeProperty('--edge-order');
    });
    if (title) title.textContent = route.title;
    if (summary) summary.textContent = route.summary;
    const routeNumber = `${String(index + 1).padStart(2, '0')} / ${String(routes.length).padStart(2, '0')}`;
    if (pathNumber) pathNumber.textContent = routeNumber;
    if (controlNumber) controlNumber.textContent = routeNumber;
    stepList?.replaceChildren(...route.steps.map(makeStep));
    mobileTrack?.replaceChildren(...route.steps.map(makeTrackItem));
    if (status) status.textContent = `${route.label} 경로가 선택됐습니다. ${route.steps.length}개 공개 항목을 따라 읽을 수 있습니다.`;
    if (!animate || reducedMotion.matches || document.hidden) return;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        root.classList.add('is-running');
        finishTimer = window.setTimeout(() => root.classList.remove('is-running'), 2600);
      });
    });
  };

  if (routes.length && title && summary && stepList) {
    root.dataset.enhanced = 'true';
    routeLinks.forEach(link => link.addEventListener('click', event => {
      const route = routes.find(candidate => candidate.id === link.dataset.routeId);
      if (!route) return;
      event.preventDefault();
      selectRoute(route, true);
    }));
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && root.classList.contains('is-running')) {
        stopMotion();
        if (status) status.textContent = '경로 움직임이 정지됐습니다.';
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopMotion(); });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopMotion(); });
  }
}
