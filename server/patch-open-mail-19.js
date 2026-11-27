/* patch-open-mail-19.js - 27 Nov 2026  URGENT (live)
 *
 * "In a conversation, every older mail shows 'Opening this mail...' for ever and never loads
 *  (seen as Ashok, Team Pulse, 'Very SS27 Po's')."  Appeared with the memory fix.
 *
 * TWO REAL CAUSES, both found by reading the shipped app:
 *
 *  (A) openLight() kept LD1[thread|gmail_id] FOR EVER after a successful fetch ("this mail is
 *      already done, never ask again"). The memory guard (stripLoaded, 26/27 Nov) then throws
 *      that mail's text away and the next thread load brings it back as a one-line summary
 *      (light:true) - but LD1 still said "done", so openLight returned at once, no request was
 *      ever made, m.loading was never set and m.light never cleared: the spinner for ever.
 *      LD1 is now what it should always have been - an IN-FLIGHT lock, cleared when the batch
 *      ends, success or failure.
 *
 *  (B) readKey() (the reading-pane draw cache, 25 Nov) does not include m.loading or m.lfail,
 *      so when a fetch FAILED and build 18 set m.lfail=true the key had not changed and
 *      renderRead() returned without drawing: the "Try again" button could never appear.
 *      That is why build 18's retry was invisible. Both flags are in the key now.
 *
 * AND the loader can no longer be left un-started, whatever route the mail was opened by
 * (click, Show all N mails, the Mail trail's "View mail", Show in <folder>, a poll that
 * re-opened the mail): after every reading-pane draw, any mail that is OPEN, still a summary,
 * not already loading and not already failed is fetched - the ones on screen first, ten at a
 * time, and a scroll brings the next ten forward. A watchdog ends any fetch still
 * running after 50 seconds as a failure, so "Opening this mail..." always turns into either the
 * mail or "Couldn't load - Retry".
 *
 * M1 (tab under 250 MB) is kept and helped: COLLAPSING a mail that was fetched as a summary
 * frees its text, its frame's HTML and its RAWC copy again and puts it back to "summary", so a
 * long trail cannot grow for ever by being opened and closed. Nothing is deleted anywhere:
 * every byte dropped is a copy the browser fetches again.
 *
 * Also: a collapsed mail always shows sender + time + first line and never a spinner (the
 * folded one-liner now has words even when the summary text is empty), and an OPEN summary
 * shows the summary text above the spinner instead of a bare spinner.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-open-mail-19.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
const n0 = s.length;
if (s.includes("__openmail19")) { console.log("already applied - nothing to do"); process.exit(0); }

let done = 0;
function edit(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(name + ": found " + n + " times, expected 1");
  s = s.replace(from, to);
  done++;
  console.log("  edit " + done + " ok  " + name);
}

/* ---- 1. the folded one-liner always has words (never a spinner, never blank) ---- */
edit("folded one-liner",
  '<div class="msnip">${esc(pvClean(m.body).slice(0,140))}</div>',
  '<div class="msnip">${esc(pvClean(m.body).slice(0,140))||(m.light?\'Click to read this mail\':\'(no text)\')}</div>'
);

/* ---- 2. an OPEN summary: its text, then the spinner - and a real Retry on failure ---- */
edit("open summary body",
  'm.light?(m.lfail&&!m.loading?`<p style="color:var(--muted)">\\u26a0 Could not open this mail. <button class="btn" data-lretry="${mi}">\\u21bb Try again</button></p>`:`<p style="color:var(--muted)">\\u23f3 Opening this mail\\u2026</p>`)',
  'm.light?`${pvClean(m.body)?`<p style="white-space:pre-wrap">${esc(pvClean(m.body).slice(0,1200))}</p>`:\'\'}${m.lfail&&!m.loading?`<p style="color:var(--muted)">\\u26a0 Couldn\\u2019t load \\u2014 <button class="btn" data-lretry="${mi}">\\u21bb Retry</button></p>`:`<p style="color:var(--muted)">\\u23f3 Opening this mail\\u2026</p>`}`'
);

