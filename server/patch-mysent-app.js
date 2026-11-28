/* patch-mysent-app.js - 28 Nov 2026   (new rule R36)
 *
 * "He sent a mail to a buyer and it is not in his Sent."
 *
 * MEASURED FIRST, live and read only (server/measure-ashish-sent.mjs): inside his own mailbox
 * teampulse@ his Sent is already complete - 309 of his conversations loaded, 307 shown, and the
 * 2 missing ones are in Deleted. The gap is elsewhere: 1,317 of his 4,888 sent mails landed in
 * mailboxes his session is never given (vinay@ 605, shipping@ 390, designer@ 253, teamalpha@ 40,
 * dmm3@ 13, merchandiser1@ 8, neetu@ 6, mis@ 1, marketing@ 1), and he cannot open those at all.
 *
 * RULE R36 (new): your OWN sent mail is shown in your Sent whatever mailbox it landed in -
 * read only, YOUR mail and nothing else from that mailbox.
 *
 * HOW IT IS KEPT SAFE, and this is the whole design:
 *  - the server action "mysent" (server/patch-mysent-server.js) returns only messages whose
 *    From is this person's own login or alias, only out of mailboxes he may NOT open, and only
 *    the ones with no copy in a mailbox he CAN open - so his Sent is never doubled. No other
 *    message, thread row, owner or activity of those mailboxes is read.
 *  - the answer is kept in its OWN list (FS36). It never goes into S.threads, so no rule, no
 *    folder count, no Needs owner, no My work and nothing else in the app can see it.
 *  - the rows are read only: no Reply, no Forward, no Done, no owner, no move, no drag. They
 *    are drawn as their own group at the end of the Sent list and open a read-only viewer.
 *  - nothing is written and nothing is posted; in a Switch ID session it is the person switched
 *    to, because the server answers for the session's own user.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-mysent-app.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__mysent")) { console.log("already applied - nothing to do"); process.exit(0); }

const BUILD_OLD = "APP_BUILD='2026-11-28-6'";
const BUILD_NEW = "APP_BUILD='2026-11-28-7'";
if (s.split(BUILD_OLD).length - 1 !== 1) throw new Error("APP_BUILD 2026-11-28-6 not found exactly once");
s = s.replace(BUILD_OLD, BUILD_NEW);
console.log("  APP_BUILD -> 2026-11-28-7");

const BLOCK = `<script>/* __mysent:start  28 Nov 2026 - rule R36: your own sent mail, wherever it landed.
   Why: server/patch-mysent-app.js. The one read-only server action it asks for:
   server/patch-mysent-server.js. Kept in its own list, so nothing else in the app sees it. */
let FS36=null,FS36at=0,FS36err='',FS36busy=false,FS36who='',FS36back=null;
function fs36On(){try{return !!(view&&view.type==='box'&&view.folder==='sent')}catch(e){return false}}
async function fs36Api(){
 const r=await fetch(API+'-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mysent',token:TOKEN})});
 const j=await r.json().catch(function(){return{error:'Server error '+r.status}});
 if(!r.ok||j.error)throw new Error(j.error||('Error '+r.status));
 return j}
async function fs36Load(force){
 if(FS36busy)return;
 if(!window.__liveReady)return;
 if(!force&&FS36!==null&&Date.now()-FS36at<6e5)return;
 FS36busy=true;FS36who=ME;
 try{const j=await fs36Api();FS36=(j.mails||[]).slice(0,300);FS36err=''}
 catch(e){FS36err=String((e&&e.message)||e);if(FS36===null)FS36=[]}
 finally{FS36busy=false;FS36at=Date.now();if(fs36On())try{renderListKeep()}catch(e){}}}
/* who a mail went to, as words a person can read */
function fs36To(m){
 const t=String((m&&m.to_text)||''),got=[];
 (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g)||[]).forEach(function(a){
  const k=a.toLowerCase();if(got.indexOf(k)<0)got.push(k)});
 if(!got.length)return t.replace(/\\s+/g,' ').trim().slice(0,70)||'(nobody named)';
 return got.slice(0,3).join(', ')+(got.length>3?' +'+(got.length-3):'')}
function fs36Rows(){
 let r=FS36||[],q='';
 try{q=((($('#q')||{}).value)||'').trim().toLowerCase()}catch(e){}
 if(q)r=r.filter(function(m){return [m.subject,m.to_text,m.cc_text,m.body,m.mailbox].join(' ').toLowerCase().indexOf(q)>=0});
 return r}
