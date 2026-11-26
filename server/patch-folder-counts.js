/* patch-folder-counts.js - 27 Nov 2026  (bug 10 - folder counts, like Outlook)
 *
 * Only the Inbox had a count (and Drafts its own number). Archive, Junk, Deleted and a
 * person's own folders had nothing at all, so nobody could tell that something unread was
 * waiting in one of them.
 *
 *   1  every folder row shows the number of UNREAD mails for THIS user - Inbox, Archive,
 *      Junk, Deleted, "All inboxes", the shared mailboxes and the person's own folders -
 *      hidden when it is 0. The Inbox number is still inboxUnreadN(), the one all five
 *      Inbox counts already use, and the other folders use the same test with the folder
 *      swapped (unread + received + seeMine + not before Go live + not a Workspace
 *      notification), so no R-rule changes and Switch ID is followed, because every one of
 *      those rules is asked as ME.
 *   2  a folder holding mail that arrived since the folder was last opened has its NAME in
 *      bold, and it goes back to normal the moment the folder is opened.
 *   3  the numbers are worked out ONCE per change (keyed on the same fingerprint the rest
 *      of the app uses) and then painted into the rows that are already on the screen, so a
 *      poll, a move, Mark read or Mark unread only rewrites the numbers.
 *   4  Junk and Deleted show their number in grey and not bold - they are not work.
 *
 * Favourites (My work, Needs owner, Late, Flagged, Critical) KEEP their own count, which is
 * the size of that list and is what the Home numbers agree with; they only go bold when the
 * list holds unread mail. Turning them into unread-only counts would make "Needs owner 11"
 * read "Needs owner 2" and disagree with Home - say the word if that is really wanted.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-folder-counts.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

["function renderFolders(", "function inboxUnreadN(", "function mailFp(", "myFolders=()=>", "function mobilePicker("]
  .forEach(k => { if (s.indexOf(k) < 0) throw new Error("the app does not contain: " + k); });

const END = "/* __folcount:end */</scr" + "ipt>";

