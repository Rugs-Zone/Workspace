/* my-rules.view.js - 27 Nov 2026  (bug 11 - rule R35: personal mail rules, Outlook style)
 *
 * Embedded into index.html by server/patch-my-rules.js between __myrules:start / __myrules:end.
 * Edit this file and run the patch again - the old block is replaced, never doubled.
 *
 * R35: every person - member, manager or admin - can make rules that change ONLY HIS OWN
 * view. A manager's rule has no team-wide power and nobody else's lists move.
 *
 * HOW THAT IS GUARANTEED, and it is the whole design: a rule is never written to the mail.
 * It is a FILTER, worked out on the spot for the person reading: nothing is saved on the
 * conversation, nothing is sent to the server, nothing reaches Gmail. So a mail a rule moves
 * is still in the team Inbox for everybody else, still in Needs owner and still in My work -
 * because those lists read the real folder on the conversation, which no rule touches.
 *
 * The rules themselves live in that person's own prefs (rm_users.prefs.mr35). The server's
 * savePrefs writes only the signed-in user's own row, so a person can read and write only
 * his own rules - which is what the "RLS" in the brief was asking for, in the database the
 * app actually talks to (see docs/schema.md).
 */

/* ------------------------------------------------------------------ state -- */
const MR_KEY = 'mr35';
const MR_NONE = { fold: '', label: '', flag: false, read: false, by: [] };
const MR_NEVER = { deleted: 1, junk: 1, purged: 1, drafts: 1 };   /* 4 · never touched by a rule */

function mrRaw() { try { const v = S.prefs && S.prefs[MR_KEY]; return Array.isArray(v) ? v : []; } catch (e) { return []; } }
/* MY rules. Prefs are per person on the server (savePrefs writes only the signed-in user's
   own row), so this is already only mine - but each rule also carries whose it is, so even
   in a Switch ID session or a shared browser copy nobody else's rule can ever run on my
   mail. A rule made before this was added has no owner written on it and counts as mine. */
function mrList() { try { return mrRaw().filter(r => r && (!r.by || r.by === ME)); } catch (e) { return []; } }
function mrSave(list, note) {
  try {
    const others = mrRaw().filter(r => r && r.by && r.by !== ME);   /* never lose somebody else's */
    list = (list || []).map(r => Object.assign({}, r, { by: r.by || ME }));
    S.prefs = Object.assign({}, S.prefs, { [MR_KEY]: others.concat(list) });
    MRV = '';                                     /* every answer is worked out again */
    const p = {}; p[MR_KEY] = S.prefs[MR_KEY];
    api('savePrefs', { prefs: p }).catch(e => toast('Your rules were not saved: ' + e.message));
    if (typeof save === 'function') save();
    render();
    if (note) toast(note);
  } catch (e) { toast('Could not save: ' + e.message); }
}
const mrId = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

