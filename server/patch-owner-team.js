/* patch-owner-team.js - 27 Nov 2026  (night plan, bug 4 - new locked rule R29a:
 *   "the Owner picker shows every user in the company")
 *
 * R29a: a conversation can only belong to somebody in the team that owns that mailbox.
 *
 * On 20 November the Owner box was widened so an Admin / CRM / Manager could also pick
 * somebody from ANOTHER team - picking them moved the conversation across and gave it to
 * them in one step. That was for Priya, who was CRM for the whole company and had to push
 * work out of one-person mailboxes. Priya has left, and what is left is a picker listing all
 * 83 people in the company, team by team, on every conversation.
 *
 *  1  the Owner / Assign list is this mailbox's own team only - for everybody, admins too;
 *     Transfer already listed only the receiving team's people and is unchanged
 *  2  a mailbox with one person (Marketing) shows that person's NAME, with no picker
 *  3  the server refuses an owner who is not in that mailbox's team (patch-server-owner-team.js)
 *  4  an Admin gets "Move to team…" in the conversation menu, which moves the whole
 *     conversation to that team's unassigned list and writes an activity-trail line
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-owner-team.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

let n = 0;
function one(mark, find, rep, why) {
  if (mark && s.indexOf(mark) >= 0) { console.log("already done: " + why); return; }
  const i = s.indexOf(find);
  if (i < 0) throw new Error("could not find the place for: " + why);
  if (s.indexOf(find, i + find.length) >= 0) throw new Error("found more than once: " + why);
  s = s.slice(0, i) + rep + s.slice(i + find.length);
  n++;
  console.log("  " + why);
}

/* ---- 1. the Owner box stops listing the rest of the company ---- */
one(
  "__r29a:",
  " if(!canAssignOut())return base;",
  " /* __r29a: 27 Nov 2026 - the Owner box lists this mailbox's OWN TEAM only, for everybody\n" +
  "    including admins. It used to add every other team as an optgroup (83 people), and\n" +
  "    picking one moved the conversation across. An admin moves a conversation with\n" +
  "    \"Move to team…\" in the conversation menu instead, which leaves it unassigned there.\n" +
  "    The lines below are kept, unreachable, so the old behaviour is easy to read back. */\n" +
  " return base;\n" +
  " if(!canAssignOut())return base;",
  "the Owner box no longer lists the whole company"
);