const BLOCK = `
<script>/* __folcount:start 27 Nov 2026 - server/patch-folder-counts.js (bug 10) */
/* Outlook-style counts on every folder. The numbers are painted into the rows that are
   already drawn, so nothing else is rebuilt; and they are worked out once per change. */
let FCC=null,FCK='';                      /* the counts, and the fingerprint they belong to */
const FCSEEN={};                          /* folder key -> when it was last opened here */
const FC_GREY={junk:1,deleted:1,purged:1};

/* unread mail in a folder, counted exactly as the Inbox counts it, with the folder swapped.
   Every rule is asked as ME, so a Switch ID session counts as that person. */
function fcUnread(t,f){
 try{
  if(!t||!t.unread)return false;
  if(String(t.folder||'inbox')!==f)return false;
  if(!inScope(t))return false;                                  /* a mailbox I may open */
  if(typeof hasRecv==='function'&&!hasRecv(t))return false;      /* something somebody sent us */
  if(typeof isWsNotif==='function'&&isWsNotif(t))return false;   /* Workspace notifications */
  if(typeof beforeLive==='function'&&beforeLive(t))return false; /* the Go-live tick */
  if(typeof seeMine==='function'&&!seeMine(t))return false;      /* R1 / R3, unchanged */
  return true;
 }catch(e){return false}
}
/* ONE pass over the mail for every folder on the pane */
function fcCounts(){
 let k;try{k=mailFp()+'|'+ME+'|'+(typeof dashAs==='undefined'?'':dashAs||'')}catch(e){k='x'+Math.random()}
 if(FCC&&k===FCK)return FCC;
 const c={},at=(key)=>c[key]||(c[key]={n:0,newest:0});
 const mine={};try{myFolders().forEach(f=>{mine[f]=1})}catch(e){}
 const favU={crit:0,mine:0,needs:0,late:0,flag:0};
 (S.threads||[]).forEach(t=>{
  if(!t||!t.unread)return;
  const f=String(t.folder||'inbox');
  /* the folders of a mailbox, and the person's own folders */
  if(fcUnread(t,f)){
   const o=at(mine[f]?('u|'+f):('b|'+t.dept+'|'+f));o.n++;if((t.last||0)>o.newest)o.newest=t.last||0;
   if(f==='inbox'){const a=at('all');a.n++;if((t.last||0)>a.newest)a.newest=t.last||0}
  }
  /* ...and whether a favourite list is holding unread mail (same tests renderFolders uses) */
  try{
   if(inScope(t)&&f!=='deleted'&&st(t)!=='done'&&critOf(t).length)favU.crit++;
   if(t.owner===ME&&st(t)!=='done'&&hasRecv(t))favU.mine++;
   if(inScope(t)&&!t.owner&&f==='inbox'&&t.status!=='done'&&isWork(t))favU.needs++;
   if(inScope(t)&&st(t)==='late')favU.late++;
   if(inScope(t)&&t.flag)favU.flag++;
  }catch(e){}
 });
 FCK=k;FCC={box:c,fav:favU};return FCC;
}
/* what is this folder row? */
function fcKeyOf(el){
 try{
  if(el.hasAttribute('data-allbox'))return {key:'all',grey:false,skip:false};
  if(el.hasAttribute('data-userf'))return {key:'u|'+el.getAttribute('data-userf'),grey:false,skip:false};
  if(el.hasAttribute('data-box')&&el.hasAttribute('data-f')){
   const f=el.getAttribute('data-f');
   if(f==='drafts')return null;                        /* Drafts keeps its own number */
   return {key:'b|'+el.getAttribute('data-box')+'|'+f,grey:!!FC_GREY[f],skip:false,dept:el.getAttribute('data-box'),f:f};
  }
  if(el.hasAttribute('data-box'))return {key:'b|'+el.getAttribute('data-box')+'|inbox',grey:false,dept:el.getAttribute('data-box'),f:'inbox'};
 }catch(e){}
 return null;
}
/* which folder is open right now? (so its name stops being bold) */
function fcOpenKey(){
 try{
  if(app!=='mail')return '';
  if(view.type==='all')return 'all';
  if(view.type==='folder')return 'u|'+view.folder;
  if(view.type==='box')return 'b|'+view.dept+'|'+view.folder;
 }catch(e){}
 return '';
}
function fcPaint(){
 const F=document.getElementById('folders');if(!F)return;
 /* a paint reads the mail as it is NOW, so it starts a fresh pass - otherwise the per-pass
    memo of seeMine / isInboxMail could answer from before a move or a Mark read that
    happened without a redraw (which is the whole point of painting). */
 try{PASS++}catch(e){}
 const C=fcCounts(),now=Date.now(),open=fcOpenKey();
 if(open)FCSEEN[open]=now;                          /* looking at it counts as opening it */
 F.querySelectorAll('.fi').forEach(el=>{
  /* a favourite keeps its own count; only its name says whether something is unread */
  const fav=el.getAttribute('data-fav');
  if(fav!=null){el.classList.toggle('fcnew',!!C.fav[fav]);return}
  if(el.hasAttribute('data-lbside'))return;          /* a topic has its own number */
  const k=fcKeyOf(el);if(!k)return;
  const o=C.box[k.key]||{n:0,newest:0};
  /* the Inbox number stays the one every other Inbox count uses */
  let n=o.n;
  try{if(k.f==='inbox'&&k.dept)n=inboxUnreadN(k.dept);else if(k.key==='all')n=inboxUnreadN()}catch(e){}
  let c=el.querySelector('.c');
  if(n){
   if(!c){c=document.createElement('span');c.className='c';el.appendChild(c)}
   const txt=n>999?Math.floor(n/1000)+'k':String(n);
   if(c.textContent!==txt)c.textContent=txt;
   c.classList.toggle('fcg',!!k.grey);
   c.classList.toggle('fcb',!k.grey);
   c.title=n.toLocaleString('en-IN')+' unread';
  }else if(c&&!c.classList.contains('hot')){c.remove()}
  /* 2 · bold while something has arrived that the folder has not been opened on since */
  const fresh=n>0&&o.newest>(FCSEEN[k.key]||0)&&k.key!==open;
  el.classList.toggle('fcnew',!!fresh);
 });
}
const _rfFC=renderFolders;
renderFolders=function(){const r=_rfFC.apply(this,arguments);try{fcPaint()}catch(e){}return r};
/* a poll, a move, Mark read / Mark unread: the pane is not rebuilt, only the numbers */
const _rdFC=render;render=function(){const r=_rdFC.apply(this,arguments);try{fcPaint()}catch(e){}return r};

/* on a phone the folder pane is hidden and the picker is all there is, so put the count in it */
const _mpFC=mobilePicker;
mobilePicker=function(){
 let h=_mpFC.apply(this,arguments);
 try{
  const C=fcCounts();
  h=h.replace(/<option value="([^"]+)"([^>]*)>([^<]*)<\\/option>/g,(m0,v,rest,lbl)=>{
   let n=0;
   const p=String(v).split(':');
   if(p[0]==='box'){const f=p[2];if(f!=='drafts'){const o=C.box['b|'+p[1]+'|'+f];n=(f==='inbox')?inboxUnreadN(p[1]):(o?o.n:0)}}
   return '<option value="'+v+'"'+rest+'>'+lbl+(n?' ('+n+')':'')+'</option>';
  });
 }catch(e){}
 return h};

/* ------------------------------------------------------------------ CSS --- */
(function fcCSS(){
 if(document.getElementById('fcCSS'))return;
 const st=document.createElement('style');st.id='fcCSS';
 st.textContent=[
  '#folders .fi .c.fcb{font-weight:800;color:var(--fg)}',                 /* 1 · unread, bold */
  '#folders .fi .c.fcg{font-weight:500;color:var(--muted)}',              /* 4 · Junk / Deleted, grey */
  '#folders .fi.fcnew .lbl{font-weight:800;color:var(--fg)}',             /* 2 · new mail in it */
  '.mpick{max-width:100%;min-width:0}'          /* the counts make the options longer */
 ].join('');
 document.head.appendChild(st);
})();
${END}
`;

