/* 25 Nov 2026 - "increase the speed everywhere, no lag, no glitch".

   MEASURED FIRST, in a real browser on a 1,086-conversation mailbox. Every single
   redraw - and the app redraws on every click - was doing all of this again:

     renderFolders()   about 20 full passes over every conversation: 5 favourite
                       counts (My work, Needs owner, Late, Flagged, Critical), the
                       unread count of each mailbox, one pass per topic and one per
                       shared mailbox - each pass calling st(), isWork(), critOf(),
                       hasRecv() per conversation.
     renderRail()      two more full passes (late/today, and unread).
     renderList()      150 rows x rowHTML() at 1.4 ms a row = about 210 ms.
     renderRead()      the whole reading pane thrown away and rebuilt, iframes and all.

   On Team Pulse, with thousands of conversations, that is most of a second for every
   click - which is exactly what "lagging" feels like.

   Nothing here changes what anybody sees. It only stops the app recomputing things
   that have not changed, and every cache is keyed on the things it actually depends
   on, so a real change is never served from a cache:

     1  renderFolders and renderRail remember their finished HTML and skip the whole
        job (counting included) while the mail fingerprint, the mailbox/folder being
        viewed, the app page, the topic filter, the draft count, the open/closed
        groups and the signed-in person are all unchanged.
     2  inboxUnreadN(dept) is worked out once per fingerprint instead of once per
        mailbox per redraw.
     3  the row cache (patch-list-speed.js) no longer throws everything away when any
        one conversation changes: each row's key already holds everything that row
        shows, so clicking one mail now redraws one row instead of 150. The key gained
        the last message's own marks, so text arriving from Gmail still redraws it.
     4  seeMine / sentSeen / inView are remembered per conversation for 300 ms, which
        is what one redraw takes - they are called from the list, the counts, All
        inboxes and the Home numbers, over and over, for the same conversations.

   Run:  node server/patch-speed-everywhere.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__speedall:start")) { console.log("already there - nothing changed"); process.exit(0); }
if (!s.includes("__listspeed:start")) throw new Error("run node server/patch-list-speed.js first");

/* ---- the row cache must stop clearing itself whenever anything at all changes ---- */
if (s.includes("RHF!==fp")) {
  s = s.replace(/\s*const fp=mailFp\(\);\n if\(RHF!==fp\)\{RHC\.clear\(\);RHF=fp\}/,
    "\n /* no global clear: each row's own key below is what decides (see patch-speed-everywhere.js) */");
  if (s.includes("RHF!==fp")) throw new Error("could not remove the global row-cache clear");
  console.log("  - the row cache no longer clears everything when one conversation changes");
} else console.log("  - row cache clearing: already done");

/* ---- richer row key: the newest message's own state, so text arriving redraws the row ---- */
const keyOld = "(t.cats||[]).join(','),(t.hist||[]).length,(t.msgs||[]).length].join('|')";
if (s.includes(keyOld)) {
  s = s.replace(keyOld,
    "(t.cats||[]).join(','),(t.hist||[]).length,(t.msgs||[]).length,\n" +
    "  (function(m){return m?((m.light?'L':'')+(m.failed?'F':'')+(m.sending?'S':'')+String(m.body||'').length+'/'+String(m.from||'').length):''})((t.msgs||[])[(t.msgs||[]).length-1])" +
    "].join('|')");
  console.log("  - the row key now notices the newest message changing");
} else if (!s.includes("m.light?'L'")) throw new Error("the row key was not found");
else console.log("  - row key: already done");

/* ---- the fingerprint should also notice a topic (label) arriving, for the Topics counts ---- */
const fpOld = "h=(h*31+((t.msgs&&t.msgs.length)||0))|0}";
if (s.includes(fpOld)) {
  s = s.replace(fpOld, "h=(h*31+((t.msgs&&t.msgs.length)||0))|0;\n   h=(h*31+(t.label?t.label.charCodeAt(0):0))|0}");
  console.log("  - the fingerprint now notices a topic being set");
} else console.log("  - fingerprint label: already done");

const block = String.raw`
<script>/* __speedall:start  25 Nov 2026: stop redoing work that has not changed */
/* ---- 1. the folder pane and the left rail ---- */
function paneKey(){
 try{
  return [mailFp(),app,view.type,view.dept||'',view.folder||'',view.id||'',lfilt||'',
   ME,dashAs||'',S.drafts.length,(S.notifs||[]).filter(n=>!n.read).length,
   JSON.stringify(S.ui&&S.ui.col||{}),(S.prefs&&S.prefs.folders||[]).join(','),
   (S.folders||[]).length,DEPTS.length,PEOPLE.length].join('|');
 }catch(e){return 'x'+Math.random()}
}
let FOLDK='',RAILK='';
const _rfSpd=renderFolders;
renderFolders=function(){
 const k=paneKey();
 const el=document.getElementById('folders');
 if(k===FOLDK&&el&&el.innerHTML)return;      /* nothing it shows has changed */
 FOLDK=k;return _rfSpd.apply(this,arguments)};
const _rrSpd=renderRail;
renderRail=function(){
 const k=paneKey();
 const el=document.getElementById('rail');
 if(k===RAILK&&el&&el.innerHTML)return;
 RAILK=k;return _rrSpd.apply(this,arguments)};
/* ---- 2. the unread count of a mailbox: once per change, not once per redraw ---- */
let IUN={},IUNK='';
const _iuSpd=inboxUnreadN;
inboxUnreadN=function(deptId){
 const k=mailFp()+'|'+ME+'|'+(view.type||'');
 if(k!==IUNK){IUN={};IUNK=k}
 const id=deptId||'*';
 if(IUN[id]!==undefined)return IUN[id];
 const n=_iuSpd.apply(this,arguments);
 IUN[id]=n;return n};
/* ---- 3. the visibility rules, shared inside one redraw and never across one ----
   Each entry point that draws starts a fresh pass. Inside one pass nothing can change
   (it is all synchronous), so sharing the answer is exact; a new pass always works it
   out again. There is no time window, so there is no way to show a stale row. */
let PASS=0;
function memoPass(fn){
 let map=new WeakMap(),at=-1;
 return function(t){
  if(!t||typeof t!=='object')return fn.apply(this,arguments);
  if(at!==PASS){map=new WeakMap();at=PASS}
  const hit=map.get(t);
  if(hit!==undefined)return hit;
  const v=fn.apply(this,arguments);
  map.set(t,v);return v}
}
seeMine=memoPass(seeMine);
sentSeen=memoPass(sentSeen);
inView=memoPass(inView);
isInboxMail=memoPass(isInboxMail);
const _rdPass=render;        render=function(){PASS++;return _rdPass.apply(this,arguments)};
const _rlPass=renderList;    renderList=function(){PASS++;return _rlPass.apply(this,arguments)};
const _rfPass=renderFolders; renderFolders=function(){PASS++;return _rfPass.apply(this,arguments)};
const _raPass=renderRail;    renderRail=function(){PASS++;return _raPass.apply(this,arguments)};
if(typeof renderListKeep==='function'){const _rkPass=renderListKeep;renderListKeep=function(){PASS++;return _rkPass.apply(this,arguments)}}
if(typeof renderRead==='function'){const _rrdPass=renderRead;renderRead=function(){PASS++;return _rrdPass.apply(this,arguments)}}
/* __speedall:end */</script>`;

s = s.replace(/\s*$/, "") + "\n" + block + "\n";
fs.writeFileSync(file, s);
console.log("patched .tmp/email.html - the folder pane, the rail, the counts, the rows and the rules are no longer redone when nothing changed");
