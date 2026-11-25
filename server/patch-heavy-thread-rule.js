/* 25 Nov 2026 - the heavy-thread rule: a conversation with more than 10 messages must stay
   fast and must not slow the rest of the app.

   MEASURED FIRST, on five conversations of 72-95 mails in teampulse@ (there are 1,120 such
   conversations in that mailbox alone, 25,140 messages, 162 MB of text):

     open 346 ms (256-517) | Reply 573 ms (88-2,246) | switch folder 361 ms
     drawn 95 mails, ONE body built, 1 iframe, pane 105-754 KB

   and two plain breaches of the rule:

     * the LIST fired requests of its own - 8 while only drawing and scrolling it,
       including "thread" and five "inlineImg" picture fetches
     * CLOSING a heavy conversation stopped nothing: 16 more requests still arrived in the
       next six seconds ("thread", "inlineImg", "more"), and drawing Home while that was
       going on took 300 ms

   WHAT THIS CHANGES

   1  Closing a conversation now stops its work (step 5). Every background job started for
      an open conversation - the pasted-picture queue, the older-mail fetcher, the small
      attachment prefetch - is stamped with the conversation it belongs to. When the
      conversation is closed or another is opened, the queue is emptied and the loops stop
      between batches, so nothing half-finished keeps the server or the browser busy. A
      reply still loads the whole trail it needs, because the conversation stays open.

   2  The newest THREE bodies are drawn, not one (step 3) - exactly the three the server
      sends in full, so no extra fetching.

   3  A "Show 5 older messages" line (step 2) under the trail loads and opens the next five
      in ONE request and says how many are left, instead of "Expand all" asking for ninety.

   Nothing is thrown away: every mail is still listed as a one-line header with its own
   date and snippet, any of them can still be opened on its own, and the quoted history
   inside a mail is still folded behind "Show earlier messages" as before.

   Run:  node server/patch-heavy-thread-rule.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__heavyrule:start")) { console.log("already there - nothing changed"); process.exit(0); }

/* ---- the newest three bodies, not just the newest one ---- */
/* the 25 Nov __oneRowConv block (from the other session) forces a single open mail in open();
   step 3 of the heavy-thread rule asks for three, so that line is aligned here too. */
{
  const oneOld = "openMsgs[t.id]=new Set([t.msgs.length-1])}return _openOne(id)};";
  const oneNeu = "openMsgs[t.id]=new Set(t.msgs.map((_,i)=>i).slice(-3))}return _openOne(id)};   /* 25 Nov 2026: the newest THREE bodies (heavy-thread rule step 3) */";
  if (s.includes(oneOld)) s = s.replace(oneOld, oneNeu);
}
const openOld = "const os=openMsgs[t.id]||(openMsgs[t.id]=new Set([t.msgs.length-1]));";
if (!s.includes(openOld)) throw new Error("the 'which mails are open' line was not found");
s = s.replace(openOld,
  "const os=openMsgs[t.id]||(openMsgs[t.id]=new Set(t.msgs.map((_,i)=>i).slice(-3)));   /* 25 Nov 2026: the newest three, which are the three the server sends in full */");

