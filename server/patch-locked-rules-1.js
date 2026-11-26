/* patch-locked-rules-1.js — 26 Nov 2026
 *
 * The first four locked rules, plus the shared "do not disturb earlier emails" guard.
 *
 *   C2   replying takes the conversation when nobody owns it; a MANAGER replying takes
 *        it over completely (the user's tap, 26 Nov). Every take writes a history line -
 *        the silent version of this is what lost Gulab's conversation on 26 Nov.
 *   C5   "Both": transfer is on for everybody, and a member may assign to a colleague.
 *   R16q mail sent from the mailbox under NOBODY's name (From name "Team Pulse") is
 *        manager-only, because it cannot be proved to be any member's.
 *   O4   every critical mail in a team is in that team manager's My work, even when a
 *        member owns it.
 *   C1   mail nobody has taken leaves a member's Inbox after 30 minutes and lives under
 *        "Needs owner". The 30 minutes only tick between 10:00 and 18:00 IST, and not at
 *        all on Sundays or holidays, so a mail arriving at 19:00 is still in everyone's
 *        Inbox in the morning and its half hour starts at 10:00.
 *
 * THE GUARD (user: "please dont disturb on earlier emails"): every rule that HIDES
 * something checks RULES_FROM and does nothing to a conversation whose newest mail is
 * older than that moment. So no mail anybody can see today disappears; the rules act on
 * mail that arrives from now on. C2 and C5 need no guard - they are actions, not filters.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-locked-rules-1.js
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

/* ------------------------------------------------------------------ C5
   can() is a const arrow, so it cannot be wrapped from a later script
   (that throws "Assignment to constant variable" - learned 25 Nov). The two
   keys are added inside the definition instead. */
one(
  "const can=(k,pid=ME)=>{const p=who(pid);return !!p&&(p.role==='Admin'||!!p.perm?.[k])};",
  "const can=(k,pid=ME)=>{const p=who(pid);if(!p)return false;"
  + "\n /* __c5 26 Nov 2026: C5 \"Both\" - everybody may transfer, and a member may assign to a"
  + "\n    colleague. Per-person ticks in Admin -> Users no longer decide these two; every other"
  + "\n    right (delete, dashboards, buddy) still reads its own tick. */"
  + "\n if((k==='assign'||k==='transfer')&&p.active!==false)return true;"
  + "\n return p.role==='Admin'||!!p.perm?.[k]};",
  "C5 - transfer and assign on for everybody"
);

/* ------------------------------------------------------------------ C2 */
one(
  " /* __noautotake:end */",
  " /* __noautotake:end */\n"
  + " /* __c2:start 26 Nov 2026: C2 - REPLYING TAKES THE CONVERSATION.\n"
  + "    - nobody owns it  -> the replier becomes the owner;\n"
  + "    - a MANAGER (or Lead / CRM / Admin) replies to somebody else's -> he takes it over\n"
  + "      completely (the user's own choice of the three options). The member who had it\n"
  + "      still SEES it, because he worked in it, but it becomes the manager's work;\n"
  + "    - a member replying to a colleague's conversation changes nothing.\n"
  + "    Every take writes a history line. The 26 Nov reason for switching this off was that\n"
  + "    it happened SILENTLY from a stale browser copy and nobody could see who had done it;\n"
  + "    the line below is what makes that traceable. */\n"
  + " try{const _me=who(ME)||{},_mgr=_me.role==='Admin'||['Manager','Lead','CRM'].includes(_me.role);\n"
  + "  if(!t.owner){t.owner=ME;hist(t,'a',`Taken by ${_me.name||'somebody'} — replied`)}\n"
  + "  else if(_mgr&&t.owner!==ME){const _was=who(t.owner);t.owner=ME;\n"
  + "   hist(t,'a',`Taken over by ${_me.name||'the manager'} — replied. Was ${(_was&&_was.name)||'somebody'}`)}\n"
  + "  if(t.status==='new')t.status='open'}catch(e){}\n"
  + " /* __c2:end */",
  "C2 - replying takes the conversation"
);

/* ------------------------------------------------------------- C1, R16q, O4
   Appended as its own script block so these wrappers are the OUTERMOST layer:
   seeMine already carries nine wrappers (the team rule, critical-only, login
   codes, the mirror and the per-pass memo), and an inner one would be bypassed. */
