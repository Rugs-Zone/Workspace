/* patch-mail-rule-r30a-row.js - 27 Nov 2026 (bug 16)
 *
 * Puts rule R30a on Admin -> Mail rules as a PER-TEAM switch, the same shape as
 * manager-first (R32): a row with a "Choose teams" button, a dialog with one On/Off per
 * team, and the conflict question before anything is saved.
 *
 * It edits server/mail-rules.view.js (the source of that page). Run it once, then run
 * server/patch-mail-rules.js to embed the page into the app. Both are safe to run twice:
 * every edit carries a marker and the script says "already done" instead of doubling.
 *
 * The teams live in the SHARED setting mail_rules.r30a, which is the same object the eight
 * On/Off switches live in - so rSet() and rReset() must keep the other keys instead of
 * writing a fresh {v,vals,log}. That is the __r30akeep edit below, and without it changing
 * any other rule would silently switch R30a off for every team.
 *
 * Run:  node server/patch-mail-rule-r30a-row.js
 *       node server/mailapp-b64.js decode
 *       node server/patch-mail-rules.js
 *       node server/patch-r30a.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const V = path.join(__dirname, "mail-rules.view.js");
let s = fs.readFileSync(V, "utf8");
let n = 0;

function one(mark, find, rep, why) {
  if (s.indexOf(mark) >= 0) { console.log("already done: " + why); return; }
  const i = s.indexOf(find);
  if (i < 0) throw new Error("could not find the place for: " + why);
  if (s.indexOf(find, i + find.length) >= 0) throw new Error("found more than once: " + why);
  s = s.slice(0, i) + rep + s.slice(i + find.length);
  n++; console.log("  " + why);
}

/* ---- 1. the registry row, straight after R30 (its live half) ---- */
one("__r30arow",
  `    brk: ['Off would put a year of history into Needs owner.']
  },
`,
  `    brk: ['Off would put a year of history into Needs owner.']
  },
  {
    /* __r30arow 27 Nov 2026 (bug 16). Per team, and its own shape (a list of teams), so it
       is a 'set' with its own chooser like manager-first - not one On/Off for everybody. */
    id: 'R30a', g: 'Ownership', k: 'set', n: 'Old mail (every mail older than the team\\'s go-live) is open to the whole team - in Search only',
    now: () => {
      try {
        const on = DEPTS.filter(d => r30aPageOn(d));
        if (!on.length) return 'OFF everywhere - old mail follows R3, so a colleague\\'s old conversation cannot be found by a member at all.';
        return 'ON for ' + on.map(d => d.name).join(', ') + ' - in those teams a conversation whose mails are ALL older than go-live can be found by every member whatever its owner, through Search and through "Show in <folder>". It does NOT appear in the Inbox list, it is never work, it has no Done button and its owner never changes.';
      } catch (e) { return 'Per team.'; }
    },
    who: 'Team members. The Manager, Lead, CRM and Admin see everything anyway.',
    brk: [
      'It is a hole in R3 on purpose, and it is deliberately a narrow one: the mail is reachable through Search and "Show in <folder>", and nowhere else. A member\\'s Inbox list, Sent, Needs owner, My work and every folder count are exactly what they were - the Inbox does not grow.',
      'It stops at the team\\'s own go-live date (the same date rule R30 uses), so no live mail is ever opened up by it. A conversation that gets one new mail after go-live leaves R30a at once and follows R3 again.',
      'It never makes old mail work: it stays out of Needs owner and out of My work, it carries no Done button, and Take over / Assign / Transfer are taken off it, because those are the only things that could change its owner from a screen R30a opened.',
      'Switch it on for a team and that team\\'s whole history becomes findable by everyone in it, including a colleague\\'s own buyer correspondence. Switch it off and members go back to finding only their own old conversations.'
    ]
  },
`,
  "the R30a row in the registry");

