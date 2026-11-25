/* 25 Nov 2026 - THE BUG behind "buttons lag and don't react at once", measured not guessed.

   MEASUREMENTS, on Team Pulse (15,868 conversations, 660 rows in the list, 150 drawn),
   in a real browser against the real server:

     click -> screen changed      open a mail 396 ms | Done 197 | Reply 281 | switch folder 190
     inside one redraw            renderList 26.6 ms of a whole redraw of 80.6 ms
     inside renderList            build the HTML 0.3 ms  <- the caches work
                                  write it into the page 16.1 ms
                                  the browser's layout afterwards 62.5 ms   <- the real cost
     a Done click                 our JavaScript 85 ms, on screen after 114 ms

   WHAT I FIRST SUSPECTED AND DISPROVED: the app fires one request per pasted picture -
   139 requests and 136 seconds of server time in a single minute. It looks terrible, but
   switching the whole picture loader off changed the clicks by -7% to +10%, i.e. noise.
   It is NOT the cause, and it is reported rather than "fixed".

   THE ACTUAL BUG: every click rewrites the ENTIRE list. renderList() builds the whole
   section and does `el.innerHTML = h`, so all 150 rows (about twelve elements each) are
   destroyed and created again, and the browser lays them all out again - even when the
   click changed ONE row (Done, Flag) or nothing in the list at all (opening a mail,
   replying). Building the HTML is already free; throwing the DOM away is what costs.

   THE FIX: when the list is already on screen and the rows are the same ones in the same
   order, only the rows whose HTML actually changed are replaced, in place. Anything that
   changes the list itself - a different mailbox, folder, tab, filter, search, sort, the
   number of rows, the day grouping, the unread count, the selection, the sync line, the
   history-loading line - still does the full draw, so every wrapper that decorates the
   header keeps working exactly as before.

   Run:  node server/patch-row-level-redraw.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__rowpatch:start")) { console.log("already there - nothing changed"); process.exit(0); }
if (!s.includes("__listspeed:start")) throw new Error("run node server/patch-list-speed.js first");

const block = String.raw`
<script>/* __rowpatch:start  25 Nov 2026: a click redraws the rows that changed, not all 150 */
let RP_SIG = '', RP_HTML = null;
function rpState(rows, cap) {
 /* everything the list shows APART from the rows themselves - if any of it moved, the
    whole list (header, chips, notes, counts) has to be drawn the old way */
 try{
  const v = LV(), q = document.getElementById('q');
  /* the day grouping, as a number: the day a mail falls in, not its printed label -
     dayLabel() formats a date (toLocaleDateString) and 150 of those cost about 9 ms a click */
  let days = 0;
  const sentV = view.type==='box' && view.folder==='sent';
  const off = new Date().getTimezoneOffset() * 60000;
  for (let i = 0; i < Math.min(rows.length, cap); i++) {
   const t = sentV ? lastOut(rows[i]) : rows[i].last;
   days = (days * 31 + Math.floor((t - off) / 86400000)) | 0;
  }
  return [view.type, view.dept||'', view.folder||'', view.id||'', view.key||'', tab, filt, lfilt||'',
   q ? q.value : '', rows.length, cap, days,
   (typeof SEL !== 'undefined' && SEL) ? SEL.size : 0,
   syncing ? 1 : 0, Math.floor((S.lastSync||0)/60000), S.ui.hideTopics?1:0, S.drafts.length,
   v.sort, v.dir, v.vf, v.lines, v.pane||'',
   (typeof HIST_DAYS!=='undefined'?HIST_DAYS:0),
   (function(){try{const d=dept(view.dept),st=d&&MORE[mailOf(d).toLowerCase()];return st?(st.done?'d':'')+(st.busy?'b':''):''}catch(e){return ''}})(),
   (function(){try{return (view.type==='box'&&view.folder==='inbox')||view.type==='all' ? inboxUnreadN(view.type==='all'?undefined:view.dept) : ''}catch(e){return ''}})()
  ].join('');
 }catch(e){return 'x'+Math.random()}
}
const _rlPatch = renderList;
window.__rlNoPatch = _rlPatch;   /* so a test can measure with and without this fix in one page */
renderList = function () {
 let rows = null, cap = 0, sig = null, want = null;
 try {
  const msgs = document.querySelector('.list .msgs');
  const special = view.type==='box' && view.folder==='drafts';
  if (special) throw 0;
  rows = listRows(); cap = listCap(rows.length); sig = rpState(rows, cap);   /* worked out ONCE */
  if (!msgs || sig !== RP_SIG || !RP_HTML) throw 0;    /* the list itself changed: draw it properly */
  want = [];
  for (let i = 0; i < Math.min(rows.length, cap); i++) want.push(rowHTML(rows[i]));
  const els = msgs.querySelectorAll('.m[data-open]');
  if (els.length !== want.length) throw 0;
  let changed = 0;
  for (let i = 0; i < want.length; i++) {
   if (RP_HTML[i] === want[i]) continue;
   els[i].outerHTML = want[i];                        /* only this row is rebuilt */
   changed++;
  }
  RP_HTML = want;
  window.__rpChanged = changed;
  return;
 } catch (e) { /* fall through to the full draw */ }
 const r = _rlPatch.apply(this, arguments);
 try {
  if (!rows) { rows = listRows(); cap = listCap(rows.length); }
  RP_SIG = sig || rpState(rows, cap);                 /* reuse what was already worked out */
  if (!want) { want = []; for (let i = 0; i < Math.min(rows.length, cap); i++) want.push(rowHTML(rows[i])); }
  RP_HTML = want;
  window.__rpChanged = -1;                            /* -1 = the whole list was drawn */
 } catch (e) { RP_SIG = ''; RP_HTML = null; }
 return r;
};
/* __rowpatch:end */</script>`;

s = s.replace(/\s*$/, "") + "\n" + block + "\n";
fs.writeFileSync(file, s);
console.log("patched .tmp/email.html - a click now redraws only the rows that changed");