/* ---- 3. LD1 is an IN-FLIGHT lock, not a permanent "done" mark (cause A) ---- */
edit("openLight: skip only what is already in flight",
  "const ids=[...new Set((list||[]).filter(m=>m&&m.light&&m.gid).map(m=>m.gid))].filter(g=>!LD1[t.id+'|'+g]);",
  "const ids=[...new Set((list||[]).filter(m=>m&&m.light&&m.gid&&!m.loading).map(m=>m.gid))].filter(g=>!LD1[t.id+'|'+g]);"
);
edit("openLight: remember WHEN the fetch started (the watchdog reads it)",
  "ids.forEach(g=>{LD1[t.id+'|'+g]=1});",
  "ids.forEach(g=>{LD1[t.id+'|'+g]=Date.now()});"
);
edit("openLight: a new go clears the old failure",
  "t.msgs.forEach(m=>{if(ids.indexOf(m.gid)>=0)m.loading=true});redrawRead(t);",
  "t.msgs.forEach(m=>{if(ids.indexOf(m.gid)>=0){m.loading=true;m.lfail=false}});redrawRead(t);"
);
edit("openLight: mark a mail that arrived as a summary (collapsing frees it again)",
  "x.raw=fixMailImgs(q.body_html||'');x.body=(q.body_text||x.body||'').trim();x.full=true;x.light=false;",
  "x.raw=fixMailImgs(q.body_html||'');x.body=(q.body_text||x.body||'').trim();x.full=true;x.light=false;x.wasLight=true;"
);
edit("openLight: the lock always comes off when the batch ends",
  "b.forEach(g=>{const x=t.msgs.find(y=>y.gid===g);if(x){x.loading=false;x.lfail=!!x.light;if(x.light)delete LD1[t.id+'|'+g]}});",
  "b.forEach(g=>{const x=t.msgs.find(y=>y.gid===g);if(x){x.loading=false;x.lfail=!!x.light}delete LD1[t.id+'|'+g]});"
);

/* ---- 4. the pane's draw cache must see loading / failed (cause B) ---- */
edit("readKey: include loading and failed",
  "m+=(x.light?'L':'')+(x.failed?'F':'')+(x.sending?'S':'')",
  "m+=(x.light?'L':'')+(x.loading?'g':'')+(x.lfail?'X':'')+(x.failed?'F':'')+(x.sending?'S':'')"
);

