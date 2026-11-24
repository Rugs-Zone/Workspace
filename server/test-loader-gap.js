/* 24 Nov 2026: "Team Alpha mail from 3 Nov to 15 Nov is not in the Inbox".
 *
 * This reproduces the real situation and checks the fix (server/patch-loader-gap.js):
 *   - the mailbox has 700 conversations spread over 1 Oct to today (a stand-in for the live
 *     550 in the last 30 days)
 *   - the browser starts with only the newest 155 of them (what sign-in really sends for one
 *     mailbox when the 1,500 newest are shared across nine) PLUS one stray conversation from
 *     September, the kind the device copy leaves behind
 *   - api('more') answers exactly as rm_list_box does: conversations older than `before`,
 *     newest first, 500 at a time
 *
 * The old loader looked at the oldest conversation in memory (September), decided it already
 * had the last 30 days and stopped without asking for anything - leaving 3 to 15 Nov missing.
 *
 *   node server/test-loader-gap.js
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

  const r = await page.evaluate(async () => {
    const BOX = 'teamalpha@rugscreation.com', D = 86400000;
    DEPTS = [{ id: 'alpha', name: 'Merch \u00b7 Team Alpha', box: 'teamalpha@', color: '#ff5001' }];
    PEOPLE = [{ id: 'me', name: 'Jagjit Singh', login: 'merchandiser2@rugscreation.com', dept: 'alpha', role: 'Manager', perm: { assign: 1, delete: 1, transfer: 1, dashboards: 1 }, active: true, hasPw: true }];
    ME = 'me';

    /* the whole mailbox as the server holds it: 700 conversations, 1 Oct -> today, plus one
       from 9 September (the stray the device copy keeps) */
    const row = (i, when) => ({
      mailbox: BOX, gmail_thread_id: 'g' + i, subject: 'Buyer mail ' + i, snippet: 'please confirm',
      counterpart_email: 'buyer' + (i % 20) + '@maxzipper.com', counterpart_name: 'Buyer ' + (i % 20),
      msg_count: 1, last_msg_at: new Date(when).toISOString(), has_in: true, has_out: false, unread: false,
      owner_id: null, status: 'done', folder: 'inbox', dept_id: 'alpha', updated_at: new Date().toISOString()
    });
    const msg = (i, when) => ({ mailbox: BOX, gmail_id: 'g' + i + 'a', gmail_thread_id: 'g' + i, direction: 'in', from_email: 'buyer' + (i % 20) + '@maxzipper.com', from_name: 'Buyer ' + (i % 20), to_text: BOX, body_text: 'please confirm ' + i, sent_at: new Date(when).toISOString() });
    const START = Date.parse('2026-10-01T04:00:00Z'), END = Date.now() - 3600000;
    const ALL = [];
    for (let i = 0; i < 700; i++) ALL.push({ i, when: START + Math.round((END - START) * (i / 699)) });
    ALL.push({ i: 999, when: Date.parse('2026-09-09T09:42:53Z') });      // the stray old one
    ALL.sort((a, b) => b.when - a.when);                                  // newest first

    const asked = [];
    window.api = async (action, p) => {
      if (action !== 'more') return {};
      asked.push({ before: p.before, when: new Date(p.before).toISOString().slice(0, 10) });
      const got = ALL.filter(x => x.when < p.before).slice(0, p.limit || 500);   // exactly like rm_list_box
      return {
        threads: got.map(x => row(x.i, x.when)), messages: got.map(x => msg(x.i, x.when)),
        activity: [], history_days: 365, now: Date.now()
      };
    };

    /* what the browser starts with: the newest 155 + the September stray */
    const first = ALL.filter(x => x.i !== 999).slice(0, 155).concat(ALL.filter(x => x.i === 999));
    S.threads = first.map(x => mapRow(row(x.i, x.when), [msg(x.i, x.when)], [], null, 'alpha'));
    const has = (from, to) => S.threads.filter(t => t.last >= Date.parse(from) && t.last < Date.parse(to)).length;
    const before = {
      loaded: S.threads.length,
      newestGap: has('2026-11-03T00:00:00+05:30', '2026-11-16T00:00:00+05:30'),
      oldestLoaded: new Date(Math.min(...S.threads.map(t => t.last))).toISOString().slice(0, 10)
    };

    app = 'mail'; view = { type: 'box', dept: 'alpha', folder: 'inbox' }; openId = null;
    document.body.classList.remove('signedout');
    window.__liveReady = true;
    MORE_DL = 0;                                   // no sign-in deadline in this test
    for (const k in MORE) delete MORE[k];
    render();

    await loadMoreBox('alpha', 'recent');          // the phase the sign-in screen waits for
    const mid = { threads: S.threads.length, gap: has('2026-11-03T00:00:00+05:30', '2026-11-16T00:00:00+05:30'), asked: asked.length };
    await loadMoreBox('alpha', 'all');             // the quiet rest-of-the-year phase
    view = { type: 'box', dept: 'alpha', folder: 'inbox' }; render();
    const rows = listRows();
    return {
      before, mid,
      after: { threads: S.threads.length, gap: has('2026-11-03T00:00:00+05:30', '2026-11-16T00:00:00+05:30') },
      asked, inboxRows: rows.length,
      inboxGap: rows.filter(t => t.last >= Date.parse('2026-11-03T00:00:00+05:30') && t.last < Date.parse('2026-11-16T00:00:00+05:30')).length,
      wholeMailbox: 701,
      state: { done: !!(MORE[BOX] || {}).done, cur: (MORE[BOX] || {}).cur ? new Date(MORE[BOX].cur).toISOString().slice(0, 10) : null }
    };
  });

  ok('the browser starts with the newest 156 only, so most of 3-15 Nov is missing', r.before.loaded === 156 && r.before.newestGap < r.after.gap / 2, JSON.stringify({start:r.before,end:r.after}));
  ok('a stray September conversation is in memory (what used to stop the loader)', r.before.oldestLoaded === '2026-09-09', r.before.oldestLoaded);
  ok('the loader asks the server anyway - it no longer trusts what is in memory', r.asked.length >= 1, JSON.stringify(r.asked.slice(0, 4)));
  ok('the first page is asked from today, not from September', r.asked.length > 0 && r.asked[0].when >= '2026-11-23', JSON.stringify(r.asked[0]));
  ok('the sign-in phase alone brings the missing 3-15 Nov mail back', r.mid.gap > 100, 'found ' + r.mid.gap);
  ok('the quiet phase carries on from where it stopped (it does not start again)', r.asked.length <= 6 && r.state.cur !== null, JSON.stringify({ asked: r.asked.map(a => a.when), cur: r.state.cur }));
  ok('the whole mailbox is loaded in the end', r.after.threads === r.wholeMailbox, r.after.threads + ' of ' + r.wholeMailbox);
  ok('and 3-15 Nov is in the Inbox list itself', r.inboxGap > 100, 'rows in that range: ' + r.inboxGap + ' of ' + r.inboxRows);
  ok('the mailbox is marked finished only after a short page', r.state.done === true, JSON.stringify(r.state));

  console.log('');
  checks.forEach(c => console.log((c.p ? 'PASS  ' : 'FAIL  ') + c.n + (c.p ? '' : '   -> ' + (c.x === undefined ? '' : c.x))));
  const bad = checks.filter(c => !c.p).length;
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  console.log(errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
