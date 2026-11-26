/* mail-search.view.js - 27 Nov 2026  (night plan, bug 1: "search hides mail")
 *
 * Embedded into the mail app by  node server/patch-search-rank.js  between the markers
 * __srch:start / __srch:end. Edit this file and run the patch again.
 *
 * It changes NOTHING about who may see a mail. Every wrapper here runs on the rows the app
 * has already filtered, so seeMine / sentSeen / inView - the whole ownership chain - decide
 * membership exactly as before. This only decides the ORDER, the EXTRAS on a row, and what
 * is asked of the server.
 *
 *  1  best match first, not date      srchRank()  + the listRows wrapper
 *  2  a number matches as a whole     qWord()     - 4815 never matches 24815 or 148150
 *  3  from:/to:/subject:/has:/before:/after: go to the server   srchFilters() + serverFind()
 *  4  500 results, then "Show more"   serverFind(raw, again, offset)
 *  5  a folder tag on every result    srchFolderTag() + the rowHTML wrapper
 *  6  filter chips under the search box
 *  7  the words are highlighted on the row and in the open mail
 */

/* ============================================================ 2 · matching = */
/* A number must match as a WHOLE number: searching 4815 must not drag in 24815 or 148150.
   Written as a scan, not a regular expression, because the word comes from a person and
   escaping it into a regex is one bad character away from a broken search. */
function qIsNum(w) { w = String(w); if (!w) return false; for (let i = 0; i < w.length; i++) { const c = w.charAt(i); if (c < '0' || c > '9') return false; } return true; }
function qDigit(c) { return c >= '0' && c <= '9'; }
function qWord(hay, w) {
  hay = String(hay == null ? '' : hay).toLowerCase();
  w = String(w == null ? '' : w).toLowerCase();
  if (!w) return false;
  if (!qIsNum(w)) return hay.indexOf(w) >= 0;
  let i = hay.indexOf(w);
  while (i >= 0) {
    if (!qDigit(hay.charAt(i - 1)) && !qDigit(hay.charAt(i + w.length))) return true;
    i = hay.indexOf(w, i + 1);
  }
  return false;
}

/* ============================================================== 1 · ranking = */
/* Where did the words actually hit? Lower is better:
     0 the subject · 1 the sender or the To/Cc line · 2 the mail text · 3 an attachment name
     4 somewhere else (the owner's name, a promise, or the server found it in a part of the
       mail this browser has not loaded)
   Newest first only INSIDE one rank. */
function srchFields(t) {
  const one = t && t._one && t.msgs && t.msgs[t._mi] ? t.msgs[t._mi] : null;   /* a per-mail row judges its own mail */
  const ms = one ? [one] : ((t && t.msgs) || []);
  const j = a => a.filter(Boolean).join(' · ');
  const ownr = (typeof who === 'function' && t && t.owner && who(t.owner)) ? who(t.owner).name : '';
  return {
    subj: String((t && t.sub) || ''),
    who: j([t && t.from, t && t.email].concat(ms.map(m => String(m.to || '') + ' ' + String(m.cc || '')))),
    body: j(ms.map(m => m.body).concat([t && t.pre])),
    att: j([].concat.apply([], ms.map(m => (m.atts || []).map(a => a.name).concat((m.files || []).map(f => f.name))))),
    other: j([ownr, t && t.promise])
  };
}
function srchRank(t, o) {
  const w = (o && o.words) || [];
  if (!w.length) return 1;                       /* a filter-only search keeps date order */
  const F = srchFields(t), all = s => w.every(x => qWord(s, x));
  if (all(F.subj)) return 0;
  if (all(F.who)) return 1;
  if (all(F.body)) return 2;
  if (all(F.att)) return 3;
  return 4;
}
const _lrSrch = listRows;
listRows = function () {
  const r = _lrSrch.apply(this, arguments);
  let raw = ''; try { raw = ($('#q') ? $('#q').value : '').trim(); } catch (e) { }
  if (!raw) return r;                            /* every other view is untouched */
  const o = parseQ(raw), k = t => rowWhen(t);
  return r.slice().sort((a, b) => (srchRank(a, o) - srchRank(b, o)) || (k(b) - k(a)));
};

