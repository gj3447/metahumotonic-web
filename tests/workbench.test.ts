import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { publicProjects, publicProjection, filterProjects, relatedProjects, normalizeQuery, isSafeLink, categories, statusLabels } from '../src/lib/workbench.ts';
import type { Project } from '../src/lib/workbench.ts';
const catalogue = JSON.parse(await readFile(new URL('../src/data/workbench.json', import.meta.url), 'utf8'));
const projects: readonly Project[] = catalogue.projects;
const readDist = (path: string) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('catalogue IDs, states, dates, relationships and public links are valid', () => {
  assert.equal(catalogue.schemaVersion, 'metahumotonic-workbench/v1');
  assert.equal(catalogue.publication.default, 'deny');
  assert.equal(catalogue.publication.authority, 'EDITORIAL_SUMMARY');
  assert.equal(new Set(projects.map(project => project.id)).size, projects.length);
  for (const project of projects) {
    assert.match(project.id, /^[a-z0-9-]+$/);
    assert.ok(categories.some(category => category.id === project.category));
    assert.ok(statusLabels[project.status]);
    assert.match(project.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(project.description.length > 40 && project.boundary.length > 30);
    assert.ok(project.evidenceLabel.length > 3);
    assert.ok(project.related.every(id => projects.some(candidate => candidate.id === id) && id !== project.id));
    assert.ok(project.links.every(link => isSafeLink(link.href)));
    assert.equal(project.public, true, 'private records must never be added to the public source file');
  }
});
test('public selection defaults to deny even when visibility is missing or truthy', () => {
  const base = projects[0];
  const denied = [
    { ...base, id: 'secret-1', public: false },
    { ...base, id: 'secret-2', public: undefined },
    { ...base, id: 'secret-3', public: 'true' },
  ] as unknown as Project[];
  assert.equal(publicProjects(denied).length, 0);
  assert.equal(publicProjects([base, ...denied]).length, 1);
});
test('projection is a whitelist and cannot serialize accidental private fields', () => {
  const contaminated = { ...projects[0], password: 'NEVER_PUBLISH_THIS', internal_path: '/private/example', originalThread: 'PRIVATE_THREAD_BODY' };
  const projection = publicProjection(catalogue.edition, [contaminated]);
  const body = JSON.stringify(projection);
  assert.doesNotMatch(body, /NEVER_PUBLISH_THIS|PRIVATE_THREAD_BODY|internal_path|password/);
  assert.equal(projection.publicationPolicy.autoPublishKg, false);
  assert.deepEqual(projection.projects[0].related, []);
});
test('search normalizes width, case and whitespace and ANDs multiple words', () => {
  assert.equal(normalizeQuery(' ＨＳＷＭ  AI '), 'hswm ai');
  assert.deepEqual(filterProjects(projects, 'all', 'HSWM').map(project => project.id), ['hswm']);
  assert.deepEqual(filterProjects(projects, 'all', 'ＨＳＷＭ').map(project => project.id), ['hswm']);
  assert.deepEqual(filterProjects(projects, 'all', '버엑시 로그라이크').map(project => project.id), ['vexi']);
  assert.deepEqual(filterProjects(projects, 'games', '  VEXI ').map(project => project.id), ['vexi']);
  assert.equal(filterProjects(projects, 'research', 'VEXI').length, 0);
  assert.equal(filterProjects(projects, 'all', 'not-a-real-project').length, 0);
  assert.equal(filterProjects(projects, 'all', '<script>alert(1)</script>').length, 0);
});
test('category filtering and related work neither mutate nor expose denied entries', () => {
  const before = JSON.stringify(projects);
  assert.equal(filterProjects(projects, 'all', '').length, 8);
  assert.equal(filterProjects(projects, 'research', '').length, 3);
  assert.equal(filterProjects(projects, 'systems', '').length, 3);
  assert.equal(filterProjects(projects, 'games', '').length, 2);
  assert.equal(filterProjects(projects, 'unknown', '').length, 0);
  assert.equal(relatedProjects(projects[0], projects).length, 3);
  assert.equal(JSON.stringify(projects), before);
});
test('unsafe and unreviewed outgoing links fail closed', () => {
  for (const href of ['javascript:alert(1)', '//evil.example/', 'http://github.com/gj3447', 'https://user:pass@github.com/x', 'https://github.com/x?token=secret', 'https://evil.example/x', '/\\evil', '/projects/../private']) {
    assert.equal(isSafeLink(href), false, href);
  }
  for (const href of ['/projects/hswm/', '/compute/', 'https://github.com/gj3447/HSWM', 'https://soopoolim.metahumotonic.com']) assert.equal(isSafeLink(href), true, href);
});
test('every published project has an actual detail route and safe rendered sources', async () => {
  for (const project of projects) {
    const html = await readDist(`projects/${project.id}/index.html`);
    assert.ok(html.includes(project.name));
    assert.ok(html.includes(project.boundary));
    assert.ok(html.includes('EDITORIAL SUMMARY'));
    assert.ok(html.includes(`https://metahumotonic.com/projects/${project.id}/`));
    for (const link of project.links.filter(link => link.href.startsWith('/'))) {
      await access(new URL(`../dist/${link.href.slice(1)}index.html`, import.meta.url));
    }
  }
});
test('published API matches source selection and excludes internal source locations', async () => {
  const api = JSON.parse(await readDist('projects/data.json'));
  assert.deepEqual(api, publicProjection(catalogue.edition, projects));
  assert.doesNotMatch(JSON.stringify(api), /\/home\/|\/Users\/|192\.168\.|NEO4J|bolt:|capability_url|source_ref|PRIVATE_THREAD/);
  assert.equal(api.projects.length, 8);
});
test('new homepage preserves no-JS content, accessible controls and no automatic compute', async () => {
  const html = await readDist('index.html');
  assert.match(html, /lang="ko"/);
  assert.match(html, /본문으로 건너뛰기/);
  assert.equal((html.match(/data-project-id=/g) ?? []).length, 8);
  assert.equal((html.match(/data-graph-node=/g) ?? []).length, 5);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /type="search"/);
  assert.match(html, /<noscript>/);
  assert.doesNotMatch(html, /333-contributor\.js|333-compute-worker\.js|data-mh-feedback/);
});
test('browser code uses published DOM only and no unsafe HTML or network side effects', async () => {
  const client = await readFile(new URL('../src/scripts/workbench.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(client, /innerHTML|eval\(|fetch\(|localStorage|sessionStorage|new Worker|workbench\.json/);
  assert.match(client, /textContent/);
  const css = await readFile(new URL('../src/styles/workbench.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});
