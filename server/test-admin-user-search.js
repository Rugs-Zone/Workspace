/* Browser test for the Admin -> Users & passwords search box and the table fit.
 * Loads the real built mail-app.html in headless Edge, fills the app's own
 * globals with 82 fake people, draws the real admin page, and checks the
 * search and the layout.
 *
 *   node server/test-admin-user-search.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///' + path.join(__dirname, '..', 'mail-app.html').replace(/\\/g, '/');

const checks = [];
const ok = (name, pass, extra) => { checks.push({ name, pass, extra }); };

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(1200);

  // Fill in the app's own globals and draw the real admin page.
  const drew = await page.evaluate(() => {
    const depts = [
      { id: 'alpha', name: 'Merch \u00b7 Team Alpha', box: 'teamalpha@rugscreation.com', color: '#ff5001' },
      { id: 'pulse', name: 'Team Pulse', box: 'teampulse@rugscreation.com', color: '#9b59b6' }
    ];
    const people = [];
    people.push({ id: 'adm', name: 'Priyanshu Tomar', login: 'marketing@rugscreation.com', dept: 'alpha', role: 'Admin', perm: {}, active: true, hasPw: true });
    people.push({ id: 'jm', name: 'Jatin Munjal', login: 'jatinmunjyal@rugscreation.com', dept: 'pulse', role: 'Executive', perm: { transfer: 1 }, active: true, hasPw: true });
    people.push({ id: 'ash', name: 'Ashok', login: 'merchandiser5@rugscreation.com', dept: 'pulse', role: 'Executive', perm: { transfer: 1 }, active: true, hasPw: true });
    people.push({ id: 'off1', name: 'Old Person', login: 'old@rugscreation.com', dept: '', role: 'Executive', perm: {}, active: false, hasPw: false });
    for (let i = 0; i < 78; i++) {
      people.push({ id: 'p' + i, name: 'Person ' + i, login: 'person' + i + '@rugscreation.com', dept: i % 2 ? 'alpha' : 'pulse', role: 'Merchandiser', perm: { transfer: 1 }, active: true, hasPw: true });
    }
    DEPTS = depts; PEOPLE = people; ME = 'adm';
    document.body.classList.remove('signedout'); // the shell is hidden until sign-in
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none'; // sign-in overlay sits on top
    app = 'admin'; adminTab = 'users'; USRQ = '';
    try { render(); return 'render'; } catch (e) {
      try { document.getElementById('main').innerHTML = pageAdmin(); return 'pageAdmin:' + e.message; } catch (e2) { return 'FAILED:' + e2.message; }
    }
  });
  ok('the admin users page draws', /^render|^pageAdmin/.test(drew), drew);

  // If render() was not usable, wire the box the way the render wrapper does.
  if (!/^render/.test(drew)) {
    await page.evaluate(() => {
      const box = document.getElementById('usrq');
      if (box) { box.oninput = function () { USRQ = box.value; admUsrFilter(); }; admUsrFilter(); }
    });
  }

  const has = await page.evaluate(() => ({
    box: !!document.getElementById('usrq'),
    rows: document.querySelectorAll('tr[data-urow]').length,
    count: (document.getElementById('usrn') || {}).textContent,
    hint: (document.getElementById('usrhint') || {}).textContent
  }));
  ok('search box is on the page', has.box);
  ok('all 82 people are listed', has.rows === 82, 'rows=' + has.rows);
  ok('heading shows the total when not searching', has.count === '82', 'count=' + has.count);
  ok('hint tells you the table scrolls sideways', /sideways/i.test(has.hint || ''), has.hint);

  const vis = () => page.evaluate(() => [...document.querySelectorAll('tr[data-urow]')]
    .filter(tr => tr.style.display !== 'none')
    .map(tr => (tr.querySelector('.uName') || {}).value));

  // type a name
  await page.fill('#usrq', 'jatin');
  await page.waitForTimeout(120);
  let v = await vis();
  ok('searching a name finds that one person', v.length === 1 && v[0] === 'Jatin Munjal', JSON.stringify(v));
  ok('count becomes "1 of 82"', (await page.textContent('#usrn')) === '1 of 82', await page.textContent('#usrn'));

  // search by user ID
  await page.fill('#usrq', 'merchandiser5@');
  await page.waitForTimeout(120);
  v = await vis();
  ok('searching a user ID finds that person', v.length === 1 && v[0] === 'Ashok', JSON.stringify(v));

  // search by team
  await page.fill('#usrq', 'team pulse');
  await page.waitForTimeout(120);
  v = await vis();
  ok('searching a team shows that team only', v.length === 41 && v.includes('Jatin Munjal') && v.includes('Ashok'), 'n=' + v.length);

  // two words must both match
  await page.fill('#usrq', 'pulse jatin');
  await page.waitForTimeout(120);
  v = await vis();
  ok('two words both have to match', v.length === 1 && v[0] === 'Jatin Munjal', JSON.stringify(v));

  // role and status
  await page.fill('#usrq', 'admin');
  await page.waitForTimeout(120);
  v = await vis();
  ok('searching a role works', v.length === 1 && v[0] === 'Priyanshu Tomar', JSON.stringify(v));
  await page.fill('#usrq', 'off');
  await page.waitForTimeout(120);
  v = await vis();
  ok('searching "off" finds switched-off people', v.includes('Old Person'), JSON.stringify(v.slice(0, 3)));

  // nothing matches
  await page.fill('#usrq', 'zzzzqqq');
  await page.waitForTimeout(120);
  v = await vis();
  ok('a search with no match says so', v.length === 0 && /Nobody matches/i.test(await page.textContent('#usrhint')), await page.textContent('#usrhint'));

  // clearing brings everyone back
  await page.fill('#usrq', '');
  await page.waitForTimeout(120);
  v = await vis();
  ok('clearing the box brings everyone back', v.length === 82, 'n=' + v.length);

  // typing does not lose focus even if the app redraws underneath
  await page.evaluate(() => document.getElementById('usrq').focus());
  await page.type('#usrq', 'jat');
  await page.evaluate(() => { try { render(); } catch (e) {} });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    focused: document.activeElement && document.activeElement.id === 'usrq',
    value: (document.getElementById('usrq') || {}).value,
    shown: [...document.querySelectorAll('tr[data-urow]')].filter(tr => tr.style.display !== 'none').length
  }));
  ok('a redraw keeps what you typed', after.value === 'jat', 'value=' + after.value);
  ok('a redraw keeps the cursor in the box', after.focused === true);
  ok('a redraw keeps the list filtered', after.shown === 1, 'shown=' + after.shown);

  // layout: the table scrolls inside its own box instead of running off the page
  await page.fill('#usrq', '');
  const lay = await page.evaluate(() => {
    const t = document.querySelector('.atable');
    const page_ = document.querySelector('.page');
    const td = document.querySelector('tr[data-urow] td:first-child');
    const th = document.querySelector('.atable th:first-child');
    const cs = getComputedStyle(td), ch = getComputedStyle(th);
    return {
      scrolls: t.scrollWidth > t.clientWidth,
      overflowX: getComputedStyle(t).overflowX,
      tableInsideBox: t.getBoundingClientRect().right <= page_.getBoundingClientRect().right + 1,
      pageFitsWindow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      firstColSticky: cs.position === 'sticky' && ch.position === 'sticky',
      firstColOpaque: cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
    };
  });
  ok('the wide table stays inside the page', lay.tableInsideBox);
  ok('the page itself no longer scrolls sideways', lay.pageFitsWindow);
  ok('the table scrolls sideways in its own box', lay.overflowX === 'auto' && lay.scrolls);
  ok('the Person column stays put while scrolling', lay.firstColSticky);
  ok('the frozen column is not see-through', lay.firstColOpaque);

  // and the frozen column really stays when scrolled right
  const stuck = await page.evaluate(() => {
    const t = document.querySelector('.atable');
    const td = document.querySelector('tr[data-urow] td:first-child');
    const before = td.getBoundingClientRect().left;
    t.scrollLeft = 400;
    const after = td.getBoundingClientRect().left;
    return { before, after, moved: Math.abs(after - before) };
  });
  ok('scrolling right does not push the name off screen', stuck.moved < 2, JSON.stringify(stuck));

  ok('no page errors', errors.length === 0, errors.join(' | '));

  await browser.close();

  let bad = 0;
  for (const c of checks) {
    if (!c.pass) bad++;
    console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name + (c.pass || !c.extra ? '' : '   [' + c.extra + ']'));
  }
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