/* ============================================================ 5 · folder tag = */
/* On a search result, "where will I find this?" is the first question. */
function srchFolderTag(t) {
  const f = String((t && t.folder) || 'inbox').toLowerCase();
  if (f === 'deleted' || f === 'purged') return 'Deleted';
  if (f === 'junk' || f === 'spam') return 'Junk';
  if (f === 'archive' || f === 'archived') return 'Archive';
  if (f && f !== 'inbox' && f !== 'sent') return f;          /* a personal folder keeps its name */
  try { if (typeof hasRecv === 'function' && !hasRecv(t)) return 'Sent'; } catch (e) { }
  try { if (typeof st === 'function' && st(t) === 'done') return 'Done'; } catch (e) { }
  return 'Inbox';
}

/* ========================================================== 7 · highlighting = */
function srchWords(o) {
  const w = ((o && o.words) || []).slice();
  ['from', 'to', 'subject'].forEach(k => { if (o && o[k]) w.push(String(o[k])); });
  return w.filter(x => String(x).length >= 2).slice(0, 8);
}
function srchQWords() {
  let raw = ''; try { raw = ($('#q') ? $('#q').value : '').trim(); } catch (e) { }
  return raw ? srchWords(parseQ(raw)) : [];
}
/* every place a word sits in this text, as [start,end] pairs, longest match kept */
function hiRanges(txt, ws) {
  const low = String(txt || '').toLowerCase(), out = [];
  ws.forEach(w0 => {
    const w = String(w0).toLowerCase(); if (w.length < 2) return;
    const num = qIsNum(w);
    let i = low.indexOf(w);
    while (i >= 0) {
      if (!num || (!qDigit(low.charAt(i - 1)) && !qDigit(low.charAt(i + w.length)))) out.push([i, i + w.length]);
      i = low.indexOf(w, i + 1);
    }
  });
  if (!out.length) return out;
  out.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const keep = []; let at = -1;
  out.forEach(r => { if (r[0] >= at) { keep.push(r); at = r[1]; } });
  return keep;
}
/* the string version, for the pieces of a row we build as HTML ourselves */
function hiText(txt, ws) {
  if (!txt || !ws.length) return txt;
  if (String(txt).indexOf('&') >= 0 || String(txt).indexOf('<') >= 0) return txt;   /* never cut an entity in half */
  const marks = hiRanges(txt, ws); if (!marks.length) return txt;
  let out = '', at = 0;
  marks.forEach(r => { out += txt.slice(at, r[0]) + '<mark class="shl">' + txt.slice(r[0], r[1]) + '</mark>'; at = r[1]; });
  return out + txt.slice(at);
}
/* the DOM version, for mail that is already on the screen - no HTML parsing, so a buyer's
   markup cannot be damaged by it */
function hiNode(node, ws) {
  const txt = node.nodeValue, marks = hiRanges(txt, ws);
  if (!marks.length) return false;
  const doc = node.ownerDocument || document, fr = doc.createDocumentFragment();
  let at = 0;
  marks.forEach(r => {
    if (r[0] > at) fr.appendChild(doc.createTextNode(txt.slice(at, r[0])));
    const mk = doc.createElement('mark'); mk.className = 'shl'; mk.textContent = txt.slice(r[0], r[1]);
    fr.appendChild(mk); at = r[1];
  });
  if (at < txt.length) fr.appendChild(doc.createTextNode(txt.slice(at)));
  node.parentNode.replaceChild(fr, node);
  return true;
}
const HI_SKIP = { SCRIPT: 1, STYLE: 1, MARK: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1 };
function hiDom(root, ws) {
  if (!root || !ws.length) return;
  let n = 0;
  (function walk(el) {
    let c = el.firstChild;
    while (c) {
      const next = c.nextSibling;
      if (c.nodeType === 3) { if (n < 400 && hiNode(c, ws)) n++; }
      else if (c.nodeType === 1 && !HI_SKIP[c.nodeName] && !(c.className === 'shl')) walk(c);
      c = next;
    }
  })(root);
}
function hiClear(root) {
  if (!root || !root.querySelectorAll) return;
  const ms = root.querySelectorAll('mark.shl');
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i], p = m.parentNode; if (!p) continue;
    p.replaceChild((m.ownerDocument || document).createTextNode(m.textContent), m);
    if (p.normalize) p.normalize();
  }
}
/* the open mail, and the sandboxed frame the buyer's own HTML lives in */
function srchHiRead() {
  const rd = document.getElementById('read'); if (!rd) return;
  hiClear(rd);
  const fr = rd.querySelectorAll('iframe');
  for (let i = 0; i < fr.length; i++) { try { const d = fr[i].contentDocument; if (d && d.body) hiClear(d.body); } catch (e) { } }
  const ws = srchQWords(); if (!ws.length) return;
  hiDom(rd, ws);
  for (let i = 0; i < fr.length; i++) { try { const d = fr[i].contentDocument; if (d && d.body) hiDom(d.body, ws); } catch (e) { } }
}
const _rrSrch = renderRead;
renderRead = function () {
  const r = _rrSrch.apply(this, arguments);
  try {
    srchHiRead();
    /* a sandboxed frame is written with srcdoc, so its document may not exist yet */
    clearTimeout(window.__srchHiT);
    window.__srchHiT = setTimeout(() => { try { srchHiRead(); } catch (e) { } }, 350);
  } catch (e) { }
  return r;
};

