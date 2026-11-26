/* patch-show-in-folder.js - 27 Nov 2026  (bug 9 - "Show in Inbox" from a quoted mail)
 *
 * People read a mail inside "Mail trail - N earlier mails" and then want the mail ITSELF:
 * its own row in their mailbox, so they can see its tags, its folder and what happened to
 * it. There was no way there at all.
 *
 *   1  every mail inside "Mail trail" gets its own ... button, and every mail drawn in the
 *      reading pane (so also the ones "Show all N mails" opens) gets one more item in its
 *      ... More menu: "Show in <folder>" - the folder that mail's row really lives in
 *      (Inbox, Sent, Archive, Junk, Deleted or one of the person's own folders)
 *   2  the quoted mail is matched to a real message: Message-ID first when both sides have
 *      one, otherwise the same sender + the same minute (2 minutes either way) + the same
 *      subject. The mail already loaded in this browser is searched first; if nothing
 *      matches, the SERVER is asked (the find action, by sender / subject / a window round
 *      that time) and the answer is merged in before trying again
 *   3  found: it switches to that folder, clears the search box, the chips, the topic filter
 *      and the View menu's own Show filter (all of which could hide it), grows the 150-row
 *      draw window until the row is really drawn, scrolls it into the middle, flashes it for
 *      3 seconds and leaves it selected. It does NOT open it
 *   4  nothing is ever silent: "Only quoted here - this mail never came to this mailbox",
 *      "This mail belongs to <name>" (R3 is untouched) or "Not in your mailboxes"
 *   5  keyboard and phone width work: the ... is a real button, the menu is the app's own
 *      .cmenu (so Escape, the arrow keys and a click outside all behave), the row is
 *      focused when it is found, and on a phone the reading pane is left so the list shows
 *
 * No ownership rule changes: R3 (a taken conversation is private) and R15 (a member sees
 * only his own mail in Sent) are ASKED, never bent - if they hide the mail, that is the
 * message the person gets.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-show-in-folder.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

["function trailHTML(", "function cmOpen(", "data-olkmore", "function listMore()", "function mergeList(", "recvMsg=(m,t)=>"]
  .forEach(k => { if (s.indexOf(k) < 0) throw new Error("the app does not contain: " + k); });

const END = "/* __showin:end */</scr" + "ipt>";

