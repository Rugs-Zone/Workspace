/* Checks the folder rule in the real built app:
 *   Inbox = anything somebody sent us, whether we have answered it or not
 *   Sent  = only what we sent that nobody has answered yet
 * and that an answered conversation still counts in the Inbox numbers and
 * still shows for whoever owns it.
 *
 *   node server/test-inbox-stays.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///' + path.join(__dirname, '..', 'mail-app.html').replace(/\\/g, '/');

const checks = [];
const ok = (name, pass, extra) => checks.push({ name, pass, extra });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const out = {};
    const now = Date.now();
    DEPTS = [{ id: 'dsg', name: 'Team Designing', box: 'designer@rugscreation.com', color: '#0a0' }];
    PEOPLE = [
      { id: 'mala', name: 'Jai Mala', login: 'designer@rugscreation.com', dept: 'dsg', role: 'Manager', perm: {}, access: {}, active: true },
      { id: 'nikhil', name: 'Nikhil', login: 'nikhilrugs@rugscreation.com', dept: 'dsg', role: 'Executive', perm: {}, access: {}, active: true }
    ];
    document.body.classList.remove('signedout');

    const mk = (msgs, owner) => ({
      id: 't' + Math.random().toString(36).slice(2), dept: 'dsg', box: 'designer@rugscreation.com',
      folder: 'inbox', status: 'open', owner: owner || null, last: now, msgs, hist: []
    });
    const inMsg = { from: 'Buyer One', email: 'buyer@ikea.com', to: 'designer@rugscreation.com', cc: '', at: now - 3600e3, body: 'hello' };
    const ourMsg = { by: 'mala', from: 'Jai Mala', email: 'designer@rugscreation.com', to: 'buyer@ikea.com', cc: '', at: now, body: 'reply' };

    const buyerOnly = mk([inMsg]);
    const weReplied = mk([inMsg, ourMsg], 'nikhil');          // Mala answered, Nikhil owns it
    const weSentOnly = mk([ourMsg]);                           // we wrote, no answer yet
    const sentThenAnswered = mk([ourMsg, { ...inMsg, at: now + 60e3 }]);

    const look = (t, folder) => { view = { type: 'box', dept: 'dsg', folder }; ME = 'nikhil'; return !!inView(t); };

    out.buyerInInbox = look(buyerOnly, 'inbox');
    out.buyerInSent = look(buyerOnly, 'sent');
    out.answeredStillInInbox = look(weReplied, 'inbox');
    out.answeredNotInSent = look(weReplied, 'sent');
    // viewed as the manager: Team Designing is manager-first, so an executive
    // is not shown mail nobody owns, which has nothing to do with the folder rule
    const lookM = (t, folder) => { view = { type: 'box', dept: 'dsg', folder }; ME = 'mala'; return !!inView(t); };
    out.oursInSent = lookM(weSentOnly, 'sent');
    out.oursNotInInbox = !lookM(weSentOnly, 'inbox');
    out.answeredLeavesSent = !lookM(sentThenAnswered, 'sent');
    out.answeredEntersInbox = lookM(sentThenAnswered, 'inbox');

    // the five Inbox counts follow the same rule
    out.countsAnswered = !!isInboxMail(weReplied);
    out.countsOursOnly = !isInboxMail(weSentOnly);

    // All inboxes
    view = { type: 'all' }; ME = 'nikhil';
    out.allInboxesAnswered = !!inView(weReplied);

    // the owner still sees it after it is handed to him
    ME = 'nikhil'; view = { type: 'box', dept: 'dsg', folder: 'inbox' };
    out.ownerSeesIt = !!inView(weReplied);
    // and a colleague who is not the owner does not (Designing is manager-first)
    PEOPLE.push({ id: 'other', name: 'Someone Else', login: 'other@rugscreation.com', dept: 'dsg', role: 'Executive', perm: {}, access: {}, active: true });
    ME = 'other';
    out.otherDoesNotSeeIt = !inView(weReplied);
    // the manager still sees everything
    ME = 'mala';
    out.managerSeesIt = !!inView(weReplied);
    return out;
  });

  ok('a buyer\u2019s mail is in the Inbox', r.buyerInInbox);
  ok('a buyer\u2019s mail is not in Sent', !r.buyerInSent);
  ok('after we reply it STAYS in the Inbox', r.answeredStillInInbox);
  ok('after we reply it does not jump to Sent', r.answeredNotInSent === false);
  ok('a mail we sent with no answer is in Sent', r.oursInSent);
  ok('a mail we sent with no answer is not in the Inbox', r.oursNotInInbox);
  ok('once answered it leaves Sent', r.answeredLeavesSent);
  ok('once answered it is in the Inbox', r.answeredEntersInbox);
  ok('an answered mail still counts in the Inbox numbers', r.countsAnswered);
  ok('a mail we only sent does not count as Inbox mail', r.countsOursOnly);
  ok('All inboxes shows the answered one too', r.allInboxesAnswered);
  ok('the owner sees it after it is handed to him', r.ownerSeesIt);
  ok('a colleague who does not own it does not see it', r.otherDoesNotSeeIt);
  ok('the manager still sees it', r.managerSeesIt);
  ok('no page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  let bad = 0;
  for (const c of checks) { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name + (c.pass || !c.extra ? '' : '   [' + c.extra + ']')); }
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