/* ---- the block ---- */
const BLOCK = `
<script>/* __ownerteam:start 27 Nov 2026 - server/patch-owner-team.js */
/* everybody a conversation in this mailbox may belong to: the team's own people, which
   already includes its Manager and its Lead. Deactivated people are left out; an Admin is
   left out unless that team really is their own. */
function teamPeople(did){try{
 return PEOPLE.filter(p=>p.dept===did&&p.active!==false&&(p.role!=='Admin'||p.dept===did));
}catch(e){return []}}
function canOwn(pid,did){return teamPeople(did).some(p=>p.id===pid)}

/* The picker is BUILT from teamPeople(), so exactly one list decides who may own a
   conversation - the same list the assign guard and the server check against. The old base
   picker filtered on p.dept===d plus a role test and never looked at 'active', so a
   DEACTIVATED colleague was still offered as an owner; the test caught that. */
const _ownOne=ownerSelect;
ownerSelect=function(t){
 const ppl=teamPeople(t.dept);
 /* 2 · a mailbox with ONE person: show the name, no picker */
 if(ppl.length===1){
  const only=ppl[0];
  return '<b class="ownone" title="'+esc(only.name)+' is the only person in '+esc(dept(t.dept).name)+', so this mail is theirs">'+esc(only.name)+'</b>';
 }
 if(!ppl.length)return '<b class="ownone" title="Nobody has been put in this mailbox yet">Nobody in this mailbox yet</b>';
 const opt=p=>'<option value="'+esc(p.id)+'"'+(t.owner===p.id?' selected':'')+'>'+esc(p.name)+(p.role==='CRM'?' (CRM)':'')+(onLeave(p.id)?' · on leave':'')+'</option>';
 let out=(t.owner?'':'<option value="">Assign to…</option>')+ppl.map(opt).join('');
 /* somebody who owned it before they left the team still has to be shown, or the box would
    quietly look as if it belonged to the first person on the list */
 if(t.owner&&!ppl.some(p=>p.id===t.owner)){const o=who(t.owner);
  if(o)out+='<option value="'+esc(o.id)+'" selected>'+esc(o.name)+' · not in this team any more</option>'}
 return '<select data-own="'+esc(t.id)+'" aria-label="Owner">'+out+'</select>';
};

/* 1 · and the same rule where an owner is actually set, so a stale picker or a keyboard
   shortcut cannot set somebody from another team either */
const _asgTeam=assign;
assign=function(t,pid){
 try{
  if(t&&pid&&!canOwn(pid,t.dept)){
   const p=who(pid);
   toast((p?p.name:'That person')+' is not in '+esc(dept(t.dept).name)+'. Use "Move to team…" to send the whole conversation there.',true);
   return;
  }
 }catch(e){}
 return _asgTeam.apply(this,arguments);
};

/* 4 · Admin only: move the whole conversation to another team, unassigned */
function moveTeamDlg(t){
 if(!t||who(ME).role!=='Admin')return;
 const others=DEPTS.filter(d=>d.id!==t.dept);
 if(!others.length){toast('There is only one team set up');return}
 const L=dlg('Move to team',
  '<p style="margin:0 0 10px;color:var(--muted);font-size:13px">“'+esc(cleanSub(t.sub))+'” moves to the team you pick and waits there with <b>no owner</b>, so anyone in that team can take it. Nothing is deleted and the whole trail goes with it.</p>'+
  '<div class="mtlist">'+others.map(d=>{
    const np=PEOPLE.filter(p=>p.dept===d.id&&p.active!==false).length;
    return '<button type="button" class="btn mtrow" data-mtpick="'+esc(d.id)+'"><span class="ddot" style="background:'+esc(d.color)+'"></span><b>'+esc(d.name)+'</b><span class="sub">'+esc(mailOf(d))+' · '+np+' '+(np===1?'person':'people')+'</span></button>';
  }).join('')+'</div>',
  '<button class="btn" data-c>Cancel</button>',true);
 const c=L.querySelector('[data-c]');if(c)c.onclick=()=>{L.innerHTML=''};
 L.querySelectorAll('[data-mtpick]').forEach(b=>b.onclick=()=>{
  const to=dept(b.dataset.mtpick),from=dept(t.dept);
  if(!to)return;
  t.dept=to.id;t.owner='';t.status='new';t.folder='inbox';t.unread=true;
  hist(t,'x','Moved from '+from.name+' to '+to.name+' by '+who(ME).name+' — waiting for an owner in '+to.name);
  save();L.innerHTML='';openId=null;toast('Moved to '+to.name+' — nobody owns it yet');render();
 });
}

/* the item in the conversation menu (right-click, and "More actions" opens the same menu) */
const _cmTeam=cmOpen;
cmOpen=function(t,x,y,row){
 const r=_cmTeam.apply(this,arguments);
 try{
  if(who(ME).role!=='Admin')return r;
  const m=document.querySelector('.cmenu');if(!m||m.querySelector('[data-moveteam]'))return r;
  const del=m.querySelector('[data-cm="del"]');
  const b=document.createElement('button');
  b.type='button';b.setAttribute('role','menuitem');b.setAttribute('data-moveteam','');
  b.innerHTML='\u{1F3E2} Move to team…';
  b.title='Admin only — send the whole conversation to another team, with no owner';
  m.insertBefore(b,del||null);
  /* the menu is positioned on the size it had when it was built */
  const W=m.offsetWidth,H=m.offsetHeight;
  m.style.left=Math.max(4,Math.min(x,innerWidth-W-4))+'px';
  m.style.top=Math.max(4,Math.min(y,innerHeight-H-4))+'px';
 }catch(e){}
 return r;
};
document.addEventListener('click',function(e){
 const b=e.target.closest&&e.target.closest('[data-moveteam]');
 if(!b)return;
 e.preventDefault();e.stopPropagation();
 const t=(typeof _cmT!=='undefined'&&_cmT)||(openId&&T_(openId));
 try{cmClose()}catch(e2){}
 if(t)moveTeamDlg(t);
},true);

/* ------------------------------------------------------------------ CSS --- */
(function otCSS(){
 if(document.getElementById('otCSS'))return;
 const st=document.createElement('style');st.id='otCSS';
 st.textContent=[
  '.ownone{font-weight:700}',
  '.mtlist{display:flex;flex-direction:column;gap:6px}',
  '.mtrow{display:flex;gap:9px;align-items:center;justify-content:flex-start;text-align:left;padding:9px 11px;width:100%}',
  '.mtrow .sub{margin-left:auto;font-size:11.5px;opacity:.7;font-weight:500}',
  '.mtrow .ddot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}'
 ].join('');
 document.head.appendChild(st);
})();
/* __ownerteam:end */</script>
`;
const a = s.indexOf("<script>/* __ownerteam:start");
if (a >= 0) {
  const b = s.indexOf("/* __ownerteam:end */</scr" + "ipt>", a);
  if (b < 0) throw new Error("the old __ownerteam block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + ("/* __ownerteam:end */</scr" + "ipt>").length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

fs.writeFileSync(F, s);
console.log(n + " edit(s) + the block. written to " + F);
