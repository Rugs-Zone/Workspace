/* patch-page-memory.js — 26 Nov 2026
 *
 * "You again increase the page memory more than 250 mb fix it now."
 *
 * WHAT WAS ACTUALLY HOLDING THE MEMORY (read out of the app, not guessed):
 *
 *   RAWC   {}  (line ~1849) every mail ever opened in this session, keyed by Gmail id,
 *              as {raw, body}. `raw` is the mail's own HTML - and since 18 Nov the pasted
 *              (cid:) pictures are written INTO it as data: URLs (line ~1945), which are
 *              real screenshots of 0.3-1.6 MB each. A 20-mail claim trail can carry 60 of
 *              them. Nothing ever removed an entry.
 *   ATTB   {}  (line ~3044) every attachment fetched in this session, as a promise of its
 *              base64 bytes - up to 25 MB per file. Never removed.
 *   ATHUMB {}  (line ~4301) every attachment thumbnail as a data: URL. Never removed.
 *   RHC    Map (line ~6078) a row's finished HTML, capped at 6000 entries - about 12 MB,
 *              and 6000 is far more than the ~450 rows that are ever drawn.
 *
 * So the page grew for as long as somebody kept working, which is exactly what was seen.
 * Turning per-mail rows on (build -17) multiplied the row objects and the row-HTML cache
 * on top of that, which is what tipped it over today.
 *
 * THE FIX: a byte budget per store, swept after a draw (at most once every 5 seconds) and
 * evicting oldest-first. Nothing that is on screen is ever evicted - the open
 * conversation's own mails are pinned. An evicted mail is simply fetched again when it is
 * next opened, which is what the app did before the cache existed.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-page-memory.js
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

/* 1. record each attachment's size when it arrives, so the sweeper can measure ATTB.
      (the value is a promise, so its size cannot be read synchronously) */
one(
  " return ATTB[k]=attCacheGet(box,gid,name).then(hit=>hit||api('attachment',{mailbox:box,gmailId:gid,name})",
  " /* __mem 26 Nov 2026: remember how big it was, for the memory sweeper */\n"
  + " return ATTB[k]=attCacheGet(box,gid,name).then(hit=>hit||api('attachment',{mailbox:box,gmailId:gid,name})",
  "ATTB - note where the size is recorded"
);
one(
  "  .catch(e=>{delete ATTB[k];throw e})}",
  "  .then(r=>{try{ATT_SZ[k]=((r&&(r.b64||r.data))||'').length||0}catch(e){}return r})\n"
  + "  .catch(e=>{delete ATTB[k];delete ATT_SZ[k];throw e})}",
  "ATTB - record the size on arrival"
);

/* 2. the row-HTML cache: 6000 entries is ~12 MB for a list that draws ~450 rows */
one(
  " if(key){if(RHC.size>6000)RHC.clear();RHC.set(key,h)}",
  " if(key){if(RHC.size>1200)RHC.clear();RHC.set(key,h)}   /* __mem: 6000 was ~12 MB; only ~450 rows are ever drawn */",
  "RHC - 6000 entries down to 1200"
);

/* 3. the sweeper itself */
const BLOCK = `
<script>/* __mem:start 26 Nov 2026 — keep the page's memory bounded. server/patch-page-memory.js */

/* Budgets, in bytes. A data: URL and a base64 string are plain ASCII, so a string's
   length is its size. Sized for the office PCs (4 GB, several tabs open all day). */
const MEM_RAWC   = 40*1024*1024;   /* opened mail, with its pasted pictures */
const MEM_ATTB   = 25*1024*1024;   /* attachment bytes fetched this session */
const MEM_THUMB  =  8*1024*1024;   /* attachment thumbnails */
const MEM_EVERY  = 5000;           /* sweep at most this often (ms) */
const ATT_SZ={};                   /* ATTB key -> bytes, filled when the file arrives */
let MEM_AT=0, MEM_LAST={};

/* the Gmail ids of the conversation on screen - never evicted */
function memPinned(){
 const keep={};
 try{
  const t=(typeof openId!=='undefined'&&openId&&typeof T_==='function')?T_(openId):null;
  ((t&&t.msgs)||[]).forEach(m=>{if(m&&m.gid)keep[m.gid]=1});
 }catch(e){}
 return keep;
}

/* Evict oldest-first until the store is inside its budget. Object keys keep their
   insertion order, so the oldest entry is simply the first key. */
function memTrim(store,budget,sizeOf,pinned){
 let total=0,keys;
 try{keys=Object.keys(store)}catch(e){return 0}
 for(let i=0;i<keys.length;i++)total+=sizeOf(store[keys[i]],keys[i]);
 if(total<=budget)return 0;
 let freed=0;
 for(let i=0;i<keys.length&&total>budget;i++){
  const k=keys[i];
  if(pinned&&pinned[k])continue;
  const sz=sizeOf(store[k],k);
  delete store[k];
  if(store===ATTB)delete ATT_SZ[k];
  total-=sz;freed+=sz;
 }
 return freed;
}

function memSweep(force){
 const now=Date.now();
 if(!force&&now-MEM_AT<MEM_EVERY)return;
 MEM_AT=now;
 try{
  const pin=memPinned();
  const f1=memTrim(RAWC,MEM_RAWC,v=>v?((v.raw||'').length+(v.body||'').length):0,pin);
  const f2=memTrim(ATTB,MEM_ATTB,(v,k)=>ATT_SZ[k]||0,null);
  const f3=memTrim(ATHUMB,MEM_THUMB,v=>String(v||'').length,null);
  if(f1||f2||f3)MEM_LAST={at:now,mail:f1,files:f2,thumbs:f3};
 }catch(e){}
}

/* run it after a draw, and once a minute even if nobody is clicking */
const _rdMem=render;
render=function(){const r=_rdMem.apply(this,arguments);try{memSweep()}catch(e){}return r};
try{setInterval(()=>{try{memSweep(true)}catch(e){}},60000)}catch(e){}

/* what the page is holding right now, for checking on a real screen:
   paste  rzMem()  into the browser console */
window.rzMem=function(){
 const mb=n=>Math.round(n/104857.6)/10+' MB';
 let mail=0,files=0,thumbs=0,rows=0;
 try{Object.keys(RAWC).forEach(k=>{const v=RAWC[k];mail+=((v&&v.raw)||'').length+((v&&v.body)||'').length})}catch(e){}
 try{Object.keys(ATT_SZ).forEach(k=>{files+=ATT_SZ[k]||0})}catch(e){}
 try{Object.keys(ATHUMB).forEach(k=>{thumbs+=String(ATHUMB[k]||'').length})}catch(e){}
 try{RHC.forEach(v=>{rows+=String(v||'').length})}catch(e){}
 return {openedMail:mb(mail),attachments:mb(files),thumbnails:mb(thumbs),rowHtml:mb(rows),
  total:mb(mail+files+thumbs+rows),conversations:(S.threads||[]).length,lastSweep:MEM_LAST};
};
/* __mem:end */</script>
`;

if (s.indexOf("__mem:start") >= 0) {
  console.log("already done: the sweeper block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  n++;
  console.log("patched: the sweeper block appended");
}

fs.writeFileSync(F, s);
console.log("\n" + n + " edit(s) written to " + F);
