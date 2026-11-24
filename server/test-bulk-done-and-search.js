/* Browser test, 24 Nov 2026, for four changes in the real built app (mail-app.html):
 *
 *   1. a bulk "Done" asks first, says how many, and warns about conversations whose newest
 *      mail came in (server/patch-bulk-done-confirm.js)
 *   2. a Quick step that closes mail goes through the same question
 *      (server/patch-quickstep-done-confirm.js)
 *   3. marking ONE such conversation done says so and offers Undo
 *      (server/patch-done-one-warning.js)
 *   4. the search box also asks the server, and shows what it finds
 *      (server/patch-app-server-search.js), plus "Report a problem"
 *      (server/patch-report-problem.js)
 *
 * It runs the app's own code - mapRow builds the conversations, renderList draws the real
 * rows, and api() is replaced by a stub that records what the app would have sent.
 *
 *   node server/test-bulk-done-and-search.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///' + path.join(__dirname, '..', 'mail-app.html').replace(/\\/g, '/');

const checks = [];
const ok = (name, pass, extra) => checks.push({ name, pass, extra });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(1200);

  /* ---- the world: one team, three people, four conversations ---- */
  const setup = await page.evaluate(() => {
    window.__api = [];
    window.api = async (action, p) => {           // no server in a test
      window.__api.push([action, p]);
      if (action === 'find') return { threads: [], messages: [], activity: [], text: true, words: ['x'], ms: 7 };
      if (action === 'report') return { ok: true, id: 1 };
      if (action === 'reports') return { reports: window.__reps || [] };
      if (action === 'reportDone') return { ok: true };
      return {};
    };
    DEPTS = [{ id: 'alpha', name: 'Merch \u00b7 Team Alpha', box: 'teamalpha@', color: '#ff5001' }];   // mailOf() appends DOMAIN ('rugscreation.com')
    PEOPLE = [
      { id: 'me', name: 'Jagjit Singh', login: 'merchandiser2@rugscreation.com', dept: 'alpha', role: 'Manager', perm: { assign: 1, delete: 1, transfer: 1, dashboards: 1 }, active: true, hasPw: true },
      { id: 'ik', name: 'Imran Khan', login: 'merchandiser4@rugscreation.com', dept: 'alpha', role: 'Merchandiser', perm: { transfer: 1 }, active: true, hasPw: true },
      { id: 'pr', name: 'Priya', login: 'crm@rugscreation.com', dept: 'alpha', role: 'Admin', perm: {}, active: true, hasPw: true }
    ];
    ME = 'me';
    const BOX = 'teamalpha@rugscreation.com', D = 86400000, now = Date.now();
    const mk = (tid, sub, lastDir, status, owner) => {
      const ms = [
        { mailbox: BOX, gmail_id: tid + 'a', gmail_thread_id: tid, direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Hershika', to_text: BOX, body_text: 'Please confirm the ship date for ' + sub, sent_at: new Date(now - 6 * D).toISOString() },
        { mailbox: BOX, gmail_id: tid + 'b', gmail_thread_id: tid, direction: 'out', from_email: BOX, from_name: 'Team Alpha', sent_by: 'ik', to_text: 'buyer@maxzipper.com', body_text: 'Noted, we will confirm.', sent_at: new Date(now - 5 * D).toISOString() }
      ];
      if (lastDir === 'in') ms.push({ mailbox: BOX, gmail_id: tid + 'c', gmail_thread_id: tid, direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Hershika', to_text: BOX, body_text: 'Any update please?', sent_at: new Date(now - 4 * D).toISOString() });
      const row = { mailbox: BOX, gmail_thread_id: tid, subject: sub, snippet: 'Any update please?', counterpart_email: 'buyer@maxzipper.com', counterpart_name: 'Hershika', msg_count: ms.length, last_msg_at: ms[ms.length - 1].sent_at, has_in: true, has_out: true, unread: false, owner_id: owner || null, status, folder: 'inbox', dept_id: 'alpha', updated_at: new Date().toISOString() };
      return mapRow(row, ms, [], null, 'alpha');
    };
    S.threads = [
      mk('t1', 'MAX ZIPPER // IO 4813 // 5 NO ZIPPER', 'in', 'new', ''),      // buyer wrote last
      mk('t2', 'Sample dispatch AW26', 'in', 'open', 'ik'),                    // buyer wrote last
      mk('t3', 'Packing list 7781', 'out', 'open', 'ik'),                      // we wrote last
      mk('t4', 'Invoice 9120', 'out', 'new', '')                               // we wrote last
    ];
    S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); });
    app = 'mail'; view = { type: 'box', dept: 'alpha', folder: 'inbox' }; openId = null;
    document.body.classList.remove('signedout');
    window.__liveReady = true;
    render();
    return { threads: S.threads.length, rows: document.querySelectorAll('.list .m').length };
  });
  ok('the four test conversations are drawn', setup.rows === 4, JSON.stringify(setup));

  /* ---------- 1. bulk Done asks, and warns ---------- */
  const askShown = await page.evaluate(() => {
    SEL.clear(); ['alpha:t1', 'alpha:t2', 'alpha:t3'].forEach(i => SEL.add(i));
    renderList();
    document.querySelector('.list [data-bk="done"]').click();
    const d = document.querySelector('#layer .dlg');
    return {
      open: !!d,
      title: d ? d.querySelector('h3').textContent : '',
      body: d ? d.querySelector('.body').textContent : '',
      buttons: d ? [...d.querySelectorAll('footer button')].map(b => b.textContent.trim()) : [],
      listed: d ? [...d.querySelectorAll('.body li')].map(li => li.textContent) : []
    };
  });
  ok('bulk Done opens a question instead of closing them', askShown.open);
  ok('the question says how many (3)', /Mark 3 conversations done\?/.test(askShown.title), askShown.title);
  ok('it warns that 2 of 3 were never answered', /In 2 of 3, the other side wrote last and nobody has answered yet/.test(askShown.body), askShown.body.slice(0, 200));
  ok('it names the waiting conversations', askShown.listed.length === 2 && /MAX ZIPPER/.test(askShown.listed.join(' ')), JSON.stringify(askShown.listed));
  ok('the safe choice is offered and is the main button', /Close the 1 answered, leave 2 waiting/.test(askShown.buttons.join(' | ')), JSON.stringify(askShown.buttons));
  ok('"Mark all 3 done" is offered too', /Mark all 3 done/.test(askShown.buttons.join(' | ')), JSON.stringify(askShown.buttons));
  ok('the 16 November mistake is explained', /16 November/.test(askShown.body));

  const cancelled = await page.evaluate(() => {
    document.querySelector('#layer footer [data-c]').click();
    return { dlg: !!document.querySelector('#layer .dlg'), done: S.threads.filter(t => t.status === 'done').length };
  });
  ok('Cancel closes the question and nothing is marked done', !cancelled.dlg && cancelled.done === 0, JSON.stringify(cancelled));

  const safe = await page.evaluate(() => {
    SEL.clear(); ['alpha:t1', 'alpha:t2', 'alpha:t3'].forEach(i => SEL.add(i));
    renderList();
    document.querySelector('.list [data-bk="done"]').click();
    document.querySelector('#layer footer [data-dsafe]').click();
    return S.threads.map(t => t.id + '=' + t.status).join(' ');
  });
  ok('the safe choice closes only the answered one', /t1=new/.test(safe) && /t2=open/.test(safe) && /t3=done/.test(safe), safe);

  const all = await page.evaluate(() => {
    SEL.clear(); ['alpha:t1', 'alpha:t2'].forEach(i => SEL.add(i));
    renderList();
    document.querySelector('.list [data-bk="done"]').click();
    document.querySelector('#layer footer [data-dall]').click();
    return S.threads.map(t => t.id + '=' + t.status).join(' ');
  });
  ok('"Mark all done anyway" still works', /t1=done/.test(all) && /t2=done/.test(all), all);

  /* put them back for the next tests */
  await page.evaluate(() => { S.threads.forEach(t => { if (t.id !== 'alpha:t3') { t.status = t.owner ? 'open' : 'new'; t.doneAt = null; } }); render(); });

  /* ---------- 2. a single Done warns and can be undone ---------- */
  const single = await page.evaluate(() => {
    document.querySelectorAll('.undobar').forEach(x => x.remove());
    done1(T_('alpha:t1'));
    const b = document.querySelector('.undobar');
    return { status: T_('alpha:t1').status, bar: b ? b.textContent : '' };
  });
  ok('one Done on an unanswered mail still marks it done', single.status === 'done', single.status);
  ok('...and says the buyer wrote last, with Undo', /wrote last and nobody has answered/.test(single.bar) && /Undo/.test(single.bar), single.bar);

  const undone = await page.evaluate(() => {
    document.querySelector('.undobar button').click();
    return T_('alpha:t1').status;
  });
  ok('Undo puts it back to waiting', undone === 'new', undone);

  const quiet = await page.evaluate(() => {
    document.querySelectorAll('.undobar').forEach(x => x.remove());
    done1(T_('alpha:t4'));                                     // we wrote last - nothing to warn about
    return { status: T_('alpha:t4').status, bar: !!document.querySelector('.undobar') };
  });
  ok('a mail we answered is still one quiet click', quiet.status === 'done' && !quiet.bar, JSON.stringify(quiet));

  /* ---------- 3. a Quick step that closes mail asks the same question ---------- */
  const qs = await page.evaluate(() => {
    S.threads.forEach(t => { t.status = t.owner ? 'open' : 'new'; t.doneAt = null; t.folder = 'inbox'; });
    SEL.clear(); SEL.add('alpha:t1'); SEL.add('alpha:t3');     // one waiting, one answered
    openId = 'alpha:t1'; render();
    const b = document.querySelector('[data-olqs]');
    if (!b) return { no: 'no Quick steps button' };
    b.click();                                                  // the pack's own Quick steps list
    const run = document.querySelector('#layer [data-olqr="0"]');
    if (!run) return { no: 'no quick step to run', layer: document.querySelector('#layer').textContent.slice(0, 160) };
    const step = run.textContent.trim();
    run.click();                                                // "Done & archive" on both
    const d = document.querySelector('#layer .dlg');
    const out = { step, asked: !!d, title: d ? d.querySelector('h3').textContent : '' };
    out.layer = document.querySelector('#layer').textContent.slice(0, 200);
    const sf = document.querySelector('#layer footer [data-dsafe]');
    out.safeBtn = !!sf;
    if (sf) sf.click();
    out.after = S.threads.map(t => t.id + '=' + t.status + '/' + t.folder).join(' ');
    return out;
  });
  ok('a Quick step that closes mail asks first', !!qs.asked, JSON.stringify(qs));
  ok('the one left open is left out of the WHOLE step (not archived either)', (qs.after||'').includes('t1=new/inbox') && (qs.after||'').includes('t3=done/archive'), JSON.stringify(qs));

  /* ---------- 4. search asks the server ---------- */
  const srch = await page.evaluate(async () => {
    window.__api = [];
    document.querySelectorAll('.undobar').forEach(x => x.remove());
    S.threads.forEach(t => { t.status = t.owner ? 'open' : 'new'; t.folder = 'inbox'; });
    $('#q').value = 'zipper';
    render();
    const typed = document.querySelector('.list .shelp')?.textContent || '';
    /* the real path: the app asks the server and merges what comes back */
    window.api = async (action, p) => {
      window.__api.push([action, p]);
      if (action !== 'find') return {};
      return {
        text: true, words: ['zipper'], ms: 812,
        threads: [{ mailbox: 'teamalpha@rugscreation.com', gmail_thread_id: 'old1', subject: 'MAX ZIPPER // IO 4813 // 5 NO ZIPPER', snippet: 'older one', counterpart_email: 'buyer@maxzipper.com', counterpart_name: 'Hershika', msg_count: 1, last_msg_at: new Date(Date.now() - 200 * 86400000).toISOString(), has_in: true, has_out: false, unread: false, owner_id: null, status: 'done', folder: 'inbox', dept_id: 'alpha', updated_at: new Date().toISOString() }],
        messages: [{ mailbox: 'teamalpha@rugscreation.com', gmail_id: 'old1a', gmail_thread_id: 'old1', direction: 'in', from_email: 'buyer@maxzipper.com', from_name: 'Hershika', to_text: 'teamalpha@rugscreation.com', body_text: 'the words are only inside this mail', sent_at: new Date(Date.now() - 200 * 86400000).toISOString() }],
        activity: []
      };
    };
    await serverFind('zipper', true);
    await new Promise(r => setTimeout(r, 120));
    return {
      typed,
      asked: window.__api.filter(a => a[0] === 'find').map(a => a[1].q),
      merged: !!S.threads.find(t => t.id === 'alpha:old1'),
      rows: [...document.querySelectorAll('.list .m .sub, .list .m')].length,
      shown: !!document.querySelector('.list .m[data-open="alpha:old1"], .list [data-open="alpha:old1"]'),
      line: document.querySelector('.list .shelp')?.textContent || '',
      inRows: listRows().some(t => t.id === 'alpha:old1')
    };
  });
  ok('three letters are asked of the server', srch.asked.includes('zipper'), JSON.stringify(srch.asked));
  ok('what the server found is merged in', srch.merged);
  ok('a conversation found only by its mail text is listed', srch.inRows, JSON.stringify(srch).slice(0, 300));
  ok('the line says how many older ones were found', /\+1 older conversation found on the server/.test(srch.line), srch.line);

  const shortQ = await page.evaluate(() => { $('#q').value = 'zi'; render(); return document.querySelector('.list .shelp')?.textContent || ''; });
  ok('under three letters it says so instead of asking', /Type three letters or more/.test(shortQ), shortQ);

  const noIdx = await page.evaluate(async () => {
    window.api = async (a) => a === 'find' ? { threads: [], messages: [], activity: [], text: false, words: ['zipper'], ms: 400 } : {};
    $('#q').value = 'zipper';
    await serverFind('zipper', true);
    await new Promise(r => setTimeout(r, 80));
    render();
    return document.querySelector('.list .shelp')?.textContent || '';
  });
  ok('it says when the mail text is not searched yet', /mail text is not searched yet/.test(noIdx), noIdx);

  const failQ = await page.evaluate(async () => {
    window.api = async () => { throw new Error('The mail server was busy for a moment.'); };
    await serverFind('zipper', true);
    await new Promise(r => setTimeout(r, 80));
    render();
    const l = document.querySelector('.list .shelp')?.textContent || '';
    return { l, retry: !!document.querySelector('.list [data-fndgo]') };
  });
  ok('a failed search says so and offers Try again', /Could not search the server/.test(failQ.l) && failQ.retry, JSON.stringify(failQ));

  /* ---------- 5. Report a problem ---------- */
  const rep = await page.evaluate(async () => {
    $('#q').value = ''; render();
    window.__api = [];
    window.api = async (action, p) => { window.__api.push([action, p]); return action === 'report' ? { ok: true, id: 5 } : {}; };
    openId = 'alpha:t1';
    repDlg(T_('alpha:t1'));
    const d = document.querySelector('#layer .dlg');
    const out = { open: !!d, body: d ? d.querySelector('.body').textContent : '' };
    d.querySelector('#rpN').value = 'this mail shows only the short preview';
    d.querySelector('footer [data-ok]').click();
    await new Promise(r => setTimeout(r, 60));
    out.sent = (window.__api.find(a => a[0] === 'report') || [])[1] || null;
    out.closed = !document.querySelector('#layer .dlg');
    return out;
  });
  ok('Report a problem opens a one-line box', rep.open);
  ok('it says what goes with it', /the page you are on/.test(rep.body) && /app version/.test(rep.body), rep.body.slice(0, 160));
  ok('it sends the note, the conversation, the page and the build', !!rep.sent && rep.sent.note === 'this mail shows only the short preview' && rep.sent.thread === 't1' && rep.sent.box === 'teamalpha@rugscreation.com' && /Team Alpha/.test(rep.sent.page) && !!rep.sent.build, JSON.stringify(rep.sent));
  ok('the box closes once it is sent', rep.closed);

  const repMenu = await page.evaluate(() => {
    cmOpen(T_('alpha:t1'), 50, 50, null);
    const has = !!document.querySelector('.cmenu [data-cm="report"]');
    document.querySelector('.cmenu [data-cm="report"]').click();
    const d = !!document.querySelector('#layer .dlg');
    if (d) document.querySelector('#layer footer [data-c]').click();
    return { has, d };
  });
  ok('right-click on a mail offers it', repMenu.has && repMenu.d, JSON.stringify(repMenu));

  const adm = await page.evaluate(async () => {
    window.__reps = [
      { id: 9, user_id: 'ik', mailbox: 'teamalpha@rugscreation.com', gmail_thread_id: 't1', note: 'only the preview shows', page: 'Team Alpha \u00b7 inbox', build: '2026-11-24-1', at: new Date().toISOString(), done_at: null },
      { id: 8, user_id: 'pr', mailbox: '', gmail_thread_id: '', note: 'search was slow', page: 'home', build: '2026-11-23-10', at: new Date(Date.now() - 3600000).toISOString(), done_at: new Date().toISOString(), done_by: 'me' }
    ];
    window.api = async (action, p) => { window.__api.push([action, p]); return action === 'reports' ? { reports: window.__reps } : { ok: true }; };
    ME = 'pr';                                     // the admin
    app = 'admin'; adminTab = 'probs'; REPS = null;
    render();
    await new Promise(r => setTimeout(r, 120));
    render();
    const txt = document.querySelector('.page')?.textContent || '';
    const tabs = [...document.querySelectorAll('[data-atab]')].map(b => b.textContent.trim());
    const out = { txt: txt.slice(0, 400), tabs, waiting: /Problems \(1\)/.test(tabs.join('|')), rows: document.querySelectorAll('.page tbody tr').length };
    const h = document.querySelector('[data-rpdone]');
    out.handled = !!h;
    if (h) { h.click(); await new Promise(r => setTimeout(r, 60)); out.sentDone = (window.__api.find(a => a[0] === 'reportDone') || [])[1] || null; }
    return out;
  });
  ok('the admin gets a Problems tab with the waiting count', adm.waiting, JSON.stringify(adm.tabs));
  ok('both reports are listed', adm.rows === 2, String(adm.rows));
  ok('the note and who wrote it are shown', /only the preview shows/.test(adm.txt) && /Imran Khan/.test(adm.txt), adm.txt.slice(0, 200));
  ok('"Handled" tells the server which one', adm.handled && adm.sentDone && adm.sentDone.id === 9, JSON.stringify(adm.sentDone));

  /* ---- report ---- */
  console.log('');
  checks.forEach(c => console.log((c.pass ? 'PASS  ' : 'FAIL  ') + c.name + (c.pass ? '' : '   -> ' + (c.extra === undefined ? '' : c.extra))));
  const bad = checks.filter(c => !c.pass).length;
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  if (errors.length) { console.log('\nPAGE ERRORS:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('no page errors');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
