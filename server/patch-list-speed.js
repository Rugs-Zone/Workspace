/* 25 Nov 2026 - "why did Rugs Email get slower?"

   Measured in a real browser on a 1,086-conversation mailbox before changing anything:

       rows the list builds        3,041   (one row per MAIL since 24 Nov)
       the same, grouped             660   (one row per conversation, as before)
       listRows()                 62.4 ms  vs 18.7 ms grouped
       rowHTML() per 100 rows    140.1 ms  (1.4 ms a row)

   So two things got heavier when every mail became its own row: the list is sorted
   over five times as many rows, and five times as many rows are candidates for
   drawing. Both run again on EVERY redraw - and the app redraws on the 15-second
   check, on every click, on hover of a row's buttons and when the list grows. On a
   real mailbox (Team Pulse has thousands of conversations) that is most of a second
   of work, again and again, for a list that usually has not changed at all.

   The fix is to stop recomputing what has not changed. Nothing about the list's
   behaviour changes:

     1  a cheap fingerprint of the mail (length, and each conversation's date, owner,
        unread, flag, status, folder and message count - about 0.2 ms for a thousand
        conversations, against 62 ms to rebuild the list) says whether anything the
        list depends on has moved.
     2  the built row list is reused only while that fingerprint AND the mailbox,
        folder, tab, filter, search text and View settings are all unchanged, with a
        one-second limit as a backstop.
     3  each row's HTML is remembered under a key holding everything that row shows,
        and the whole lot is dropped the moment the fingerprint changes.

   A copy of the list is handed out, never the remembered array itself, so a caller
   that sorts or filters it cannot corrupt the cache.

   Note save() cannot be wrapped (it is a const arrow), which is why this works from
   a fingerprint rather than a change counter.

   Run:  node server/patch-list-speed.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__listspeed:start")) { console.log("already there - nothing changed"); process.exit(0); }
if (!s.includes("__rowmail:start")) throw new Error("run node server/patch-row-opens-that-mail.js first");

const block = String.raw`
<script>/* __listspeed:start  25 Nov 2026: a redraw stops rebuilding a list that has not changed */
/* has anything the list depends on moved? (cheap: a few numbers per conversation) */
function mailFp(){
 try{
  const a=S.threads;let h=a.length|0;
  for(let i=0;i<a.length;i++){const t=a[i];
   h=(h*31+(t.last|0))|0;
   h=(h*31+((t.unread?1:0)+(t.flag?2:0)+(t.pinned?4:0)))|0;
   h=(h*31+(t.status?t.status.charCodeAt(0):0))|0;
   h=(h*31+(t.folder?t.folder.charCodeAt(0):0))|0;
   h=(h*31+(t.owner?t.owner.length*7+t.owner.charCodeAt(0):0))|0;
   h=(h*31+((t.msgs&&t.msgs.length)||0))|0}
  return h;
 }catch(e){return Math.random()}
}
function listKey(){
 try{
  const v=LV(),q=document.getElementById('q');
  return [mailFp(),view.type,view.dept||'',view.folder||'',view.id||'',view.key||'',
   tab,filt,lfilt||'',q?q.value:'',dashAs||'',ME,
   v.sort,v.dir,v.vf,v.conv?1:0].join('|');
 }catch(e){return 'x'+Math.random()}
}
let LRC={k:'',at:0,rows:null};
const _lrSpd=listRows;
listRows=function(){
 const k=listKey(),now=Date.now();
 if(LRC.rows&&LRC.k===k&&now-LRC.at<1000)return LRC.rows.slice();
 const rows=_lrSpd.apply(this,arguments);
 LRC={k:k,at:now,rows:rows};
 return rows.slice()};
/* each row's HTML, dropped as soon as the mail changes */
const RHC=new Map(); let RHF=null;
const _rhSpd=rowHTML;
rowHTML=function(t){
 const fp=mailFp();
 if(RHF!==fp){RHC.clear();RHF=fp}
 let key=null;
 try{key=[t.id,t._mi==null?'':t._mi,view.type,view.folder||'',view.dept||'',
  openId===t.id?1:0,t.unread?1:0,st(t),t.owner||'',t.flag?1:0,t.folder||'',t.last,
  t.att||'',t.promise||'',t.due||'',t.topic||'',t.for_owner||'',
  (t.cats||[]).join(','),(t.hist||[]).length,(t.msgs||[]).length].join('|')}catch(e){key=null}
 if(key){const hit=RHC.get(key);if(hit!==undefined)return hit}
 const h=_rhSpd.apply(this,arguments);
 if(key){if(RHC.size>6000)RHC.clear();RHC.set(key,h)}
 return h};
/* __listspeed:end */</script>`;

s = s.replace(/\s*$/, "") + "\n" + block + "\n";
fs.writeFileSync(file, s);
console.log("patched .tmp/email.html - the list and the rows are no longer rebuilt when nothing changed");