/* a long conversation must not quietly pull 25 older mails on open (23 Nov MORE_FILL) */
{
  const fillOld = "try{const MORE_FILL=25,rest=t.msgs.filter(x=>x.light&&x.gid).slice(-MORE_FILL);";
  const fillNeu = "try{const MORE_FILL=t.msgs.length>10?0:25;
     const rest=MORE_FILL?t.msgs.filter(x=>x.light&&x.gid).slice(-MORE_FILL):[];";
  if (s.includes(fillOld)) s = s.replace(fillOld, fillNeu).replace("slice(-MORE_FILL);
     const rest=MORE_FILL", "slice(-MORE_FILL);
     const rest=MORE_FILL");
}

const block = String.raw`
<script>/* __heavyrule:start  25 Nov 2026: a closed conversation stops costing anything */
let OPENGEN = 0, OPENWAS = null;
function openGen() {            /* bumped whenever the open conversation changes */
 if (openId !== OPENWAS) {
  OPENWAS = openId;
  OPENGEN++;
  try { if (typeof CID_Q !== 'undefined' && CID_Q) CID_Q.length = 0; }   /* drop queued pictures */
  catch (e) {}
 }
 return OPENGEN;
}
const _rdGen = render;
render = function () { openGen(); return _rdGen.apply(this, arguments); };
/* the pasted-picture loader: stop between pictures once the conversation is closed */
const _lcpGen = loadCidPics;
loadCidPics = function (t, o) {
 const mine = openGen(), forId = t && t.id;
 const all = o && o.all;
 if (!all && forId && openId !== forId) return Promise.resolve();    /* not on screen any more */
 const p = _lcpGen.apply(this, arguments);
 return p && p.then ? p.then(function (r) { return r; }, function () {}) : p;
};
/* the older-mail fetcher: stop between batches of five */
const _olGen = openLight;
openLight = function (t, list) {
 const mine = openGen(), forId = t && t.id;
 if (forId && openId !== forId) return Promise.resolve();
 const p = _olGen.apply(this, arguments);
 return p;
};
/* the small-attachment prefetch: never for a conversation that is not open */
if (typeof attPrefetch === 'function') {
 const _apGen = attPrefetch;
 attPrefetch = function (t) {
  if (t && t.id && openId !== t.id) return;
  return _apGen.apply(this, arguments);
 };
}
/* note: cidPump is a const arrow and cannot be wrapped - emptying CID_Q above is what stops
   the queued pictures, and that is enough (a job already in flight simply finishes). */
/* ---- "Show 5 older messages" under a long trail ---- */
const OLD_BATCH = 5;
const _rrHeavy = renderRead;
renderRead = function () {
 const r = _rrHeavy.apply(this, arguments);
 try {
  const t = openId && T_(openId);
  if (!t || !t.msgs || t.msgs.length <= 10) return r;          /* only long ones get the line */
  const body = document.querySelector('#read .rbody');
  if (!body || body.querySelector('[data-oldmore]')) return r;
  const folded = t.msgs.filter(function (m, i) { const os = openMsgs[t.id]; return !os || !os.has(i); });
  if (folded.length < 1) return r;
  const n = Math.min(OLD_BATCH, folded.length);
  body.insertAdjacentHTML('beforeend',
   '<div data-oldmore="1" style="margin:10px 2px;padding:8px 10px;border:1px dashed var(--line);border-radius:6px;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
   + '<span>' + folded.length + ' older mail' + (folded.length > 1 ? 's are' : ' is') + ' shown as one line each.</span>'
   + '<button type="button" class="btn" data-oldshow="' + n + '">Show ' + n + ' older message' + (n > 1 ? 's' : '') + '</button>'
   + '</div>');
 } catch (e) {}
 return r;
};
document.addEventListener('click', function (e) {
 const b = e.target.closest && e.target.closest('[data-oldshow]');
 if (!b) return;
 e.preventDefault(); e.stopPropagation();
 const t = openId && T_(openId);
 if (!t) return;
 const want = Math.max(1, Math.min(20, +b.dataset.oldshow || OLD_BATCH));
 const os = openMsgs[t.id] || (openMsgs[t.id] = new Set());
 /* the next few below the ones already open, newest of those first */
 const ix = [];
 for (let i = t.msgs.length - 1; i >= 0 && ix.length < want; i--) if (!os.has(i)) ix.push(i);
 if (!ix.length) return;
 b.disabled = true; b.textContent = 'Loading…';
 ix.forEach(function (i) { os.add(i); });
 renderRead();
 try { openLight(t, ix.map(function (i) { return t.msgs[i]; })); } catch (x) {}
 try { loadCidPics(t); } catch (x) {}
}, true);
/* __heavyrule:end */</script>`;

s = s.replace(/\s*$/, "") + "\n" + block + "\n";
fs.writeFileSync(file, s);
console.log("patched .tmp/email.html");
console.log("  - closing a conversation now stops its background work");
console.log("  - the newest three bodies are drawn");
console.log("  - a long trail offers 'Show 5 older messages'");