/* ---- 2. the page's own answer to "is it on for this team", from the app's own rule ---- */
one("__r30apageon",
  `/* manager-first teams live in the shared setting the SERVER also reads (rm_auto_give) */`,
  `/* __r30apageon rule R30a: ask the APP's own helper, so the page can never disagree with
   what the app actually does. The fallback repeats the shipped default (Alpha and Pulse). */
function r30aPageList() {
  try { if (typeof r30aList === 'function') return r30aList(); } catch (e) { }
  try {
    const v = (S.settings && S.settings[RULES_KEY] || {}).r30a;
    if (Array.isArray(v)) return v.map(x => String(x).toLowerCase().split('@')[0]);
  } catch (e) { }
  return ['teamalpha', 'teampulse'];
}
function r30aPageOn(d) {
  try { if (typeof r30aTeam === 'function') return !!r30aTeam(d.id); } catch (e) { }
  try { return r30aPageList().indexOf(String(d.box || '').toLowerCase().split('@')[0]) >= 0; } catch (e) { return false; }
}
/* manager-first teams live in the shared setting the SERVER also reads (rm_auto_give) */`,
  "r30aPageList / r30aPageOn on the page");

/* ---- 3. the conflict question, counted from the mail this browser has loaded ---- */
one("__r30achk",
  `/* ====================================================== THE HEALTH CHECKS == */`,
  `/* __r30achk rule R30a, per team */
function rChk30a(box, on) {
  const hard = [], warn = [], eff = [];
  const d = DEPTS.filter(x => String(x.box || '').toLowerCase().split('@')[0] === String(box).toLowerCase().split('@')[0])[0];
  const nm = d ? d.name : box;
  const mem = PEOPLE.filter(p => p.active !== false && d && p.dept === d.id && !['Manager', 'Lead', 'CRM', 'Admin'].includes(p.role)).length;
  let old = 0, oldOwned = 0;
  try {
    const tf = d ? (S.trackFrom || {})[d.id] : 0;
    if (tf) rMine().forEach(t => {
      if (!d || t.dept !== d.id) return;
      if (!(+(t.last || 0) > 0 && +(t.last || 0) < tf)) return;
      old++; if (t.owner) oldOwned++;
    });
  } catch (e) { }
  if (on) {
    eff.push(old + ' conversation' + (old === 1 ? '' : 's') + ' of ' + nm + ' loaded in this browser are older than its go-live, and ' + oldOwned + ' of those already belong to somebody. Every one of the ' + mem + ' member' + (mem === 1 ? '' : 's') + ' would be able to FIND all of them by searching.');
    eff.push('Nothing moves and no Inbox grows: they stay out of the Inbox list, out of Needs owner and out of My work, and they are reachable only through Search and "Show in <folder>".');
    warn.push('It is a hole in R3: in ' + nm + ', a member will be able to read a colleague\\'s old buyer correspondence. That is the point of the rule, and it is why it stops at go-live - but it is worth saying out loud before you press it.');
    if (!(d && (S.trackFrom || {})[d.id])) hard.push(nm + ' has no go-live date set (Admin -> Departments -> Activate), so R30a has no date to stop at and will open NOTHING. Set the team live first.');
  } else {
    eff.push(nm + ' goes back to R3: a member will no longer find an old conversation that belongs to a colleague, not even by searching for it.');
    warn.push('This is what people report as "search hides mail". Before 27 November it was the only behaviour there was.');
  }
  return { hard: hard, warn: warn, eff: eff };
}

/* ====================================================== THE HEALTH CHECKS == */`,
  "the R30a conflict check");

/* ---- 4. the row's action: a "Choose teams" button like manager-first ---- */
one("__r30abtn",
  `  else if (r.id === 'R32') { act = canEdit ? '<button class="btn" data-rmgr>Choose teams</button>' : ''; }`,
  `  else if (r.id === 'R32') { act = canEdit ? '<button class="btn" data-rmgr>Choose teams</button>' : ''; }
  else if (r.id === 'R30a') { act = canEdit ? '<button class="btn" data-r30a>Choose teams</button>' : ''; }   /* __r30abtn */`,
  "the Choose teams button on the R30a row");