const BLOCK = `
<script>/* __locked1:start 26 Nov 2026 — C1, R16q, O4. See server/patch-locked-rules-1.js */

/* ===== the guard: these rules never touch mail that is already in a mailbox =====
   The user's instruction was "please dont disturb on earlier emails". Every rule below
   asks newMail(t) first, and a conversation whose newest mail is older than this moment
   is left exactly as it is today. Moving this forward re-arms the rules for later mail;
   it is the one number to change if they are ever switched on for history as well. */
const RULES_FROM=Date.parse('2026-11-26T18:30:00+05:30');
function newMail(t){try{return !!t&&(t.last||0)>=RULES_FROM}catch(e){return false}}

/* ===== the working-day clock (C1) =====
   10:00 to 18:00 IST, nothing on a Sunday, nothing on a holiday. Worked out in IST on
   purpose (ms+19800000 read with the getUTC* methods gives IST wall-clock), so a laptop
   left on another time zone cannot shift the office day. */
const WORK_OPEN=10*60, WORK_CLOSE=18*60, WINDOW_MINS=30, DAY_MS=86400000, IST=19800000;
const HOLIDAYS_FALLBACK=[];   /* 'YYYY-MM-DD'. Empty until the server sends the company list */
function holidays(){try{const v=S.settings&&S.settings.holidays;
 return Array.isArray(v)?v.map(x=>String(x).slice(0,10)):HOLIDAYS_FALLBACK}catch(e){return HOLIDAYS_FALLBACK}}
function offDay(ist){try{
 if(ist.getUTCDay()===0)return true;                       /* Sunday */
 const k=ist.toISOString().slice(0,10);
 return holidays().indexOf(k)>=0;
}catch(e){return false}}
function workMins(from,to){try{
 if(!(to>from))return 0;
 let total=0,cur=from;
 for(let guard=0;cur<to&&guard<500;guard++){
  const ist=new Date(cur+IST);
  const mid=Date.UTC(ist.getUTCFullYear(),ist.getUTCMonth(),ist.getUTCDate())-IST;  /* IST midnight */
  if(!offDay(ist)){
   const a=Math.max(cur,mid+WORK_OPEN*60000),b=Math.min(to,mid+WORK_CLOSE*60000);
   if(b>a)total+=(b-a)/60000;
  }
  cur=mid+DAY_MS;
 }
 return total;
}catch(e){return 1e9}}                                      /* on any doubt, do not hide it */

/* Has the shared half hour run out for this conversation? Cached for 30 seconds per
   conversation, because seeMine is asked about every row on every draw. */
function sharedWindowOver(t){try{
 if(!newMail(t))return false;                               /* earlier mail: untouched */
 const now=Date.now();
 if(t._winAt&&now-t._winAt<30000)return !!t._winOver;
 const over=workMins(t.last||0,now)>=WINDOW_MINS;
 t._winAt=now;t._winOver=over;
 return over;
}catch(e){return false}}

/* ===== C1: mail nobody has taken leaves a member's Inbox after the half hour ===== */
const _smWin=seeMine;
seeMine=function(t){
 const base=_smWin.apply(this,arguments);
 if(base!==true)return base;
 try{
  if(!t||t.owner)return true;                               /* only mail nobody has taken */
  const p=who(ME)||{};
  if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;
  if(typeof isMyWork==='function'&&isMyWork(t))return true; /* I have worked in it */
  if(typeof isOtp==='function'&&isOtp(t))return true;       /* a login code is never hidden */
  if(!hideUnowned(t))return true;                           /* Needs owner / the Unassigned chip */
  return !sharedWindowOver(t);
 }catch(e){return true}
};

/* ===== R16q: sent under nobody's name is manager-only =====
   Only that one case changes. A mail I sent, or one that can be traced to a person, is
   decided exactly as before. Everyone sends from Rugs Email now, so this is really about
   mail arriving from Outlook under the mailbox's own name. */
const _ssUntraced=sentSeen;
sentSeen=function(t){
 try{
  const p=who(ME)||{};
  if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;
  if(newMail(t)){
   const out=(t.msgs||[]).filter(m=>m.by||(m.ours&&!colleagueIn(m,t)));
   if(out.length&&!out.some(m=>msgMine(m,t))&&!out.some(m=>sentWho(m,t)))return false;
  }
 }catch(e){}
 return _ssUntraced.apply(this,arguments);
};

/* ===== O4: critical mail is the manager's work =====
   A manager already SAW everything in his team; this puts the critical ones (claim,
   shipment delay, cancellation...) on his plate as well, so one is never only a
   member's problem. It is on two plates at once by design. The My work view itself still
   drops anything Done and anything with nothing received, so the old swept history
   cannot appear. Admins are left out on purpose - nine mailboxes of critical mail is
   not one person's plate. */
const _imwCrit=isMyWork;
isMyWork=function(t){
 if(_imwCrit.apply(this,arguments))return true;
 try{
  if(!t||!newMail(t))return false;
  const p=who(ME)||{};
  if(!['Manager','Lead'].includes(p.role))return false;
  if(!p.dept||p.dept!==t.dept)return false;                 /* his own team only */
  return (typeof critOf==='function')&&critOf(t).length>0;
 }catch(e){return false}
};
/* __locked1:end */</script>
`;

if (s.indexOf("__locked1:start") >= 0) {
  console.log("already done: C1 / R16q / O4 block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  n++;
  console.log("patched: C1 / R16q / O4 block appended");
}

fs.writeFileSync(F, s);
console.log("\n" + n + " edit(s) written to " + F);
