import { normalizeQuery } from '../lib/workbench';

const controls = document.querySelector<HTMLElement>('[data-learning-controls]');
const query = document.querySelector<HTMLInputElement>('#learning-query');
const entries = [...document.querySelectorAll<HTMLDetailsElement>('[data-learning-id]')];
const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-learning-kind]')];
const count = document.querySelector<HTMLElement>('[data-learning-count]');
const empty = document.querySelector<HTMLElement>('[data-learning-empty]');
let kind = 'all';
function render() {
  const words = normalizeQuery(query?.value ?? '').split(' ').filter(Boolean);
  let visible = 0;
  for (const entry of entries) {
    entry.hidden = (kind !== 'all' && entry.dataset.kind !== kind) || !words.every(word => normalizeQuery(entry.dataset.search ?? '').includes(word));
    if (!entry.hidden) visible++;
  }
  for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.learningKind === kind));
  if (count) count.textContent = `${visible}개 항목`;
  if (empty) empty.hidden = visible !== 0;
}
function reset() { kind = 'all'; if (query) query.value = ''; render(); }
function followHash() {
  const id = location.hash.slice(1);
  // Only identifiers authored in the published graph can select a disclosure.
  const target = entries.find(entry => entry.id === id || [...entry.querySelectorAll('[id]')].some(child => child.id === id));
  if (!target) return;
  reset(); target.open = true;
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    target.querySelector('summary')?.focus({ preventScroll: true });
  });
}
if (controls && query) {
  controls.hidden = false;
  query.addEventListener('input', render);
  query.addEventListener('keydown', event => { if (event.key === 'Escape') reset(); });
  filters.forEach(button => button.addEventListener('click', () => { kind = button.dataset.learningKind ?? 'all'; render(); }));
  document.querySelector('[data-learning-reset]')?.addEventListener('click', () => { reset(); query.focus(); });
  window.addEventListener('hashchange', followHash);
  document.addEventListener('click', event => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (link && link.origin === location.origin && link.pathname === location.pathname && link.hash.startsWith('#entity-')) setTimeout(followHash, 0);
  });
  followHash();
}