/* ================================================== 5 + 7 · the row itself == */
const _rhSrch = rowHTML;
rowHTML = function (t) {
  let h = _rhSrch.apply(this, arguments);
  let raw = ''; try { raw = ($('#q') ? $('#q').value : '').trim(); } catch (e) { }
  if (!raw) return h;
  try {
    const ws = srchWords(parseQ(raw));
    /* the folder tag, first in the row's tag strip */
    const f = srchFolderTag(t);
    h = h.replace('<div class="tags">', '<div class="tags"><span class="tag sfold" title="Where this conversation is">' + esc(f) + '</span>');
    /* the words, inside the three places a row shows text - and only there */
    if (ws.length) h = h.replace(/(<div class="(?:sub|pre)">|<span class="who">)([^<&]*)(<)/g,
      (m, a, txt, c) => a + hiText(txt, ws) + c);
  } catch (e) { }
  return h;
};

/* ================================================ 3 + 4 · asking the server = */
function srchFilters(raw) {
  const o = parseQ(raw), f = {};
  if (o.from) f.from = o.from;
  if (o.to) f.to = o.to;
  if (o.subject) f.subject = o.subject;
  if (o.att) f.att = true;
  if (o.before) f.before = o.before;
  if (o.after) f.after = o.after;
  if (o.in) f.in = o.in;
  return f;
}
function srchHasFilter(f) { return !!(f.from || f.to || f.subject || f.att || f.before || f.after || f.in); }
/* replaces the 24 Nov serverFind: it now sends the filters, asks for 500 instead of 200,
   and can fetch the next 500 without throwing away the ones already on screen. */
serverFind = function (raw, again, offset) {
  const q = String(raw || '').trim();
  const f = q ? srchFilters(q) : {};
  const words = q ? parseQ(q).words.join(' ').trim() : '';
  const off = Math.max(0, Number(offset) || 0);
  if ((words.length < 3) && !srchHasFilter(f)) { if (FND.q) fndClear(); return; }
  if (!again && !off && FND.q === q && (FND.busy || FND.at)) return;      /* already asked */
  FND = { q, ids: (FND.q === q && off) ? FND.ids : new Set(), busy: true, err: '', text: FND.text, at: 0, n: 0, ms: 0, more: false, off };
  try { renderListKeep(); } catch (e) { }
  api('find', { q, f, limit: 500, offset: off }).then(r => {
    if (($('#q') ? $('#q').value : '').trim() !== q) return;              /* they typed on */
    if (!Array.isArray(r.words)) { FND = { q, ids: new Set(), busy: false, err: '', text: true, at: 0, n: 0, ms: 0, more: false, off: 0 }; return; }
    const before = new Set(S.threads.map(t => t.id)), bd = boxDept(), ids = new Set(FND.ids);
    mergeList(r);
    (r.threads || []).forEach(row => { const home = bd[String(row.mailbox).toLowerCase()]; if (home) ids.add(home + ':' + row.gmail_thread_id); });
    FND = {
      q, ids, busy: false, err: '', text: r.text !== false, at: Date.now(),
      n: [...ids].filter(i => !before.has(i)).length, ms: r.ms || 0,
      more: !!r.more, off
    };
    render();
  }).catch(e => {
    if (($('#q') ? $('#q').value : '').trim() !== q) return;
    FND = { q, ids: FND.ids, busy: false, err: e.message || 'Search failed', text: true, at: Date.now(), n: 0, ms: 0, more: false, off };
    try { renderListKeep(); } catch (e2) { }
  });
};

