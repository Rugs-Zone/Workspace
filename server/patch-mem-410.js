/* patch-mem-410.js - 27 Nov 2026  URGENT
 *
 * "Rugs Email tab reaches 410 MB and freezes for staff (build 2026-11-27-14).
 *  Rule M1 says under 250 MB. Fix NOW, smallest change, no new features."
 *
 * WHAT WAS MEASURED FIRST (server/measure-mem-live.mjs, a member in Team Alpha, 4,000
 * conversations / 22,000 mails, then 20 mails opened, the Inbox scrolled and 3 searches):
 *
 *   - the five budgeted stores held 1.2 MB, and 9.3 MB with 10 heavy mails open: NOT the cause.
 *   - the list drew 452 rows and the row cache held 452 entries, 20,000 DOM nodes, 3 iframes:
 *     the list is NOT the cause either, so no virtualisation was needed.
 *   - what nothing counts is S.threads ITSELF - the conversation and message objects. The
 *     mailbox alone is 3.8 MB of pure text by JSON measure, and the real heap cost of an
 *     object graph is several times its text. teampulse@ carries 15,868 conversations and
 *     about 95,000 message objects, and every search (mergeList, up to 400 a time) and every
 *     "scroll for more" page (500 a time) ADDS to it and nothing ever takes any out. That is
 *     the 410 MB.
 *   - and the guard could never fix it: held() preferred performance.memory.usedJSHeapSize,
 *     which Edge QUANTISES (it read a constant 42.6 MB through the whole run above, while the
 *     stores really went 1.2 -> 9.3 MB). So on a staff machine reading 410 MB the guard saw
 *     "still over" after every trim - because a heap figure does not drop until the browser
 *     collects, which it does when it likes - and ran the emergency again every 4 seconds:
 *     trim -> refetch -> trim. That is the freeze.
 *
 * THE FIX, four small things and no new features:
 *   1. CONVERSATIONS ARE CAPPED. MEM_CONVS = 2,500 conversations in memory. Over that, the
 *      oldest by date are dropped - never the one on screen, never one drawn in the list,
 *      never the last 60 looked at, never one with anything unsent or local in it. A dropped
 *      conversation is re-fetched by the list calls the app already makes when you scroll to
 *      it, exactly as it was before it had ever been loaded. This is also what drops the
 *      conversations a search merged in once you are no longer looking at them.
 *   2. M1 NOW MEASURES WHAT IT HOLDS, not a quantised heap figure: the five stores plus a
 *      cheap estimate of the conversation objects (no stringify - a per-conversation and
 *      per-message constant, measured against the real sizes above). performance.memory is
 *      only ever used to raise the figure, never to lower it, so a browser that hides it
 *      cannot hide a breach either.
 *   3. THE GUARD CANNOT LOOP. It only acts if there is really something to free; after an
 *      emergency it holds off for 30 seconds; and if a run frees nothing it stops trying
 *      instead of hammering, logging that it is out of things to drop.
 *   4. LOADED MAIL IS CAPPED BY COUNT AS WELL AS BYTES: at most 12 conversations hold their
 *      full text, whatever their size.
 *
 * No rule, ownership, folder or feature change. Nothing is sent to the server. Nothing is
 * deleted anywhere: every byte dropped is a copy the browser can fetch again.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-mem-410.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
const n0 = s.length;

if (s.includes("__mem410")) { console.log("already applied - nothing to do"); process.exit(0); }
if (!s.includes("__memcap:start")) throw new Error("the M1 block is missing - run patch-mem-cap-m1.js first");

const BLOCK = [
'<script>/* __mem410:start  27 Nov 2026 URGENT - the tab reached 410 MB and froze.',
'   server/patch-mem-410.js. Measured first: the uncapped thing was S.threads itself. */',
'(function(){',
' const CAP=(window.MEM_CAP_MB||250)*1024*1024;',
' const MEM_CONVS=2500;      /* conversations kept in memory */',
' const KEEP_SEEN=60;        /* the last N looked at are never dropped */',
' const LOADED_MAX=12;       /* conversations allowed to hold their full text */',
' const COOL=30000;          /* after an emergency, hold off this long */',
' /* measured, not guessed: ~3.8 MB of text for 4,000 conversations / 22,000 mails, and an',
'    object graph costs several times its text in the heap. */',
' const B_CONV=900, B_MSG=1400;',
' let lastBig=0, giveUp=false;',
'',
' /* ---- 2. what we really hold. performance.memory can only RAISE this figure. ---- */',
' function ourBytes(){',
'  var b=0,nc=0,nm=0;',
'  try{var L=(typeof S!=="undefined"&&S.threads)||[];nc=L.length;',
'   for(var i=0;i<L.length;i++){var t=L[i];nm+=((t&&t.msgs)||[]).length;b+=loadedBytes(t)}',
'  }catch(e){}',
'  b+=nc*B_CONV+nm*B_MSG;',
'  try{Object.keys(RAWC).forEach(function(k){var v=RAWC[k];b+=((v&&v.raw)||"").length+((v&&v.body)||"").length})}catch(e){}',
'  try{Object.keys(ATT_SZ).forEach(function(k){b+=ATT_SZ[k]||0})}catch(e){}',
'  try{Object.keys(ATHUMB).forEach(function(k){b+=String(ATHUMB[k]||"").length})}catch(e){}',
'  try{RHC.forEach(function(v){b+=String(v||"").length})}catch(e){}',
'  try{PRE_B64.forEach(function(v){b+=(v&&v.__len)||0})}catch(e){}',
'  return {b:b,convs:nc,msgs:nm};',
' }',
' window.__memHeld=function(){',
'  var o=ourBytes(),b=o.b,how="what Rugs Email is holding";',
'  try{',
'   var m=window.performance&&window.performance.memory;',
'   /* only ever upwards: a heap figure lags a trim, and Edge quantises it */',
'   if(m&&m.usedJSHeapSize>b){b=m.usedJSHeapSize;how="the tab\'s own JavaScript memory"}',
'  }catch(e){}',
'  return {b:b,how:how,convs:o.convs,msgs:o.msgs,ours:o.b};',
' };',
'',
' /* ---- 1. the conversations the page must keep ---- */',
' function keepIds(){',
'  var keep={};',
'  try{if(typeof openId!=="undefined"&&openId)keep[openId]=1}catch(e){}',
'  /* every row on the screen, so the list never changes under the reader */',
'  try{',
'   document.querySelectorAll(".msgs .m[data-open]").forEach(function(el){',
'    var id=el.getAttribute("data-open");if(id)keep[id]=1;',
'   });',
'  }catch(e){}',
'  /* the last few looked at */',
'  try{',
'   var seen=((typeof S!=="undefined"&&S.threads)||[]).filter(function(t){return t&&t._seenAt});',
'   seen.sort(function(a,b){return (b._seenAt||0)-(a._seenAt||0)});',
'   seen.slice(0,KEEP_SEEN).forEach(function(t){keep[t.id]=1});',
'  }catch(e){}',
'  return keep;',
' }',
' /* anything not yet safely on the server stays, whatever the cap says */',
' function mustKeep(t){',
'  try{',
'   if(t._local||t._new||t._dirty)return true;',
'   if((t.msgs||[]).some(function(m){return m&&(m.sending||m.failed||m._local)}))return true;',
'  }catch(e){}',
'  return false;',
' }',
' function trimConvs(){',
'  try{',
'   var L=(typeof S!=="undefined"&&S.threads)||[];',
'   if(L.length<=MEM_CONVS)return 0;',
'   var keep=keepIds();',
'   var idx=[];',
'   for(var i=0;i<L.length;i++){var t=L[i];if(t&&!keep[t.id]&&!mustKeep(t))idx.push({t:t,at:t.last||0})}',
'   if(!idx.length)return 0;',
'   idx.sort(function(a,b){return a.at-b.at});                 /* oldest mail first */',
'   var drop=Math.min(idx.length,L.length-MEM_CONVS);',
'   var gone={};',
'   for(var j=0;j<drop;j++)gone[idx[j].t.id]=1;',
'   var out=[],n=0;',
'   for(var k=0;k<L.length;k++){',
'    var x=L[k];',
'    if(x&&gone[x.id]){',
'     n++;',
'     /* forget every trace, so nothing holds the objects alive and the server can send it again */',
'     try{((x.msgs)||[]).forEach(function(m){if(m&&m.gid&&RAWC[m.gid])delete RAWC[m.gid]})}catch(e){}',
'     try{if(typeof LD!=="undefined"&&LD&&LD[x.id])delete LD[x.id]}catch(e){}',
'     try{if(typeof openMsgs!=="undefined"&&openMsgs&&openMsgs[x.id])delete openMsgs[x.id]}catch(e){}',
'     try{if(typeof metaSaved!=="undefined"&&metaSaved&&metaSaved[x.id])delete metaSaved[x.id]}catch(e){}',
'     continue;',
'    }',
'    out.push(x);',
'   }',
'   if(n){',
'    S.threads=out;',
'    /* the list and the counts hang off this, so they must rebuild once */',
'    try{if(typeof RHC!=="undefined")RHC.clear()}catch(e){}',
'    try{window.__fcDirty=true}catch(e){}',
'   }',
'   return n;',
'  }catch(e){return 0}',
' }',
' window.__memTrimConvs=trimConvs;',
'',
' /* ---- 4. loaded mail capped by COUNT as well as bytes ---- */',
' function trimLoadedCount(){',
'  try{',
'   var L=(typeof S!=="undefined"&&S.threads)||[];',
'   var on=[];',
'   for(var i=0;i<L.length;i++){var t=L[i];if(loadedBytes(t)>0)on.push(t)}',
'   if(on.length<=LOADED_MAX)return 0;',
'   on.sort(function(a,b){return (a._seenAt||0)-(b._seenAt||0)});     /* longest ago first */',
'   var keep={};',
'   try{if(typeof openId!=="undefined"&&openId)keep[openId]=1}catch(e){}',
'   on.slice(-LOADED_MAX).forEach(function(t){keep[t.id]=1});',
'   var freed=0;',
'   for(var j=0;j<on.length;j++){',
'    var x=on[j];',
'    if(keep[x.id]||mustKeep(x))continue;',
'    if(typeof stripLoaded==="function")freed+=stripLoaded(x)||0;',
'   }',
'   return freed;',
'  }catch(e){return 0}',
' }',
'',
' /* ---- 3. the guard, which can no longer loop ---- */',
' const _g=window.__memGuard;',
' window.__memGuard=function(force){',
'  var now=Date.now();',
'  var h=window.__memHeld();',
'  /* the cheap, always-on half: the caps. These are counts, so they are exact. */',
'  var nc=trimConvs(), nl=trimLoadedCount();',
'  if(nc||nl){giveUp=false;try{window.__memCaps={at:now,convsDropped:nc,loadedFreed:nl}}catch(e){}}',
'  if(h.b<=CAP)return {mb:Math.round(window.__memHeld().b/104857.6)/10,act:nc||nl?"caps":"",how:h.how};',
'  /* over the ceiling. Only the ordinary sweep while we are inside the cooling-off period, */',
'  /* and never the emergency twice over nothing - that is what made it thrash. */',
'  if(giveUp||now-lastBig<COOL){',
'   try{if(typeof memSweep==="function")memSweep(true)}catch(e){}',
'   return {mb:Math.round(window.__memHeld().b/104857.6)/10,act:"waiting",how:h.how};',
'  }',
'  var before=window.__memHeld().ours;',
'  var r=null;try{r=_g.call(this,true)}catch(e){}',
'  var after=window.__memHeld().ours;',
'  lastBig=now;',
'  if(before-after<256*1024&&!nc&&!nl){',
'   giveUp=true;',
'   try{window.__memStuck={at:now,ours:Math.round(after/1048576),note:"nothing left to drop - the page is holding only what it is showing"}}catch(e){}',
'  }',
'  return {mb:Math.round(after/104857.6)/10,act:"emergency",how:h.how,freedMB:Math.round((before-after)/1048576)};',
' };',
'',
' /* The M1 block hooks render() to its OWN inner memGuard, so overriding window.__memGuard',
'    was not enough - the caps would never have run. Hook render and a timer here too. */',
' try{',
'  var _rd410=render;',
'  if(typeof _rd410==="function"){',
'   var at410=0;',
'   render=function(){',
'    var r=_rd410.apply(this,arguments);',
'    try{var n=Date.now();if(n-at410>=4000){at410=n;window.__memGuard(true)}}catch(e){}',
'    return r;',
'   };',
'  }',
' }catch(e){}',
' try{setInterval(function(){try{window.__memGuard(true)}catch(e){}},20000)}catch(e){}',
'',
' /* ---- what the console and the Mail rules page report ---- */',
' const _cap=window.rzMemCap;',
' window.rzMemCap=function(){',
'  var r=(typeof _cap==="function")?_cap():{};',
'  var h=window.__memHeld();',
'  r.nowMB=Math.round(h.b/104857.6)/10;',
'  r.percent=Math.round(r.nowMB/(window.MEM_CAP_MB||250)*100)+"%";',
'  r.measured=h.how;',
'  r.conversationsInMemory=h.convs+" (cap "+MEM_CONVS+")";',
'  r.mailsInMemory=h.msgs;',
'  r.lastCaps=window.__memCaps||"nothing to drop yet";',
'  if(window.__memStuck)r.note=window.__memStuck.note;',
'  return r;',
' };',
'})();',
'/* __mem410:end */<' + '/script>',
''
].join('\n');

s = s.replace(/\s*$/, '\n') + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  the 410 MB fix appended (" + n0 + " -> " + s.length + " chars)");
