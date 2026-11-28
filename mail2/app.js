// Rugs Email v2 - Shell. Shows REAL mail of the test mailbox (READ ONLY: only the 'list' call, nothing is ever written).
// Not signed in to Rugs Email in this browser -> sample mail.
import { toRows } from './src/live.mjs';
const TEST_BOX = 'marketing@rugscreation.com';
const FOLDERS = [
  { id: 'inbox', name: 'Inbox' }, { id: 'sent', name: 'Sent' }, { id: 'drafts', name: 'Drafts' },
  { id: 'archive', name: 'Archive' }, { id: 'deleted', name: 'Deleted' }, { id: 'junk', name: 'Junk' },
];
let MAIL = [
  { id: 1, folder: 'inbox', from: 'Bianca Turner', subj: 'SS27 order - CAD approval', pre: 'Hi team, please find the revised CAD for the 3 designs…', time: '15:42', unread: true },
  { id: 2, folder: 'inbox', from: 'Loods 5 Inkoop', subj: 'PO 45821 - shipping date', pre: 'Can you confirm the ex-factory date for PO 45821?', time: '13:10', unread: true },
  { id: 3, folder: 'inbox', from: 'Messe Frankfurt', subj: 'Heimtextil 2027 - Hall 11.0 Stand B79', pre: 'Your exhibitor passes are ready to download.', time: 'Yesterday', unread: false },
  { id: 4, folder: 'sent', from: 'To: Bianca Turner', subj: 'Re: SS27 order - CAD approval', pre: 'Dear Bianca, thank you - we will share strike-offs by Monday.', time: '16:01', unread: false },
];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

let folder = 'inbox'; let selected = null;

function drawFolders() {
  $('#folderList').innerHTML = FOLDERS.map(f => {
    const n = MAIL.filter(m => m.folder === f.id && m.unread).length;
    return `<li data-f="${f.id}" class="${f.id === folder ? 'on' : ''}" tabindex="0"><span>${f.name}</span>${n ? `<span class="n">${n}</span>` : ''}</li>`;
  }).join('');
}
function drawRows() {
  const rows = MAIL.filter(m => m.folder === folder);
  $('#folderName').textContent = FOLDERS.find(f => f.id === folder).name;
  $('#rows').innerHTML = rows.length ? rows.map(m => `
    <li class="row${m.unread ? ' unread' : ''}${m.id === selected ? ' sel' : ''}" data-id="${m.id}" tabindex="0">
      <div class="top"><span class="from">${esc(m.from)}</span><span class="time">${esc(m.time)}</span></div>
      <div class="subj">${esc(m.subj)}</div><div class="pre">${esc(m.pre)}</div></li>`).join('')
    : '<li class="empty">Nothing in this folder</li>';
}
function drawReading() {
  const m = MAIL.find(x => x.id === selected);
  $('#reading').innerHTML = !m ? '<div class="empty">Select a mail to read it</div>' : `
    <button class="icon-btn back" style="color:var(--fg)" aria-label="Back to list">←</button>
    <h1>${esc(m.subj)}</h1><div class="meta">${esc(m.from)} · ${esc(m.time)}</div>
    <div class="actions"><button>↩ Reply</button><button>↩↩ Reply all</button><button>→ Forward</button></div>
    ${m.msgs && m.msgs.length
      ? m.msgs.map(x => `<div class="meta"><b>${esc(x.from)}</b> · ${esc(x.at)}</div><div class="body">${esc(x.text)}</div><hr>`).join('')
      : `<div class="body">${esc(m.pre)}</div>`}
    <div class="meta">Full mail with pictures and attachments comes with the Reading pane screen.</div>`;
}
function draw() { drawFolders(); drawRows(); drawReading(); }

$('#folderList').addEventListener('click', e => {
  const li = e.target.closest('li'); if (!li) return;
  folder = li.dataset.f; selected = null; $('#folders').classList.remove('open'); draw();
});
$('#rows').addEventListener('click', e => {
  const li = e.target.closest('.row'); if (!li) return;
  selected = +li.dataset.id; MAIL.find(m => m.id === selected).unread = false;
  document.body.classList.add('reading-open'); draw();
});
$('#reading').addEventListener('click', e => { if (e.target.closest('.back')) document.body.classList.remove('reading-open'); });
for (const id of ['#folderList', '#rows']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') e.target.click(); });
$('#menuBtn').addEventListener('click', () => $('#folders').classList.toggle('open'));

// Light / dark, remembered per browser
function setTheme(t) { document.documentElement.dataset.theme = t; $('#themeBtn').textContent = t === 'dark' ? '☀' : '🌙'; store.set('rm2-theme', t); }
setTheme(store.get('rm2-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#themeBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

// Resizable panes (drag or arrow keys), widths remembered
const LIMITS = { folders: [160, 360], list: [280, 640] };
for (const k of Object.keys(LIMITS)) { const w = store.get('rm2-w-' + k); if (w) document.documentElement.style.setProperty(`--${k}-w`, w + 'px'); }
function setW(k, w) { const [a, b] = LIMITS[k]; w = Math.max(a, Math.min(b, Math.round(w)));
  document.documentElement.style.setProperty(`--${k}-w`, w + 'px'); store.set('rm2-w-' + k, w); }
document.querySelectorAll('.splitter').forEach(sp => {
  const k = sp.dataset.left; const pane = document.getElementById(k);
  sp.addEventListener('pointerdown', e => {
    sp.setPointerCapture(e.pointerId); sp.classList.add('drag');
    const x0 = e.clientX, w0 = pane.getBoundingClientRect().width;
    const mv = ev => setW(k, w0 + ev.clientX - x0);
    const up = () => { sp.classList.remove('drag'); sp.removeEventListener('pointermove', mv); sp.removeEventListener('pointerup', up); };
    sp.addEventListener('pointermove', mv); sp.addEventListener('pointerup', up);
  });
  sp.addEventListener('keydown', e => { const d = e.key === 'ArrowLeft' ? -20 : e.key === 'ArrowRight' ? 20 : 0;
    if (d) setW(k, pane.getBoundingClientRect().width + d); });
});

// ---- Real mail of the test mailbox (READ ONLY) ----
async function loadLive() {
  let token = ''; try { token = localStorage.getItem('rugs-token') || ''; } catch {}
  const status = document.querySelector('.status span');
  if (!token) { status.textContent = '● Sample mail - sign in to Rugs Email in this browser to see ' + TEST_BOX; return; }
  status.textContent = '● Loading ' + TEST_BOX + ' …';
  try {
    const res = await fetch('https://mail-api.rugserp.com/rugs-mail-list', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list', token }) });
    const r = await res.json().catch(() => ({ error: 'Server error ' + res.status }));
    if (!res.ok || r.error) throw new Error(r.error || 'Error ' + res.status);
    const rows = toRows(r, TEST_BOX);
    if (!rows.length) throw new Error('your login cannot see this mailbox');
    MAIL = rows; selected = null;
    status.textContent = `● ${TEST_BOX} · ${rows.filter(m => m.folder !== 'sent').length} conversations · read only`;
    draw();
  } catch (e) { status.textContent = `● Could not load ${TEST_BOX}: ${e.message} - showing sample mail`; }
}

draw();
loadLive();
