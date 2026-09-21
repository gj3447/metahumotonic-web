import { normalizeQuery } from '../lib/workbench';

// All client data comes from already-published DOM fields. Never import the
// unfiltered source catalogue or fetch private KG/thread data in the browser.
const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-project-id]'));
const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-category]'));
const input = document.querySelector<HTMLInputElement>('#project-query');
const count = document.querySelector<HTMLElement>('[data-project-count]');
const empty = document.querySelector<HTMLElement>('[data-project-empty]');
const controls = document.querySelector<HTMLElement>('[data-project-controls]');
let category = 'all';

const render = (): void => {
  const terms = normalizeQuery(input?.value ?? '').split(' ').filter(Boolean);
  let visible = 0;
  for (const card of cards) {
    const haystack = normalizeQuery(card.dataset.projectSearch ?? '');
    const matches = (category === 'all' || card.dataset.projectCategory === category) &&
      terms.every(term => haystack.includes(term));
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  for (const filter of filters) filter.setAttribute('aria-pressed', String(filter.dataset.category === category));
  if (count) count.textContent = `${visible}개의 작업`;
  if (empty) empty.hidden = visible !== 0;
};

if (input && controls) {
  controls.hidden = false;
  for (const filter of filters) filter.addEventListener('click', () => {
    category = filter.dataset.category ?? 'all';
    render();
  });
  input.addEventListener('input', render);
  document.querySelector('[data-project-reset]')?.addEventListener('click', () => {
    category = 'all'; input.value = ''; render(); input.focus();
  });
  document.addEventListener('keydown', event => {
    const target = event.target;
    const editing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); input.focus();
    }
    if (event.key === 'Escape' && document.activeElement === input) {
      input.value = ''; render();
    }
  });
  render();
}

const nodes = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-graph-node]'));
for (const node of nodes) node.addEventListener('click', () => {
  const project = cards.find(card => card.dataset.projectId === node.dataset.graphNode);
  if (!project) return;
  for (const other of nodes) {
    const active = other === node;
    other.setAttribute('aria-pressed', String(active));
    other.classList.toggle('is-selected', active);
  }
  const title = document.querySelector('[data-graph-title]');
  const summary = document.querySelector('[data-graph-summary]');
  const label = document.querySelector('[data-graph-category]');
  const link = document.querySelector<HTMLAnchorElement>('[data-graph-link]');
  const name = project.dataset.projectName ?? '';
  if (title) title.textContent = name;
  if (summary) summary.textContent = project.dataset.projectSubtitle ?? '';
  if (label) label.textContent = project.dataset.projectCategory?.toUpperCase() ?? '';
  if (link && /^[a-z0-9-]+$/.test(project.dataset.projectId ?? '')) {
    link.href = `/projects/${project.dataset.projectId}/`;
    link.setAttribute('aria-label', `${name} 자세히 보기`);
  }
});
