// Shell check in real headless Edge (same Playwright as v1 tests): node mail2/tests/shell.check.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(root, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': types[path.extname(f)] || 'text/plain' }); r.end(b); }); });
await new Promise(ok => srv.listen(0, ok));
const url = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  for (const w of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(url); await page.waitForSelector('.row');
    const bar = await page.$eval('.topbar', e => getComputedStyle(e).backgroundColor);
    ok(bar === 'rgb(15, 108, 189)' || bar === 'rgb(17, 94, 163)', `${w}px: blue top bar (${bar})`);
    ok(await page.$$eval('#folderList li', l => l.length) === 6, `${w}px: 6 folders`);
    ok(await page.$$eval('.row', l => l.length) === 3, `${w}px: 3 Inbox rows`);
    ok(await page.$eval('#folderList .n', e => e.textContent) === '2', `${w}px: Inbox unread 2`);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}px: no sideways scroll`);
    if (w === 390) await page.click('#menuBtn');
    await page.click('#folderList li[data-f="sent"]');
    ok(await page.$$eval('.row', l => l.length) === 1, `${w}px: Sent shows 1 row`);
    if (w === 390) await page.click('#menuBtn');
    await page.click('#folderList li[data-f="inbox"]');
    await page.click('.row');
    ok(await page.isVisible('.reading h1'), `${w}px: mail opens in reading pane`);
    ok(await page.$eval('#folderList .n', e => e.textContent) === '1', `${w}px: opening marks read (count 1)`);
    const t0 = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.click('#themeBtn');
    ok(await page.evaluate(() => document.documentElement.dataset.theme) !== t0, `${w}px: light/dark toggle`);
    if (w === 1280) {
      const before = await page.$eval('#list', e => e.getBoundingClientRect().width);
      const b = await (await page.$('.splitter[data-left="list"]')).boundingBox();
      await page.mouse.move(b.x + 2, b.y + 200); await page.mouse.down(); await page.mouse.move(b.x + 102, b.y + 200, { steps: 5 }); await page.mouse.up();
      const after = await page.$eval('#list', e => e.getBoundingClientRect().width);
      ok(Math.abs(after - before - 100) <= 3, `list pane resized ${before} -> ${after}`);
      await page.reload(); await page.waitForSelector('.row');
      ok(Math.abs(await page.$eval('#list', e => e.getBoundingClientRect().width) - after) <= 3, 'width remembered after reload');
    }
    ok(errs.length === 0, `${w}px: no page errors ${errs.join(' | ')}`);
    await page.close();
  }
} finally { await browser.close(); srv.close(); }
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
