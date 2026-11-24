/* Measures the attachment work on a mail with 5 attachments, BEFORE and AFTER today's change.
 * "Before" is the app exactly as committed in git; "after" is the built app in the working copy.
 * Same browser, same stubbed server (every attachment takes 300 ms and is counted), same mail,
 * and the same code path the reading pane uses: attHTML() draws the chips into an article.mail,
 * then olkExtras() adds the thumbnails and buttons.
 *   node server/test-att-speed.js
 */
const path = require('path'), fs = require('fs'), cp = require('child_process');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ROOT = path.join(__dirname, '..');
const BEFORE = path.join(ROOT, '.tmp', 'mail-app.before.html');
process.on('uncaughtException', () => {});
cp.execSync('git show HEAD:mail-app.html > ' + JSON.stringify(BEFORE), { cwd: ROOT, shell: 'cmd.exe' });

const PORT = 8741;
const srv = require('http').createServer((q, r) => {
  const f = decodeURIComponent(q.url.split('?')[0]);
  const p = f === '/before' ? BEFORE : path.join(ROOT, f === '/' ? 'mail-app.html' : f);
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'Content-Type': /\.js$/.test(p) ? 'text/javascript' : /\.json$/.test(p) ? 'application/json' : /\.txt$/.test(p) ? 'text/plain' : 'text/html' });
    r.end(d);
  });
}).listen(PORT);

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