const a = s.indexOf("<script>/* __folcount:start");
if (a >= 0) {
  const b = s.indexOf(END, a);
  if (b < 0) throw new Error("the old __folcount block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + END.length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

/* ---- found while testing this, and fixed here because it is one line: DARK MODE ----
   The 26 Nov contrast block sets ':root{--fg:#0b0a09!important}' for the darker light-mode
   text, but its two dark-mode overrides carry no !important - so in dark mode --fg stayed
   the light near-black and every count, name and subject was near-black on a near-black
   page. The test measured the same colour in both themes, which is what gave it away. */
const DARK_OLD = "'@media (prefers-color-scheme: dark){:root:not([data-theme=\"light\"]){--fg:#f2eeeb;--muted:#9c948e}}' +\n  ':root[data-theme=\"dark\"]{--fg:#f2eeeb;--muted:#9c948e}' +";
const DARK_NEW = "'@media (prefers-color-scheme: dark){:root:not([data-theme=\"light\"]){--fg:#f2eeeb!important;--muted:#9c948e!important}}' +\n  ':root[data-theme=\"dark\"]{--fg:#f2eeeb!important;--muted:#9c948e!important}' +   /* __folcountdark: the light-mode override above is !important, so these must be too */";
if (s.indexOf("__folcountdark") >= 0) console.log("  dark mode: already fixed");
else if (s.indexOf(DARK_OLD) < 0) throw new Error("the 26 Nov contrast block is not where it was");
else { s = s.split(DARK_OLD).join(DARK_NEW); console.log("  dark mode: the two overrides now win (they lacked !important)"); }

fs.writeFileSync(F, s);
console.log("written to " + F);
