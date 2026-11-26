/* patch-mgr-sees-sent.js - 27 Nov 2026  (night plan, bug 6 - new locked rule R8m:
 *   "a team manager must see his team members' replies in his Inbox, not only in Sent")
 *
 * One shared mailbox, several people working from it. R8 says mail we sent lives in Sent,
 * not the Inbox - right for the person who sent it, but it leaves the manager with no way
 * to see what his team actually answered without going into Sent and reading it as a list
 * of his own outgoing mail.
 *
 * R8m: for a MANAGER (or Lead) of that team, every mail sent by one of HIS team members -
 * from Rugs Email, or from Outlook under that member's own name - also appears as its own
 * row in his Inbox, at the mail's own time. R17 is unchanged: it is one row per mail.
 *
 *   1  manager: the member's sent mail is a row in his Inbox AND stays in Sent
 *   2  the sender himself: Sent only (R8 unchanged). Other members: unchanged
 *   3  the manager's own sent mail: his Sent only
 *   4  the row is tagged "Sent by <name>", arrives READ, is never work (no Needs owner, no
 *      My work, no Done button) and does not touch the owner
 *   5  an Admin is not included - nine mailboxes of other people's sent mail is not a plate
 *
 * NOTHING about ownership changes: hasRecv() is deliberately NOT touched, so these rows can
 * never turn into work, and the five Inbox counts (all unread-based) stay exactly as they
 * were, because an R8m row is read.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-mgr-sees-sent.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

let n = 0;
function all(mark, find, rep, why, times) {
  if (s.indexOf(mark) >= 0) { console.log("already done: " + why); return; }
  const hits = s.split(find).length - 1;
  if (hits !== times) throw new Error("expected " + times + " place(s) for " + why + ", found " + hits);
  s = s.split(find).join(rep);
  n += hits;
  console.log("  " + why + " (" + hits + " place" + (hits === 1 ? "" : "s") + ")");
}

/* The Inbox gate, in the three places that decide it - the base rule, the wrapper that wins,
   and All inboxes. hasRecv() is NOT in this list on purpose: it decides what counts as WORK,
   and an R8m row must never become work. */
all(
  "__r8m",
  "t.msgs.some(m=>recvMsg(m,t));",
  "(t.msgs.some(m=>recvMsg(m,t))||mgrHasSent(t));   /* __r8m: ...and, for a manager, mail his own team members sent */",
  "the Inbox lets in a conversation a team member wrote in (base rule, the wrapper that wins, and All inboxes)",
  3
);

/* ---- the block ---- */
const BLOCK = `
<script>/* __mgrsent:start 27 Nov 2026 - server/patch-mgr-sees-sent.js (rule R8m) */
/* which team am I the manager of? Admins are deliberately left out (rule 5), and so is
   anyone who is not a Manager or a Lead. */
function mgrTeam(){try{
 const p=who(ME);
 if(!p||p.role==='Admin')return '';
 return (p.role==='Manager'||p.role==='Lead')?(p.dept||''):'';
}catch(e){return ''}}

/* was this message sent by one of MY team members (not me)? sentWho() already knows how to
   name the sender of a mail written here or sent from Outlook under their own name, and it
   forgives spelling (Jagjeet = Jagjit). */
function mgrSent(m,t){try{
 if(!m||!t)return false;
 const team=mgrTeam();
 if(!team||t.dept!==team)return false;
 if(!(m.by||m.ours))return false;                 /* only mail WE sent */
 if(typeof colleagueIn==='function'&&colleagueIn(m,t))return false;   /* a colleague writing IN is received mail */
 const who_=(typeof sentWho==='function')?sentWho(m,t):null;
 if(!who_||who_===ME)return false;                /* unnamed, or my own - rule 3 */
 const p=who(who_);
 return !!p&&p.dept===team&&p.active!==false&&p.role!=='Admin';
}catch(e){return false}}
function mgrHasSent(t){try{
 if(!t||!t.msgs||!mgrTeam())return false;
 for(let i=0;i<t.msgs.length;i++)if(mgrSent(t.msgs[i],t))return true;
 return false;
}catch(e){return false}}

/* 1 · the rows themselves. explode() builds one row per mail; for the Inbox it keeps only
   received mail, so the member's reply is added here afterwards - which also keeps the
   ordinary path untouched for everybody who is not a manager. */
const _expMgr=explode;
explode=function(rows){
 const out=_expMgr.apply(this,arguments);
 try{
  if(!mgrTeam())return out;
  const inb=view.type==='all'||(view.type==='box'&&view.folder==='inbox');
  if(!inb)return out;
  const have={};out.forEach(p=>{if(p&&p._one)have[p.id+'|'+p._mi]=1});
  const add=[];
  (rows||[]).forEach(t=>{
   (t.msgs||[]).forEach((m,i)=>{
    if(!mgrSent(m,t)||have[t.id+'|'+i])return;
    const p=Object.create(t);
    p.last=m.at;p.from=m.from||t.from;p.email=m.email||t.email;
    p.pre=String(m.body||'').replace(/\\s+/g,' ').slice(0,200);
    p.unread=false;                                /* 4 · it arrives read */
    p.att=((m.atts&&m.atts.length)||(m.files&&m.files.length))?'1':'';
    p._one=true;p._mi=i;p._mgrSent=(typeof sentWho==='function')?sentWho(m,t):'';
    add.push(p);
   });
  });
  if(add.length){
   /* explode() pushes the whole conversation as ONE row when it has no mail of its own to
      show ("if(!ms.length)"). A Sent-only conversation now reaches the Inbox through R8m,
      so that fallback row and our per-mail row were both drawn - the same mail twice.
      Take the fallback away for exactly the conversations we have given real rows. */
   const did={};add.forEach(p=>{did[p.id]=1});
   const keep=out.filter(p=>!(p&&!p._one&&did[p.id]));
   return keep.concat(add);
  }
 }catch(e){}
 return out;
};

/* 4 · the row says who sent it, and offers no Done button - it is not work, it is a copy of
   what somebody on the team answered */
const _rhMgr=rowHTML;
rowHTML=function(t){
 let h=_rhMgr.apply(this,arguments);
 try{
  if(t&&t._mgrSent){
   const p=who(t._mgrSent),nm=p?p.name.split(' ')[0]:'a teammate';
   h=h.replace('<div class="tags">','<div class="tags"><span class="tag t-asg mgrsent" title="'+esc((p?p.name:'A teammate'))+' sent this from '+esc(dept(t.dept).name)+' — it is here so you can see what your team answered">↳ Sent by '+esc(nm)+'</span>');
   h=h.replace(/<button data-qdone="[^"]*"[^>]*>.*?<\\/button>/,'');   /* no Done on a copy */
  }
 }catch(e){}
 return h;
};

/* ------------------------------------------------------------------ CSS --- */
(function msCSS(){
 if(document.getElementById('msCSS'))return;
 const st=document.createElement('style');st.id='msCSS';
 st.textContent=[
  '.tag.mgrsent{background:rgba(60,110,200,.14);color:#2b4f93;font-weight:650}',
  'body.v-sent .list .m .tags .tag.mgrsent{display:none}'
 ].join('');
 document.head.appendChild(st);
})();
/* __mgrsent:end */</script>
`;
const a = s.indexOf("<script>/* __mgrsent:start");
if (a >= 0) {
  const b = s.indexOf("/* __mgrsent:end */</scr" + "ipt>", a);
  if (b < 0) throw new Error("the old __mgrsent block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + ("/* __mgrsent:end */</scr" + "ipt>").length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

fs.writeFileSync(F, s);
console.log(n + " edit(s) + the block. written to " + F);
