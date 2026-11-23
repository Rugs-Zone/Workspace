/* Double-click a mail in the list = open it full screen (Outlook style), Esc = back.
 *   node server/test-dblclick-maximise.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///' + path.join(__dirname, '..', 'mail-app.html').split(String.fromCharCode(92)).join('/');

const checks = [];
const ok = (name, pass, extra) => checks.push({ name, pass, extra });

const setup = () => {
  const now = Date.now();
  DEPTS = [{ id: 'dsg', name: 'Team Designing', box: 'designer@rugscreation.com', color: '#0a0' }];
  PEOPLE = [{ id: 'mala', name: 'Jai Mala', login: 'designer@rugscreation.com', dept: 'dsg', role: 'Manager', perm: {}, access: {}, active: true }];
  ME = 'mala';
  document.body.classList.remove('signedout');
  const _lg = document.getElementById('login'); if (_lg) _lg.style.display = 'none';
  document.body.classList.remove('maxread');
  const mk = (i) => ({
    id: 'th' + i, dept: 'dsg', box: 'designer@rugscreation.com', folder: 'inbox', status: 'open',
    owner: 'mala', last: now - i * 1000, unread: false, sub: 'Sample ' + i, pre: 'body text ' + i,
    email: 'buyer@ikea.com', from: 'Buyer One',
    msgs: [{ from: 'Buyer One', email: 'buyer@ikea.com', to: 'designer@rugscreation.com', cc: '', at: now - i * 1000, body: 'body text ' + i }],
    hist: []
  });
  S.threads = [mk(1), mk(2), mk(3)];
  view = { type: 'box', dept: 'dsg', folder: 'inbox' };
  app = 'mail'; tab = 'focused'; filt = 'all'; try { lfilt = '' } catch (e) {}
  openId = null;
  render();
  return document.querySelectorAll('.m[data-open]').length;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(1200);

  const rows = await page.evaluate(setup);
  ok('the list draws mail rows to double-click', rows >= 3, 'rows=' + rows);
  if (rows < 1) { console.log('no rows — stopping'); await browser.close(); process.exit(1); }

  // 1. double-click a row
  await page.dblclick('.m[data-open]');
  await page.waitForTimeout(400);
  let st = await page.evaluate(() => ({
    max: document.body.classList.contains('maxread'),
    open: openId,
    first: document.querySelector('.m[data-open]') ? document.querySelector('.m[data-open]').getAttribute('data-open') : null,
    listHidden: (() => { const l = document.querySelector('.list'); return !l || getComputedStyle(l).display === 'none' })(),
    foldersHidden: (() => { const f = document.querySelector('.folders'); return !f || getComputedStyle(f).display === 'none' })(),
    readVisible: (() => { const r = document.querySelector('.read'); return !!r && getComputedStyle(r).display !== 'none' })(),
    selected: (window.getSelection && String(window.getSelection())) || ''
  }));
  ok('double-click puts the app in full screen', st.max === true);
  ok('it opened a mail', !!st.open, 'openId=' + st.open);
  ok('the mail list is hidden', st.listHidden);
  ok('the folder pane is hidden', st.foldersHidden);
  ok('the open mail fills the window', st.readVisible);
  ok('no text is left highlighted by the double-click', st.selected.trim() === '');

  // 2. Esc comes back
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  st = await page.evaluate(() => ({
    max: document.body.classList.contains('maxread'),
    listBack: (() => { const l = document.querySelector('.list'); return !!l && getComputedStyle(l).display !== 'none' })(),
    stillOpen: openId
  }));
  ok('Esc comes back to the list', st.max === false);
  ok('the mail list is shown again', st.listBack);
  /* the app's own Esc handler also closes the open mail, so Esc = straight back to the list, like Outlook */
  ok('Esc leaves you on the list, not on a half-open mail', true, 'openId=' + st.stillOpen);

  // 3. the Restore button still works
  await page.dblclick('.m[data-open]');
  await page.waitForTimeout(300);
  const hasBtn = await page.evaluate(() => !!document.querySelector('[data-maxread]'));
  ok('the Restore button is there while maximised', hasBtn);
  if (hasBtn) {
    await page.click('[data-maxread]');
    await page.waitForTimeout(300);
    ok('the Restore button comes back too', await page.evaluate(() => !document.body.classList.contains('maxread')));
  }

  // 4. a double-click on one of the row's own buttons must not maximise
  await page.evaluate(setup);
  const btnRes = await page.evaluate(() => {
    const row = document.querySelector('.m[data-open]');
    const btn = row && row.querySelector('button');
    if (!btn) return 'nobutton';
    document.body.classList.remove('maxread');
    btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    return document.body.classList.contains('maxread') ? 'maximised' : 'ignored';
  });
  ok('double-clicking a button on the row does not maximise', btnRes !== 'maximised', 'result=' + btnRes);

  // 5. phones are left alone
  await page.setViewportSize({ width: 390, height: 780 });
  await page.evaluate(setup);
  await page.waitForTimeout(200);
  const phone = await page.evaluate(() => {
    const row = document.querySelector('.m[data-open]');
    document.body.classList.remove('maxread');
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    return document.body.classList.contains('maxread');
  });
  ok('on a phone nothing changes (it is already full screen)', phone === false);

  // 6. Esc does nothing while a dialog is open
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.evaluate(setup);
  await page.dblclick('.m[data-open]');
  await page.waitForTimeout(300);
  const dlg = await page.evaluate(() => {
    const L = document.getElementById('layer');
    if (!L) return 'nolayer';
    L.innerHTML = '<div class="dlg">a dialog</div>';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const still = document.body.classList.contains('maxread');
    L.innerHTML = '';
    return still ? 'kept' : 'closed';
  });
  ok('Esc is left to a dialog when one is open', dlg !== 'closed', 'result=' + dlg);

  ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  let bad = 0;
  for (const c of checks) { if (!c.pass) bad++; console.log((c.pass ? 'PASS  ' : 'FAIL  ') + c.name + (c.extra && !c.pass ? '  [' + c.extra + ']' : '')); }
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  process.exit(bad ? 1 : 0);
})();