/* ---- 5. the block that makes sure the loader always starts and always finishes ---- */
const Q = String.fromCharCode(39);           /* an apostrophe, kept out of these JS strings */
const BLOCK = [
'<script>/* __openmail19:start  27 Nov 2026 URGENT - "every older mail shows Opening this mail for ever".',
'   server/patch-open-mail-19.js. The two causes are fixed in the app above; this block makes sure the',
'   fetch is always STARTED (whatever route opened the mail) and always ENDS (the mail, or',
'   Couldn' + Q + 't load - Retry), and gives rule M1 its memory back when a mail is folded up again. */',
'(function(){',
' var TRIES=3;          /* automatic goes per mail; after that the person presses Retry */',
' var NEAR=10;          /* mails fetched per pass, so a 50-mail trail stays polite */',
' var STUCK=50000;      /* a fetch still running after this long is a failure */',
' var KICK={}, FREED=0;',
'',
' function thr(){try{return (typeof openId!=="undefined"&&openId&&typeof T_==="function")?T_(openId):null}catch(e){return null}}',
'',
' /* ---- always START: every OPEN summary is fetched, the ones on screen first ---- */',
' /* Deliberately NOT "only when scrolled into view": a mail that is open and waiting must',
'    never sit on a spinner with no request in flight - that is the bug being fixed. Being on',
'    screen only decides the ORDER, and ten at a time keeps a 50-mail trail polite. */',
' function kickOpen(){',
'  try{',
'   var t=thr();if(!t||!t.msgs)return;',
'   var os=openMsgs[t.id];if(!os)return;',
'   var want=[];',
'   t.msgs.forEach(function(m,i){',
'    if(!os.has(i)||!m||!m.light||!m.gid)return;',
'    if(m.loading||m.lfail)return;',
'    var k=t.id+"|"+m.gid;if((KICK[k]||0)>=TRIES)return;',
'    var el=document.getElementById("msg-"+t.id+"-"+i),d=1e9;',
'    try{if(el){var r=el.getBoundingClientRect();d=r.top<0?-r.top:r.top}}catch(e){}',
'    want.push({m:m,k:k,d:d});',
'   });',
'   if(!want.length)return;',
'   want.sort(function(a,b){return a.d-b.d});           /* nearest the eye first */',
'   var take=want.slice(0,NEAR);',
'   take.forEach(function(o){KICK[o.k]=(KICK[o.k]||0)+1});',
'   try{openLight(t,take.map(function(o){return o.m}))}catch(e){}',
'   /* the rest follow: each batch redraws the pane, and a draw calls this again. A scroll',
'      brings the next pass forward instead of waiting for the draw. */',
'   if(want.length>take.length){',
'    var box=document.querySelector("#read .rbody");',
'    if(box&&!box.__ol19){box.__ol19=1;box.addEventListener("scroll",function(){setTimeout(kickOpen,0)},{passive:true})}',
'    setTimeout(kickOpen,300);',
'   }',
'  }catch(e){}',
' }',
' /* every draw of the reading pane makes sure of it - whatever route opened the mail */',
' try{',
'  if(typeof renderRead==="function"){',
'   var _rrOL=renderRead;',
'   renderRead=function(){var r=_rrOL.apply(this,arguments);try{setTimeout(kickOpen,0)}catch(e){}return r};',
'  }',
' }catch(e){}',
'',
' /* ---- always FINISH: nothing may spin for ever ---- */',
' try{setInterval(function(){try{',
'  var t=thr();if(!t||!t.msgs)return;var now=Date.now(),ch=false;',
'  t.msgs.forEach(function(m){',
'   if(!m||!m.loading||!m.gid)return;',
'   var k=t.id+"|"+m.gid,at=LD1[k];',
'   if(!(at>1e12)){LD1[k]=now;return}            /* no start time: start the clock now */',
'   if(now-at>STUCK){m.loading=false;m.lfail=true;delete LD1[k];ch=true}',
'  });',
'  if(ch)redrawRead(t);',
' }catch(e){}},8000)}catch(e){}',
'',
' /* ---- the memory guard must never leave a mail locked or spinning ---- */',
' try{',
'  if(typeof stripLoaded==="function"){',
'   var _slOL=stripLoaded;',
'   stripLoaded=function(t){',
'    try{((t&&t.msgs)||[]).forEach(function(m){',
'     if(!m)return;m.loading=false;m.lfail=false;',
'     if(m.gid){try{delete LD1[t.id+"|"+m.gid]}catch(e){}delete KICK[t.id+"|"+m.gid]}',
'    })}catch(e){}',
'    return _slOL.apply(this,arguments);',
'   };',
'  }',
' }catch(e){}',
'',
' /* ---- M1: folding a mail up frees what fetching it cost ---- */',
' function freeMsg(t,m){',
'  if(!m||!m.wasLight)return 0;',
'  if(!m.raw&&!m.html)return 0;',
'  var f=0;',
'  try{',
'   f=String(m.raw||"").length+String(m.html||"").length;',
'   delete m.raw;delete m.html;',
'   if(typeof m.body==="string"&&m.body.length>1500)m.body=m.body.slice(0,1500);',
'   m.full=false;m.light=true;m.loading=false;m.lfail=false;',
'   if(m.gid){try{delete RAWC[m.gid]}catch(e){}try{delete LD1[t.id+"|"+m.gid]}catch(e){}delete KICK[t.id+"|"+m.gid]}',
'  }catch(e){}',
'  return f>0?f:0;',
' }',
' /* after the app has folded it (this listener is registered later, so it runs after) */',
' try{document.addEventListener("click",function(e){',
'  var b=null;try{b=e.target.closest&&e.target.closest("[data-mtog],[data-mall]")}catch(x){}',
'  if(!b)return;',
'  setTimeout(function(){try{',
'   var t=thr();if(!t||!t.msgs)return;var os=openMsgs[t.id];if(!os)return;',
'   var f=0;t.msgs.forEach(function(m,i){if(!os.has(i))f+=freeMsg(t,m)});',
'   if(f>0){FREED+=f;redrawRead(t)}',
'  }catch(x){}},0);',
' })}catch(e){}',
'',
' /* paste  rzOpenMails()  into the browser console */',
' window.rzOpenMails=function(){',
'  var t=thr();if(!t)return "no conversation open";',
'  var os=openMsgs[t.id]||new Set();',
'  return {conversation:t.sub,mails:t.msgs.length,open:os.size,',
'   summaries:t.msgs.filter(function(m){return m&&m.light}).length,',
'   loadingNow:t.msgs.filter(function(m){return m&&m.loading}).length,',
'   failed:t.msgs.filter(function(m){return m&&m.lfail}).length,',
'   inFlightLocks:Object.keys(LD1).length,',
'   freedByFolding:Math.round(FREED/1024)+" KB"};',
' };',
'})();',
'/* __openmail19:end */<' + '/script>',
''
].join('\n');

s = s.replace(/\s*$/, '\n') + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  " + done + " edits + the start/finish/free block (" + n0 + " -> " + s.length + " chars)");