async function run(page, url) {
  await page.goto(url);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async (PNG) => {
    const out = { notes: [] };
    DEPTS = [{ id: 'tp', name: 'Team Pulse', box: 'teampulse@rugscreation.com', color: '#0a0' }];
    PEOPLE = [{ id: 'ashok', name: 'Ashok', login: 'merchandiser5@rugscreation.com', dept: 'tp', role: 'Executive', perm: {}, access: {}, active: true }];
    ME = 'ashok'; document.body.classList.remove('signedout');

    let calls = 0;
    window.api = (action, p) => {
      if (action !== 'attachment') return Promise.resolve({});
      calls++;
      return new Promise(res => setTimeout(() => res({ name: p.name, mime: 'image/png', b64: PNG }), 300));
    };
    try { if (window.caches) await caches.delete('rugs-att-v1'); } catch (e) {}

    const atts = [
      { name: 'image001.png', mime: 'image/png', size: 4925, inline: true, cid: 'image001.png@01DD' },
      { name: 'Outlook-logo.png', mime: 'image/png', size: 8100, inline: true },
      { name: 'Rug photo.jpg', mime: 'image/jpeg', size: 900000 },
      { name: 'Invoice 77-26.pdf', mime: 'application/pdf', size: 180000 },
      { name: 'Packing list.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 24000 }
    ];
    const now = Date.now();
    const m = { gid: 'GID5', from: 'Buyer', email: 'buyer@ikea.com', to: 'teampulse@rugscreation.com', cc: '', at: now,
      body: 'five files', raw: '<p>Regards</p><img src="cid:image001.png@01DD">', full: true, atts,
      /* the real-world shape: the Drive copy is done, so every file is listed with a link -
         this is where the signature pictures used to come back into the attachment bar */
      files: atts.map(x => ({ name: x.name, size: x.size, link: 'https://drive.google.com/file/d/ID' + x.name.length + '/view' })) };
    const t = { id: 'tp:spd', dept: 'tp', box: 'teampulse@rugscreation.com', folder: 'inbox', status: 'open', owner: 'ashok',
      unread: false, last: now, sub: 'Five files', pre: 'five', from: 'Buyer', email: 'buyer@ikea.com',
      other: false, cats: [], to: [], hist: [], full: true, msgs: [m] };
    S.threads = [t]; view = { type: 'box', dept: 'tp', folder: 'inbox' }; app = 'mail'; openId = 'tp:spd';
    if (typeof openMsgs === 'object') openMsgs['tp:spd'] = new Set([0]);

    /* the reading pane's own markup for this one message */
    const paint = (farDown) => {
      let read = document.getElementById('read');
      if (!read) { read = document.createElement('div'); read.id = 'read'; document.body.appendChild(read); }
      read.style.cssText = 'display:block;height:' + (farDown ? '400px' : 'auto') + ';overflow:auto';
      read.innerHTML = (farDown ? '<div style="height:3000px"></div>' : '') +
        '<article class="mail" id="msg-tp:spd-0"><header><b>Buyer</b></header><div class="mbody">' + attHTML(m, t) + '</div></article>';
      if (typeof olkExtras === 'function') olkExtras();
      return read;
    };

    /* (1) the mail is drawn with the attachments in view */
    const t0 = performance.now();
    let read = paint(false);
    out.drawMs = Math.round(performance.now() - t0);
    out.chips = read.querySelectorAll('.att').length;
    out.chipNames = [...read.querySelectorAll('.att')].map(x => x.textContent.replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ')).join(' | ');
    out.hiddenLink = !!read.querySelector('[data-attshow]');
    await new Promise(r => setTimeout(r, 1500));
    out.visibleCalls = calls;

    /* (2) the same mail with the attachments below the fold (every cache emptied first,
       so this measures the fetching and not what step 1 already brought in) */
    calls = 0;
    try { Object.keys(ATHUMB).forEach(k => delete ATHUMB[k]); } catch (e) {}
    try { Object.keys(ATTB).forEach(k => delete ATTB[k]); } catch (e) {}
    try { if (window.caches) await caches.delete('rugs-att-v1'); } catch (e) {}
    read = paint(true);
    await new Promise(r => setTimeout(r, 1500));
    out.offscreenCalls = calls;

    /* (3) the quiet prefetch when a mail is opened */
    calls = 0;
    if (typeof attPrefetch === 'function') attPrefetch(t);
    await new Promise(r => setTimeout(r, 1500));
    out.prefetchCalls = calls;

    /* (4) opening one attachment, then opening it again */
    calls = 0;
    await window.rzAttBytes('teampulse@rugscreation.com', 'GID5', 'Invoice 77-26.pdf').catch(() => {});
    out.clickCalls = calls;
    calls = 0;
    await window.rzAttBytes('teampulse@rugscreation.com', 'GID5', 'Invoice 77-26.pdf').catch(() => {});
    out.againCalls = calls;

    /* (5) kept for the next visit? */
    out.cacheKept = false;
    try { if (window.caches) { const c = await caches.open('rugs-att-v1'); out.cacheKept = (await c.keys()).length > 0; } } catch (e) {}
    return out;
  }, PNG);
  return r;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));

  const before = await run(page, 'http://127.0.0.1:' + PORT + '/before');
  const after = await run(page, 'http://127.0.0.1:' + PORT + '/mail-app.html');

  const row = (k, b, a) => console.log('  ' + k.padEnd(46) + String(b).padStart(9) + String(a).padStart(11));
  console.log('\n  one mail, 5 attachments (2 of them signature pictures)  BEFORE      AFTER');
  row('fetches when the mail is drawn, files in view', before.visibleCalls, after.visibleCalls);
  row('fetches when the files are below the fold', before.offscreenCalls, after.offscreenCalls);
  row('fetches by the quiet prefetch on opening', before.prefetchCalls, after.prefetchCalls);
  row('attachment chips shown', before.chips, after.chips);
  row('link to the hidden inline pictures', before.hiddenLink ? 'yes' : 'no', after.hiddenLink ? 'yes' : 'no');
  row('chips drawn in (ms)', before.drawMs, after.drawMs);
  row('fetches to open one attachment', before.clickCalls, after.clickCalls);
  row('fetches to open the same one again', before.againCalls, after.againCalls);
  row('kept in the browser cache for next visit', before.cacheKept ? 'yes' : 'no', after.cacheKept ? 'yes' : 'no');
  console.log('\n  before: ' + before.chipNames);
  console.log('  after : ' + after.chipNames);
  console.log('\n  (each fetch answers in 300 ms in this test, so 3 fetches = ~0.9 s of waiting)');

  const checks = [];
  const ok = (n, pass, extra) => checks.push({ n, pass, extra });
  ok('drawing the mail costs fewer attachment fetches', after.visibleCalls < before.visibleCalls, before.visibleCalls + ' -> ' + after.visibleCalls);
  ok('files below the fold are not fetched at all', after.offscreenCalls === 0 && before.offscreenCalls > 0, before.offscreenCalls + ' -> ' + after.offscreenCalls);
  ok('the quiet prefetch brings in one file, not three', after.prefetchCalls === 1 && before.prefetchCalls > 1, before.prefetchCalls + ' -> ' + after.prefetchCalls);
  ok('the two signature pictures are out of the attachment bar', after.chips === 3 && before.chips > 3, before.chips + ' -> ' + after.chips);
  ok('they are still reachable behind a link', after.hiddenLink && !before.hiddenLink);
  ok('the real photo, the PDF and the spreadsheet all stayed', /Rug photo/.test(after.chipNames) && /Invoice/.test(after.chipNames) && /Packing/.test(after.chipNames), after.chipNames);
  ok('opening an attachment costs one fetch', after.clickCalls === 1);
  ok('opening it again costs none', after.againCalls === 0);
  ok('it is kept in the browser cache for the next visit', after.cacheKept && !before.cacheKept);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

  let bad = 0;
  console.log('');
  checks.forEach(c => { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.n + (c.pass || !c.extra ? '' : '  -> ' + c.extra)); });
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  await browser.close();
  srv.close();
  process.exitCode = bad ? 1 : 0;
})();
