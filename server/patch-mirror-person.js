/* 25 Nov 2026 - Rugs Email: one person's mailbox shows EXACTLY what another person's shows.

   Asked for: "In Jatin Munjal show what actually coming same in Ashok - exactly the
   same email, not more than that, not less than that."

   Why anything was needed at all: since 16 Nov a mail with an owner is that person's
   mail, so two Executives in the same team never see the same list - each sees the
   team's unclaimed mail, his own, and anything he replied in. Making Jatin a Manager
   would have shown him MORE than Ashok (the whole team), which is not what was asked.

   How it works: the two rules that decide what a person may see - seeMine (every
   folder, every count, Search, the Home numbers) and sentSeen (the Sent folder) - are
   run with Jatin counted AS Ashok. Nothing else changes: he still sends as himself,
   owns his own work, and the server is not touched, so Ashok is completely unaffected
   and there is nothing to undo in the data.

   Listed by LOGIN, not by user id, because the id of a person created from the Admin
   page is not known in advance. Both spellings of his address are listed.

   To mirror somebody else: add a line to MIRROR_LOGIN. To stop it: remove the line.

   Edit this file, then run:  node server/patch-mirror-person.js
   and afterwards:            node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");

if (s.includes("__mirror:start")) { console.log("already there - nothing changed"); process.exit(0); }

const block = String.raw`
<script>/* __mirror:start  25 Nov 2026: this person sees exactly what that person sees */
/* who sees whose mail:  the person signing in  ->  the person whose mail he sees */
const MIRROR_LOGIN={
 'jatinmunjal@rugscreation.com':'merchandiser5@rugscreation.com',   /* Jatin Munjal sees Ashok's mail */
 'jatinmunjyal@rugscreation.com':'merchandiser5@rugscreation.com'   /* the same, if his login was saved with the older spelling */
};
let _mrFor='',_mrId='';
function mirrorId(){try{
 const me=who(ME);if(!me)return'';
 const lg=String(me.login||'').toLowerCase();
 const want=MIRROR_LOGIN[lg];if(!want)return'';
 if(_mrFor===lg&&_mrId)return _mrId;                     /* worked out once, then remembered */
 const p=(PEOPLE||[]).find(x=>String(x.login||'').toLowerCase()===want&&x.active!==false);
 _mrFor=lg;_mrId=p?p.id:'';
 return _mrId}catch(e){return''}}
function asMirror(fn,args){
 const id=mirrorId();
 if(!id||id===ME)return fn.apply(null,args);
 const old=ME;ME=id;                                      /* judge this mail as the other person */
 try{return fn.apply(null,args)}finally{ME=old}}
const _smMir=seeMine;  seeMine =function(){return asMirror(_smMir,arguments)};
const _ssMir=sentSeen; sentSeen=function(){return asMirror(_ssMir,arguments)};
/* a quiet line in the top bar, so nobody is confused about whose mail they are looking at */
const _rndMir=render;
render=function(){
 _rndMir.apply(this,arguments);
 try{
  const id=mirrorId();if(!id)return;
  const bar=document.querySelector('.topbar')||document.querySelector('header');
  if(!bar||document.getElementById('mirnote'))return;
  const n=document.createElement('span');
  n.id='mirnote';n.style.cssText='font-size:12px;opacity:.85;padding:2px 8px;border:1px solid currentColor;border-radius:999px;white-space:nowrap';
  n.textContent='Showing '+((who(id)||{}).name||'')+'’s mail';
  n.title='This mailbox shows exactly the same mail as '+((who(id)||{}).name||'')+' sees — nothing more, nothing less.';
  bar.appendChild(n);
 }catch(e){}
};
/* __mirror:end */</script>`;

s = s.replace(/\s*$/, "") + "\n" + block + "\n";
fs.writeFileSync(file, s);
console.log("patched .tmp/email.html - the mirror rule is in");
