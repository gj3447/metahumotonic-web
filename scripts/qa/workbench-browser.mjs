import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist');
const output = resolve(process.env.MH_QA_OUTPUT ?? 'qa-results');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.jsonld': 'application/ld+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
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
const results = { origin: 'isolated-loopback-preview', checkedAt: new Date().toISOString(), sizes: [], functionality: {}, accessibility: [], consoleErrors: [], workers: 0, externalRequests: [] };
const hub = JSON.parse(await readFile(resolve('src/data/learning-hub.json'), 'utf8'));
try {
  browser = await chromium.launch({ executablePath: process.env.MH_CHROMIUM_EXECUTABLE || undefined, args: ['--disable-dev-shm-usage'] });
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: width <= 390, hasTouch: width <= 390 });
    const page = await context.newPage();
    page.on('pageerror', error => results.consoleErrors.push(error.message));
    page.on('worker', () => results.workers++);
    page.on('request', request => { if (!request.url().startsWith(origin)) results.externalRequests.push(request.url()); });
    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.product-feature').count(), 3);
    const simulation = page.locator('[data-meaning-simulation]');
    assert.equal(await simulation.getAttribute('data-enhanced'), 'true');
    assert.equal(await simulation.locator('[data-node-id]').count(), 9);
    assert.equal(await simulation.locator('[data-edge-from]').count(), 8);
    assert.equal(await simulation.locator('[data-route-id]').count(), 4);
    assert.equal(await simulation.evaluate(node => node.classList.contains('is-running')), false, 'simulation must not autoplay');
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(dimensions.document <= width + 1 && dimensions.body <= width + 1, `horizontal overflow: ${JSON.stringify(dimensions)}`);
    await page.screenshot({ path: resolve(output, `hero-${width}.png`) });
    await page.screenshot({ path: resolve(output, `home-${width}.jpg`), type: 'jpeg', quality: 78, fullPage: true });
    await page.locator('.meaning-section').screenshot({ path: resolve(output, `meaning-${width}.png`) });
    if ([1440, 390].includes(width)) {
      const analysis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      results.accessibility.push({ width, violations: analysis.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    }
    const aiRoute = simulation.locator('[data-route-id="ai"]');
    if (width <= 390) await aiRoute.tap();
    else await aiRoute.click();
    assert.equal(await simulation.getAttribute('data-active-route'), 'ai');
    assert.equal(await aiRoute.getAttribute('aria-current'), 'true');
    assert.equal(await simulation.locator('[data-meaning-control-number]').textContent(), '04 / 04');
    assert.equal(await simulation.locator('[data-meaning-steps] li').count(), 4);
    assert.equal(await simulation.locator('[data-meaning-mobile-track] .meaning-track-item').count(), 4);
    assert.equal(await simulation.evaluate(node => node.classList.contains('is-running')), false, 'reduced motion must not animate');
    await simulation.locator('[data-route-id="community"]').click();
    assert.equal(await simulation.getAttribute('data-active-route'), 'community');
    assert.equal(await simulation.locator('[data-meaning-steps] a[href="/projects/soopoolim/"]').count(), 1);
    assert.equal(await simulation.locator('[data-meaning-control-number]').textContent(), '03 / 04');
    await simulation.locator('[data-route-id="worlds"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await simulation.getAttribute('data-active-route'), 'worlds');
    assert.equal(await simulation.locator('[data-meaning-steps] li').count(), 3);
    if (width <= 768) {
      const menu = page.locator('.mobile-nav');
      await menu.locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await menu.getAttribute('open'), '');
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('open'), null);
      assert.equal(await menu.locator('summary').evaluate(node => node === document.activeElement), true);
      if (width <= 390) await menu.locator('summary').tap();
      else await menu.locator('summary').click();
      await menu.locator('a[href="/axioms/"]').click();
      assert.equal(await page.locator('[data-axiom]').count(), 12);
      await page.goto(origin);
    }
    await page.locator('.product-feature a[aria-label="메이플리니지 소개"]').click();
    assert.equal(await page.locator('h1').textContent(), '메이플리니지');
    await page.goto(origin + '/projects/');
    await page.locator('[data-project-controls]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-project-id]:visible').count(), 9);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `directory overflow ${width}`);
    await page.screenshot({ path: resolve(output, `projects-${width}.jpg`), type: 'jpeg', quality: 78, fullPage: true });
    if ([1440, 390].includes(width)) {
      const analysis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      results.accessibility.push({ page: 'projects', width, violations: analysis.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    }
    await page.locator('[data-category="games"]').click();
    assert.equal(await page.locator('[data-project-id]:visible').count(), 3);
    await page.locator('#project-query').fill('ＶＥＸＩ');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 1);
    await page.locator('#project-query').fill('not-a-real-project');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 0);
    assert.equal(await page.locator('[data-project-empty]').isVisible(), true);
    await page.locator('[data-project-reset]').click();
    assert.equal(await page.locator('[data-project-id]:visible').count(), 9);
    await page.locator('#project-query').fill('버엑시 로그라이크');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 1);
    await page.locator('#project-query').press('Escape');
    assert.equal(await page.locator('[data-project-id]:visible').count(), 9);
    await page.locator('[data-project-id="usl"] h2 a').click();
    assert.equal(await page.locator('h1').textContent(), 'USL');
    const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(detailOverflow, false, `detail overflow ${width}`);
    await page.goto(origin + '/projects/soopoolim/');
    const soopMath = page.locator('[data-soop-sim]');
    assert.equal(await soopMath.getAttribute('data-enhanced'), 'true');
    assert.equal(await soopMath.getAttribute('data-mode'), 'hyperedge');
    assert.equal(await soopMath.locator('.soop-sim-pairs line').count(), 15);
    assert.equal(await soopMath.locator('.soop-sim-incidences line').count(), 6);
    await soopMath.screenshot({ path: resolve(output, `soop-math-${width}.png`) });
    await soopMath.locator('[data-soop-mode="pairs"]').click();
    assert.equal(await soopMath.getAttribute('data-mode'), 'pairs');
    assert.equal(await soopMath.locator('[data-soop-mode="pairs"]').getAttribute('aria-pressed'), 'true');
    await soopMath.screenshot({ path: resolve(output, `soop-math-pairs-${width}.png`) });
    await soopMath.locator('[data-soop-mode="hyperedge"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await soopMath.getAttribute('data-mode'), 'hyperedge');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `soopoolim overflow ${width}`);
    if ([1440, 390].includes(width)) {
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      results.accessibility.push({ page: 'soopoolim', width, violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    }
    results.functionality.soopMath = true;
    await page.goto(origin + '/services/');
    assert.equal(await page.locator('[data-service-project]').count(), 9);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `services overflow ${width}`);
    await page.screenshot({ path: resolve(output, `services-${width}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
    if ([1440, 390].includes(width)) {
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      results.accessibility.push({ page: 'services', width, violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    }
    if (width <= 390) {
      const mapLabelSize = await page.locator('.service-map-node small').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
      assert.ok(mapLabelSize >= 12, `mobile service map label too small at ${width}px: ${mapLabelSize}px`);
      await page.locator('.service-index a[href="#knowledge-services"]').click();
      assert.equal(new URL(page.url()).hash, '#knowledge-services');
      const jump = await page.evaluate(() => ({
        navigationBottom: document.querySelector('.service-index').getBoundingClientRect().bottom,
        sectionTop: document.querySelector('#knowledge-services').getBoundingClientRect().top,
      }));
      assert.ok(jump.sectionTop >= jump.navigationBottom - 2, `sticky service navigation obscures target at ${width}px: ${JSON.stringify(jump)}`);
      results.functionality.serviceJump = true;
    }
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('main *')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `enlarged services overflow ${width}`);
    for (const route of ['/developers/', '/api/', '/mcp/']) {
      await page.goto(origin + route);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `developer overflow ${route} ${width}`);
      if ([1440, 390].includes(width)) {
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        results.accessibility.push({ page: route, width, violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
      }
    }
    for (const route of ['/apostles/', '/axioms/', '/philosophy/', '/agents/', '/foundation/', '/apostles/orbital-cloud/']) {
      await page.goto(origin + route);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `content overflow ${route} ${width}`);
      if (route === '/apostles/') assert.equal(await page.locator('[data-apostle]').count(), 12);
      if (route === '/axioms/') {
        assert.equal(await page.locator('[data-axiom]').count(), 12);
        await page.locator('.axiom-index a[href="#axiom-12"]').click();
        assert.ok(page.url().endsWith('#axiom-12'));
        await page.goto(origin + route);
      }
      await page.screenshot({ path: resolve(output, `${route.split('/').filter(Boolean).join('-')}-${width}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
      if ([1440, 390].includes(width)) {
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        results.accessibility.push({ page: route, width, violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
      }
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll('main *')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
        for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `enlarged content overflow ${route} ${width}`);
    }
    await page.goto(origin + '/learn/');
    await page.locator('[data-learning-controls]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-learning-id]:visible').count(), hub.nodes.length);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `learning overflow ${width}`);
    await page.screenshot({ path: resolve(output, `learn-${width}.jpg`), type: 'jpeg', quality: 78, fullPage: true });
    if ([1440, 390].includes(width)) {
      const analysis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      results.accessibility.push({ page: 'learn', width, violations: analysis.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
    }
    if (width <= 390) await page.locator('[data-learning-kind="video"]').tap();
    else await page.locator('[data-learning-kind="video"]').click();
    assert.equal(await page.locator('[data-learning-id]:visible').count(), 3);
    await page.locator('#learning-query').fill('없는 검색어');
    assert.equal(await page.locator('[data-learning-empty]').isVisible(), true);
    await page.locator('[data-learning-reset]').click();
    await page.locator('#learning-query').fill('ＵＳＬ');
    assert.equal(await page.locator('[data-learning-id]:visible').count(), 1);
    await page.locator('#entity-usl > summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#entity-usl').getAttribute('open'), '');
    await page.locator('#entity-usl a[href="#entity-hswm"]').click();
    await page.locator('#entity-hswm[open]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement === document.querySelector('#entity-hswm > summary'));
    assert.equal(await page.locator('#entity-hswm').getAttribute('open'), '');
    assert.equal(await page.locator('[data-learning-id]:visible').count(), hub.nodes.length);
    assert.equal(await page.locator('#entity-hswm > summary').evaluate(node => node === document.activeElement), true);
    // Enlarge text, keep reduced motion enabled, and verify reflow on the same content.
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('main *')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    const enlarged = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
      offenders: [...document.querySelectorAll('main *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(node => ({ tag: node.tagName, class: node.className, width: node.getBoundingClientRect().width, text: node.textContent.slice(0, 70) })) }));
    assert.equal(enlarged.overflow, false, `enlarged learning overflow ${width}: ${JSON.stringify(enlarged.offenders)}`);
    await page.goto(origin);
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('main *')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `enlarged company home overflow ${width}`);
    results.sizes.push({ width, overflow: false, search: true, filters: true, emptyReset: true, companyNavigation: true, detail: true });
    await context.close();
  }
  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(origin);
  const movingSimulation = motionPage.locator('[data-meaning-simulation]');
  await movingSimulation.locator('[data-route-id="products"]').click();
  await motionPage.waitForFunction(() => document.querySelector('[data-meaning-simulation]')?.classList.contains('is-running'));
  await motionPage.waitForFunction(() => !document.querySelector('[data-meaning-simulation]')?.classList.contains('is-running'), undefined, { timeout: 5000 });
  results.functionality.oneShotSimulation = true;
  await motionContext.close();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(origin);
  assert.equal(await page.locator('.product-feature').count(), 3);
  assert.equal(await page.locator('[data-meaning-simulation]').getAttribute('data-enhanced'), null);
  assert.equal(await page.locator('[data-meaning-steps] li').count(), 3);
  assert.equal(await page.locator('[data-meaning-mobile-track] .meaning-track-item').count(), 3);
  assert.equal(await page.locator('[data-route-id]').count(), 4);
  await page.goto(origin + '/projects/soopoolim/');
  assert.equal(await page.locator('[data-soop-sim]').getAttribute('data-mode'), 'hyperedge');
  assert.equal(await page.locator('[data-soop-controls]').getAttribute('hidden'), '');
  assert.equal(await page.locator('.soop-sim-pairs line').count(), 15);
  await page.goto(origin);
  await page.locator('.mobile-nav summary').click();
  assert.equal(await page.locator('.mobile-nav').getAttribute('open'), '');
  results.functionality.noJs = true;
  const hrefs = await page.locator('a[href]').evaluateAll(elements => [...new Set(elements.map(a => a.getAttribute('href')).filter(href => href?.startsWith('/') && !href.startsWith('//')))]);
  for (const href of hrefs) {
    const path = href.split('#')[0] || '/';
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, `broken local home link: ${href}`);
  }
  results.functionality.localLinks = hrefs.length;
  await page.goto(origin + '/projects/');
  assert.equal(await page.locator('[data-project-id]:visible').count(), 9);
  assert.equal(await page.locator('[data-project-controls]').isVisible(), false);
  await page.goto(origin + '/services/');
  assert.equal(await page.locator('[data-service-project]').count(), 9);
  assert.equal(await page.locator('.service-link-card').count(), 8);
  await page.goto(origin + '/learn/#entity-usl');
  assert.equal(await page.locator('[data-learning-id]:visible').count(), hub.nodes.length);
  assert.equal(await page.locator('[data-learning-controls]').isVisible(), false);
  await page.locator('#entity-usl > summary').click();
  assert.equal(await page.locator('#entity-usl').getAttribute('open'), '');
  results.functionality.learningNoJs = true;
  results.functionality.learningKeyboardAndFilters = true;
  await context.close();
  assert.equal(results.consoleErrors.length, 0);
  assert.equal(results.workers, 0);
  assert.equal(results.externalRequests.length, 0, 'reading the hub must not contact media providers');
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