/* ------------------------------------------------------------------ engine - */
/* the newest mail somebody sent us - the one a rule is about */
function mrMsg(t) {
  const ms = (t && t.msgs) || [];
  for (let i = ms.length - 1; i >= 0; i--) { try { if (recvMsg(ms[i], t)) return ms[i]; } catch (e) { } }
  return ms[ms.length - 1] || null;
}
const mrTxt = x => String(x == null ? '' : x).toLowerCase().trim();
/* do ALL the conditions of this rule match? */
function mrMatch(t, r) {
  try {
    const c = (r && r.c) || {};
    if (!c.from && !c.dom && !c.sub && !c.to && !c.att) return false;   /* a rule with no condition catches nothing */
    const m = mrMsg(t); if (!m) return false;
    const from = mrTxt(m.email);
    if (c.from && from.indexOf(mrTxt(c.from)) < 0) return false;
    if (c.dom) {
      const d = mrTxt(c.dom).replace(/^@/, '');
      if (!d || from.indexOf('@' + d) < 0) return false;
    }
    if (c.sub) {
      const sub = mrTxt(typeof cleanSub === 'function' ? cleanSub(t.sub) : t.sub);
      if (sub.indexOf(mrTxt(c.sub)) < 0) return false;
    }
    if (c.to) {
      const to = mrTxt([m.to, m.cc, m.delivered_to, (t.to_addrs || []).join(' ')].join(' '));
      if (to.indexOf(mrTxt(c.to)) < 0) return false;
    }
    if (c.att && !((m.atts && m.atts.length) || (m.files && m.files.length))) return false;
    return true;
  } catch (e) { return false; }
}
/* run the rules in order: first match wins per action, and a rule with "stop" ends it */
function mrRun(t) {
  const rules = mrList();
  if (!rules.length) return MR_NONE;
  const raw = String((t && t.folder) || 'inbox');
  if (MR_NEVER[raw]) return MR_NONE;                 /* 4 · Junk, Deleted and Drafts are left alone */
  const out = { fold: '', label: '', flag: false, read: false, by: [] };
  let mine = [];
  try { mine = myFolders() || []; } catch (e) { }
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!r || r.on === false) continue;
    if (!mrMatch(t, r)) continue;
    const a = r.a || {};
    if (a.move && !out.fold && mine.indexOf(a.move) >= 0) out.fold = a.move;
    if (a.topic && !out.label) out.label = a.topic;
    if (a.flag) out.flag = true;
    if (a.read) out.read = true;
    out.by.push(r.name || ('Rule ' + (i + 1)));
    if (r.stop) break;
  }
  return out;
}
/* one answer per conversation per draw: a rule is a pure function of the mail, so this is
   exact - and it is thrown away on the next draw, so nothing can go stale */
let MRV = '', MRC = new WeakMap();
function mrEval(t) {
  if (!t || typeof t !== 'object') return MR_NONE;
  let v; try { v = JSON.stringify(mrList()) + '|' + ME + '|' + (typeof PASS === 'undefined' ? 0 : PASS); } catch (e) { v = 'x' + Math.random(); }
  if (v !== MRV) { MRC = new WeakMap(); MRV = v; }
  const hit = MRC.get(t);
  if (hit !== undefined) return hit;
  const r = mrRun(t);
  MRC.set(t, r);
  return r;
}
/* a small number that changes whenever my rules (or who I am) change, so every cache in the
   app - the drawn list, each row's HTML, the folder pane, the counts - is worked out again */
function mrFp() {
  try {
    const s = ME + '|' + JSON.stringify(mrRaw());
    let h = s.length | 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  } catch (e) { return 0; }
}
/* what the rest of the app asks */
const mrMove = t => mrEval(t).fold;                                  /* '' = where it really is */
const mrLab = t => mrEval(t).label || (t && t.label) || '';
const mrFlagOf = t => !!((t && t.flag) || mrEval(t).flag);
const mrUnread = t => !!(t && t.unread) && !mrEval(t).read;
const mrHit = t => mrEval(t).by;

/* --------------------------------------------------------------- the view -- */
/* a mail my rule moved is in MY folder and out of MY Inbox. Everything else - Needs owner,
   My work, Sent, the critical pages, Search - is left exactly as it was, which is what keeps
   rule 4 true: those lists read the conversation's real folder. */
const _ivMR = inView;
inView = function (t) {
  try {
    const f = mrMove(t);
    if (f) {
      if (view.type === 'folder') {
        if (view.folder !== f) return false;
        /* may this person see it at all? ask the same question its own Inbox would */
        const sv = view;
        try { view = { type: 'box', dept: t.dept, folder: 'inbox' }; return _ivMR.call(this, t); }
        finally { view = sv; }
      }
      if (view.type === 'all') return false;                         /* it left my Inbox */
      if (view.type === 'box' && view.folder === 'inbox' && t.dept === view.dept) return false;
    }
  } catch (e) { }
  return _ivMR.apply(this, arguments);
};
/* the Inbox count follows the same move */
const _iuMR = inboxUnreadN;
inboxUnreadN = function (deptId) {
  const n = _iuMR.apply(this, arguments);
  try {
    if (!mrList().length) return n;
    let off = 0;
    S.threads.forEach(t => {
      if (!t || !t.unread) return;
      if (deptId ? t.dept !== deptId : !inScope(t)) return;
      if (!isInboxMail(t)) return;
      if (mrMove(t) || mrEval(t).read) off++;       /* moved out of my Inbox, or read for me */
    });
    return Math.max(0, n - off);
  } catch (e) { return n; }
};

