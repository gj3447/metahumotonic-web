import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist');
const output = resolve(process.env.MH_QA_OUTPUT ?? 'qa-results');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + sep) && file !== root) throw new Error('outside root');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = { origin: 'isolated-loopback-preview', checkedAt: new Date().toISOString(), sizes: [], functionality: {}, accessibility: [], consoleErrors: [], workers: 0 };
try {
  browser = await chromium.launch({ executablePath: process.env.MH_CHROMIUM_EXECUTABLE || undefined, args: ['--disable-dev-shm-usage'] });
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => results.consoleErrors.push(error.message));
    page.on('worker', () => results.workers++);
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('[data-project-controls]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-project-id]:visible').count(), 8);
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(dimensions.document <= width + 1 && dimensions.body <= width + 1, `horizontal overflow: ${JSON.stringify(dimensions)}`);
    await page.screenshot({ path: resolve(output, `home-${width}.jpg`), type: 'jpeg', quality: 78, fullPage: true });
    if ([1440, 390].includes(width)) {
      const analysis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      results.accessibility.push({ width, violations: analysis.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    }
    await page.locator('[data-category="games"]').click();
    assert.equal(await page.locator('[data-project-id]:visible').count(), 2);
    await page.locator('#project-query').fill('ＶＥＸＩ');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 1);
    await page.locator('#project-query').fill('not-a-real-project');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 0);
    assert.equal(await page.locator('[data-project-empty]').isVisible(), true);
    await page.locator('[data-project-reset]').click();
    assert.equal(await page.locator('[data-project-id]:visible').count(), 8);
    await page.locator('#project-query').fill('버엑시 로그라이크');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 1);
    await page.locator('#project-query').press('Escape');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 8);
    await page.locator('[data-graph-node="usl"]').click();
    assert.equal(await page.locator('[data-graph-title]').textContent(), 'USL');
    assert.equal(await page.locator('[data-graph-link]').getAttribute('href'), '/projects/usl/');
    await page.locator('[data-graph-link]').click();
    assert.equal(await page.locator('h1').textContent(), 'USL');
    const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(detailOverflow, false, `detail overflow ${width}`);
    results.sizes.push({ width, overflow: false, search: true, filters: true, emptyReset: true, focusMap: true, detail: true });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(origin);
  assert.equal(await page.locator('[data-project-id]:visible').count(), 8);
  assert.equal(await page.locator('[data-project-controls]').isVisible(), false);
  results.functionality.noJs = true;
  const hrefs = await page.locator('a[href]').evaluateAll(elements => [...new Set(elements.map(a => a.getAttribute('href')).filter(href => href?.startsWith('/') && !href.startsWith('//')))]);
  for (const href of hrefs) {
    const path = href.split('#')[0] || '/';
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, `broken local home link: ${href}`);
  }
  results.functionality.localLinks = hrefs.length;
  await context.close();
  assert.equal(results.consoleErrors.length, 0);
  assert.equal(results.workers, 0);
  results.passed = results.accessibility.every(item => item.violations.length === 0);
  await writeFile(resolve(output, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  if (!results.passed) process.exitCode = 1;
} catch (error) {
  results.error = error.stack; results.passed = false;
  await writeFile(resolve(output, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.error(error); process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