function fs36Draw(){
 if(!fs36On())return;
 if(FS36!==null&&FS36who&&FS36who!==ME){FS36=null;FS36err='';FS36at=0}
 const box=document.querySelector('.list .msgs');if(!box)return;
 /* 28 Nov 2026: the list is NOT rebuilt when the mail has not changed (the drawn-row cache
    of 27 Nov), so this group has to take its own rows off before it puts them on, and keep a
    fingerprint so an unchanged list is left alone. */
 const rows=fs36Rows();
 const q0=(function(){try{return ((($('#q')||{}).value)||'').trim()}catch(e){return''}})();
 const sig=JSON.stringify([FS36===null?'?':rows.length,FS36err,q0,FS36at,ME,typeof filt==='undefined'?'':filt,typeof lfilt==='undefined'?'':lfilt]);
 if(box.getAttribute('data-fs36sig')===sig&&box.querySelector('[data-fs36group],[data-fs36more]'))return;
 Array.prototype.forEach.call(box.querySelectorAll('[data-fs36group],[data-fs36],[data-fs36more]'),function(el){el.remove()});
 box.setAttribute('data-fs36sig',sig);
 if((typeof filt!=='undefined'&&filt!=='all')||(typeof lfilt!=='undefined'&&lfilt))return;
 const head=function(txt){return '<div class="day" data-fs36group title="Mail you sent that landed only in a mailbox you cannot open. Read only - your own mail, nothing else from that mailbox.">'+txt+'</div>'};
 if(FS36===null){
  if(!window.__liveReady)return;     /* signed out, or the app has not finished booting */
  fs36Load();box.insertAdjacentHTML('beforeend',head('Also sent by you')+'<div class="listmore" data-fs36more>Looking in the mailboxes you cannot open…</div>');return}
 if(FS36err){box.insertAdjacentHTML('beforeend',head('Also sent by you')+'<div class="listmore" data-fs36more>Could not look in the mailboxes you cannot open — '+esc(FS36err)+' <button class="btn" data-fs36ref style="min-height:40px">Try again</button></div>');return}
 if(!rows.length)return;
 const h=[head('📤 Also sent by you · in mailboxes you cannot open · '+rows.length)];
 rows.forEach(function(m){const i=FS36.indexOf(m),at=Date.parse(m.sent_at)||0;
  h.push('<div class="m" data-fs36="'+i+'" role="button" tabindex="0" style="cursor:pointer">'
  +'<span>'+av(((who(ME)||{}).name)||'Me')+'</span><div class="body"><div class="r1">'
  +'<span class="who">To: '+esc(fs36To(m))+'</span>'
  +'<span class="time" title="'+esc(tLong(at))+'">'+esc(tShort(at))+'</span></div>'
  +'<div class="sub">'+esc(cleanSub(m.subject||'(no subject)'))+'</div>'
  +'<div class="pre">'+esc(String(m.body||'').replace(/\\s+/g,' ').trim().slice(0,160))+'</div>'
  +'<div class="tags"><span class="tag t-done" title="'+esc(m.mailbox)+' — you cannot open this mailbox">'+esc(String(m.mailbox).split('@')[0]+'@')+' · read only</span>'
  +(m.has_attachments?'<span class="tag t-asg" title="Has attachment">'+ico('clip','Has attachment')+'</span>':'')
  +'</div></div></div>')});
 box.insertAdjacentHTML('beforeend',h.join(''))}
const _rl36=renderList;
renderList=function(){const r=_rl36.apply(this,arguments);try{fs36Draw()}catch(e){}return r};
function fs36Close(){const d=document.getElementById('fs36dlg');if(d)d.remove();
 try{if(FS36back&&FS36back.focus)FS36back.focus()}catch(e){}}
function fs36Open(i){
 const m=(FS36||[])[i];if(!m)return;
 fs36Close();try{FS36back=document.activeElement}catch(e){}
 const at=Date.parse(m.sent_at)||0;
 const d=document.createElement('div');d.id='fs36dlg';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','A mail you sent');
 d.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
 d.innerHTML='<div style="background:var(--pane);color:var(--fg);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);max-width:760px;width:100%;max-height:86vh;display:flex;flex-direction:column;font-family:var(--ui)">'
 +'<div style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)">'
 +'<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;overflow-wrap:anywhere">'+esc(cleanSub(m.subject||'(no subject)'))+'</div>'
 +'<div style="font-size:12.5px;color:var(--muted);margin-top:4px;overflow-wrap:anywhere">'+esc(tLong(at))+' · To: '+esc(fs36To(m))
 +(m.cc_text?' · Cc: '+esc(fs36To({to_text:m.cc_text})):'')+'</div></div>'
 +'<button class="btn" data-fs36close aria-label="Close" style="min-height:40px;min-width:40px">✕</button></div>'
 +'<div style="padding:10px 16px;font-size:12.5px;color:var(--muted);border-bottom:1px solid var(--line)">This mail is in <b>'+esc(m.mailbox)+'</b>, a mailbox you cannot open. You are seeing <b>your own mail only</b> — read only, nothing else from that mailbox.</div>'
 +'<div style="padding:14px 16px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14.5px;line-height:1.5">'+esc(String(m.body||'').trim()||'(this mail has no text)')+'</div></div>';
 d.addEventListener('click',function(ev){if(ev.target===d)fs36Close()});
 document.body.appendChild(d);
 try{d.querySelector('[data-fs36close]').focus()}catch(e){}}
document.addEventListener('click',function(e){
 if(!e.target||!e.target.closest)return;
 if(e.target.closest('[data-fs36close]')){fs36Close();return}
 if(e.target.closest('[data-fs36ref]')){FS36=null;FS36err='';FS36at=0;fs36Load(true);try{renderListKeep()}catch(e2){}return}
 const o=e.target.closest('[data-fs36]');if(o){e.preventDefault();fs36Open(+o.getAttribute('data-fs36'))}});
document.addEventListener('keydown',function(e){
 if(e.key==='Escape'&&document.getElementById('fs36dlg')){e.preventDefault();fs36Close();return}
 if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.closest){const o=e.target.closest('[data-fs36]');
  if(o){e.preventDefault();fs36Open(+o.getAttribute('data-fs36'))}}});
/* paste  rzMySent()  into the console */
window.rzMySent=function(){return{mails:(FS36||[]).length,loadedFor:FS36who,lookedAt:FS36at?new Date(FS36at).toLocaleTimeString('en-IN'):'not yet',error:FS36err||'none'}};
/* __mysent:end */${"<"}/script>
`;

s = s.replace(/\s*$/, "\n") + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  R36: one APP_BUILD edit + one appended block");
