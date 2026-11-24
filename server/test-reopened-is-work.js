/* 24 Nov 2026: a conversation the server put back ("Reopened by system") counts as work
 * again, even though its newest mail is older than Go live - while an identical one without
 * that line still does not.
 *
 *   node server/test-reopened-is-work.js
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
    DEPTS = [{ id: 'alpha', name: 'Merch \u00b7 Team Alpha', box: 'teamalpha@', color: '#ff5001' }];
    PEOPLE = [{ id: 'me', name: 'Jagjit Singh', login: 'merchandiser2@rugscreation.com', dept: 'alpha', role: 'Manager', perm: { assign: 1, delete: 1, transfer: 1, dashboards: 1 }, active: true, hasPw: true }];
    ME = 'me';
    const BOX = 'teamalpha@rugscreation.com';
    const GOLIVE = Date.parse('2026-11-16T05:25:24Z');
    S.trackFrom = { alpha: GOLIVE };                     // Go live, as rm_go_live set it
    S.prefs = { ...(S.prefs || {}), workFrom: new Date(GOLIVE).toISOString() };
    const mk = (tid, when, acts) => {
      const ms = [
        { mailbox: BOX, gmail_id: tid + 'a', gmail_thread_id: tid, direction: 'out', from_email: BOX, from_name: 'Team Alpha', sent_by: 'me', to_text: 'buyer@maxzipper.com', body_text: 'our reply', sent_at: new Date(Date.parse(when) - 86400000).toISOString() },
        { mailbox: BOX, gmail_id: tid + 'b', gmail_thread_id: tid, direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Hershika', to_text: BOX, body_text: 'any update please', sent_at: when }
      ];
      const row = { mailbox: BOX, gmail_thread_id: tid, subject: 'MAX ZIPPER ' + tid, snippet: 'any update please', counterpart_email: 'buyer@maxzipper.com', counterpart_name: 'Hershika', msg_count: 2, last_msg_at: when, has_in: true, has_out: true, unread: false, owner_id: null, status: 'new', folder: 'inbox', dept_id: 'alpha', updated_at: new Date().toISOString() };
      return mapRow(row, ms, acts || [], null, 'alpha');
    };
    const put = { mailbox: BOX, gmail_thread_id: 'rep', user_id: null, kind: 'reopen', text: 'Reopened by system: marked done by mistake on 16 Nov', at: new Date().toISOString() };
    S.threads = [
      mk('rep', '2026-11-13T05:28:46Z', [put]),          // put back by the server
      mk('old', '2026-11-13T05:28:46Z', []),             // the same age, never touched
      mk('new', new Date().toISOString(), [])            // mail since Go live
    ];
    app = 'mail';
    document.body.classList.remove('signedout');
    window.__liveReady = true;
    const inFav = (id, fav) => { view = { type: 'fav', id: fav }; openId = null; render(); return listRows().some(t => t.id === 'alpha:' + id); };
    return {
      work: S.threads.map(t => t.id + '=' + isWork(t)).join(' '),
      repNeeds: inFav('rep', 'needs'), oldNeeds: inFav('old', 'needs'), newNeeds: inFav('new', 'needs'),
      repAssign: inFav('rep', 'assign'), oldAssign: inFav('old', 'assign'),
      repInbox: (() => { view = { type: 'box', dept: 'alpha', folder: 'inbox' }; render(); return listRows().some(t => t.id === 'alpha:rep'); })(),
      hist: (S.threads[0].hist || []).map(h => h.txt)
    };
  });

  ok('the server\u2019s history line arrived on the conversation', /Reopened by system/.test((r.hist || []).join(' ')), JSON.stringify(r.hist));
  ok('a conversation the server put back counts as work', / alpha:rep=true/.test(' ' + r.work), r.work);
  ok('one of the same age that was never touched still does not', /alpha:old=false/.test(r.work), r.work);
  ok('mail since Go live counts as before', /alpha:new=true/.test(r.work), r.work);
  ok('it shows in Needs owner', r.repNeeds);
  ok('...and in To assign (the manager\u2019s list)', r.repAssign);
  ok('the untouched one of the same age shows in neither', !r.oldNeeds && !r.oldAssign, JSON.stringify([r.oldNeeds, r.oldAssign]));
  ok('and it is in the Inbox as well', r.repInbox);

  console.log('');
  checks.forEach(c => console.log((c.p ? 'PASS  ' : 'FAIL  ') + c.n + (c.p ? '' : '   -> ' + (c.x === undefined ? '' : c.x))));
  const bad = checks.filter(c => !c.p).length;
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  console.log(errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
