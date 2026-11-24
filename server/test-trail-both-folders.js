/* 24 Nov 2026: open the SAME conversation from the Inbox and from Sent, and check the whole
 * trail is there both times (asked for with the Inbox/Sent verification).
 *
 *   node server/test-trail-both-folders.js
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
    const BOX = 'teamalpha@rugscreation.com', D = 86400000, now = Date.now();
    /* five messages: buyer, us, buyer, us, buyer - the real shape of a working thread */
    const ms = [
      { mailbox: BOX, gmail_id: 'm1', gmail_thread_id: 'tt', direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Hershika', to_text: BOX, body_text: 'ONE first enquiry', sent_at: new Date(now - 9 * D).toISOString() },
      { mailbox: BOX, gmail_id: 'm2', gmail_thread_id: 'tt', direction: 'out', from_email: BOX, from_name: 'Team Alpha', sent_by: 'me', to_text: 'buyer@maxzipper.com', body_text: 'TWO our first answer', sent_at: new Date(now - 8 * D).toISOString() },
      { mailbox: BOX, gmail_id: 'm3', gmail_thread_id: 'tt', direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Hershika', to_text: BOX, body_text: 'THREE their question', sent_at: new Date(now - 7 * D).toISOString() },
      { mailbox: BOX, gmail_id: 'm4', gmail_thread_id: 'tt', direction: 'out', from_email: BOX, from_name: 'Team Alpha', sent_by: 'me', to_text: 'buyer@maxzipper.com', body_text: 'FOUR our second answer', sent_at: new Date(now - 6 * D).toISOString() },
      { mailbox: BOX, gmail_id: 'm5', gmail_thread_id: 'tt', direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Hershika', to_text: BOX, body_text: 'FIVE any update please', sent_at: new Date(now - 5 * D).toISOString() }
    ];
    const row = { mailbox: BOX, gmail_thread_id: 'tt', subject: 'MAX ZIPPER // IO 4813', snippet: 'FIVE any update please', counterpart_email: 'buyer@maxzipper.com', counterpart_name: 'Hershika', msg_count: 5, last_msg_at: ms[4].sent_at, has_in: true, has_out: true, unread: false, owner_id: 'me', status: 'open', folder: 'inbox', dept_id: 'alpha', updated_at: new Date().toISOString() };
    S.threads = [mapRow(row, ms, [], null, 'alpha')];
    S.threads[0].full = true;                       // as if the whole mail had been fetched
    app = 'mail'; openId = null;
    document.body.classList.remove('signedout');
    window.__liveReady = true;

    const look = (folder) => {
      view = { type: 'box', dept: 'alpha', folder };
      openId = null; render();
      const inList = listRows().some(t => t.id === 'alpha:tt');
      openId = 'alpha:tt'; render();
      const read = document.querySelector('#read');
      const mails = read ? read.querySelectorAll('.mail') : [];
      const txt = read ? read.textContent : '';
      return {
        inList,
        messages: mails.length,
        collapsed: [...mails].filter(m => m.classList.contains('collapsed')).length,
        words: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].filter(w => txt.indexOf(w) >= 0),
        openIdx: [...mails].map((m,i)=>m.classList.contains('collapsed')?null:i).filter(i=>i!==null),
        order: [...mails].map(m=>(m.textContent.match(/ONE|TWO|THREE|FOUR|FIVE/)||[''])[0])
      };
    };
    return { inbox: look('inbox'), sent: look('sent') };
  });

  for (const [where, v] of [['the Inbox', r.inbox], ['Sent', r.sent]]) {
    ok('opened from ' + where + ': the conversation is in the list', v.inList, JSON.stringify(v));
    ok('opened from ' + where + ': all five messages of the trail are drawn', v.messages === 5, 'drew ' + v.messages);
    ok('opened from ' + where + ': exactly one message is open, and it is the newest', v.openIdx.length === 1 && v.order[v.openIdx[0]] === 'FIVE', JSON.stringify({open:v.openIdx,order:v.order}));
    ok('opened from ' + where + ': the four older ones are folded, not missing', v.collapsed === 4, 'folded ' + v.collapsed);
    ok('opened from ' + where + ': every message of the trail is in the page', v.words.length === 5, v.words.join(','));
  }

  console.log('');
  checks.forEach(c => console.log((c.p ? 'PASS  ' : 'FAIL  ') + c.n + (c.p ? '' : '   -> ' + (c.x === undefined ? '' : c.x))));
  const bad = checks.filter(c => !c.p).length;
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  console.log(errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
