/* 24 Nov 2026: the list says when mail is being hidden (server/patch-why-missing.js).
 *   node server/test-why-missing.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///' + path.join(__dirname, '..', 'mail-app.html').replace(/\\/g, '/');
const checks = [];
const ok = (n, p, x) => checks.push({ n, p, x });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    window.api = async () => ({});
    const BOX = 'teamalpha@rugscreation.com', D = 86400000;
    DEPTS = [{ id: 'alpha', name: 'Merch \u00b7 Team Alpha', box: 'teamalpha@', color: '#ff5001' }];
    PEOPLE = [
      { id: 'me', name: 'Jagjit Singh', login: 'merchandiser2@rugscreation.com', dept: 'alpha', role: 'Manager', perm: { assign: 1, delete: 1, transfer: 1, dashboards: 1 }, active: true, hasPw: true },
      { id: 'pr', name: 'Priya', login: 'crm@rugscreation.com', dept: 'alpha', role: 'Admin', perm: {}, active: true, hasPw: true }
    ];
    ME = 'me';
    const mk = (i, when, status) => {
      const ms = [{ mailbox: BOX, gmail_id: 'x' + i, gmail_thread_id: 'x' + i, direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Buyer', to_text: BOX, body_text: 'please confirm', sent_at: new Date(when).toISOString() }];
      const row = { mailbox: BOX, gmail_thread_id: 'x' + i, subject: 'Mail ' + i, snippet: 'please confirm', counterpart_email: 'buyer@maxzipper.com', counterpart_name: 'Buyer', msg_count: 1, last_msg_at: new Date(when).toISOString(), has_in: true, has_out: false, unread: false, owner_id: null, status, folder: 'inbox', dept_id: 'alpha', updated_at: new Date().toISOString() };
      return mapRow(row, ms, [], null, 'alpha');
    };
    const now = Date.now();
    S.threads = [];
    for (let i = 0; i < 12; i++) S.threads.push(mk(i, Date.parse('2026-11-10T06:00:00Z') + i * 1000, 'done'));   // 10 Nov, finished
    for (let i = 20; i < 25; i++) S.threads.push(mk(i, now - D, 'new'));                                          // yesterday, open
    app = 'mail'; view = { type: 'box', dept: 'alpha', folder: 'inbox' }; openId = null; filt = 'all';
    document.body.classList.remove('signedout');
    window.__liveReady = true;
    OLDMAIL = { history_days: 365, hide_before_live: false, live_at: null, loaded: true };
    const note = () => { render(); const e = [...document.querySelectorAll('.list .shelp')].map(x => x.textContent).join(' || '); return e; };

    const out = {};
    out.quiet = note();                                        // nothing hidden: no note
    out.rowsAll = listRows().length;

    filt = 'open';                                             // the filter people leave on
    out.filtered = note();
    out.rowsOpen = listRows().length;
    const btn = document.querySelector('.list [data-showall]');
    out.hasShowAll = !!btn;
    if (btn) { btn.click(); out.afterShowAll = { filt, rows: listRows().length }; }

    filt = 'all';
    OLDMAIL = { history_days: 365, hide_before_live: true, live_at: Date.parse('2026-11-16T05:25:24Z'), loaded: true };
    out.beforeLive = note();
    out.rowsHidden = listRows().length;
    ME = 'pr';                                                 // the admin sees how to undo it
    out.adminWording = note();
    return out;
  });

  ok('nothing is hidden: no note at all', !/is hidden|is hiding/.test(r.quiet), r.quiet);
  ok('with the Open filter on, it says how many it is hiding', /The Open filter is hiding 12 conversations/.test(r.filtered), r.filtered);
  ok('...and offers Show all', r.hasShowAll);
  ok('Show all brings them back', r.afterShowAll && r.afterShowAll.filt === 'all' && r.afterShowAll.rows === r.rowsAll, JSON.stringify(r.afterShowAll));
  ok('"Hide mail from before Go live" is reported, with the count and the date', /Mail from before Go live \(16 Nov\) is hidden for everyone — 12 conversations here/.test(r.beforeLive), r.beforeLive);
  ok('and those 12 really are out of the list', r.rowsHidden === 5, 'rows ' + r.rowsHidden);
  ok('a team member is told to ask the admin', /Ask the admin to untick it/.test(r.beforeLive), r.beforeLive);
  ok('the admin is told where the tick is', /Admin → Overview → Old mail/.test(r.adminWording), r.adminWording);

  console.log('');
  checks.forEach(c => console.log((c.p ? 'PASS  ' : 'FAIL  ') + c.n + (c.p ? '' : '   -> ' + (c.x === undefined ? '' : c.x))));
  const bad = checks.filter(c => !c.p).length;
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  console.log(errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
