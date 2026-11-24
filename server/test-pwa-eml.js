/* Checks, in BOTH Edge and Chrome, the parts of "open a .eml without Outlook" that a browser
 * can actually be tested for here:
 *   - the manifest is served, valid, and says it can open .eml files (file_handlers)
 *   - the installed-app hook exists in this browser (launchQueue) and is wired by mail.html
 *   - WITHOUT installing anything: the picker and drag-and-drop open the preview in the tab
 * What cannot be tested from here, and is reported as such, is Windows actually handing a
 * double-clicked .eml to the installed app - that needs a real install and a person's consent.
 *   node server/test-pwa-eml.js
 */
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const BROWSERS = [
  ['Edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
  ['Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
];
const ROOT = path.join(__dirname, '..');
const PORT = 8743;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.txt': 'text/plain', '.json': 'application/manifest+json', '.png': 'image/png' };
const srv = require('http').createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/') f = '/mail.html';
  fs.readFile(path.join(ROOT, f), (e, d) => {
    if (e) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    r.end(d);
  });
}).listen(PORT);
process.on('uncaughtException', () => {});

const checks = [];
const ok = (n, pass, extra) => checks.push({ n, pass, extra });

(async () => {
  for (const [label, exe] of BROWSERS) {
    if (!fs.existsSync(exe)) { ok(label + ': installed on this PC', false, 'not found at ' + exe); continue; }
    const browser = await chromium.launch({ executablePath: exe, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto('http://127.0.0.1:' + PORT + '/mail.html');
    await page.waitForTimeout(3000);

    const r = await page.evaluate(async () => {
      const out = {};
      const lnk = document.querySelector('link[rel=manifest]');
      out.manifestLinked = !!lnk;
      out.manifestHref = lnk ? lnk.getAttribute('href') : '';
      try {
        const m = await (await fetch('mail-manifest.json')).json();
        out.name = m.name;
        out.standalone = m.display === 'standalone';
        const fh = (m.file_handlers || [])[0] || {};
        out.handlesEml = !!(fh.accept && fh.accept['message/rfc822'] && fh.accept['message/rfc822'].indexOf('.eml') >= 0);
        out.handlerAction = String(fh.action || '');
        out.launchExisting = (m.launch_handler || {}).client_mode === 'navigate-existing';
        out.icons = (m.icons || []).length;
      } catch (e) { out.manifestError = String(e.message || e); }
      out.launchQueue = ('launchQueue' in window);
      out.launchWired = Array.isArray(window.__RUGS_LAUNCH_FILES__);
      /* without installing anything: the two ways to open a file already on the PC */
      out.pick = typeof window.rzEmlPick === 'function';
      out.openLocal = typeof window.rzEmlOpenLocal === 'function';
      DEPTS = [{ id: 'tp', name: 'Team Pulse', box: 'teampulse@rugscreation.com', color: '#0a0' }];
      PEOPLE = [{ id: 'a', name: 'Ashok', login: 'merchandiser5@rugscreation.com', dept: 'tp', role: 'Executive', perm: {}, access: {}, active: true }];
      ME = 'a'; document.body.classList.remove('signedout');
      const eml = ['From: Buyer <buyer@ikea.com>', 'To: teampulse@rugscreation.com', 'Subject: Downloaded mail',
        'Date: Mon, 24 Nov 2026 09:00:00 +0530', 'Content-Type: text/plain; charset=utf-8', '', 'Opened without Outlook.'].join('\r\n');
      const f = new File([new TextEncoder().encode(eml)], 'Saved mail.eml', { type: 'message/rfc822' });
      const dt = new DataTransfer(); dt.items.add(f);
      window.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      out.hint = !!document.querySelector('.emldrop');
      window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise(x => setTimeout(x, 800));
      const ov = document.querySelector('.cfview');
      out.dropOpened = !!ov && /Opened without Outlook/.test(ov.querySelector('iframe') ? ov.querySelector('iframe').getAttribute('srcdoc') : '');
      out.dropCard = !!ov && !!ov.querySelector('article.mail header') && /buyer@ikea\.com/.test(ov.textContent);
      if (ov && ov.querySelector('[data-cfvx]')) ov.querySelector('[data-cfvx]').click();
      return out;
    });

    ok(label + ': the manifest is linked on the page', r.manifestLinked && /mail-manifest\.json/.test(r.manifestHref), r.manifestHref);
    ok(label + ': the manifest is valid and names the app', !r.manifestError && r.name === 'Rugs Email', r.manifestError || r.name);
    ok(label + ': it installs as its own window', r.standalone);
    ok(label + ': it says it can open .eml files', r.handlesEml, JSON.stringify(r.handlerAction));
    ok(label + ': a file opens in the window already running', r.launchExisting);
    ok(label + ': this browser has the installed-app file hook (launchQueue)', r.launchQueue);
    ok(label + ': the page is listening for a file the app was started with', r.launchWired);
    ok(label + ': without installing - "Open an .eml file" exists', r.pick && r.openLocal);
    ok(label + ': without installing - dragging a .eml shows the drop hint', r.hint);
    ok(label + ': without installing - dropping it opens the mail in Rugs format', r.dropOpened && r.dropCard);
    ok(label + ': no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await browser.close();
  }

  let bad = 0;
  checks.forEach(c => { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.n + (c.pass || !c.extra ? '' : '  -> ' + c.extra)); });
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  console.log('NOT testable here: Windows handing a double-clicked .eml to the installed app -');
  console.log('that needs a real install and the person to allow it once.');
  srv.close();
  process.exitCode = bad ? 1 : 0;
})();