/* ---- 5. keep every other key in mail_rules - R30a's team list lives in there too ---- */
one("__r30akeep1",
  `  const body = { v: 1, vals: vals, log: log.slice(-200) };`,
  `  /* __r30akeep1: keep every other key in mail_rules - R30a's team list (r30a) is in there,
     and a fresh object would switch the rule off for every team on the next toggle. */
  const body = Object.assign({}, rulesObj(), { v: 1, vals: vals, log: log.slice(-200) });`,
  "rSet keeps the other mail_rules keys");

one("__r30akeep2",
  `  const body = { v: 1, vals: {}, log: log.slice(-200) };`,
  `  const body = Object.assign({}, rulesObj(), { v: 1, vals: {}, log: log.slice(-200) });   /* __r30akeep2 */`,
  "rReset keeps the other mail_rules keys (R30a is per team, not a shipped default)");

/* ---- 6. the chooser and the save ---- */
one("__r30adlg",
  `/* one delegated listener of our own, so the app's big click handler is untouched */`,
  `/* ------------------------------------------------- R30a: the team chooser ----- */
/* __r30adlg */
function r30aDlg() {
  const b = '<p style="font-size:13px;line-height:1.55;margin:0 0 10px">In a team where this is <b>on</b>, a conversation whose mails are <b>all older than that team\\'s go-live</b> can be <b>found by every member</b>, whoever owns it. ' +
    'It is reachable through <b>Search</b> and through <b>"Show in &lt;folder&gt;"</b> only - it does not appear in the Inbox list, it is never work, it has no Done button and its owner never changes.</p>' +
    '<div>' + DEPTS.map(d => {
      const box = String(d.box || '').toLowerCase().split('@')[0], on = r30aPageOn(d);
      const tf = (S.trackFrom || {})[d.id] || 0;
      let old = 0; try { if (tf) old = rMine().filter(t => t.dept === d.id && +(t.last || 0) > 0 && +(t.last || 0) < tf).length; } catch (e) { }
      const mem = PEOPLE.filter(p => p.active !== false && p.dept === d.id && !['Manager', 'Lead', 'CRM', 'Admin'].includes(p.role)).length;
      return '<div class="rlmb"><button class="rsw" data-r30at="' + esc(box) + '" aria-pressed="' + on + '">' + (on ? 'On' : 'Off') + '</button>' +
        '<span><b>' + esc(d.name) + '</b> \\u00b7 ' + esc(box) + '<br><span style="opacity:.75;font-size:12px">' +
        (tf ? ('live since ' + esc(tLong(tf)) + ' \\u00b7 ' + old + ' loaded conversation' + (old === 1 ? '' : 's') + ' older than that') : '<b style="color:#c22">no go-live date set</b>') +
        ' \\u00b7 ' + mem + ' member' + (mem === 1 ? '' : 's') + '</span></span></div>';
    }).join('') + '</div>';
  const L = dlg('Old mail open to the team (R30a)', b, '<button class="btn pri" data-x30a>Close</button>', true);
  const x = L.querySelector('[data-x30a]'); if (x) x.onclick = () => { L.innerHTML = ''; render(); };
}
function r30aAsk(box, on) {
  const c = rChk30a(box, on);
  const d = DEPTS.filter(x => String(x.box || '').toLowerCase().split('@')[0] === String(box).toLowerCase().split('@')[0])[0];
  const nm = d ? d.name : box;
  let b = '<div class="rlcf">';
  if (c.eff.length) b += '<div class="rlbox eff"><h4>What happens the moment you press it</h4><ul>' + c.eff.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  if (c.hard.length) b += '<div class="rlbox stop"><h4>\\u26d4 This conflicts with how the rest of the app works</h4><ul>' + c.hard.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  if (c.warn.length) b += '<div class="rlbox warn"><h4>\\u26a0\\ufe0f What it will cost</h4><ul>' + c.warn.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  b += '<p style="font-size:12.5px;opacity:.8;margin:8px 0 0">Who it affects: every member of ' + esc(nm) + '. The Manager, Lead, CRM and Admin see everything anyway.</p></div>';
  const L = dlg((on ? 'Open ' : 'Close ') + nm + '\\u2019s old mail to the team?', b,
    '<button class="btn pri" data-rno>Leave it as it is</button><button class="btn warn" data-ryes>' +
    (c.hard.length ? 'I have read the conflict \\u2014 change it anyway' : (on ? 'Open it to the team' : 'Switch it off')) + '</button>', true);
  const no = L.querySelector('[data-rno]'); if (no) { no.focus(); no.onclick = () => { L.innerHTML = ''; r30aDlg(); }; }
  const yes = L.querySelector('[data-ryes]');
  if (yes) yes.onclick = () => {
    const key = String(box).toLowerCase().split('@')[0];
    const cur = r30aPageList().filter(x => x !== key);
    if (on) cur.push(key);
    const log = rLog().slice();
    log.push({ id: 'R30a ' + key, from: on ? 'Off' : 'On', to: on ? 'On' : 'Off', by: ME, at: Date.now() });
    const body = Object.assign({}, rulesObj(), { v: 1, vals: (rulesObj().vals || {}), log: log.slice(-200), r30a: cur });
    S.settings = S.settings || {}; const back = S.settings[RULES_KEY];
    S.settings[RULES_KEY] = body;
    L.innerHTML = ''; render();
    api('saveSetting', { key: RULES_KEY, value: body })
      .then(() => { toast(nm + (on ? '\\u2019s old mail is now open to the whole team' : '\\u2019s old mail follows R3 again')); render(); })
      .catch(e => {
        S.settings[RULES_KEY] = back;
        if (/unknown setting/i.test(e.message || '')) { RULES_NOSRV = true; toast('Not saved: the office server has not picked up the Mail rules setting yet. It updates itself within ten minutes \\u2014 try again then.', true); }
        else toast('Not saved: ' + (e.message || 'the server refused it'), true);
        render();
      });
  };
}

/* one delegated listener of our own, so the app's big click handler is untouched */`,
  "the R30a chooser and its save");

