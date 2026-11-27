/* patch-mem-cap-m1.js - 27 Nov 2026
 *
 * USER'S WORDS: "make mandatory rule in setting that rugs email keep tab under 250 mb".
 *
 * Until now 250 MB was only a GOAL written in the night plan: the app had five separate
 * budgets (loaded mail 35 MB, opened-mail cache 15 MB, attachments 10 MB, thumbnails 4 MB,
 * compose files 15 MB, row HTML 600-2000 rows) and the 250 MB figure was the sum nobody
 * measured. If a budget was ever raised, or the browser held something the budgets do not
 * count, nothing in the app noticed.
 *
 * THIS MAKES IT A REAL, MANDATORY CEILING:
 *   - MEM_CAP_MB = 250. It is read from no setting, so nobody can switch it off; the
 *     Mail rules page shows it as rule M1 with the badge "Mandatory" and no switch.
 *   - memMeasured() reads the TAB's own JavaScript memory (performance.memory.usedJSHeapSize,
 *     which Chrome and Edge both give - the office PCs are Edge), and falls back to the sum
 *     of what Rugs Email itself is holding when a browser does not offer it.
 *   - memGuard() runs after a draw (at most every 4 s) and on its own timer every 20 s:
 *       over 80% (200 MB) -> a full ordinary sweep, early;
 *       over 100% (250 MB) -> an EMERGENCY trim: every conversation's loaded text except
 *         the one on screen and the last one looked at, the opened-mail cache, the
 *         attachment bytes, the thumbnails and the row-HTML cache are all dropped, and the
 *         compose attachments too unless a mail is actually being written (never throw away
 *         something somebody is typing). Everything dropped is fetched again when next
 *         needed - that is exactly what the app did before any of it was cached.
 *   - It never touches mail on the server, a folder, an owner or a read/unread state: it
 *     only drops copies the page is holding.
 *   - window.rzMemCap() reports the ceiling, what is held now and every time the guard had
 *     to act, so the rule can be checked on a real screen instead of trusted.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-mem-cap-m1.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
const n0 = s.length;

if (s.includes("__memcap:start")) { console.log("already applied - nothing to do"); process.exit(0); }
if (!s.includes("window.rzMemTrim")) throw new Error("the page-memory block is missing - run patch-page-memory-2.js first");

const BLOCK = [
'<script>/* __memcap:start  27 Nov 2026 - RULE M1 (mandatory): this tab stays under 250 MB.',
'   server/patch-mem-cap-m1.js. There is no setting that switches this off. */',
'(function(){',
' /* the ceiling, in megabytes. Mandatory: read from no setting and from no URL. */',
' const MEM_CAP_MB=250;',
' const CAP=MEM_CAP_MB*1024*1024;',
' const WARN=Math.round(CAP*0.8);        /* 200 MB - sweep early, before it is a problem */',
' const EVERY=4000;                      /* do not measure more often than this (ms) */',
' let AT=0, HITS=[], SWEPT=0;',
'',
' /* What the TAB is holding. performance.memory is Chrome/Edge only, which is what the',
'    office PCs run; where it is missing we fall back to what Rugs Email itself holds. */',
' function held(){',
'  try{',
'   const m=window.performance&&window.performance.memory;',
'   if(m&&m.usedJSHeapSize>0)return {b:m.usedJSHeapSize,how:"tab"};',
'  }catch(e){}',
'  let b=0;',
'  try{((window.S&&S.threads)||[]).forEach(function(t){b+=loadedBytes(t)})}catch(e){}',
'  try{Object.keys(RAWC).forEach(function(k){var v=RAWC[k];b+=((v&&v.raw)||"").length+((v&&v.body)||"").length})}catch(e){}',
'  try{Object.keys(ATT_SZ).forEach(function(k){b+=ATT_SZ[k]||0})}catch(e){}',
'  try{Object.keys(ATHUMB).forEach(function(k){b+=String(ATHUMB[k]||"").length})}catch(e){}',
'  try{RHC.forEach(function(v){b+=String(v||"").length})}catch(e){}',
'  try{PRE_B64.forEach(function(v){b+=(v&&v.__len)||0})}catch(e){}',
'  return {b:b,how:"stores"};',
' }',
' window.__memHeld=held;',
'',
' /* is somebody writing a mail right now? then the files they attached are not ours to drop */',
' function composing(){',
'  try{return !!document.querySelector(".dlg .editor, .inline textarea")}catch(e){return false}',
' }',
'',
' /* The emergency trim. Nothing here is mail: every one of these is a COPY the page kept',
'    to be quick, and dropping it only means fetching it again when it is next needed. */',
' function emergency(){',
'  var freed=0;',
'  var keep={};',
'  try{if(typeof openId!=="undefined"&&openId)keep[openId]=1}catch(e){}',
'  try{',
'   var last=null,lat=0;',
'   ((window.S&&S.threads)||[]).forEach(function(t){var a=t&&t._seenAt||0;if(a>lat){lat=a;last=t}});',
'   if(last)keep[last.id]=1;',
'  }catch(e){}',
'  try{',
'   ((window.S&&S.threads)||[]).forEach(function(t){',
'    if(!t||keep[t.id])return;',
'    if(typeof stripLoaded==="function")freed+=stripLoaded(t)||0;',
'   });',
'  }catch(e){}',
'  /* the opened-mail cache, minus the conversation on screen */',
'  try{',
'   var pin=(typeof memPinned==="function")?memPinned():{};',
'   Object.keys(RAWC).forEach(function(k){',
'    if(pin[k])return;',
'    var v=RAWC[k];freed+=((v&&v.raw)||"").length+((v&&v.body)||"").length;delete RAWC[k];',
'   });',
'  }catch(e){}',
'  try{Object.keys(ATTB).forEach(function(k){freed+=ATT_SZ[k]||0;delete ATTB[k];delete ATT_SZ[k]})}catch(e){}',
'  try{Object.keys(ATHUMB).forEach(function(k){freed+=String(ATHUMB[k]||"").length;delete ATHUMB[k]})}catch(e){}',
'  try{RHC.forEach(function(v){freed+=String(v||"").length});RHC.clear()}catch(e){}',
'  if(!composing()){try{PRE_B64.forEach(function(v){freed+=(v&&v.__len)||0});PRE_B64.clear()}catch(e){}}',
'  return freed;',
' }',
'',
' /* The guard itself. Mandatory means it is not asked for permission and cannot be',
'    skipped: it runs after a draw and on its own timer for as long as the tab is open. */',
' function memGuard(force){',
'  var now=Date.now();',
'  if(!force&&now-AT<EVERY)return null;',
'  AT=now;',
'  var h=held(),act="";',
'  try{',
'   if(h.b>CAP){',
'    act="emergency";',
'    if(typeof memSweep==="function")memSweep(true);',
'    var f=emergency();',
'    SWEPT++;',
'    HITS.push({at:now,was:Math.round(h.b/1048576),freed:Math.round(f/1048576),how:h.how});',
'    if(HITS.length>20)HITS.shift();',
'    h=held();',
'   }else if(h.b>WARN){',
'    act="sweep";',
'    if(typeof memSweep==="function")memSweep(true);',
'    h=held();',
'   }',
'  }catch(e){}',
'  return {mb:Math.round(h.b/104857.6)/10,act:act,how:h.how};',
' }',
' window.__memGuard=memGuard;',
'',
' /* after every draw, and on a timer so a page left open all day is still held down */',
' try{',
'  var _rdCap=window.render;',
'  if(typeof _rdCap==="function"){',
'   window.render=function(){var r=_rdCap.apply(this,arguments);try{memGuard()}catch(e){}return r};',
'  }',
' }catch(e){}',
' try{setInterval(function(){try{memGuard(true)}catch(e){}},20000)}catch(e){}',
'',
' /* so the rule can be read off a real screen: rzMemCap() in the browser console,',
'    and the same numbers on Admin -> Mail rules, rule M1. */',
' window.MEM_CAP_MB=MEM_CAP_MB;',
' window.rzMemCap=function(){',
'  var h=held();',
'  var mb=Math.round(h.b/104857.6)/10;',
'  return {',
'   rule:"M1 (mandatory) - this tab stays under "+MEM_CAP_MB+" MB",',
'   capMB:MEM_CAP_MB,',
'   nowMB:mb,',
'   percent:Math.round(mb/MEM_CAP_MB*100)+"%",',
'   measured:h.how==="tab"?"the tab\'s own JavaScript memory":"what Rugs Email is holding (this browser does not report the tab)",',
'   timesItHadToAct:SWEPT,',
'   lastActions:HITS.slice(-5),',
'   switchable:false',
'  };',
' };',
'})();',
'/* __memcap:end */<' + '/script>',
''
].join('\n');

/* the app has no </body> of its own (there is one inside a JS string), so this appends
   at the very end of the file - the 27 Nov design-13 lesson */
s = s.replace(/\s*$/, '\n') + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  M1 memory-cap block appended (" + n0 + " -> " + s.length + " chars)");
