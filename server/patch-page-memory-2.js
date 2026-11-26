/* patch-page-memory-2.js — 26 Nov 2026
 *
 * "Reduce the memory usage of page under 250 mb"
 *
 * patch-page-memory.js capped three caches, but it could not have been enough, and this is
 * why: the full mail is NOT only in the RAWC cache. When a mail is loaded the app writes it
 * onto the MESSAGE OBJECT itself -
 *
 *     x.raw = fixMailImgs(m.body_html||'');   x.body = m.body_text;   (lines ~1889, ~1980)
 *     RAWC[m.gmail_id] = {raw:x.raw, body:x.body}                     (the same strings)
 *     x.raw = nh                                                      (~1945: the pasted
 *                                                                      screenshots are
 *                                                                      written INTO it as
 *                                                                      data: URLs)
 *
 * - so the heavy text hangs off S.threads, which lives for the whole session. Emptying RAWC
 * freed nothing while the conversation objects still pointed at the same strings.
 *
 * This patch therefore:
 *   1. gives the loaded mail ON the conversations its own budget, and strips it from the
 *      conversations that were opened longest ago (oldest first, never the one on screen,
 *      never the last three looked at). A stripped conversation keeps its preview, goes back
 *      to t.full=false, and is fetched again when it is next opened - which is exactly what
 *      the app did before any of it was cached;
 *   2. lowers the three caps from last night, now that the real store is handled;
 *   3. caps PRE_B64 - compose attachments encoded while the mail is being written (base64,
 *      so a third bigger than the files). It was never emptied, so every mail written in a
 *      session stayed in memory;
 *   4. reports the lot in rzMem(), with rzMemTrim() to force a sweep.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-page-memory-2.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
let n = 0;

function one(old, neu, what) {
  const hits = s.split(old).length - 1;
  if (hits === 0) {
    if (s.indexOf(neu) >= 0) { console.log("already done: " + what); return; }
    throw new Error("NOT FOUND: " + what);
  }
  if (hits > 1) throw new Error("found " + hits + " times, expected 1: " + what);
  s = s.replace(old, neu);
  n++;
  console.log("patched: " + what);
}

/* ---- 1. tighter budgets than last night ---- */
one(
  "const MEM_RAWC   = 40*1024*1024;   /* opened mail, with its pasted pictures */",
  "const MEM_RAWC   = 15*1024*1024;   /* opened mail, with its pasted pictures */",
  "cache of opened mail 40 MB -> 15 MB"
);
one(
  "const MEM_ATTB   = 25*1024*1024;   /* attachment bytes fetched this session */",
  "const MEM_ATTB   = 10*1024*1024;   /* attachment bytes fetched this session */",
  "attachments 25 MB -> 10 MB"
);
one(
  "const MEM_THUMB  =  8*1024*1024;   /* attachment thumbnails */",
  "const MEM_THUMB  =  4*1024*1024;   /* attachment thumbnails */",
  "thumbnails 8 MB -> 4 MB"
);
one(
  " if(key){if(RHC.size>1200)RHC.clear();RHC.set(key,h)}   /* __mem: 6000 was ~12 MB; only ~450 rows are ever drawn */",
  " if(key){if(RHC.size>600)RHC.clear();RHC.set(key,h)}   /* __mem2: ~450 rows are ever drawn */",
  "row HTML 1200 -> 600 entries"
);

