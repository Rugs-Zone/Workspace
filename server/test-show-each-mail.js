/* "Show each mail" is the rule now - checked in the real built app.
 *   node server/test-show-each-mail.js
 */
/* 26 Nov 2026: this suite describes the ONE ROW PER MAIL model, reverted the same day
   (server/patch-back-to-yesterday.js). While one row per conversation is on, these
   checks do not apply - the code they test is still present and still works. */
const _app = require('fs').readFileSync(__dirname + '/../mail-app.html','utf8');
if (/R17:\s*false/.test(_app) || /\{conv:true\}/.test(_app)) {
  console.log('SKIPPED - one row per conversation is on, so "each mail its own row" does not apply.');
  console.log('          (switch rule R17 on in Admin -> Mail rules to run these 11 checks)');
  process.exit(0);
}
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///' + path.join(__dirname, '..', 'mail-app.html').replace(/\\/g, '/');
process.on('uncaughtException', () => {});

const checks = [];
const ok = (n, pass, extra) => checks.push({ n, pass, extra });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const out = {}, now = Date.now();
    DEPTS = [{ id: 'tp', name: 'Team Pulse', box: 'teampulse@rugscreation.com', color: '#0a0' }];
    PEOPLE = [{ id: 'ashok', name: 'Ashok', login: 'merchandiser5@rugscreation.com', dept: 'tp', role: 'Executive', perm: {}, access: {}, active: true }];
    ME = 'ashok';
    document.body.classList.remove('signedout');

    /* even with "grouped" saved in this person's prefs, it must answer "each mail" */
    S.prefs = Object.assign({}, S.prefs, { lv: { conv: true } });
    out.conv = LV().conv;
    out.menuHasNoChoice = !/Group by conversation/.test(vmHTML()) && !/Show each mail/.test(vmHTML());
    out.labelClean = !/Each mail/.test(vmLabel());

    /* the reported conversation: a colleague wrote twice, we replied twice */
    const col = at => ({ from: 'packaging', email: 'packaging@rugscreation.com', to: 'Ashok <merchandiser5@rugscreation.com>', cc: '', at, body: 'io 4868 packing', ours: true });
    const our = at => ({ by: 'ashok', from: 'Ashok', email: 'teampulse@rugscreation.com', to: 'packaging@rugscreation.com', cc: '', at, body: 'noted thanks', ours: true });
    const buyer = at => ({ from: 'Max Zipper', email: 'cs2@maxzippers.com', to: 'teampulse@rugscreation.com', cc: '', at, body: 'zip order' });
    const t = {
      id: 'tp:1', dept: 'tp', box: 'teampulse@rugscreation.com', folder: 'inbox', status: 'open', owner: 'ashok',
      unread: true, last: now, sub: 'FW: IO - 4868 TBM', pre: 'io 4868', from: 'packaging', email: 'packaging@rugscreation.com',
      other: false, cats: [], to: [], hist: [], msgs: [col(now - 7 * 86400e3), our(now - 3 * 86400e3), col(now - 86400e3), our(now)]
    };
    const t2 = Object.assign({}, t, { id: 'tp:2', sub: 'New zipper order', msgs: [buyer(now - 7200e3), our(now - 3600e3)] });
    S.threads = [t, t2];
    const q = document.querySelector('#q'); if (q) q.value = '';
    tab = 'focused'; filt = 'all';

    view = { type: 'box', dept: 'tp', folder: 'inbox' };
    const inbox = listRows();
    out.inboxRows = inbox.length;                         // 2 colleague mails + 1 buyer mail = 3
    out.inboxHasColleagueRows = inbox.filter(x => x.email === 'packaging@rugscreation.com').length;
    out.inboxHasNoOurRows = inbox.filter(x => x.email === 'teampulse@rugscreation.com').length;
    out.eachRowOpensTheThread = inbox.every(x => x.id === 'tp:1' || x.id === 'tp:2');
    out.unreadOnNewestIn = inbox.filter(x => x.unread).length;

    view = { type: 'box', dept: 'tp', folder: 'sent' };
    const sent = listRows();
    out.sentRows = sent.length;                           // our 2 + our 1 = 3
    out.sentOnlyOurs = sent.every(x => x.email === 'teampulse@rugscreation.com');
    return out;
  });

  ok('the choice is fixed at "each mail", even when "grouped" is saved in prefs', r.conv === false);
  ok('the View menu no longer offers the two conversation options', r.menuHasNoChoice);
  ok('the View button does not carry a pointless "Each mail" label', r.labelClean);
  ok('the Inbox shows one row per mail that came in', r.inboxRows === 3, 'rows=' + r.inboxRows);
  ok('a colleague\'s two mails each get their own Inbox row', r.inboxHasColleagueRows === 2, 'got ' + r.inboxHasColleagueRows);
  ok('our own replies are not rows in the Inbox', r.inboxHasNoOurRows === 0);
  ok('every row still opens its whole conversation', r.eachRowOpensTheThread);
  ok('in an unread conversation only its newest incoming mail looks unread (one row each, 2 conversations)', r.unreadOnNewestIn === 2, 'got ' + r.unreadOnNewestIn);
  ok('Sent shows one row per mail we sent', r.sentRows === 3, 'rows=' + r.sentRows);
  ok('a colleague\'s mail never shows as a row in Sent', r.sentOnlyOurs);
  ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  let bad = 0;
  checks.forEach(c => { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.n + (c.pass || !c.extra ? '' : '  -> ' + c.extra)); });
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  await browser.close();
  process.exitCode = bad ? 1 : 0;
})();
