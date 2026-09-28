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
  if (count) count.textContent = `${visible}개의 프로젝트`;
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