/* ---- 2. the real store ---- */
const BLOCK = `
<script>/* __mem2:start 26 Nov 2026 — the loaded mail on the conversations themselves.
   server/patch-page-memory-2.js */

const MEM_LOADED = 35*1024*1024;   /* full mail held on S.threads, with its pictures */
const MEM_PREB64 = 15*1024*1024;   /* compose attachments, already encoded */
const MEM_KEEP   = 3;              /* the last N conversations looked at are never stripped */

/* when each conversation was last opened, so the oldest goes first */
const _opSeen=open;
open=function(id){try{const t=(typeof T_==='function')?T_(id):null;if(t)t._seenAt=Date.now()}catch(e){}
 return _opSeen.apply(this,arguments)};

function msgBytes(m){try{return ((m&&m.raw)||'').length+((m&&m.body)||'').length+((m&&m.html)||'').length}catch(e){return 0}}
function loadedBytes(t){let b=0;try{((t&&t.msgs)||[]).forEach(m=>{if(m&&(m.raw||m.html))b+=msgBytes(m)})}catch(e){}return b}

/* Put a conversation back to "not loaded": the preview stays, the heavy text goes, and
   opening it fetches it again (t.full=false is the app's own flag for that). */
function stripLoaded(t){
 let freed=0;
 try{
  ((t&&t.msgs)||[]).forEach(m=>{
   if(!m)return;
   freed+=msgBytes(m);
   if(m.raw)delete m.raw;
   if(m.html)delete m.html;
   if(m.trail)delete m.trail;
   if(typeof m.body==='string'&&m.body.length>1500)m.body=m.body.slice(0,1500);
   m.full=false;
   try{if(m.gid&&RAWC[m.gid])delete RAWC[m.gid]}catch(e){}
   freed-=msgBytes(m);
  });
  t.full=false;
  try{if(typeof LD!=='undefined'&&LD&&LD[t.id])delete LD[t.id]}catch(e){}
 }catch(e){}
 return freed>0?freed:0;
}

function memTrimLoaded(){
 try{
  const list=(typeof S!=='undefined'&&S.threads)||[];
  let total=0;const cand=[];
  for(let i=0;i<list.length;i++){
   const t=list[i],b=loadedBytes(t);
   if(b>0){total+=b;cand.push({t:t,b:b,at:t._seenAt||0})}
  }
  if(total<=MEM_LOADED)return 0;
  cand.sort((a,b)=>a.at-b.at);                      /* longest ago first */
  const keep={};
  cand.slice(-MEM_KEEP).forEach(c=>{keep[c.t.id]=1});   /* the last few looked at */
  try{if(typeof openId!=='undefined'&&openId)keep[openId]=1}catch(e){}
  let freed=0;
  for(let i=0;i<cand.length&&total>MEM_LOADED;i++){
   const c=cand[i];
   if(keep[c.t.id])continue;
   const f=stripLoaded(c.t);
   total-=f;freed+=f;
  }
  return freed;
 }catch(e){return 0}
}

function memTrimCompose(){
 try{
  if(typeof PRE_B64==='undefined'||!PRE_B64||!PRE_B64.size)return 0;
  let total=0;const keys=[];
  PRE_B64.forEach((v,k)=>{keys.push(k);total+=(v&&v.__len)||0});
  if(total<=MEM_PREB64)return 0;
  let freed=0;
  for(let i=0;i<keys.length&&total>MEM_PREB64;i++){
   const v=PRE_B64.get(keys[i]),sz=(v&&v.__len)||0;
   PRE_B64.delete(keys[i]);total-=sz;freed+=sz;
  }
  return freed;
 }catch(e){return 0}
}

/* hang the two new sweeps off the one from last night */
const _msBase=memSweep;
memSweep=function(force){
 const now=Date.now();
 const due=force||!window.__memAt||now-window.__memAt>=5000;
 _msBase.apply(this,arguments);
 if(!due)return;
 window.__memAt=now;
 try{
  const f1=memTrimLoaded(),f2=memTrimCompose();
  if(f1||f2)window.__memFreed={at:now,mailOnList:f1,composeFiles:f2};
 }catch(e){}
};

/* what the page is holding right now. In the browser console: rzMem() */
window.rzMem=function(){
 const mb=x=>Math.round(x/104857.6)/10;
 let onList=0,cache=0,files=0,thumbs=0,rows=0,pre=0,loadedConvs=0;
 try{((S&&S.threads)||[]).forEach(t=>{const b=loadedBytes(t);if(b){onList+=b;loadedConvs++}})}catch(e){}
 try{Object.keys(RAWC).forEach(k=>{const v=RAWC[k];cache+=((v&&v.raw)||'').length+((v&&v.body)||'').length})}catch(e){}
 try{Object.keys(ATT_SZ).forEach(k=>{files+=ATT_SZ[k]||0})}catch(e){}
 try{Object.keys(ATHUMB).forEach(k=>{thumbs+=String(ATHUMB[k]||'').length})}catch(e){}
 try{RHC.forEach(v=>{rows+=String(v||'').length})}catch(e){}
 try{PRE_B64.forEach(v=>{pre+=(v&&v.__len)||0})}catch(e){}
 /* the cache and the conversations share the same text, so they are counted once */
 return {
  mailLoaded:mb(onList)+' MB in '+loadedConvs+' conversations',
  attachments:mb(files)+' MB', thumbnails:mb(thumbs)+' MB',
  rowHtml:mb(rows)+' MB', composeFiles:mb(pre)+' MB',
  heldByRugsEmail:mb(onList+files+thumbs+rows+pre)+' MB',
  conversations:((S&&S.threads)||[]).length,
  lastSweep:window.__memFreed||'nothing to free yet',
  note:'the browser\\'s own use (page, pictures on screen, Chrome itself) is on top of this'
 };
};
window.rzMemTrim=function(){memSweep(true);return window.rzMem()};
/* __mem2:end */</script>
`;

if (s.indexOf("__mem2:start") >= 0) {
  console.log("already done: the loaded-mail sweeper");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  n++;
  console.log("patched: the loaded-mail sweeper appended");
}

/* ---- 3. remember how big each encoded compose attachment is ---- */
one(
  "function preRead(f){ const k = preKey(f); if(!PRE_B64.has(k)) PRE_B64.set(k, fileB64(f).catch(()=>null)); return PRE_B64.get(",
  "function preRead(f){ const k = preKey(f); if(!PRE_B64.has(k)) PRE_B64.set(k, fileB64(f)"
  + ".then(r=>{try{const p=PRE_B64.get(k);if(p)p.__len=String((r&&(r.b64||r))||'').length}catch(e){}return r})"
  + ".catch(()=>null)); return PRE_B64.get(",
  "compose attachments - record the encoded size"
);

/* the sweeper reads window.__memAt, so last night's throttle must use it too */
one(
  "let MEM_AT=0, MEM_LAST={};",
  "let MEM_AT=0, MEM_LAST={};\ntry{window.__memAt=0}catch(e){}",
  "share the sweep clock with the second sweeper"
);

fs.writeFileSync(F, s);
console.log("\n" + n + " edit(s) written to " + F);