/* ======================================== 6 · the chips, and "Show more" ==== */
const SQ_CHIPS = [
  ['from:', 'From', 'from:ikea — the sender’s name or address'],
  ['to:', 'To', 'to:priya — who it was sent to (To or Cc)'],
  ['has:attachment', 'Has attachment', 'only conversations carrying a file'],
  ['date', 'Date range', 'after:YYYY-MM-DD and before:YYYY-MM-DD — edit the dates once they are in the box'],
  ['folder', 'Folder', 'in:inbox — also sent, archive, junk, deleted, or one of your own folders']
];
function srchChipsHTML() {
  return '<div class="schips" role="group" aria-label="Search filters"><span class="lbl">Narrow it:</span>' +
    SQ_CHIPS.map(c => '<button type="button" class="btn" data-sq="' + esc(c[0]) + '" title="' + esc(c[2]) + '">' + esc(c[1]) + '</button>').join('') +
    '<button type="button" class="btn" data-sqclear title="Empty the search box">Clear</button></div>';
}
function srchChipText(code) {
  if (code === 'date') {
    const d = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    return 'after:' + d(30) + ' before:' + d(-1);
  }
  if (code === 'folder') return 'in:inbox';
  return code;
}
const _rlSrch = renderList;
renderList = function () {
  _rlSrch.apply(this, arguments);
  const h = document.querySelector('.list .lhead'); if (!h) return;
  let raw = '', focus = false;
  try { raw = ($('#q') ? $('#q').value : '').trim(); focus = document.activeElement === $('#q'); } catch (e) { }
  if (!raw && !focus) return;
  h.insertAdjacentHTML('afterbegin', srchChipsHTML());
  /* "Show more" - only when the server said there really is a next page */
  if (raw && FND.q === raw && FND.more && !FND.busy) {
    const n = FND.ids ? FND.ids.size : 0;
    h.insertAdjacentHTML('beforeend', '<div class="shelp"><span>🔎 Showing the first ' + n +
      ' from the server — there are more.</span><button class="btn" data-sqmore>Show the next 500</button></div>');
  }
};
document.addEventListener('click', function (e) {
  const b = e.target.closest ? e.target.closest('[data-sq],[data-sqclear],[data-sqmore]') : null;
  if (!b) return;
  const box = $('#q'); if (!box) return;
  if (b.hasAttribute('data-sqclear')) { box.value = ''; fndClear(); render(); box.focus(); return; }
  if (b.hasAttribute('data-sqmore')) {
    const raw = box.value.trim();
    serverFind(raw, true, (FND.off || 0) + 500);
    return;
  }
  const add = srchChipText(b.dataset.sq);
  const cur = box.value.replace(/\s+$/, '');
  if (cur.toLowerCase().indexOf(add.toLowerCase()) >= 0) { box.focus(); return; }   /* already there */
  box.value = (cur ? cur + ' ' : '') + add;
  box.focus();
  /* put the cursor right after the code, so they can type the name straight away */
  try { const p = box.value.length; box.setSelectionRange(p, p); } catch (e2) { }
  render();
}, false);

/* ------------------------------------------------------------------- CSS --- */
(function srchCSS() {
  if (document.getElementById('srchCSS')) return;
  const s = document.createElement('style'); s.id = 'srchCSS';
  s.textContent = [
    '.schips{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 10px 2px}',
    '.schips .lbl{font-size:11.5px;opacity:.6;font-weight:600}',
    '.schips .btn{padding:3px 9px;font-size:11.5px;border-radius:99px}',
    'mark.shl{background:#ffe08a;color:inherit;padding:0 1px;border-radius:2px}',
    ':root[data-theme="dark"] mark.shl,html.dark mark.shl{background:#7a5d00;color:#fff}',
    '.tag.sfold{background:rgba(60,110,200,.14);color:#2b4f93;font-weight:650}',
    '@media (max-width:620px){.schips{padding:6px 8px 2px}.schips .lbl{display:none}}'
  ].join('');
  document.head.appendChild(s);
})();
/* __srch:end */