/* ------------------------------------------------------------- the screen -- */
function mrSum(r) {
  const c = r.c || {}, a = r.a || {}, w = [];
  if (c.from) w.push('from ' + c.from);
  if (c.dom) w.push('from @' + String(c.dom).replace(/^@/, ''));
  if (c.sub) w.push('subject has "' + c.sub + '"');
  if (c.to) w.push('sent to ' + c.to);
  if (c.att) w.push('has an attachment');
  const d = [];
  if (a.move) d.push('move to ' + a.move);
  if (a.topic) { let nm = a.topic; try { nm = LB(a.topic).name; } catch (e) { } d.push('topic ' + nm); }
  if (a.flag) d.push('flag it');
  if (a.read) d.push('mark it read');
  return esc((w.join(' and ') || 'no condition yet') + ' → ' + (d.join(', ') || 'nothing yet')) +
    (r.stop ? ' <span class="tag t-done">stop here</span>' : '');
}
function mrCount(r) {
  try {
    const one = [r];
    return (S.threads || []).filter(t => {
      if (!t || MR_NEVER[String(t.folder || 'inbox')]) return false;
      if (!inScope(t)) return false;
      try { if (typeof seeMine === 'function' && !seeMine(t)) return false; } catch (e) { }
      return mrMatch(t, one[0]);
    }).length;
  } catch (e) { return 0; }
}
function mrDlg() {
  const list = mrList();
  const rows = list.length ? list.map((r, i) => `<div class="mrrow ${r.on === false ? 'off' : ''}">
   <button class="btn mrtog" data-mron="${i}" aria-pressed="${r.on !== false}" title="${r.on === false ? 'Switched off' : 'On'}">${r.on === false ? '○ Off' : '● On'}</button>
   <div class="mrw"><b>${esc(r.name || 'Rule ' + (i + 1))}</b><span>${mrSum(r)}</span></div>
   <div class="mrb">
    <button class="btn" data-mrup="${i}" ${i === 0 ? 'disabled' : ''} title="Move up" aria-label="Move ${esc(r.name || '')} up">↑</button>
    <button class="btn" data-mrdn="${i}" ${i === list.length - 1 ? 'disabled' : ''} title="Move down" aria-label="Move ${esc(r.name || '')} down">↓</button>
    <button class="btn" data-mrrun="${i}" title="See how many mails this rule matches">▶ Run now</button>
    <button class="btn" data-mred="${i}">Edit</button>
    <button class="btn" data-mrdel="${i}" title="Delete this rule">${ico('trash')}</button>
   </div></div>`).join('') : `<div class="empty"><b>No rules yet</b><span>A rule can file a buyer's mail into one of your own folders, give it a topic, flag it or mark it read — for you only.</span></div>`;
  const L = dlg('\u{1F4CB} My rules', `
  <p style="margin:0 0 10px;color:var(--muted)">These rules change <b style="color:var(--fg)">only your own view</b>. Nothing is moved for the team: the mail stays in the team Inbox for everybody else, and it still shows in <b style="color:var(--fg)">Needs owner</b> and <b style="color:var(--fg)">My work</b> until somebody owns it or marks it done. Junk, Deleted and Drafts are never touched by a rule.</p>
  <p style="margin:0 0 10px;color:var(--muted)">They are checked top to bottom on every mail, new or old — the first rule that matches sets each action, and a rule marked <b style="color:var(--fg)">stop here</b> ends the list.</p>
  <div class="mrlist">${rows}</div>`,
    `<button class="btn" data-mrall>▶ Run now on existing mail</button><span class="grow" style="flex:1"></span><button class="btn" data-x2>Close</button><button class="btn pri" data-mrnew>＋ New rule</button>`, true);
  const q = x => L.querySelector(x);
  q('[data-x2]').onclick = () => { L.innerHTML = ''; };
  q('[data-mrnew]').onclick = () => mrEdit(-1);
  q('[data-mrall]').onclick = () => mrRunAll();
  L.querySelectorAll('[data-mron]').forEach(b => b.onclick = () => {
    const i = +b.dataset.mron, l = mrList().slice();
    l[i] = Object.assign({}, l[i], { on: l[i].on === false });
    mrSave(l); mrDlg();
  });
  L.querySelectorAll('[data-mrup]').forEach(b => b.onclick = () => { const i = +b.dataset.mrup, l = mrList().slice(); if (i > 0) { const x = l[i - 1]; l[i - 1] = l[i]; l[i] = x; mrSave(l); mrDlg(); } });
  L.querySelectorAll('[data-mrdn]').forEach(b => b.onclick = () => { const i = +b.dataset.mrdn, l = mrList().slice(); if (i < l.length - 1) { const x = l[i + 1]; l[i + 1] = l[i]; l[i] = x; mrSave(l); mrDlg(); } });
  L.querySelectorAll('[data-mred]').forEach(b => b.onclick = () => mrEdit(+b.dataset.mred));
  L.querySelectorAll('[data-mrrun]').forEach(b => b.onclick = () => mrRunOne(+b.dataset.mrrun));
  L.querySelectorAll('[data-mrdel]').forEach(b => b.onclick = () => {
    const i = +b.dataset.mrdel, l = mrList().slice(), gone = l[i];
    l.splice(i, 1); mrSave(l, 'Rule deleted'); mrDlg();
    if (typeof undoToast === 'function') undoToast('Rule "' + (gone.name || 'Rule') + '" deleted', () => { const n = mrList().slice(); n.splice(i, 0, gone); mrSave(n, 'Rule put back'); mrDlg(); });
  });
  return L;
}
function mrEdit(idx) {
  const list = mrList(), r = idx >= 0 ? JSON.parse(JSON.stringify(list[idx])) : { id: mrId(), name: '', on: true, stop: false, c: {}, a: {} };
  const c = r.c || {}, a = r.a || {};
  let folders = []; try { folders = myFolders() || []; } catch (e) { }
  const L = dlg(idx >= 0 ? 'Edit rule' : 'New rule', `
  <div class="fld"><label for="mrn">Name</label><input type="text" id="mrn" value="${esc(r.name || '')}" placeholder="e.g. Turner Bianca"></div>
  <h4 style="margin:12px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)">When ALL of these match</h4>
  <div class="fld"><label for="mrf">From address</label><input type="text" id="mrf" value="${esc(c.from || '')}" placeholder="buyer@turner-bianca.com"></div>
  <div class="fld"><label for="mrd">From domain</label><input type="text" id="mrd" value="${esc(c.dom || '')}" placeholder="turner-bianca.com"></div>
  <div class="fld"><label for="mrs">Subject contains</label><input type="text" id="mrs" value="${esc(c.sub || '')}" placeholder="IO 4815"></div>
  <div class="fld"><label for="mrt">Sent to (your address or alias)</label><input type="text" id="mrt" value="${esc(c.to || '')}" placeholder="merchandiser4@rugscreation.com"></div>
  <label class="mrck"><input type="checkbox" id="mra" ${c.att ? 'checked' : ''}> Has an attachment</label>
  <h4 style="margin:14px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)">Then, for me only</h4>
  <div class="fld"><label for="mrmv">Move to my folder</label><select id="mrmv"><option value="">— leave it where it is —</option>${folders.map(f => `<option value="${esc(f)}" ${a.move === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
  <div class="fld"><label for="mrnf">…or a new folder</label><input type="text" id="mrnf" placeholder="Turner" value=""></div>
  <div class="fld"><label for="mrtp">Set topic</label><select id="mrtp"><option value="">— no topic —</option>${LABELS.map(l => `<option value="${l.id}" ${a.topic === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
  <label class="mrck"><input type="checkbox" id="mrfl" ${a.flag ? 'checked' : ''}> Flag it</label>
  <label class="mrck"><input type="checkbox" id="mrrd" ${a.read ? 'checked' : ''}> Mark it read (for me)</label>
  <label class="mrck"><input type="checkbox" id="mrst" ${r.stop ? 'checked' : ''}> Stop processing more rules</label>
  <p style="margin:10px 0 0;color:var(--muted);font-size:12px">Marking it read hides it from your own unread counts only — it stays unread for everybody else and in Gmail.</p>`,
    `<button class="btn" data-c2>Cancel</button><button class="btn pri" data-s2>Save rule</button>`, true);
  const q = x => L.querySelector(x);
  q('[data-c2]').onclick = () => mrDlg();
  q('[data-s2]').onclick = () => {
    const nf = q('#mrnf').value.trim();
    const n = {
      id: r.id || mrId(), by: r.by || ME, name: q('#mrn').value.trim(), on: r.on !== false, stop: !!q('#mrst').checked,
      c: { from: q('#mrf').value.trim(), dom: q('#mrd').value.trim().replace(/^@/, ''), sub: q('#mrs').value.trim(), to: q('#mrt').value.trim(), att: !!q('#mra').checked },
      a: { move: nf || q('#mrmv').value, topic: q('#mrtp').value, flag: !!q('#mrfl').checked, read: !!q('#mrrd').checked }
    };
    if (!n.c.from && !n.c.dom && !n.c.sub && !n.c.to && !n.c.att) { toast('Give the rule at least one condition'); return; }
    if (!n.a.move && !n.a.topic && !n.a.flag && !n.a.read) { toast('Give the rule at least one action'); return; }
    if (!n.name) n.name = n.c.dom ? ('@' + n.c.dom) : (n.c.from || n.c.sub || 'My rule');
    if (nf) {                                     /* a new folder of mine, made on the spot */
      let f = []; try { f = (myFolders() || []).slice(); } catch (e) { }
      if (f.indexOf(nf) < 0) { f.push(nf); if (typeof saveMyFolders === 'function') saveMyFolders(f); }
    }
    const l = mrList().slice();
    if (idx >= 0) l[idx] = n; else l.push(n);
    mrSave(l, idx >= 0 ? 'Rule saved' : 'Rule added');
    mrDlg();
    mrRunOne(idx >= 0 ? idx : l.length - 1, true);
  };
}
/* 3 · "Run now on existing mail" - the count first, then it is applied to the lists */
function mrRunOne(i, quiet) {
  const r = mrList()[i]; if (!r) return;
  const n = mrCount(r);
  if (quiet) { toast(n ? n + ' mail' + (n === 1 ? '' : 's') + ' here match "' + (r.name || 'the rule') + '"' : 'Nothing here matches this rule yet'); return; }
  const L = dlg('Run "' + (r.name || 'rule') + '" on existing mail', `
   <p style="margin:0">This rule matches <b>${n.toLocaleString('en-IN')}</b> conversation${n === 1 ? '' : 's'} of the mail loaded in this browser.</p>
   <p style="margin:8px 0 0;color:var(--muted)">${esc(mrSum(r).replace(/<[^>]*>/g, ''))}</p>
   <p style="margin:8px 0 0;color:var(--muted)">A rule is a filter, not a move: nothing is written to the mail and nobody else's lists change. Press Apply and your own lists are drawn again with this rule in them. Older mail that has not been loaded yet is filed the moment it arrives on screen.</p>`,
    `<button class="btn" data-c3>Cancel</button><button class="btn pri" data-a3>Apply to my view</button>`);
  L.querySelector('[data-c3]').onclick = () => mrDlg();
  L.querySelector('[data-a3]').onclick = () => { L.innerHTML = ''; MRV = ''; render(); toast(n ? 'Done — ' + n + ' mail' + (n === 1 ? '' : 's') + ' filed by "' + (r.name || 'the rule') + '"' : 'Nothing here matched'); };
}
function mrRunAll() {
  const list = mrList().filter(r => r && r.on !== false);
  if (!list.length) { toast('No rules are switched on'); return; }
  let moved = 0, read = 0, flagged = 0, topic = 0, hit = 0;
  (S.threads || []).forEach(t => {
    const e = mrRun(t);
    if (!e.by.length) return;
    hit++;
    if (e.fold) moved++;
    if (e.read) read++;
    if (e.flag) flagged++;
    if (e.label) topic++;
  });
  const L = dlg('Run my rules on existing mail', `
   <p style="margin:0"><b>${hit.toLocaleString('en-IN')}</b> conversation${hit === 1 ? '' : 's'} of the mail loaded here match one of your ${list.length} rule${list.length === 1 ? '' : 's'}.</p>
   <ul style="margin:8px 0 0;padding-left:18px;color:var(--muted)">
    <li>${moved.toLocaleString('en-IN')} would sit in one of your folders</li>
    <li>${topic.toLocaleString('en-IN')} would get a topic</li>
    <li>${flagged.toLocaleString('en-IN')} would be flagged</li>
    <li>${read.toLocaleString('en-IN')} would count as read for you</li>
   </ul>
   <p style="margin:8px 0 0;color:var(--muted)">Nothing is written to the mail and nobody else's lists change.</p>`,
    `<button class="btn" data-c4>Cancel</button><button class="btn pri" data-a4>Apply to my view</button>`);
  L.querySelector('[data-c4]').onclick = () => mrDlg();
  L.querySelector('[data-a4]').onclick = () => { L.innerHTML = ''; MRV = ''; render(); toast('Done — ' + hit + ' conversation' + (hit === 1 ? '' : 's') + ' filed by your rules'); };
}

/* the entry in the menu under your own name, next to the shared rules page */
const _mmMR = meMenu;
meMenu = function () {
  const r = _mmMR.apply(this, arguments);
  try {
    const m = document.querySelector('.pop[aria-label="Account"] .menu');
    if (m && !m.querySelector('[data-myrules]')) {
      const b = document.createElement('button');
      b.setAttribute('data-myrules', '');
      b.textContent = '\u{1F4CB} My rules';
      b.title = 'Rules that file your own mail - they change nobody else’s view';
      const anchor = m.querySelector('[data-rules]') || m.querySelector('#mB');
      m.insertBefore(b, anchor || null);
    }
  } catch (e) { }
  return r;
};
document.addEventListener('click', function (e) {
  const b = e.target && e.target.closest ? e.target.closest('[data-myrules]') : null;
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  try { $('#layer').innerHTML = ''; } catch (x) { }
  mrDlg();
}, true);

/* ------------------------------------------------------------------ CSS ---- */
(function mrCSS() {
  if (document.getElementById('mrCSS')) return;
  const st = document.createElement('style'); st.id = 'mrCSS';
  st.textContent = [
    '.mrlist{display:flex;flex-direction:column;gap:8px}',
    '.mrrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--pane)}',
    '.mrrow.off{opacity:.55}',
    '.mrrow .mrw{flex:1;min-width:140px;display:flex;flex-direction:column;gap:2px}',
    '.mrrow .mrw span{font-size:12px;color:var(--muted)}',
    '.mrrow .mrb{display:flex;gap:4px;flex-wrap:wrap}',
    '.mrrow .btn{padding:4px 8px;font-size:12px}',
    '.mrtog{min-width:58px}',
    '.mrck{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px}',
    '@media (max-width:640px){.mrrow .mrb{width:100%}.mrrow .mrb .btn{flex:1}}'
  ].join('');
  document.head.appendChild(st);
})();