const BLOCK = `
<script>/* __showin:start 27 Nov 2026 - server/patch-show-in-folder.js (bug 9) */
/* From a mail quoted in "Mail trail - N earlier mails" (or from any mail drawn in the
   reading pane) go to that mail's OWN row in the mailbox. Nothing here changes who may see
   what: R3 and R15 are asked, and when they say no, that is what the person is told. */
const SIB_MS=120000;                        /* "the same time" = two minutes either way */
let SIB_Q=null;                             /* the quoted mail the little menu is about */
let SIB_SEL=null;                           /* {id,mi} - the row left selected */

const sibFolders={inbox:'Inbox',sent:'Sent',archive:'Archive',junk:'Junk',deleted:'Deleted',drafts:'Drafts',purged:'Deleted'};
const sibFolderName=f=>sibFolders[String(f||'inbox')]||(String(f||'').charAt(0).toUpperCase()+String(f||'').slice(1));
/* which folder does THAT mail's row live in? The conversation's folder decides it, except
   in the Inbox, where a mail we sent has its row in Sent (rule R8 / R14). */
function sibFolderOf(t,mi){
 const f=String(t&&t.folder||'inbox');
 if(f!=='inbox')return f;
 const m=t&&t.msgs&&t.msgs[mi];
 try{if(m&&recvMsg(m,t))return 'inbox'}catch(e){return 'inbox'}
 return 'sent';
}
const sibSub=x=>String((typeof cleanSub==='function'?cleanSub(x||''):x)||'').toLowerCase().replace(/^((re|fw|fwd)\\s*:\\s*)+/i,'').replace(/\\s+/g,' ').trim();
const sibMid=x=>String((x&&(x.mid||x.msgid||x.rfc||x.rfc_message_id))||'').replace(/[<>\\s]/g,'').toLowerCase();
const sibAdr=x=>String((x&&x.email)||'').toLowerCase().trim();
/* is this real message the quoted mail? */
function sibSame(q,m,t,midOnly){
 const a=sibMid(q),b=sibMid(m);
 if(a&&b)return a===b;                     /* a Message-ID on both sides settles it */
 if(midOnly)return false;
 if(!sibAdr(q)||sibAdr(q)!==sibAdr(m))return false;
 if(Math.abs((+q.at||0)-(+m.at||0))>SIB_MS)return false;
 const x=sibSub(q.sub),y=sibSub(m.subject||(t&&t.sub));
 return !x||!y||x===y;                     /* a trail keeps the conversation's subject */
}
/* the mail loaded in this browser, Message-ID pass first */
function sibFind(q){
 if(!q)return null;
 for(let pass=0;pass<2;pass++){
  const list=S.threads||[];
  for(let i=0;i<list.length;i++){const t=list[i],ms=t&&t.msgs||[];
   for(let k=0;k<ms.length;k++)if(sibSame(q,ms[k],t,pass===0))return {t:t,mi:k};}
 }
 return null;
}
/* ...and if it is not loaded, ask the server and look again */
function sibAsk(q){
 try{
  const f={},at=+q.at||0;
  if(sibAdr(q))f.from=sibAdr(q);
  if(sibSub(q.sub))f.subject=sibSub(q.sub).slice(0,80);
  if(at){f.after=new Date(at-6*3600000).toISOString();f.before=new Date(at+6*3600000).toISOString()}
  if(!f.from&&!f.subject)return Promise.resolve({hit:null,err:''});
  return api('find',{f:f,limit:60}).then(r=>{
   if(r&&Array.isArray(r.threads)){try{mergeList(r)}catch(e){}}
   return {hit:sibFind(q),err:''};
  }).catch(e=>({hit:null,err:(e&&e.message)||'the server did not answer'}));
 }catch(e){return Promise.resolve({hit:null,err:(e&&e.message)||'the server did not answer'})}
}

/* ---- 3 · go to the row ---- */
function sibShow(t,mi){
 if(!t)return;
 if(typeof canSee==='function'&&!canSee(t.dept)){toast('Not in your mailboxes');return}
 if(typeof seeMine==='function'&&!seeMine(t)){
  const o=t.owner&&who(t.owner);toast('This mail belongs to '+((o&&o.name)||'somebody else'));return}
 const f=sibFolderOf(t,mi);
 if(f==='sent'&&typeof sentSeen==='function'&&!sentSeen(t)){
  let nm='a colleague';try{const w=sentWho(t.msgs[mi],t),p=w&&who(w);if(p&&p.name)nm=p.name}catch(e){}
  toast('This mail belongs to '+nm);return}
 app='mail';
 view={type:'box',dept:t.dept,folder:f};
 /* clear everything that could hide the row */
 if(typeof filt!=='undefined')filt='all';
 if(typeof lfilt!=='undefined')lfilt='';
 if(typeof tab!=='undefined')tab='focused';
 try{const q=$('#q');if(q&&q.value){q.value='';if(typeof fndClear==='function')fndClear()}}catch(e){}
 try{const v=LV();if(v&&v.vf&&v.vf!=='all'){S.prefs=S.prefs||{};S.prefs.lv=Object.assign({},S.prefs.lv||{},{vf:'all'});if(typeof save==='function')save()}}catch(e){}
 /* a phone shows either the list or the open mail, never both: leave the reading pane */
 try{if(matchMedia('(max-width:900px)').matches)openId=null}catch(e){}
 SIB_SEL={id:t.id,mi:mi};
 render();
 sibRow(t,mi,0);
}
function sibSelector(id,mi){
 const base='.list .m[data-open="'+String(id).replace(/"/g,'')+'"]';
 return mi==null?base:base+'[data-mi="'+mi+'"]';
}
function sibRow(t,mi,tries){
 const el=document.querySelector(sibSelector(t.id,mi))||document.querySelector(sibSelector(t.id,null));
 if(!el){
  /* not drawn yet: the list draws 150 rows and adds more on scroll - grow it */
  if(tries<15&&document.querySelector('.list [data-listmore]')){try{listMore()}catch(e){}
   return setTimeout(()=>sibRow(t,mi,tries+1),70)}
  if(tries<4)return setTimeout(()=>sibRow(t,mi,tries+1),120);
  toast('It is in '+sibFolderName(sibFolderOf(t,mi))+', but your list is not showing it');
  return;
 }
 document.querySelectorAll('.m.sibhit').forEach(x=>x.classList.remove('sibhit'));
 el.classList.add('sibhit','sibsel');
 try{el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}catch(e){try{el.scrollIntoView()}catch(e2){}}
 try{el.setAttribute('tabindex','-1');el.focus({preventScroll:true})}catch(e){}
 setTimeout(()=>{try{el.classList.remove('sibhit')}catch(e){}},3000);
 toast('Shown in '+sibFolderName(sibFolderOf(t,mi)));
}
/* the row stays selected across a redraw, and the next click on a row clears it */
const _rlSib=renderList;renderList=function(){const r=_rlSib.apply(this,arguments);
 try{if(SIB_SEL){const el=document.querySelector(sibSelector(SIB_SEL.id,SIB_SEL.mi));if(el)el.classList.add('sibsel')}}catch(e){}
 return r};
document.addEventListener('click',e=>{try{
 const r=e.target&&e.target.closest&&e.target.closest('.list .m[data-open]');
 if(r&&SIB_SEL){SIB_SEL=null;document.querySelectorAll('.m.sibsel').forEach(x=>x.classList.remove('sibsel'))}
}catch(x){}},true);

/* what the menu item says, and what pressing it does */
function sibGo(q){
 const hit=sibFind(q);
 if(hit)return sibShow(hit.t,hit.mi);
 toast('Looking for this mail\\u2026');
 sibAsk(q).then(r=>{
  if(r&&r.hit)return sibShow(r.hit.t,r.hit.mi);
  /* never say it was never here when it was the SERVER that could not answer */
  toast(r&&r.err?('Could not look for it on the server \\u2014 '+r.err)
   :'Only quoted here \\u2014 this mail never came to this mailbox');
 });
}

/* ---- 1 · the ... on every mail quoted in "Mail trail" ---- */
function sibTrailBtns(){
 const R=document.getElementById('read');if(!R)return;
 R.querySelectorAll('details.trail .q > div > .qh').forEach(qh=>{
  if(qh.querySelector('.sibm'))return;
  const b=document.createElement('button');
  b.type='button';b.className='sibm';b.setAttribute('data-sibm','1');
  b.setAttribute('aria-haspopup','menu');b.title='More \\u2014 go to this mail in your mailbox';
  b.setAttribute('aria-label','More actions for this quoted mail');
  b.textContent='\\u22ef';
  qh.appendChild(b);
 });
}
const _rrSib=renderRead;renderRead=function(){const r=_rrSib.apply(this,arguments);try{sibTrailBtns()}catch(e){}return r};
/* which quoted mail is this button on? */
function sibQof(btn){
 try{
  const art=btn.closest('article.mail'),box=btn.closest('.q > div'),qn=box&&box.querySelector('.qn');
  if(!art||!box)return null;
  const mi=+String(art.id).split('-').pop(),t=openId&&T_(openId),m=t&&t.msgs&&t.msgs[mi];
  const tr=m&&m.trail||[];
  let k=qn?(+qn.textContent||0)-1:-1;
  if(k<0||!tr[k]){const all=[].slice.call(box.parentNode.children);k=all.indexOf(box)}
  return tr[k]||null;
 }catch(e){return null}
}
document.addEventListener('click',e=>{
 let b=null;try{b=e.target&&e.target.closest&&e.target.closest('[data-sibm]')}catch(x){}
 if(!b)return;
 e.preventDefault();e.stopPropagation();
 const q=sibQof(b);
 if(typeof cmClose==='function')cmClose();
 if(!q){toast('This quoted mail cannot be read');return}
 SIB_Q=q;
 const hit=sibFind(q);
 const label=hit?('\\ud83d\\udccd Show in '+sibFolderName(sibFolderOf(hit.t,hit.mi))):'\\ud83d\\udccd Find this mail';
 const m=document.createElement('div');m.className='cmenu';m.setAttribute('role','menu');
 m.setAttribute('aria-label','Actions for the quoted mail from '+String(q.from||''));
 m.innerHTML='<button type="button" role="menuitem" data-cm="sibq">'+esc(label)+'</button>';
 document.body.appendChild(m);
 const r=b.getBoundingClientRect(),W=m.offsetWidth,H=m.offsetHeight;
 m.style.left=Math.max(4,Math.min(r.right-W,innerWidth-W-4))+'px';
 m.style.top=Math.max(4,Math.min(r.bottom+4,innerHeight-H-4))+'px';
 const f=m.querySelector('button');if(f)f.focus();
},true);

/* ---- 1b · one more item in the reading pane's own ... More menu ----
   The mail is taken from cmOpen's own "row" argument: for the pane's ... button that IS
   the button, so its article names the mail. A click listener of our own cannot do it -
   the app's data-olkmore handler is registered first on the same target, so it has already
   called cmOpen before ours runs. A right-click on a list row passes the row itself, which
   has no article, so nothing is added there (you are looking at the row already). */
const _cmSib=cmOpen;
cmOpen=function(t,x,y,row){
 let mi=null;
 try{const art=row&&row.closest&&row.closest('article.mail');if(art)mi=+String(art.id).split('-').pop()}catch(e){}
 const r=_cmSib.apply(this,arguments);
 try{
  if(mi!=null&&!isNaN(mi)&&t&&t.msgs&&t.msgs[mi]){
   const m=document.querySelector('.cmenu');
   if(m&&!m.querySelector('[data-cm^="sib:"]')){
    m.insertAdjacentHTML('beforeend','<hr><button type="button" role="menuitem" data-cm="sib:'+mi+'">\\ud83d\\udccd '+esc('Show in '+sibFolderName(sibFolderOf(t,mi)))+'</button>');
    const W=m.offsetWidth,H=m.offsetHeight;                /* it grew - keep it on screen */
    m.style.left=Math.max(4,Math.min(parseFloat(m.style.left)||x,innerWidth-W-4))+'px';
    m.style.top=Math.max(4,Math.min(parseFloat(m.style.top)||y,innerHeight-H-4))+'px';
   }
  }
 }catch(e){}
 return r};
/* both menu items, taken before the app's own menu handler runs */
document.addEventListener('click',e=>{
 let b=null;try{b=e.target&&e.target.closest&&e.target.closest('.cmenu [data-cm]')}catch(x){}
 if(!b)return;
 const a=String(b.dataset.cm||'');
 if(a!=='sibq'&&a.slice(0,4)!=='sib:')return;
 e.preventDefault();e.stopPropagation();
 if(typeof cmClose==='function')cmClose();
 if(a==='sibq'){const q=SIB_Q;SIB_Q=null;if(q)sibGo(q);return}
 const mi=+a.slice(4),t=openId&&T_(openId);
 if(t&&t.msgs&&t.msgs[mi])sibShow(t,mi);
},true);

/* ------------------------------------------------------------------ CSS --- */
(function sibCSS(){
 if(document.getElementById('sibCSS'))return;
 const st=document.createElement('style');st.id='sibCSS';
 st.textContent=[
  '.trail .q > div > .qh{position:relative;padding-right:30px}',
  '.sibm{position:absolute;top:2px;right:2px;width:24px;height:24px;border:1px solid transparent;',
  'border-radius:6px;background:transparent;color:var(--muted);font-size:14px;line-height:1;cursor:pointer}',
  '.sibm:hover,.sibm:focus-visible{border-color:var(--line);background:var(--pane);color:var(--fg)}',
  '.list .m.sibhit{animation:sibflash 3s ease-out 1}',
  '.list .m.sibsel{box-shadow:inset 3px 0 0 var(--brand)}',
  '@keyframes sibflash{0%,55%{background:color-mix(in srgb,var(--brand) 26%,transparent)}100%{background:transparent}}',
  '@media (prefers-reduced-motion: reduce){.list .m.sibhit{animation:none;outline:2px solid var(--brand);outline-offset:-2px}}',
  '@media (max-width:640px){.sibm{width:30px;height:30px;font-size:16px}}'
 ].join('');
 document.head.appendChild(st);
})();
${END}
`;

const a = s.indexOf("<script>/* __showin:start");
if (a >= 0) {
  const b = s.indexOf(END, a);
  if (b < 0) throw new Error("the old __showin block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + END.length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

fs.writeFileSync(F, s);
console.log("written to " + F);
