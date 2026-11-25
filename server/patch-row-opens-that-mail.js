/* 25 Nov 2026 - two things reported on the mail list.

   (1) "I click the 5 Nov mail and it shows the latest one."
       Since 24 Nov every mail has its own row, but a row only carried the
       CONVERSATION id - and the reading pane always opens the newest message of a
       conversation (openMsgs starts as the last one). So clicking the 5 Nov row
       opened the right conversation with the wrong mail open, and the 5 Nov one
       folded away below. Now each row remembers WHICH mail it is, clicking it opens
       exactly that mail (fetching its full text if it has not been read from Gmail
       yet), scrolls to it and flashes it once. The trail is all still there - the
       other mails are folded above and below it, as before.

   (2) "On older dates show the time too."
       The row showed a time only for today and the last few days; anything older
       showed just "5 Nov". Every row now shows the time as well, and a mail from an
       earlier year shows the year.

   Run:  node server/patch-row-opens-that-mail.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
const done = [], skip = [];

/* ---- 1. each exploded row remembers its own message ---- */
(function () {
  if (s.includes("p._mi=")) { skip.push("row remembers its mail"); return; }
  const find = "p._one=true;out.push(p)";
  if (s.indexOf(find) < 0) throw new Error("explode() not found");
  if (s.indexOf(find) !== s.lastIndexOf(find)) throw new Error("explode() anchor is not unique");
  s = s.replace(find, "p._one=true;p._mi=t.msgs.indexOf(m);out.push(p)");
  done.push("row remembers its mail");
})();

/* ---- 2. the rest, as a layer on top ---- */
const block = String.raw`
<script>/* __rowmail:start  25 Nov 2026: a row opens ITS OWN mail, and every row shows the time */
/* the time on a row: today 10:42, yesterday "Yesterday 10:42", this week "Mon 10:42",
   older "5 Nov 10:42", an earlier year "5 Nov 2025 10:42" */
function rowTime(t0){
 const d=new Date(t0),tm=d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
 if(sod(t0)===sod(NOW))return tm;
 if(sod(t0)===sod(NOW)-D)return 'Yesterday '+tm;
 if(NOW-t0<6*D)return d.toLocaleDateString('en-IN',{weekday:'short'})+' '+tm;
 const sameYear=d.getFullYear()===new Date(NOW).getFullYear();
 return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',...(sameYear?{}:{year:'numeric'})})+' '+tm}
const _rhRow=rowHTML;
rowHTML=function(t){
 let h=_rhRow.apply(this,arguments);
 try{
  /* which mail is this row? (one row per mail since 24 Nov) */
  if(t&&t._mi!=null&&t._mi>=0)h=h.replace('data-open="','data-mi="'+t._mi+'" data-open="');
  /* show the time on every row, not only the recent ones */
  const when=(view.type==='box'&&view.folder==='sent')?lastOut(t):t.last;
  h=h.replace(/(<span class="time"[^>]*>)([\s\S]*?)(<\/span>)/,(m0,a,b,c)=>a+esc(rowTime(when))+c);
 }catch(e){}
 return h};
/* a click on a row: remember which mail was clicked, before the app's own handler runs */
let WANT_MI=null;
document.addEventListener('click',e=>{
 try{
  const b=e.target.closest('[data-open][data-mi]');
  if(!b||e.target.closest('.qa'))return;
  WANT_MI={id:idv(b.dataset.open),mi:+b.dataset.mi};
 }catch(x){}
},true);
document.addEventListener('keydown',e=>{
 try{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const b=e.target&&e.target.closest&&e.target.closest('[data-open][data-mi]');
  if(!b)return;
  WANT_MI={id:idv(b.dataset.open),mi:+b.dataset.mi};
 }catch(x){}
},true);
const _openRow=open;
open=function(id){
 let want=null;
 if(WANT_MI&&WANT_MI.id===id)want=WANT_MI.mi;
 WANT_MI=null;
 const t=T_(id);
 if(t&&want!=null&&t.msgs&&t.msgs[want]){
  openMsgs[id]=new Set([want]);          /* open the mail that was clicked, not the newest */
 }
 const r=_openRow.apply(this,arguments);
 if(t&&want!=null&&t.msgs&&t.msgs[want]){
  try{if(t.msgs[want].light)openLight(t,[t.msgs[want]])}catch(e){}   /* not read from Gmail yet */
  setTimeout(()=>{try{
   const a=document.getElementById('msg-'+id+'-'+want),box=a&&a.closest('.rbody');
   if(!a)return;
   if(box){let y=0,n=a;while(n&&n!==box){y+=n.offsetTop;n=n.offsetParent}if(n!==box)y=a.offsetTop-box.offsetTop;
    box.scrollTo({top:Math.max(0,y-12),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
   a.classList.remove('flash');void a.offsetWidth;a.classList.add('flash');
  }catch(e){}},40);
 }
 return r};
/* __rowmail:end */</script>`;

if (s.includes("__rowmail:start")) skip.push("row/time layer");
else { s = s.replace(/\s*$/, "") + "\n" + block + "\n"; done.push("row/time layer"); }

fs.writeFileSync(file, s);
console.log("patched .tmp/email.html");
console.log("  applied:      ", done.join(", ") || "(nothing)");
console.log("  already there:", skip.join(", ") || "(none)");
