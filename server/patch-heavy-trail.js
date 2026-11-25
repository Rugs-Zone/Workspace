/* 25 Nov 2026 - heavy conversations: the lag when one is open.

   MEASURED on the ten heaviest conversations in teampulse@ (86-100 mails, 643-766 KB of
   text, up to 7,353 attachment records), in a real browser against the real server:

     opening one            234-434 ms, and only ONE iframe is built for 95 mails
     the server's answer    0.8-2.2 s, 0.9-4.2 MB, and it already sends only the newest
                            FIVE mails in full - the rest come as short summaries
     Reply                  2,232-2,882 ms   <-- by far the worst thing in the app
     Done / switch folder   under half a second

   WHY REPLY IS SO SLOW, measured piece by piece on a 95-mail conversation:

     trailOf            58.7 ms
     qBuild, all mails 165.5 ms
     trailBlock, all    17.1 ms
     the editor ends up holding 2,562 KB of quoted HTML, 804 pictures, 95 quoted blocks

   So about 240 ms is our own work and the remaining ~2 seconds is the browser laying out
   two and a half megabytes of quoted mail inside a contenteditable box. It also makes
   typing heavy afterwards, and it is why big replies hit the 15 MB send limit.

   THE FIX: a reply quotes the newest THREE mails. The rest are not built at all - in
   their place sits one line, "Show quoted text - N older mails are not quoted", and
   pressing it builds them and puts them in exactly where they belong. Nothing is thrown
   away: the whole conversation is still in the mail itself for both sides, every mail is
   still listed with its own tickbox, and one click includes the lot. The line itself is
   removed on send (it is only a control), so the recipient never sees it.

   Run:  node server/patch-heavy-trail.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__heavytrail:start")) { console.log("already there - nothing changed"); process.exit(0); }

/* ---- 1. the control must never go out with the mail ---- */
const cleanOld = "d.querySelectorAll('script,style,iframe,object,embed,form,input,button,meta,link').forEach(n=>n.remove());";
if (!s.includes(cleanOld)) throw new Error("cleanHTML was not found");
s = s.replace(cleanOld,
  "d.querySelectorAll('script,style,iframe,object,embed,form,input,button,meta,link,[data-trailmore]').forEach(n=>n.remove());");

/* ---- 2. quote the newest few, keep the rest one click away ---- */
const block = String.raw`
<script>/* __heavytrail:start  25 Nov 2026: a reply quotes the newest 3 mails, the rest on request */
const TRAIL_OPEN = 3;                 /* how many earlier mails are quoted straight away */
const TM_REST = new Map(); let TM_N = 0;
const _teOld = trailEditHTML;
trailEditHTML = function (t) {
 try {
  const tr = trailOf(t);
  if (tr.length <= TRAIL_OPEN + 1) return _teOld.apply(this, arguments);   /* short trail: as before */
  const keepFrom = tr.length - TRAIL_OPEN;                                  /* the newest few */
  let h = '';
  for (let i = tr.length - 1; i >= keepFrom; i--) h += trailBlock(tr[i], i);
  const tok = 'tm' + (++TM_N);
  TM_REST.set(tok, { t: t, hi: keepFrom });
  const n = keepFrom;
  h += '<div data-trailmore="' + tok + '" contenteditable="false" style="margin:10px 0;padding:8px 10px;border:1px dashed var(--line);border-radius:6px;background:var(--bg2,rgba(127,127,127,.06));font-size:13px;color:var(--muted)">'
    + '\u{1F4DC} ' + n + ' older mail' + (n > 1 ? 's are' : ' is') + ' not quoted, to keep this reply quick. '
    + '<button type="button" data-trailshow="' + tok + '" class="btn" style="margin-left:6px">Show quoted text</button>'
    + '</div>';
  return h;
 } catch (e) { return _teOld.apply(this, arguments); }
};
/* pressing it builds the older quotes and puts them where they belong */
document.addEventListener('click', function (e) {
 const b = e.target.closest && e.target.closest('[data-trailshow]');
 if (!b) return;
 e.preventDefault();
 const tok = b.dataset.trailshow, info = TM_REST.get(tok);
 const line = document.querySelector('[data-trailmore="' + tok + '"]');
 if (!info || !line) { if (line) line.remove(); return; }
 b.disabled = true; b.textContent = 'Adding…';
 setTimeout(function () {
  try {
   const tr = trailOf(info.t);
   let h = '';
   for (let i = info.hi - 1; i >= 0; i--) h += trailBlock(tr[i], i);
   line.insertAdjacentHTML('beforebegin', h);
   line.remove();
   TM_REST.delete(tok);
   /* keep the per-mail tickboxes in step */
   document.querySelectorAll('[data-qsel]').forEach(function (cb) { if (+cb.dataset.qsel < info.hi) cb.checked = true; });
   const ctr = document.getElementById('ctr'); if (ctr) ctr.checked = true;
   if (typeof toast === 'function') toast('The whole trail is in the mail now');
   if (typeof loadCidPics === 'function') { try { loadCidPics(info.t, { all: true }); } catch (x) {} }
  } catch (x) { if (typeof toast === 'function') toast('Could not add the older mails: ' + x.message); }
 }, 10);
}, true);
/* __heavytrail:end */</script>`;

s = s.replace(/\s*$/, "") + "\n" + block + "\n";
fs.writeFileSync(file, s);
console.log("patched .tmp/email.html - a reply now quotes the newest 3 mails, the rest behind 'Show quoted text'");
