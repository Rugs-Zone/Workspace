/* Checks the folder rule in the real built app, using the user's own example:
 *   11:00 buyer writes  -> Inbox
 *   11:01 we reply      -> our reply is in Sent, the conversation STAYS in the Inbox
 *   11:03 buyer answers -> the Inbox row moves to 11:03, trail 11:03 / 11:01 / 11:00
 * so a conversation can be in both folders, and a Sent row shows OUR message
 * (To: …, our time, our words), not the buyer's newest one.
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
    out.sentNotMineHidden = look(weReplied, 'sent');   // Nikhil did not send it (17 Nov rule)
    // viewed as the manager: Team Designing is manager-first, so an executive
    // is not shown mail nobody owns, which has nothing to do with the folder rule
    const lookM = (t, folder) => { view = { type: 'box', dept: 'dsg', folder }; ME = 'mala'; return !!inView(t); };
    out.answeredAlsoInSent = lookM(weReplied, 'sent');  // Mala sent it, so she sees it in Sent
    out.oursInSent = lookM(weSentOnly, 'sent');
    out.oursNotInInbox = !lookM(weSentOnly, 'inbox');
    out.answeredStaysInSent = lookM(sentThenAnswered, 'sent');
    out.answeredEntersInbox = lookM(sentThenAnswered, 'inbox');

    // the Sent ROW must be about our own mail
    view = { type: 'box', dept: 'dsg', folder: 'sent' }; ME = 'mala';
    const html = rowHTML({ ...weReplied, pre: 'hello', email: 'buyer@ikea.com', sub: 'Loom file', unread: false, hist: [] });
    out.sentRowToLine = /To: *buyer@ikea.com/.test(html);
    out.sentRowOurWords = /reply/.test(html) && !/>hello</.test(html);
    out.sentRowOurTime = (typeof lastOut === 'function') && lastOut(weReplied) === ourMsg.at;
    view = { type: 'box', dept: 'dsg', folder: 'inbox' };
    const ih = rowHTML({ ...weReplied, pre: 'hello', email: 'buyer@ikea.com', sub: 'Loom file', unread: false, hist: [] });
    out.inboxRowUnchanged = /hello/.test(ih) && !/To: *buyer/.test(ih);

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
  ok('after we reply our reply also shows in Sent', r.answeredAlsoInSent);
  ok('a colleague who did not send it does not see it in Sent', r.sentNotMineHidden === false);
  ok('a mail we sent with no answer is in Sent', r.oursInSent);
  ok('a mail we sent with no answer is not in the Inbox', r.oursNotInInbox);
  ok('a conversation we wrote in stays in Sent after they answer', r.answeredStaysInSent);
  ok('once answered it is in the Inbox', r.answeredEntersInbox);
  ok('an answered mail still counts in the Inbox numbers', r.countsAnswered);
  ok('a mail we only sent does not count as Inbox mail', r.countsOursOnly);
  ok('All inboxes shows the answered one too', r.allInboxesAnswered);
  ok('the owner sees it after it is handed to him', r.ownerSeesIt);
  ok('a colleague who does not own it does not see it', r.otherDoesNotSeeIt);
  ok('the manager still sees it', r.managerSeesIt);
  ok('a Sent row is addressed "To: the buyer"', r.sentRowToLine);
  ok('a Sent row previews OUR words, not the buyer’s', r.sentRowOurWords);
  ok('a Sent row is timed by our own mail', r.sentRowOurTime);
  ok('the Inbox row is unchanged', r.inboxRowUnchanged);
  ok('no page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  let bad = 0;
  for (const c of checks) { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name + (c.pass || !c.extra ? '' : '   [' + c.extra + ']')); }
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
