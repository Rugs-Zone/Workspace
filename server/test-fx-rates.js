/* 24 Nov 2026: browser test for the USD–INR Rates screen (server/fx-rates.view.js),
 * driven through server/test-fx-rates.html in headless Edge.
 *
 * Covers what the brief asked for: hero + change, the five KPI cards with their dates,
 * the chart and its 30/90/365 toggle, the day table and its CSV, the recipients panel
 * (add / pause / resume / remove / master switch / send test / last sent), the WhatsApp
 * card being disabled, the loading / empty / error states, and the break-UI cases
 * (90-character email addresses, no recipients at all, 365 rows, 390px phone).
 *
 *   node server/test-fx-rates.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = 'file:///' + path.join(__dirname, 'test-fx-rates.html').replace(/\\/g, '/');

const checks = [];
const ok = (n, p, x) => checks.push({ n, p, x });

/* the shapes fx-api really returns */
function makeState(days, opts) {
  opts = opts || {};
  const rows = [];
  const end = Date.UTC(2026, 10, 24);                       // 24 Nov 2026
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end - i * 86400000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;   // the market is shut at weekends
    const t = (days - i) / days;
    rows.push({ d: d.toISOString().slice(0, 10), r: 88 + Math.sin(i / 7) * 0.8 + t * 0.9, s: 'frankfurter.dev (ECB)' });
  }
  const upto = rows;
  const win = (n) => {
    const from = new Date(Date.parse(upto[upto.length - 1].d + 'T00:00:00Z') - (n - 1) * 86400000).toISOString().slice(0, 10);
    const w = upto.filter(x => x.d >= from);
    let lo = w[0], hi = w[0];
    w.forEach(x => { if (x.r < lo.r) lo = x; if (x.r > hi.r) hi = x; });
    return { lo, hi, n: w.length };
  };
  const cur = upto[upto.length - 1], prev = upto[upto.length - 2] || null;
  return {
    rows,
    stats: { today: cur, yesterday: opts.firstDay ? null : prev, week: win(7), month: win(30) },
    recipients: opts.recipients !== undefined ? opts.recipients : [
      { id: 'r1', email: 'vinay@rugscreation.com', name: 'Vinay Chugh', active: true },
      { id: 'r2', email: 'accounts.department.panipat.haryana.india.rugscreation.works@rugscreation.com', name: 'Accounts — the whole department, long name to push the layout', active: true },
      { id: 'r3', email: 'priya@rugscreation.com', name: null, active: false }
    ],
    settings: opts.settings === undefined ? { enabled: true } : opts.settings,
    last_sent: opts.last_sent === undefined ? '2026-11-24' : opts.last_sent
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const load = async (data, fail) => {
    await page.goto(FILE);
    await page.evaluate(([d, f]) => { window.__fxData = d; window.__fxFail = f; window.__calls = []; window.__toasts = []; state.fx = null; state.fxRange = 30; }, [data, fail || null]);
    await page.evaluate(() => renderFxRates());
    await page.waitForTimeout(140);
  };

  /* ---------- 1. loading state ---------- */
  await page.goto(FILE);
  const loading = await page.evaluate(() => {
    window.__fxData = null;
    let release;
    window.fetch = () => new Promise(r => { release = r; });     // never answers
    renderFxRates();
    return document.getElementById('fxWrap').textContent.trim();
  });
  ok('while it is fetching, the screen says so', /Loading today/.test(loading), loading);

  /* ---------- 2. error state ---------- */
  await load(makeState(40), { status: 500, error: 'fx_rates is not reachable' });
  const err = await page.evaluate(() => ({ txt: document.getElementById('fxWrap').textContent, retry: !!document.querySelector('[data-fx="reload"]') }));
  ok('a failed load shows the reason and a Try again button', /fx_rates is not reachable/.test(err.txt) && err.retry, err.txt.slice(0, 120));

  /* ---------- 3. the 401 is translated into what to do ---------- */
  await load(makeState(40), { status: 401, error: 'Not allowed' });
  const no401 = await page.evaluate(() => document.getElementById('fxWrap').textContent);
  ok('a 401 says how to get access, not "Not allowed"', /Manage Visibility/.test(no401) && !/Not allowed/.test(no401), no401.slice(0, 140));

  /* ---------- 4. empty state: no rates stored ---------- */
  await load({ rows: [], stats: null, recipients: [], settings: null, last_sent: null });
  const empty = await page.evaluate(() => ({ txt: document.getElementById('fxWrap').textContent, btn: !!document.querySelector('[data-fx="refresh"]') }));
  ok('with no rates stored it explains and offers to fetch one', /No rates have been stored yet/.test(empty.txt) && empty.btn, empty.txt.slice(0, 120));

  /* ---------- 5. the normal screen ---------- */
  await load(makeState(400));
  const hero = await page.evaluate(() => {
    const r = document.querySelector('.fx-rate'), c = document.querySelector('.fx-chg');
    return { rate: r && r.textContent, chg: c && c.textContent, cls: c && c.className, when: (document.querySelector('.fx-when') || {}).textContent, size: r ? parseFloat(getComputedStyle(r).fontSize) : 0, refresh: !!document.querySelector('[data-fx="refresh"]') };
  });
  ok('the rate is the hero, in rupees', /^₹\d+\.\d\d$/.test((hero.rate || '').trim()), hero.rate);
  ok('it is the biggest thing on the page (>=38px)', hero.size >= 38, String(hero.size));
  ok('the change vs yesterday carries an arrow, the amount, the % and the word', /[▲▼]/.test(hero.chg) && /\(\d+\.\d\d%\)/.test(hero.chg) && /(up|down|level) vs yesterday/.test(hero.chg), hero.chg);
  ok('direction is not colour alone (up/down class AND a word)', /\b(up|down|flat)\b/.test(hero.cls), hero.cls);
  ok('the hero names the day and where the rate came from', /2026/.test(hero.when) && /frankfurter/.test(hero.when), hero.when);
  ok('Refresh now is on the hero', hero.refresh);

  const kpis = await page.evaluate(() => [...document.querySelectorAll('.ops-tile')].map(t => ({ v: t.querySelector('b').textContent, l: t.querySelector('span').textContent })));
  ok('there are five KPI cards', kpis.length === 5, String(kpis.length));
  ok('they are Yesterday, week low/high, month low/high', /Yesterday/.test(kpis[0].l) && /Week low/.test(kpis[1].l) && /Week high/.test(kpis[2].l) && /Month low/.test(kpis[3].l) && /Month high/.test(kpis[4].l), JSON.stringify(kpis.map(k => k.l)));
  ok('every KPI carries its own date', kpis.slice(1).every(k => /\d{2} \w{3}/.test(k.l)), JSON.stringify(kpis.map(k => k.l)));
  ok('every KPI is a rupee figure', kpis.every(k => /^₹\d+\.\d\d$/.test(k.v)), JSON.stringify(kpis.map(k => k.v)));

  /* ---------- 6. the chart ---------- */
  const chart = await page.evaluate(() => {
    const svg = document.querySelector('.fx-chart');
    return {
      there: !!svg,
      lines: svg ? svg.querySelectorAll('path').length : 0,
      stroke: svg ? (svg.querySelectorAll('path')[1] || {}).getAttribute('stroke-width') : '',
      nonScaling: svg ? (svg.querySelectorAll('path')[1] || {}).getAttribute('vector-effect') : '',
      grid: svg ? [...svg.querySelectorAll('line')].filter(l => l.getAttribute('stroke') === 'var(--line)').length : 0,
      dashedGrid: svg ? [...svg.querySelectorAll('line')].some(l => l.getAttribute('stroke') === 'var(--line)' && l.getAttribute('stroke-dasharray')) : false,
      labels: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent).filter(t => /^₹/.test(t)).length : 0,
      endDotRing: svg ? [...svg.querySelectorAll('circle')].some(c => c.getAttribute('r') === '4.5' && c.getAttribute('stroke') === 'var(--card)' && c.getAttribute('stroke-width') === '2') : false,
      tabs: [...document.querySelectorAll('[data-fxrange]')].map(b => b.textContent),
      active: (document.querySelector('[data-fxrange].active') || {}).textContent,
      focusable: svg ? svg.getAttribute('tabindex') : null,
      alt: svg ? svg.getAttribute('aria-label') : '',
      legend: document.querySelectorAll('#fxWrap .legend').length
    };
  });
  ok('the chart is drawn', chart.there && chart.lines >= 2, JSON.stringify(chart).slice(0, 120));
  ok('the line is 2px and keeps its weight when the page scales', chart.stroke === '2' && chart.nonScaling === 'non-scaling-stroke', chart.stroke + '/' + chart.nonScaling);
  ok('gridlines are hairline and solid, never dashed', chart.grid >= 2 && !chart.dashedGrid, 'grid ' + chart.grid);
  ok('only the window low, high and last value are labelled', chart.labels === 2, String(chart.labels));
  ok('the end dot carries a 2px surface ring', chart.endDotRing);
  ok('one series, so no legend box', chart.legend === 0);
  ok('the 30 / 90 / 365 toggle is there with 30 days selected', chart.tabs.join('|') === '30 days|90 days|1 year' && /30 days/.test(chart.active || ''), chart.tabs.join('|') + ' active=' + chart.active);
  ok('the chart is reachable by keyboard and describes itself', chart.focusable === '0' && /USD to INR/.test(chart.alt) && /table below/.test(chart.alt), (chart.alt || '').slice(0, 90));

  /* hover gives a crosshair and a tooltip */
  const hover = await page.evaluate(async () => {
    const svg = document.querySelector('.fx-chart'), box = svg.getBoundingClientRect();
    const hit = svg.querySelector('.fx-hit');
    hit.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + box.width * 0.6, clientY: box.top + box.height * 0.5, bubbles: true }));
    await new Promise(r => setTimeout(r, 150));   // the tooltip fades in over 80ms
    const tip = document.querySelector('.fx-tip');
    const out = { tip: tip.textContent, shown: getComputedStyle(tip).opacity, cross: document.querySelector('.fx-cross').getAttribute('opacity') };
    svg.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    out.after = document.querySelector('.fx-tip').style.opacity;
    return out;
  });
  ok('hovering shows a crosshair and a tooltip with the day and the rate', hover.shown === '1' && hover.cross === '1' && /₹\d+\.\d\d/.test(hover.tip) && /2026/.test(hover.tip), JSON.stringify(hover).slice(0, 160));
  ok('the tooltip names the source too', /frankfurter|market reference/.test(hover.tip), hover.tip);
  ok('it goes away when the pointer leaves', hover.after === '0', hover.after);

  const keys = await page.evaluate(async () => {
    const svg = document.querySelector('.fx-chart');
    svg.focus();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    const a = document.querySelector('.fx-tip').textContent;
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    return { a, b: document.querySelector('.fx-tip').textContent };
  });
  ok('arrow keys walk along the line', /₹/.test(keys.a) && keys.a !== keys.b, JSON.stringify(keys));

  /* the toggle changes both the chart and the table */
  const toggled = await page.evaluate(async () => {
    const before = document.querySelectorAll('.fx-tablebox tbody tr').length;
    document.querySelector('[data-fxrange="365"]').click();
    await new Promise(r => setTimeout(r, 60));
    return { before, after: document.querySelectorAll('.fx-tablebox tbody tr').length, range: state.fxRange, active: (document.querySelector('[data-fxrange].active') || {}).textContent, csv: (document.querySelector('[data-fx="csv"]') || {}).textContent };
  });
  ok('1 year loads far more days into the chart and the table', toggled.after > toggled.before * 5 && toggled.range === 365, JSON.stringify(toggled).slice(0, 140));
  ok('the CSV button says how many rows it will write', /\d+ rows/.test(toggled.csv || ''), toggled.csv);
  ok('365 days of rows render without an error', toggled.after >= 250, String(toggled.after));

  /* ---------- 7. the day table ---------- */
  const table = await page.evaluate(() => {
    const head = [...document.querySelectorAll('.fx-tablebox th')].map(t => t.textContent);
    const first = [...document.querySelectorAll('.fx-tablebox tbody tr')][0];
    const cells = first ? [...first.children].map(c => c.textContent) : [];
    const rows = [...document.querySelectorAll('.fx-tablebox tbody tr')].slice(0, 3).map(tr => tr.children[0].textContent);
    const boxH = document.querySelector('.fx-tablebox').getBoundingClientRect().height;
    return { head, cells, rows, boxH, scrolls: document.querySelector('.fx-tablebox').scrollHeight > document.querySelector('.fx-tablebox').clientHeight };
  });
  ok('the table is date, rate, source', /Date/.test(table.head[0]) && /USD/.test(table.head[1]) && /came from/.test(table.head[2]), JSON.stringify(table.head));
  ok('newest day first', table.rows.length > 1 && Date.parse(table.rows[0]) > Date.parse(table.rows[1]), JSON.stringify(table.rows));
  ok('365 rows scroll inside their own box instead of stretching the page', table.scrolls && table.boxH <= 430, JSON.stringify({ h: table.boxH, scrolls: table.scrolls }));

  const csv = await page.evaluate(async () => {
    let name = '', text = '';
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = function (b) { text = b.size; return 'blob:fake'; };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { name = this.download; };
    document.querySelector('[data-fx="csv"]').click();
    await new Promise(r => setTimeout(r, 20));
    URL.createObjectURL = realCreate; HTMLAnchorElement.prototype.click = realClick;
    return { name, size: text };
  });
  ok('the CSV downloads with a named file and real content', /^usd-inr-last-365-days-\d{4}-\d{2}-\d{2}\.csv$/.test(csv.name) && csv.size > 1000, JSON.stringify(csv));

  /* ---------- 8. the recipients panel ---------- */
  const rec = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.fx-rec')].filter(r => !r.closest('.fx-soon'));
    return {
      count: rows.length,
      paused: rows.filter(r => r.classList.contains('off')).length,
      pauseBtns: document.querySelectorAll('[data-fxact="pause"]').length,
      resumeBtns: document.querySelectorAll('[data-fxact="resume"]').length,
      removeBtns: document.querySelectorAll('[data-fxact="delete"]').length,
      master: !!document.getElementById('fxOn'),
      masterOn: (document.getElementById('fxOn') || {}).checked,
      masterText: (document.querySelector('.fx-master') || {}).textContent,
      test: !!document.querySelector('[data-fx="test"]'),
      testOff: (document.querySelector('[data-fx="test"]') || {}).disabled,
      lastSent: (document.querySelector('#fxWrap section:last-of-type') || {}).textContent,
      panel: [...document.querySelectorAll('#fxWrap section')].map(s => s.textContent).find(t => /10 AM email/.test(t)) || ''
    };
  });
  ok('every recipient is listed with pause and remove', rec.count === 3 && rec.removeBtns === 3 && rec.pauseBtns === 2 && rec.resumeBtns === 1, JSON.stringify(rec).slice(0, 200));
  ok('a paused person is shown as paused', rec.paused === 1 && /paused/.test(rec.panel), String(rec.paused));
  ok('the master switch is there and on', rec.master && rec.masterOn === true);
  ok('the master switch says what it means and how many people get it', /The 10 AM email is on/.test(rec.masterText) && /2 people get it/.test(rec.masterText), rec.masterText.replace(/\s+/g, ' ').slice(0, 120));
  ok('"Send test to me" is offered and names the address', rec.test && !rec.testOff && /priya@rugscreation.com only/.test(rec.panel), String(rec.testOff));
  ok('"last sent" is shown as a real date', /Last sent:/.test(rec.panel) && /2026/.test(rec.panel), (rec.panel.match(/Last sent:[^.]*/) || [''])[0]);

  /* a 90-character address must not stretch the card */
  const longEmail = await page.evaluate(() => {
    const em = [...document.querySelectorAll('.fx-rec .fx-em')].find(e => e.textContent.length > 40);
    const card = em.closest('section');
    return { len: em.textContent.length, emW: Math.round(em.getBoundingClientRect().width), cardW: Math.round(card.getBoundingClientRect().width), wraps: em.getBoundingClientRect().height > 20, nameClipped: getComputedStyle(em.parentElement.querySelector('.fx-nm')).textOverflow };
  });
  ok('a long email stays inside the card (' + longEmail.len + ' characters)', longEmail.emW <= longEmail.cardW, JSON.stringify(longEmail));
  ok('a long name is clipped with an ellipsis, not wrapped', longEmail.nameClipped === 'ellipsis', longEmail.nameClipped);

  /* adding: validation, then the call */
  const addBad = await page.evaluate(async () => {
    document.getElementById('fxEmail').value = 'not-an-email';
    document.querySelector('[data-fx="add"]').click();
    await new Promise(r => setTimeout(r, 30));
    return { toasts: window.__toasts.slice(), calls: window.__calls.filter(c => c.action === 'fxRecipientSave').length };
  });
  ok('a wrong address is refused on the spot, nothing sent', /doesn't look like an email/.test(addBad.toasts.join(' ')) && addBad.calls === 0, JSON.stringify(addBad));

  const addGood = await page.evaluate(async () => {
    window.__toasts = [];
    document.getElementById('fxEmail').value = '  Neetu@RugsCreation.com  ';
    document.getElementById('fxName').value = 'Neetu';
    document.querySelector('[data-fx="add"]').click();
    await new Promise(r => setTimeout(r, 60));
    const c = window.__calls.find(x => x.action === 'fxRecipientSave');
    return { c, toasts: window.__toasts.slice(), token: c && c.session_token };
  });
  ok('adding sends the tidied address with the session token', addGood.c && addGood.c.email === 'neetu@rugscreation.com' && addGood.c.name === 'Neetu' && addGood.c.active === true && addGood.token === 't0ken', JSON.stringify(addGood.c));
  ok('and says what will happen next', /added/.test(addGood.toasts.join(' ')) && /10 AM/.test(addGood.toasts.join(' ')), addGood.toasts.join(' | '));

  const pause = await page.evaluate(async () => {
    window.__calls = []; window.__toasts = [];
    document.querySelector('[data-fxact="pause"]').click();
    await new Promise(r => setTimeout(r, 60));
    const c = window.__calls.find(x => x.action === 'fxRecipientSave');
    return { c, toasts: window.__toasts.slice() };
  });
  ok('Pause keeps the person but turns them off', pause.c && pause.c.active === false && pause.c.email === 'vinay@rugscreation.com', JSON.stringify(pause.c));
  ok('and says they stop getting it', /stop getting it/.test(pause.toasts.join(' ')), pause.toasts.join(' | '));

  const del = await page.evaluate(async () => {
    window.__calls = []; window.__confirmAnswer = false;
    document.querySelector('[data-fxact="delete"]').click();
    await new Promise(r => setTimeout(r, 40));
    const cancelled = window.__calls.filter(x => x.action === 'fxRecipientDelete').length;
    window.__confirmAnswer = true;
    document.querySelector('[data-fxact="delete"]').click();
    await new Promise(r => setTimeout(r, 60));
    return { cancelled, asked: window.__confirmText, done: window.__calls.find(x => x.action === 'fxRecipientDelete') };
  });
  ok('Remove asks first, and nothing happens on Cancel', del.cancelled === 0 && /Remove .*@/.test(del.asked || ''), JSON.stringify(del).slice(0, 140));
  ok('saying yes removes that one by its id', del.done && del.done.id === 'r1', JSON.stringify(del.done));

  const master = await page.evaluate(async () => {
    window.__calls = []; window.__toasts = [];
    const c = document.getElementById('fxOn');
    c.checked = false;
    c.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return { call: window.__calls.find(x => x.action === 'fxSettings'), toasts: window.__toasts.slice() };
  });
  ok('the master switch saves enabled=false', master.call && master.call.enabled === false, JSON.stringify(master.call));
  ok('and says the email is paused', /paused/.test(master.toasts.join(' ')), master.toasts.join(' | '));

  const test = await page.evaluate(async () => {
    window.__calls = []; window.__toasts = [];
    document.querySelector('[data-fx="test"]').click();
    await new Promise(r => setTimeout(r, 60));
    return { call: window.__calls.find(x => x.action === 'fxSendTest'), toasts: window.__toasts.slice() };
  });
  ok('"Send test to me" calls fxSendTest and reports back', !!test.call && /Test queued for you/.test(test.toasts.join(' ')), JSON.stringify(test.toasts));

  /* ---------- 9. no recipients at all ---------- */
  await load(makeState(40, { recipients: [], last_sent: null }));
  const none = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('#fxWrap section')].map(s => s.textContent).find(t => /10 AM email/.test(t)) || '';
    return { panel, rows: [...document.querySelectorAll('.fx-rec')].filter(r => !r.closest('.fx-soon')).length };
  });
  ok('with nobody on the list it invites you to add the first one', none.rows === 0 && /Add the first address/.test(none.panel), none.panel.replace(/\s+/g, ' ').slice(0, 120));
  ok('and warns that the switch is on but nothing goes out', /Nobody is on the list, so nothing goes out/.test(none.panel), 'panel');
  ok('"last sent" reads "not yet" rather than a blank', /Last sent:\s*not yet/.test(none.panel.replace(/\s+/g, ' ')), 'panel');

  /* ---------- 10. the first day of the history (no yesterday) ---------- */
  await load(makeState(8, { firstDay: true }));
  const first = await page.evaluate(() => ({ chg: (document.querySelector('.fx-chg') || {}).textContent, k0: (document.querySelector('.ops-tile b') || {}).textContent, k0l: (document.querySelector('.ops-tile span') || {}).textContent }));
  ok('with no yesterday it says so instead of showing 0.00%', /First day of the history/.test(first.chg), first.chg);
  ok('the Yesterday card says there is no earlier day', first.k0 === '—' && /no earlier day/.test(first.k0l), first.k0 + ' / ' + first.k0l);

  /* ---------- 11. the WhatsApp card ---------- */
  await load(makeState(40));
  const wa = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#fxWrap section')].find(s => /WhatsApp numbers/.test(s.textContent));
    return card ? {
      soon: /Coming soon/.test(card.textContent),
      inputs: [...card.querySelectorAll('input')].map(i => i.disabled),
      btns: [...card.querySelectorAll('button')].map(b => b.disabled),
      says: card.textContent.replace(/\s+/g, ' ')
    } : null;
  });
  ok('the WhatsApp card is there and marked Coming soon', wa && wa.soon);
  ok('every WhatsApp field and button is disabled', wa && wa.inputs.length >= 2 && wa.inputs.every(Boolean) && wa.btns.every(Boolean), JSON.stringify(wa && wa.inputs));
  ok('it explains it is only a preview', wa && /not switched on yet/.test(wa.says), (wa && wa.says.slice(0, 110)) || '');

  /* ---------- 12. the phone, 390px ---------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await load(makeState(400));
  const phone = await page.evaluate(() => {
    const w = document.getElementById('fxWrap');
    const over = [...w.querySelectorAll('*')].filter(el => el.getBoundingClientRect().width > w.getBoundingClientRect().width + 1)
      .map(el => el.tagName + '.' + (el.className || '').toString().split(' ')[0]);
    return {
      bodyScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      over: [...new Set(over)],
      twoCols: getComputedStyle(document.querySelector('.fx-two')).gridTemplateColumns.split(' ').length,
      kpiCols: getComputedStyle(document.querySelector('.ops-tiles')).gridTemplateColumns.split(' ').length,
      rate: parseFloat(getComputedStyle(document.querySelector('.fx-rate')).fontSize),
      chartW: Math.round(document.querySelector('.fx-chart').getBoundingClientRect().width),
      tableBox: Math.round(document.querySelector('.fx-tablebox').getBoundingClientRect().height)
    };
  });
  ok('at 390px the page never scrolls sideways', !phone.bodyScrollsSideways && phone.over.length === 0, JSON.stringify(phone.over));
  ok('the two panels stack into one column', phone.twoCols === 1, String(phone.twoCols));
  ok('the KPI cards fit two to a row', phone.kpiCols === 2, String(phone.kpiCols));
  ok('the hero shrinks but stays the biggest thing', phone.rate >= 30 && phone.rate <= 52, String(phone.rate));
  ok('the chart fits the screen width', phone.chartW <= 360, String(phone.chartW));
  ok('the table box is shorter on a phone', phone.tableBox <= 345, String(phone.tableBox));

  console.log('');
  checks.forEach(c => console.log((c.p ? 'PASS  ' : 'FAIL  ') + c.n + (c.p ? '' : '   -> ' + (c.x === undefined ? '' : c.x))));
  const bad = checks.filter(c => !c.p).length;
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
