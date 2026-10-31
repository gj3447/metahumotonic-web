// Run with the repository's pinned Node inside proxmox-scratch; optional --public.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, chmod } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const target = 'https://metahumotonic.com/card/ra/';
const root = resolve('public');
const output = process.env.STORAGE_ARTIFACT_DIR;
assert.ok(output, 'Run through proxmox-scratch to retain screenshots within capacity limits');
await mkdir(output, { recursive: true });
const files = ['index.html', 'card.css', 'card.js', 'qr.png', 'qr.svg', 'contact.vcf', 'card.png'];
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.vcf': 'text/vcard; charset=utf-8' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = path === '/favicon.svg' ? 'favicon.svg' : `card/ra/${path === '/card/ra/' ? 'index.html' : path.split('/').at(-1)}`;
  if (file !== 'favicon.svg' && !files.includes(file.split('/').at(-1))) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { 'Content-Type': mime[extname(file)] }); res.end(await readFile(resolve(root, file))); }
  catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = process.argv.includes('--public') ? target : `http://127.0.0.1:${server.address().port}/card/ra/`;
const report = { url, checkedAt: new Date().toISOString(), viewports: [], assets: [], checks: [], errors: [] };
let browser;
try {
  if (process.env.STORAGE_MEMORY_TMPDIR) process.env.TMPDIR = process.env.STORAGE_MEMORY_TMPDIR;
  browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  if (process.argv.includes('--export-image')) {
    assert.ok(!process.argv.includes('--public'), 'Export from reviewed local source only');
    const context = await browser.newContext({ viewport: { width: 960, height: 800 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const bounds = await page.locator('.business-card').boundingBox();
    assert.equal(bounds.width, 720);
    assert.equal(bounds.height, 400);
    const destination = resolve(root, 'card/ra/card.png');
    await page.locator('.business-card').screenshot({ path: destination });
    await chmod(destination, 0o644);
    await context.close();
    report.checks.push('1440x800 business-card image export');
  }
  const stylesheet = (await readFile(resolve(root, 'card/ra/index.html'), 'utf8')).match(/href="([^\"]*card\.css[^\"]*)"/)[1];
  for (const file of files) {
    const assetUrl = new URL(file === 'card.css' ? stylesheet : file, url);
    const response = await fetch(assetUrl);
    assert.equal(response.status, 200, file);
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(await readFile(resolve(root, 'card/ra', file))), `served bytes: ${assetUrl}`);
    if (file === 'qr.png') assert.match(response.headers.get('content-type'), /^image\/png/);
    report.assets.push(assetUrl.pathname + assetUrl.search);
  }
  for (const width of [390, 320, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 400, hasTouch: width < 400, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').textContent(), '라경준');
    assert.ok(await page.locator('.qr-image img').evaluate(img => img.complete && img.naturalWidth > 200));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${width}`);
    const card = await page.locator('.business-card').boundingBox();
    assert.ok(Math.abs(card.width / card.height - 1.8) < 0.03, `business-card proportion at ${width}: ${JSON.stringify(card)}`);
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(accessibility.violations.map(v => v.id), [], `accessibility ${width}`);
    await page.screenshot({ path: resolve(output, `card-${width}.png`), fullPage: true });
    if (width === 390) {
      await page.locator('#share').focus();
      assert.equal(await page.locator('#share').evaluate(el => el === document.activeElement), true);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copied = text; } } });
      });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.copied);
      assert.equal(await page.evaluate(() => window.copied), target);
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
      await page.locator('#share').tap();
      await page.locator('#card-url').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#card-url').inputValue(), target);
      await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.shared = data; } }));
      await page.locator('#share').tap();
      assert.equal(await page.evaluate(() => window.shared.url), target);
      await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Canceled', 'AbortError'); } }));
      await page.locator('#share').tap();
      assert.equal(await page.locator('#status').textContent(), '');
      assert.equal(await page.locator('#copy-fallback').isVisible(), false);
      const downloadEvent = page.waitForEvent('download');
      await page.locator('a[href="./contact.vcf"]').tap();
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), /\.vcf$/);
      const cardDownloadEvent = page.waitForEvent('download');
      await page.locator('a[href="./card.png"]').tap();
      assert.match((await cardDownloadEvent).suggestedFilename(), /명함\.png$/);
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll('body *')].map(el => [el, parseFloat(getComputedStyle(el).fontSize) * 2]);
        for (const [el, size] of sizes) el.style.fontSize = `${size}px`;
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'enlarged text overflow');
      report.checks.push('keyboard', 'touch', 'clipboard', 'manual-copy fallback', 'native-share payload', 'share cancellation', 'vCard download', 'card image download', 'enlarged text');
    }
    report.viewports.push({ width, accessibilityViolations: 0 });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(url);
  assert.ok(await page.locator('.qr-image img').isVisible());
  assert.ok(await page.locator('a[href="./contact.vcf"]').isVisible());
  assert.equal(await page.locator('#share').isVisible(), false);
  report.checks.push('core content without JavaScript');
  await context.close();
  assert.deepEqual(report.errors, []);
  report.status = 'PASS';
} finally {
  await browser?.close();
  server.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, url, viewports: report.viewports, checks: report.checks, output }));
