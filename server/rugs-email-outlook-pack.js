/* Rugs Email - Outlook pack  (marker: __olpack)
   ---------------------------------------------------------------------------
   One extra layer on top of the mail app that lives in index.html as
   EMAIL_HTML_B64. It never edits the app's own code: it wraps rowHTML,
   renderFolders, _renderRead, renderTop, compose and cmOpen, so the app can be
   rebuilt underneath and this pack simply re-applied on top.

   To change it: edit THIS file, then run  python server/patch-outlook-pack.py
   (it replaces the block between the __olpack markers inside index.html).

   What it adds
     1  hover bar on each mail row: Mark read / unread, Pin, Not junk
     2  Search options dialog + saved searches in the folder pane
     3  favourite folders + Manage folders (rename / delete / star)
     4  Not junk (hover bar and right-click menu)
     5  Unsubscribe bar on newsletters
     6  Download all attachments of a conversation as one ZIP
     7  Read aloud
     8  Immersive reader
     9  Quick steps (ready-made and your own)
    10  pre-send check (no subject, "attached" with no file, many recipients)
   --------------------------------------------------------------------------- */
(function () {
  if (window.__olpack) return;
  window.__olpack = '1';
  const Q = s => document.querySelector(s);
  const pref = k => (S.prefs || {})[k];
  const setPref = (k, v) => {
    S.prefs = { ...(S.prefs || {}), [k]: v };
    try { api('savePrefs', { prefs: { [k]: v } }).catch(() => {}); } catch (e) {}
  };
  const myName = () => (who(ME) || {}).name || 'someone';
  const openT = () => (typeof openId !== 'undefined' && openId ? T_(openId) : null);
  const full = t => canSee(t.dept) === 'full';

  /* ---------- styles ---------- */
  const css = [
    '.qa button.on{color:var(--blue,#0f6cbd)}',
    '.olbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--line);background:var(--pane)}',
    '.olbar button{all:unset;cursor:pointer;font:inherit;font-size:12.5px;padding:5px 10px;border:1px solid var(--line);border-radius:6px;color:var(--fg);background:transparent;display:inline-flex;gap:6px;align-items:center}',
    '.olbar button:hover{background:var(--hover)}',
    '.olbar button[disabled]{opacity:.5;cursor:default}',
    '.olbar .olnote{font-size:12px;color:var(--muted)}',
    '.olunsub{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:7px 10px;margin:8px 10px 0;border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--blue,#0f6cbd) 7%,transparent);font-size:12.5px}',
    '.olstar{all:unset;cursor:pointer;padding:0 6px;opacity:.5;font-size:12px}',
    '.olstar:hover,.olstar.on{opacity:1}',
    '.olsq{display:grid;gap:8px}',
    '.olsq .row{display:flex;gap:8px;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:8px;padding:7px 10px}',
    '.olsq .row small{color:var(--muted)}',
    '.olgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '@media(max-width:620px){.olgrid{grid-template-columns:1fr}}',
    '.olchk{display:flex;gap:8px;align-items:center;font-size:13px;margin:2px 0}',
    '.olimm{position:fixed;inset:0;z-index:9999;overflow:auto;padding:28px 18px 60px;background:#fbf8f3;color:#1d1d1d}',
    '.olimm.dark{background:#17181a;color:#e9e9ea}.olimm.sepia{background:#f4ecd8;color:#3a2f1b}',
    '.olimm .wrap{margin:0 auto}',
    '.olimm h1{font-size:1.35em;margin:0 0 4px}',
    '.olimm .meta{font-size:.8em;opacity:.7;margin-bottom:18px}',
    '.olimm .msg{margin:0 0 26px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.olimm .msg b.who{display:block;font-size:.8em;opacity:.75;margin-bottom:6px}',
    '.olimmbar{position:sticky;top:0;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px;margin:-28px -18px 18px;background:inherit;border-bottom:1px solid rgba(128,128,128,.3)}',
    '.olimmbar button{all:unset;cursor:pointer;font:inherit;font-size:12.5px;padding:5px 10px;border:1px solid rgba(128,128,128,.4);border-radius:6px}',
    '.olwarn{margin:0 14px 10px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--red,#d33) 45%,transparent);background:color-mix(in srgb,var(--red,#d33) 10%,transparent);border-radius:8px;font-size:12.5px}',
    '.olwarn ul{margin:4px 0 6px;padding-left:18px}',
    '.olwarn .act{display:flex;gap:8px;flex-wrap:wrap}'
  ].join('');
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* =======================================================================
     1 - hover bar: Mark read / unread, Pin, Not junk
     ======================================================================= */
  const _rowOL = rowHTML;
  rowHTML = function (t) {
    const h = _rowOL.apply(this, arguments);
    let b = '<button data-olrd="' + t.id + '" class="' + (t.unread ? 'on' : '') + '" title="' +
      (t.unread ? 'Mark read' : 'Mark unread') + '" aria-label="' + (t.unread ? 'Mark read' : 'Mark unread') + '">' +
      ico('mail') + '</button>' +
      '<button data-olpn="' + t.id + '" class="' + (t.pinned ? 'on' : '') + '" title="' +
      (t.pinned ? 'Unpin' : 'Pin to the top') + '" aria-label="Pin">' + ico('pin') + '</button>';
    if (t.folder === 'junk') b += '<button data-olnj="' + t.id + '" title="Not junk - move back to the Inbox" aria-label="Not junk">&#10003;</button>';
    return h.replace('<div class="qa">', '<div class="qa">' + b);
  };

  function notJunk(t) {
    const em = String(t.email || '').toLowerCase();
    const blocked = (S.blocked || []).map(x => String(x).toLowerCase());
    const onList = !!em && blocked.includes(em);
    const admin = (who(ME) || {}).role === 'Admin';
    let msg = 'Move this back to the Inbox as "not junk"?';
    if (onList) msg += admin
      ? ' ' + em + ' will also be taken off the team\'s blocked list.'
      : ' Note: ' + em + ' is on the team\'s blocked list, so their next mail will land in Junk again - ask an admin to unblock them.';
    rcAsk(msg, () => {
      t.folder = 'inbox'; t.prev = null;
      if (typeof reopenMail === 'function' && t.status === 'done' && !t.doneAt) reopenMail(t);
      hist(t, 'n', 'Marked not junk by ' + myName());
      if (onList && admin) S.blocked = (S.blocked || []).filter(x => String(x).toLowerCase() !== em);
      save(); toast('Moved to the Inbox'); render();
    });
  }

  /* =======================================================================
     2 - Search options + saved searches
     ======================================================================= */
  function runQ(q) {
    const i = Q('#q'); if (!i) return;
    if (typeof app !== 'undefined') app = 'mail';
    i.value = q;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    try { render(); } catch (e) {}
  }
  function searchDlg() {
    const folders = [['', 'Any folder'], ['inbox', 'Inbox'], ['sent', 'Sent'], ['archive', 'Archive'],
      ['junk', 'Junk'], ['deleted', 'Deleted']].concat(myFolders().map(f => [f, f]));
    const L = dlg('Search options',
      '<div class="olgrid">' +
      '<div class="fld"><label for="olw">Words anywhere</label><input type="text" id="olw" placeholder="e.g. invoice 4050"></div>' +
      '<div class="fld"><label for="olfrom">From</label><input type="text" id="olfrom" placeholder="name or e-mail"></div>' +
      '<div class="fld"><label for="olto">To / Cc</label><input type="text" id="olto" placeholder="name or e-mail"></div>' +
      '<div class="fld"><label for="olsubject">Subject has</label><input type="text" id="olsubject" placeholder="words in the subject"></div>' +
      '<div class="fld"><label for="olin">Folder</label><select id="olin">' +
      folders.map(f => '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>').join('') + '</select></div>' +
      '<div class="fld"><label for="olaf">Received after</label><input type="date" id="olaf"></div>' +
      '<div class="fld"><label for="olbf">Received before</label><input type="date" id="olbf"></div>' +
      '<div class="fld"><label>Only show</label>' +
      '<label class="olchk"><input type="checkbox" id="olatt"> Mail with attachments</label>' +
      '<label class="olchk"><input type="checkbox" id="olun"> Unread</label>' +
      '<label class="olchk"><input type="checkbox" id="olfl"> Flagged</label></div></div>' +
      '<p class="lead" style="margin:10px 0 0">This writes the search for you. You can also type it by hand, e.g. ' +
      '<code>from:ikea subject:"ship date" has:attachment</code></p>',
      '<button class="btn" data-c>Cancel</button><button class="btn" data-olsv>Save this search</button>' +
      '<button class="btn pri" data-olsgo>Search</button>', true);
    const g = id => { const el = L.querySelector(id); return el ? String(el.value || '').trim() : ''; };
    const ck = id => { const el = L.querySelector(id); return !!(el && el.checked); };
    const build = () => {
      const out = [];
      if (g('#olw')) out.push(g('#olw'));
      ['from', 'to', 'subject'].forEach(k => {
        const v = g('#ol' + k);
        if (v) out.push(k + ':' + (/\s/.test(v) ? '"' + v + '"' : v));
      });
      if (g('#olin')) out.push('in:' + g('#olin'));
      if (ck('#olatt')) out.push('has:attachment');
      if (ck('#olun')) out.push('is:unread');
      if (ck('#olfl')) out.push('is:flagged');
      if (g('#olaf')) out.push('after:' + g('#olaf'));
      if (g('#olbf')) out.push('before:' + g('#olbf'));
      return out.join(' ');
    };
    L.querySelector('[data-c]').onclick = () => { L.innerHTML = ''; };
    /* note: this button must NOT be called data-olgo - that name belongs to the
       favourite-folder rows, whose handler would swallow the click. */
    L.querySelector('[data-olsgo]').onclick = () => {
      const q = build(); if (!q) { toast('Fill in at least one box'); return; }
      L.innerHTML = ''; runQ(q);
    };
    L.querySelector('[data-olsv]').onclick = () => {
      const q = build(); if (!q) { toast('Fill in at least one box first'); return; }
      L.innerHTML = '';
      ask('Name this search', 'Shown in the folder pane, e.g. "IKEA ship dates"', nm => {
        nm = String(nm || '').trim(); if (!nm) return;
        const list = (pref('savedQ') || []).filter(x => x && x.name !== nm);
        list.push({ name: nm, q: q });
        setPref('savedQ', list.slice(-20)); renderFolders();
        toast('Saved - it is in the folder pane');
      });
    };
  }

  /* =======================================================================
     3 - favourite folders, saved searches and Manage folders in the pane
     ======================================================================= */
  const favList = () => pref('favFold') || [];
  function favToggle(key) {
    const l = favList();
    setPref('favFold', l.indexOf(key) < 0 ? l.concat([key]) : l.filter(x => x !== key));
    renderFolders();
  }
  function favLabel(key) {
    const p = String(key).split(':');
    if (p[0] === 'u') {
      const nm = p.slice(1).join(':');
      return { lbl: nm, go: () => { view = { type: 'folder', folder: nm }; openId = null; render(); } };
    }
    const d = dept(p[1]); if (!d) return null;
    const nice = { inbox: 'Inbox', sent: 'Sent', archive: 'Archive', junk: 'Junk', deleted: 'Deleted', drafts: 'Drafts' }[p[2]] || p[2];
    return {
      lbl: d.name + ' - ' + nice,
      go: () => { view = { type: 'box', dept: p[1], folder: p[2] }; openId = null; if (Q('#q')) Q('#q').value = ''; render(); }
    };
  }
  function manageFoldersDlg() {
    const own = myFolders();
    const L = dlg('Manage folders',
      (own.length
        ? '<div class="olsq">' + own.map((f, i) =>
          '<div class="row"><b>' + esc(f) + '</b><span style="display:flex;gap:6px">' +
          '<button class="btn" data-olren="' + i + '">Rename</button>' +
          '<button class="btn" data-olfav2="' + esc(f) + '">' + (favList().indexOf('u:' + f) < 0 ? 'Favourite' : 'In favourites') + '</button>' +
          '<button class="btn warn" data-oldel="' + i + '">Delete</button></span></div>').join('') + '</div>'
        : '<p class="lead" style="margin:0">You have no folders of your own yet. Make one with "New folder" in the folder pane.</p>') +
      '<p class="lead" style="margin:12px 0 0">Your folders are yours only - nobody else sees them. Deleting one sends its mail back to the Inbox. ' +
      'A starred folder sits at the top of the pane.</p>',
      '<button class="btn pri" data-c>Done</button>', true);
    L.querySelector('[data-c]').onclick = () => { L.innerHTML = ''; render(); };
    L.querySelectorAll('[data-olren]').forEach(b => {
      b.onclick = () => {
        const oldName = own[+b.dataset.olren];
        L.innerHTML = '';
        ask('Rename folder', 'New name for "' + oldName + '"', v => {
          v = String(v || '').trim(); if (!v || v === oldName) return;
          if (own.indexOf(v) >= 0 || ['inbox', 'sent', 'drafts', 'archive', 'junk', 'deleted'].indexOf(v.toLowerCase()) >= 0) {
            toast('That folder name is already in use'); return;
          }
          saveMyFolders(own.map(x => x === oldName ? v : x));
          let n = 0;
          (S.threads || []).forEach(t => { if (t.folder === oldName) { t.folder = v; n++; } });
          const l = favList();
          if (l.indexOf('u:' + oldName) >= 0) setPref('favFold', l.map(x => x === 'u:' + oldName ? 'u:' + v : x));
          save(); toast('Renamed - ' + n + ' mail' + (n === 1 ? '' : 's') + ' moved with it'); render();
        });
      };
    });
    L.querySelectorAll('[data-olfav2]').forEach(b => {
      b.onclick = () => { favToggle('u:' + b.dataset.olfav2); L.innerHTML = ''; manageFoldersDlg(); };
    });
    L.querySelectorAll('[data-oldel]').forEach(b => {
      b.onclick = () => {
        const f = own[+b.dataset.oldel];
        rcAsk('Delete the folder "' + f + '"? Its mail goes back to the Inbox.', () => {
          saveMyFolders(own.filter(x => x !== f));
          (S.threads || []).forEach(t => { if (t.folder === f) t.folder = 'inbox'; });
          setPref('favFold', favList().filter(x => x !== 'u:' + f));
          save(); L.innerHTML = ''; toast('Folder deleted'); render();
        });
      };
    });
  }
  const _rfOL = renderFolders;
  renderFolders = function () {
    const r = _rfOL.apply(this, arguments);
    try { paneExtras(); } catch (e) {}
    return r;
  };
  function paneExtras() {
    const pane = Q('#folders');
    if (!pane || (typeof app !== 'undefined' && app !== 'mail')) return;
    const star = (host, key, title) => {
      if (host.querySelector('.olstar')) return;
      const on = favList().indexOf(key) >= 0;
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'olstar' + (on ? ' on' : '');
      s.dataset.olfav = key;
      s.title = on ? 'Remove from favourites' : title;
      s.setAttribute('aria-label', s.title);
      s.textContent = on ? '★' : '☆';
      host.appendChild(s);
    };
    pane.querySelectorAll('.fi[data-box][data-f]').forEach(b => star(b, 'b:' + b.dataset.box + ':' + b.dataset.f, 'Add to favourites'));
    pane.querySelectorAll('.fi[data-userf]').forEach(b => star(b, 'u:' + b.dataset.userf, 'Add to favourites'));

    const favs = favList().map(k => ({ k: k, v: favLabel(k) })).filter(x => x.v);
    if (favs.length && !pane.querySelector('.olfav')) {
      const d = document.createElement('div');
      d.className = 'fgroup olfav';
      d.innerHTML = '<div class="h4"><button type="button" aria-expanded="true">Favourite folders</button></div><div class="gbody">' +
        favs.map(x => '<button class="fi" data-olgo="' + esc(x.k) + '"><span class="ic">★</span><span class="lbl">' + esc(x.v.lbl) + '</span></button>').join('') +
        '</div>';
      const first = pane.querySelector('.fgroup');
      if (first) pane.insertBefore(d, first); else pane.appendChild(d);
    }
    if (!pane.querySelector('.olsaved')) {
      const sq = pref('savedQ') || [];
      const d = document.createElement('div');
      d.className = 'fgroup olsaved';
      d.innerHTML = '<div class="h4"><button type="button" aria-expanded="true">Saved searches</button></div><div class="gbody">' +
        sq.map((x, i) => '<div class="fiw"><button class="fi" data-olrun="' + i + '" title="' + esc(x.q) + '"><span class="ic">●</span><span class="lbl">' + esc(x.name) + '</span></button>' +
          '<button class="fdel" data-olsdel="' + i + '" title="Delete this saved search" aria-label="Delete saved search">✕</button></div>').join('') +
        '<button class="fi" data-olsearch><span class="ic">○</span><span class="lbl" style="color:var(--muted)">Search options...</span></button>' +
        '<button class="fi" data-olmanage><span class="ic">⚙</span><span class="lbl" style="color:var(--muted)">Manage folders</span></button></div>';
      pane.appendChild(d);
    }
  }

  /* =======================================================================
     5 - Unsubscribe
     ======================================================================= */
  const UNSUB_RX = /unsubscribe|opt[\s-]?out|stop these e?-?mails|manage (your )?(e?-?mail )?preferences/i;
  function unsubLink(t) {
    const ms = (t && t.msgs) || [];
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i];
      if (!m || m.by || m.ours) continue;
      if (m.listUnsub && /^https?:/i.test(String(m.listUnsub))) return String(m.listUnsub);
      const html = String(m.raw || m.html || '');
      const rx = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
      let a;
      while ((a = rx.exec(html))) {
        const href = a[1];
        const txt = String(a[2]).replace(/<[^>]*>/g, ' ');
        if (!/^https?:/i.test(href)) continue;
        if (UNSUB_RX.test(txt) || UNSUB_RX.test(href)) return href;
      }
      const u = String(m.body || '').match(/https?:\/\/\S*(unsubscribe|optout|opt-out)\S*/i);
      if (u) return u[0];
    }
    return '';
  }

  /* =======================================================================
     6 - Download all attachments as one ZIP
     ======================================================================= */
  function attsOf(t) {
    const out = [];
    ((t && t.msgs) || []).forEach(m => {
      ((m && m.atts) || []).forEach(a => { if (a && a.name && m.gid) out.push({ name: a.name, gid: m.gid }); });
    });
    return out;
  }
  function zipAll(t, btn) {
    const list = attsOf(t);
    if (!list.length) { toast('No attachments in this conversation'); return; }
    const was = btn ? btn.innerHTML : '';
    const say = s => { if (btn) btn.textContent = s; };
    if (btn) btn.disabled = true;
    const bad = [];
    const used = {};
    say('Getting the viewer...');
    loadJS(OFX.jszip).then(() => {
      const zip = new JSZip();
      let i = 0;
      const next = () => {
        if (i >= list.length) {
          if (!Object.keys(zip.files).length) throw new Error('None of the files could be fetched');
          say('Making the ZIP...');
          return zip.generateAsync({ type: 'blob' }).then(blob => {
            // 18 Nov 2026: the ZIP keeps the subject's own letters (Hindi, accents...) - only characters
            // Windows forbids are replaced - and goes through the app's one saveFile().
            const nm = fileName(String(cleanSub(t.sub) || 'attachments').slice(0, 60)) || 'attachments';
            saveFile(blob, nm + '.zip', 'application/zip');
            toast(bad.length ? 'ZIP saved - these could not be fetched: ' + bad.join(', ') : 'ZIP saved');
          });
        }
        const it = list[i++];
        say('Getting file ' + i + ' of ' + list.length + '...');
        return api('attachment', { mailbox: t.box, gmailId: it.gid, name: it.name })
          .then(r => {
            let nm = it.name || ('file' + i);
            if (used[nm]) {
              const d = nm.lastIndexOf('.');
              nm = d > 0 ? nm.slice(0, d) + ' (' + used[nm] + ')' + nm.slice(d) : nm + ' (' + used[nm] + ')';
            }
            used[it.name] = (used[it.name] || 0) + 1;
            zip.file(nm, r.b64 || '', { base64: true });
          })
          .catch(() => { bad.push(it.name); })
          .then(next);
      };
      return next();
    }).catch(e => {
      toast('Could not make the ZIP - ' + ((e && e.message) || 'try again'));
    }).then(() => {
      if (btn) { btn.disabled = false; btn.innerHTML = was; }
    });
  }

  /* =======================================================================
     7 - Read aloud
     ======================================================================= */
  let speaking = false;
  function readAloud(t, btn) {
    const synth = window.speechSynthesis;
    if (!synth) { toast('This browser cannot read mail aloud'); return; }
    if (speaking) { synth.cancel(); speaking = false; if (btn) btn.textContent = 'Read aloud'; return; }
    const ms = t.msgs || [];
    const last = ms[ms.length - 1];
    const body = String((last && last.body) || '').replace(/\s+/g, ' ').trim();
    const txt = (cleanSub(t.sub) || 'No subject') + '. From ' + (rowName(t) || 'unknown') + '. ' + (body || 'This mail has no text.');
    const u = new SpeechSynthesisUtterance(txt.slice(0, 7000));
    const voices = synth.getVoices() || [];
    const v = voices.filter(x => /en[-_]IN/i.test(x.lang))[0] || voices.filter(x => /^en/i.test(x.lang))[0];
    if (v) u.voice = v;
    u.onend = u.onerror = () => { speaking = false; if (btn) btn.textContent = 'Read aloud'; };
    speaking = true;
    if (btn) btn.textContent = 'Stop reading';
    synth.cancel(); synth.speak(u);
  }

  /* =======================================================================
     8 - Immersive reader
     ======================================================================= */
  function immersive(t) {
    const old = document.querySelector('.olimm'); if (old) old.remove();
    const box = document.createElement('div');
    const msgs = (t.msgs || []).map(m => {
      const nm = m.by ? ((who(m.by) || {}).name || m.from) : (m.from || m.email || 'unknown');
      return '<div class="msg"><b class="who">' + esc(nm) + ' - ' + esc(tLong(m.at)) + '</b>' +
        esc(String(m.body || '').trim() || '(no text)') + '</div>';
    }).join('');
    box.innerHTML = '<div class="olimmbar">' +
      '<button data-oli="s-">A-</button><button data-oli="s+">A+</button>' +
      '<button data-oli="w-">narrower</button><button data-oli="w+">wider</button>' +
      '<button data-oli="l">line spacing</button>' +
      '<button data-oli="t">light / sepia / dark</button>' +
      '<button data-oli="x">Close (Esc)</button></div>' +
      '<div class="wrap"><h1>' + esc(cleanSub(t.sub) || '(no subject)') + '</h1>' +
      '<div class="meta">' + esc(rowName(t) || '') + (t.email ? ' &lt;' + esc(t.email) + '&gt;' : '') + ' - ' + esc(tLong(t.last)) + '</div>' +
      msgs + '</div>';
    document.body.appendChild(box);
    const wrap = box.querySelector('.wrap');
    const apply = () => {
      box.className = 'olimm' + (pref('immTheme') ? ' ' + pref('immTheme') : '');
      box.style.fontSize = (+(pref('immSize') || 18)) + 'px';
      wrap.style.maxWidth = (+(pref('immWide') || 680)) + 'px';
      wrap.style.lineHeight = String(+(pref('immLine') || 1.7));
    };
    const close = () => { box.remove(); document.removeEventListener('keydown', esckey); };
    const esckey = e => { if (e.key === 'Escape') close(); };
    apply();
    box.querySelectorAll('[data-oli]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.oli;
        if (a === 'x') return close();
        if (a === 's+') setPref('immSize', Math.min(34, (+(pref('immSize') || 18)) + 2));
        if (a === 's-') setPref('immSize', Math.max(13, (+(pref('immSize') || 18)) - 2));
        if (a === 'w+') setPref('immWide', Math.min(1100, (+(pref('immWide') || 680)) + 80));
        if (a === 'w-') setPref('immWide', Math.max(380, (+(pref('immWide') || 680)) - 80));
        if (a === 'l') setPref('immLine', (+(pref('immLine') || 1.7)) >= 2.2 ? 1.4 : (+(pref('immLine') || 1.7)) + 0.3);
        if (a === 't') setPref('immTheme', pref('immTheme') === 'sepia' ? 'dark' : (pref('immTheme') === 'dark' ? '' : 'sepia'));
        apply();
      };
    });
    document.addEventListener('keydown', esckey);
  }

  /* =======================================================================
     9 - Quick steps
     ======================================================================= */
  const ACTS = {
    done: 'Mark done', open: 'Mark open', read: 'Mark read', unread: 'Mark unread',
    flag: 'Flag', unflag: 'Clear flag', pin: 'Pin', mine: 'Assign to me',
    archive: 'Move to Archive', inbox: 'Move to Inbox', junk: 'Move to Junk', del: 'Delete'
  };
  const DEFAULT_QS = [
    { name: 'Done & archive', acts: ['done', 'archive'] },
    { name: 'Take it & flag', acts: ['mine', 'flag'] },
    { name: 'Read & archive', acts: ['read', 'archive'] }
  ];
  const qsList = () => {
    const l = pref('qsteps');
    return (Array.isArray(l) && l.length) ? l : DEFAULT_QS;
  };
  function qsRun(step, list) {
    /* 24 Nov 2026: a step that closes mail asks first, and warns about conversations whose
       newest mail came in (the 16 Nov bulk-done lesson). The ones left open are skipped
       by the whole step, not just by the "done" part of it. */
    const _acts = step.acts || [];
    if (_acts.indexOf('done') >= 0 && typeof window.rzAskBulkDone === 'function') {
      const _l = (list || []).filter(Boolean);
      if (_l.some(t => t.status !== 'done')) {
        window.rzAskBulkDone(_l, keep => qsGo(step, _l.filter(t => t.status === 'done' || keep.indexOf(t) >= 0)));
        return;
      }
    }
    qsGo(step, list);
  }
  function qsGo(step, list) {
    let n = 0, skipped = 0;
    list.forEach(t => {
      if (!t) return;
      if (!full(t)) { skipped++; return; }
      (step.acts || []).forEach(a => {
        if (a === 'done') { t.status = 'done'; t.doneAt = t.doneAt || Date.now(); }
        else if (a === 'open') { if (typeof reopenMail === 'function') reopenMail(t); else t.status = t.owner ? 'open' : 'new'; }
        else if (a === 'read') t.unread = false;
        else if (a === 'unread') t.unread = true;
        else if (a === 'flag') t.flag = true;
        else if (a === 'unflag') t.flag = false;
        else if (a === 'pin') t.pinned = true;
        else if (a === 'mine') { t.owner = ME; if (t.status === 'new') t.status = 'open'; }
        else if (a === 'archive' || a === 'inbox' || a === 'junk') t.folder = a;
        else if (a === 'del') { if (can('delete')) { t.prev = t.folder; t.folder = 'deleted'; } }
        else if (a.indexOf('to:') === 0) t.folder = a.slice(3);
      });
      hist(t, 'n', 'Quick step "' + step.name + '" by ' + myName());
      n++;
    });
    save();
    toast(step.name + ' - ' + n + ' mail' + (n === 1 ? '' : 's') + (skipped ? ' (' + skipped + ' skipped, view only)' : ''));
    try { if (typeof SEL !== 'undefined') SEL.clear(); } catch (e) {}
    openId = null; render();
  }
  function qsDlg(list) {
    const steps = qsList();
    if (!list.length) { toast('Open a mail first, or tick some mails'); return; }
    const L = dlg('Quick steps',
      '<p class="lead" style="margin:0 0 10px">One click does several things at once, on ' +
      (list.length === 1 ? 'this mail' : 'the ' + list.length + ' mails you picked') + '.</p>' +
      '<div class="olsq">' + steps.map((s, i) =>
        '<div class="row"><span><b>' + esc(s.name) + '</b><br><small>' +
        esc((s.acts || []).map(a => ACTS[a] || (a.indexOf('to:') === 0 ? 'Move to ' + a.slice(3) : a)).join(' then ')) +
        '</small></span><span style="display:flex;gap:6px">' +
        '<button class="btn pri" data-olqr="' + i + '">Run</button>' +
        '<button class="btn warn" data-olqd="' + i + '">Remove</button></span></div>').join('') + '</div>',
      '<button class="btn" data-c>Close</button><button class="btn" data-olqnew>New quick step</button>', true);
    L.querySelector('[data-c]').onclick = () => { L.innerHTML = ''; };
    L.querySelectorAll('[data-olqr]').forEach(b => {
      b.onclick = () => { const s = steps[+b.dataset.olqr]; L.innerHTML = ''; qsRun(s, list); };
    });
    L.querySelectorAll('[data-olqd]').forEach(b => {
      b.onclick = () => {
        const keep = steps.filter((x, i) => i !== +b.dataset.olqd);
        setPref('qsteps', keep.length ? keep : [{ name: 'Done & archive', acts: ['done', 'archive'] }]);
        L.innerHTML = ''; qsDlg(list);
      };
    });
    L.querySelector('[data-olqnew]').onclick = () => { L.innerHTML = ''; qsNewDlg(list); };
  }
  function qsNewDlg(list) {
    const folders = myFolders();
    const L = dlg('New quick step',
      '<div class="fld"><label for="olqn">Name</label><input type="text" id="olqn" placeholder="e.g. Done and move to Shipped"></div>' +
      '<p class="lead" style="margin:10px 0 6px">Pick what it should do:</p>' +
      Object.keys(ACTS).map(k => '<label class="olchk"><input type="checkbox" data-olqa="' + k + '"> ' + esc(ACTS[k]) + '</label>').join('') +
      (folders.length
        ? '<div class="fld" style="margin-top:10px"><label for="olqf">...and move it to one of your own folders</label>' +
          '<select id="olqf"><option value="">- no -</option>' + folders.map(f => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join('') + '</select></div>'
        : ''),
      '<button class="btn" data-c>Cancel</button><button class="btn pri" data-ok>Save</button>', true);
    L.querySelector('[data-c]').onclick = () => { L.innerHTML = ''; qsDlg(list); };
    L.querySelector('[data-ok]').onclick = () => {
      const nm = String(L.querySelector('#olqn').value || '').trim();
      const acts = [].slice.call(L.querySelectorAll('[data-olqa]')).filter(c => c.checked).map(c => c.dataset.olqa);
      const fo = L.querySelector('#olqf') ? L.querySelector('#olqf').value : '';
      if (fo) acts.push('to:' + fo);
      if (!nm || !acts.length) { toast('Give it a name and pick at least one action'); return; }
      setPref('qsteps', qsList().concat([{ name: nm, acts: acts }]).slice(0, 12));
      L.innerHTML = ''; toast('Quick step saved'); qsDlg(list);
    };
  }

  /* =======================================================================
     reading-pane bar: Quick steps / Read aloud / Immersive / ZIP / Unsubscribe
     ======================================================================= */
  const _rrOL = _renderRead;
  _renderRead = function () {
    const r = _rrOL.apply(this, arguments);
    try { packBar(); } catch (e) {}
    return r;
  };
  function packBar() {
    const el = Q('#read'); if (!el) return;
    const t = openT(); if (!t) return;
    if (el.querySelector('.olbar')) return;
    const n = attsOf(t).length;
    const un = unsubLink(t);
    const bar = document.createElement('div');
    bar.className = 'olbar';
    bar.innerHTML =
      '<button data-olqs title="Do several things in one click">Quick steps</button>' +
      '<button data-olaloud title="Read this mail out loud">Read aloud</button>' +
      '<button data-olimm title="Clean, big text for easy reading">Immersive reader</button>' +
      (n > 1 ? '<button data-olzip title="Save every attachment of this conversation in one ZIP file">Download all (' + n + ')</button>' : '');
    el.insertBefore(bar, el.firstChild);
    if (un) {
      const u = document.createElement('div');
      u.className = 'olunsub';
      u.innerHTML = '<span>This looks like a newsletter or a mailing list.</span>' +
        '<button class="btn" data-olunsub>Unsubscribe</button>' +
        '<span class="olnote">Opens the sender\'s own page in a new tab.</span>';
      bar.after(u);
    }
  }

  /* =======================================================================
     10 - pre-send check
     ======================================================================= */
  const ATT_WORDS = /\b(attach|attached|attaching|attachment|attachments|enclosed|pfa)\b/i;
  function preSendWarnings(L) {
    const w = [];
    const v = id => { const el = L.querySelector(id); return el ? String(el.value || '').trim() : ''; };
    const sub = v('#cs'), to = v('#ct'), cc = v('#cc');
    const bodyEl = L.querySelector('#cb');
    const body = bodyEl ? String(bodyEl.innerText || bodyEl.textContent || '').trim() : '';
    const inp = L.querySelector('#cat');
    const files = (inp && inp._olk) ? inp._olk.length : 0;
    if (!sub) w.push('There is no subject.');
    if (!body) w.push('The mail has no text.');
    if (!files && ATT_WORDS.test(body)) w.push('You wrote about an attachment, but no file is attached.');
    const people = (to + ',' + cc).split(/[,;]+/).map(x => x.trim()).filter(Boolean).length;
    if (people >= 10) w.push('It goes to ' + people + ' people. Check that all of them should see it.');
    return w;
  }
  function hookSend() {
    const L = Q('#layer'); if (!L) return;
    const s = L.querySelector('footer [data-send]');
    if (!s || s.__olchk) return;
    s.__olchk = 1;
    const orig = s.onclick;
    s.onclick = function (ev) {
      if (s.__olok) return orig ? orig.call(this, ev) : undefined;
      let w = [];
      try { w = preSendWarnings(L); } catch (e) { w = []; }
      if (!w.length) return orig ? orig.call(this, ev) : undefined;
      const foot = s.closest('footer') || s.parentNode;
      const old = L.querySelector('.olwarn'); if (old) old.remove();
      const d = document.createElement('div');
      d.className = 'olwarn';
      d.innerHTML = '<b>Before it goes out</b><ul>' + w.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
        '<div class="act"><button type="button" class="btn" data-olfix>Let me fix it</button>' +
        '<button type="button" class="btn pri" data-olany>Send anyway</button></div>';
      if (foot && foot.parentNode) foot.parentNode.insertBefore(d, foot);
      d.querySelector('[data-olfix]').onclick = () => d.remove();
      d.querySelector('[data-olany]').onclick = () => { d.remove(); s.__olok = 1; s.click(); };
      return false;
    };
  }
  const _cmpOL = compose;
  compose = function () {
    const r = _cmpOL.apply(this, arguments);
    /* at once (compose builds its window straight away) and again on the next tick,
       in case a later layer rebuilds the footer */
    try { hookSend(); } catch (e) {}
    setTimeout(() => { try { hookSend(); } catch (e) {} }, 0);
    return r;
  };

  /* =======================================================================
     right-click menu: Quick steps and Not junk
     ======================================================================= */
  function pickList(t) {
    try {
      if (typeof SEL !== 'undefined' && SEL.size) {
        const l = [...SEL].map(T_).filter(Boolean);   /* 24 Nov 2026: SEL is a Set - slice on it gave [] */
        if (l.length) return l;
      }
    } catch (e) {}
    return t ? [t] : [];
  }
  const _cmOL = cmOpen;
  cmOpen = function (t) {
    const r = _cmOL.apply(this, arguments);
    try {
      const m = document.querySelector('.cmenu');
      if (!m || !t) return r;
      m.appendChild(document.createElement('hr'));
      const add = (a, l) => {
        const b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.olcm = a; b.innerHTML = l;
        m.appendChild(b);
      };
      add('qs', 'Quick steps...');
      if (t.folder === 'junk') add('nj', 'Not junk');
      m.querySelectorAll('[data-olcm]').forEach(b => {
        b.onclick = () => {
          const a = b.dataset.olcm;
          try { if (typeof cmClose === 'function') cmClose(); else m.remove(); } catch (e) { m.remove(); }
          if (a === 'qs') qsDlg(pickList(t));
          if (a === 'nj') notJunk(t);
        };
      });
    } catch (e) {}
    return r;
  };

  /* =======================================================================
     one click handler for everything this pack adds
     ======================================================================= */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest(
      '[data-olrd],[data-olpn],[data-olnj],[data-olfav],[data-olgo],[data-olrun],[data-olsdel],' +
      '[data-olsearch],[data-olmanage],[data-olqs],[data-olaloud],[data-olimm],[data-olzip],[data-olunsub]');
    if (!b) return;
    const d = b.dataset;
    e.preventDefault(); e.stopPropagation();
    if (d.olrd) {
      const t = T_(d.olrd); if (!t) return;
      t.unread = !t.unread; save(); toast(t.unread ? 'Marked unread' : 'Marked read'); render(); return;
    }
    if (d.olpn) {
      const t = T_(d.olpn); if (!t) return;
      t.pinned = !t.pinned;
      hist(t, 'n', (t.pinned ? 'Pinned' : 'Unpinned') + ' by ' + myName());
      save(); toast(t.pinned ? 'Pinned to the top' : 'Unpinned'); render(); return;
    }
    if (d.olnj) { const t = T_(d.olnj); if (t) notJunk(t); return; }
    if (d.olfav) { favToggle(d.olfav); return; }
    if (d.olgo) { const f = favLabel(d.olgo); if (f) f.go(); return; }
    if (d.olrun !== undefined && d.olrun !== '') {
      const x = (pref('savedQ') || [])[+d.olrun]; if (x) runQ(x.q); return;
    }
    if (d.olsdel !== undefined && d.olsdel !== '') {
      const l = (pref('savedQ') || []).slice();
      l.splice(+d.olsdel, 1); setPref('savedQ', l); renderFolders(); return;
    }
    if (d.olsearch !== undefined) { searchDlg(); return; }
    if (d.olmanage !== undefined) { manageFoldersDlg(); return; }
    if (d.olqs !== undefined) { qsDlg(pickList(openT())); return; }
    if (d.olaloud !== undefined) { const t = openT(); if (t) readAloud(t, b); return; }
    if (d.olimm !== undefined) { const t = openT(); if (t) immersive(t); return; }
    if (d.olzip !== undefined) { const t = openT(); if (t) zipAll(t, b); return; }
    if (d.olunsub !== undefined) {
      const t = openT(); if (!t) return;
      const u = unsubLink(t);
      if (!u) { toast('No unsubscribe link found in this mail'); return; }
      rcAsk('Open the sender\'s unsubscribe page in a new tab? ' + u.slice(0, 120), () => {
        window.open(u, '_blank', 'noopener');
        hist(t, 'n', 'Unsubscribe page opened by ' + myName()); save();
      });
      return;
    }
  }, true);

  /* a search-options button next to the search box */
  const _rtOL = renderTop;
  renderTop = function () {
    const r = _rtOL.apply(this, arguments);
    try {
      const q = Q('#q');
      if (q && q.parentNode && !q.parentNode.querySelector('[data-olsearch]')) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn';
        b.dataset.olsearch = '1';
        b.title = 'Search options';
        b.setAttribute('aria-label', 'Search options');
        b.textContent = 'Options';
        b.style.cssText = 'padding:4px 8px;font-size:12px';
        q.after(b);
      }
    } catch (e) {}
    return r;
  };

  window.__olpackApi = { searchDlg, qsDlg, qsRun, qsList, immersive, readAloud, zipAll, attsOf, unsubLink, notJunk, preSendWarnings, favToggle, favList, manageFoldersDlg };
})();