/* ---- 7. the clicks ---- */
one("__r30aclick",
  `  const b = e.target.closest ? e.target.closest('[data-rtog],[data-rmore],[data-rreset],[data-rold],[data-rmgr],[data-rmgrt],[data-rules]') : null;`,
  `  const b = e.target.closest ? e.target.closest('[data-rtog],[data-rmore],[data-rreset],[data-rold],[data-rmgr],[data-rmgrt],[data-r30a],[data-r30at],[data-rules]') : null;   /* __r30aclick */`,
  "the delegated listener knows the two R30a buttons");

one("__r30ahandle",
  `  if (b.dataset.rmgrt) { if (who(ME) && who(ME).role === 'Admin') rMgrAsk(b.dataset.rmgrt, b.getAttribute('aria-pressed') !== 'true'); return; }`,
  `  if (b.dataset.rmgrt) { if (who(ME) && who(ME).role === 'Admin') rMgrAsk(b.dataset.rmgrt, b.getAttribute('aria-pressed') !== 'true'); return; }
  /* __r30ahandle */
  if (b.hasAttribute('data-r30a')) { if (who(ME) && who(ME).role === 'Admin') r30aDlg(); else toast('Only an admin can change a rule', true); return; }
  if (b.dataset.r30at) { if (who(ME) && who(ME).role === 'Admin') r30aAsk(b.dataset.r30at, b.getAttribute('aria-pressed') !== 'true'); return; }`,
  "the R30a clicks");

fs.writeFileSync(V, s);
console.log(n + " edit(s) to " + V);
