/* test-mail-rules.mjs - 26 Nov 2026
 *
 * Checks the Mail rules page the way the other rule tests do it: the registry, the conflict
 * engine and the EIGHT gates are cut verbatim out of the shipped app (.tmp/email.html) and
 * run here, so a passing test is about the code that ships, not about a copy.
 *
 * Two halves:
 *   A  the registry and the conflict engine - every rule is complete, and a change really
 *      reports the conflicts, the warnings and the live numbers it should;
 *   B  the gates - with a switch moved, seeMine / can / LV / the OTP wrapper really behave
 *      differently. A switch that changes nothing would be worse than no switch at all.
 *
 * Run:  node server/test-mail-rules.mjs
 */
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
const cut = (a, b) => {
  const i = src.indexOf(a); if (i < 0) throw new Error("not found in the app: " + a);
  const j = src.indexOf(b, i); if (j < 0) throw new Error("no end for: " + a);
  return src.slice(i, j);
};

/* ---------------------------------------------------------------- the world */
const env = `
let ME='imran', view={type:'box',dept:'ta',folder:'inbox'}, filt='all', app='mail', adminTab='overview', openId=null;
let DEPTS=[{id:'ta',name:'Team Alpha',box:'teamalpha',color:'#f50'},{id:'ms',name:'Mis',box:'mis',color:'#09c'}];
const DOMAIN='@rugscreation.com';
const dept=id=>DEPTS.find(d=>d.id===id)||null;
const mailOf=d=>d.box+DOMAIN;
let PEOPLE=[
 {id:'imran',name:'Imran Khan',login:'merchandiser4@rugscreation.com',dept:'ta',role:'Executive',active:true,perm:{}},
 {id:'gulab',name:'Gulab Tyagi',login:'amr1@rugscreation.com',dept:'ta',role:'Executive',active:true,perm:{}},
 {id:'jagjit',name:'Jagjit Singh',login:'merchandiser2@rugscreation.com',dept:'ta',role:'Manager',active:true,perm:{}},
 {id:'bhawna',name:'Bhawna',login:'dmm3@rugscreation.com',dept:'ms',role:'Manager',active:true,perm:{}},
 {id:'adm',name:'Priyanshu Tomar',login:'marketing@rugscreation.com',dept:'mkt',role:'Admin',active:true,perm:{}}];
const who=id=>PEOPLE.find(p=>p.id===id)||null;
const esc=s=>String(s==null?'':s);
const toast=()=>{};
const render=()=>{};
const api=()=>Promise.resolve({});
const dlg=()=>({querySelector:()=>null});
const av=()=>'';
const ico=()=>'';
let OLDMAIL={history_days:365,hide_before_live:false,live_at:null,loaded:true};
const beforeLive=t=>!!(OLDMAIL.hide_before_live&&OLDMAIL.live_at&&(t.last||0)<OLDMAIL.live_at);
const hasRecv=t=>(t.msgs||[]).some(m=>!m.ours);
const isWsNotif=t=>!!(t&&t.wsn);
let isInboxMail=t=>t.folder==='inbox'&&hasRecv(t);
let listRows=()=>[];
let inView=()=>true;
const msgMine=(m,t)=>!!(m&&m.by===ME);
const APP_BUILD='test';
const S={settings:{},threads:[],lvOf:{},prefs:{}};
/* 27 Nov: rule M1 reads the memory guard (server/patch-mem-cap-m1.js). The harness gives it
   the same shape the real one returns, and MEMCAP lets a test push the tab over the ceiling. */
let MEMCAP={nowMB:62.4,timesItHadToAct:0};
const window={rzMemCap:()=>Object.assign({capMB:250,switchable:false},MEMCAP)};
let MGR_FIRST=[];
function mgrFirstBoxes(){const v=S.settings&&S.settings.mgr_first_boxes;return Array.isArray(v)?v.map(x=>String(x).toLowerCase()):MGR_FIRST}
function mgrFirst(d){const x=dept(d);return !!x&&mgrFirstBoxes().indexOf(String(mailOf(x)||'').toLowerCase())>=0}
const LV_DEF={sort:'date',dir:'desc',vf:'all',pane:'right',conv:true,lines:1};
${cut("function nmKey(s){", "function sentWho(m,t){")}
${cut("function sentWho(m,t){", "\nfunction ")}
${cut("function partsOf(t) {", "/* the My work view, its count and the Mine filter all follow the same rule */")}
${cut("const UNASSIGNED_TEAM_INBOX=", "/* 20 Nov 2026: a mailbox somebody sees ONLY the critical")}
${cut("const OTP_SUB=", "const _rowOtp=rowHTML")}
${cut("const RULES_KEY = 'mail_rules'", "/* ================================================= THE TWO WRAPPED RULES ==")}
${cut("const can=(k,pid=ME)=>", "\n")}
${cut("const LV=()=>", "\n")}
/* the two wrapped rules, R7 and R11, exactly as the app installs them */
function rInboxView(){try{return view.type==='all'||(view.type==='box'&&view.folder==='inbox')}catch(e){return false}}
const _imR7=isInboxMail;
isInboxMail=function(t){if(t&&t.status==='done'&&!RON('R7'))return false;return _imR7.apply(this,arguments)};
const _wsnR11=isWsNotif;
`;
const A = new Function(env + `; return {
  RULES,RGROUPS,RDEF,RV,RON,RCAN,rChk,rChkMgr,rHealth,rById,rInbox,
  seeMine:t=>seeMine(t),can:(k,p)=>can(k,p),LV,isInboxMail:t=>isInboxMail(t),
  set:(k,v)=>{S.settings.mail_rules={v:1,vals:Object.assign({},(S.settings.mail_rules||{}).vals||{},{[k]:v})}},
  clear:()=>{S.settings.mail_rules=null},
  setME:v=>{ME=v}, setView:v=>{view=v}, setFilt:v=>{filt=v},
  setThreads:v=>{S.threads=v}, setMgr:v=>{S.settings.mgr_first_boxes=v},
  setOld:v=>{OLDMAIL=Object.assign(OLDMAIL,v)}, setLv:v=>{S.lvOf=v},
  setMem:v=>{MEMCAP=v}, rMemNow,
  dropManager:()=>{PEOPLE=PEOPLE.filter(p=>p.id!=='jagjit')},
  addManager:()=>{PEOPLE.push({id:'jagjit',name:'Jagjit Singh',login:'merchandiser2@rugscreation.com',dept:'ta',role:'Manager',active:true,perm:{}})}
}`)();

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = g === w; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };
const has = (n, arr, word) => { const ok = (arr || []).some(x => String(x).toLowerCase().includes(word.toLowerCase())); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (nothing said \"" + word + "\" in " + JSON.stringify(arr) + ")")); ok ? pass++ : fail++; };

/* mail to count against */
const buyer = { at: 1, from: "Buyer", email: "b@x.com" };
const mine = { at: 2, from: "Imran Khan", by: "imran", ours: true };
const THREADS = [
  { id: "a", dept: "ta", folder: "inbox", owner: null, status: "new", sub: "New enquiry", msgs: [buyer] },
  { id: "b", dept: "ta", folder: "inbox", owner: "gulab", status: "open", sub: "PO 174871", msgs: [buyer] },
  { id: "c", dept: "ta", folder: "inbox", owner: null, status: "done", sub: "Old history", msgs: [buyer] },
  { id: "d", dept: "ta", folder: "inbox", owner: "imran", status: "done", sub: "Finished", msgs: [buyer, mine] },
  { id: "e", dept: "ta", folder: "inbox", owner: null, status: "new", sub: "Your OTP is 448213", msgs: [buyer] },
  { id: "f", dept: "ta", folder: "inbox", owner: null, status: "new", sub: "Your pending tasks", wsn: true, msgs: [buyer] },
  { id: "g", dept: "ta", folder: "sent", owner: "imran", status: "open", sub: "Sent only", msgs: [mine] }
];
A.setThreads(THREADS);

/* =============================================== A · registry and defaults */
console.log("=== A1 · the registry is complete and honest ===");
ck("every rule has an id, a group, a name, a 'what it does now' and a 'who'",
  A.RULES.every(r => r.id && r.g && r.n && r.now && r.who && Array.isArray(r.brk) && r.brk.length), true);
ck("every rule's kind is one we draw", A.RULES.every(r => ['sw', 'fx', 'srv', 'off', 'set', 'req'].includes(r.k)), true);
ck("every rule's group is in the group list", A.RULES.every(r => A.RGROUPS.includes(r.g)), true);
ck("no two rules share an id", new Set(A.RULES.map(r => r.id)).size === A.RULES.length, true);
ck("every group has at least one rule", A.RGROUPS.every(g => A.RULES.some(r => r.g === g)), true);
ck("8 rules can really be switched here", A.RULES.filter(r => r.k === 'sw').length, 8);
ck("every switchable rule has a shipped default", A.RULES.filter(r => r.k === 'sw').every(r => A.RDEF[r.id] !== undefined), true);
ck("the whole of MAIL-RULES-LIVE list A is on the page",
  ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22', 'R23', 'R24', 'R25', 'R26', 'R27', 'R28', 'R29', 'R30', 'R31', 'R32', 'R33', 'R34'].every(id => !!A.rById(id)), true);
ck("the rules built but NOT switched on are listed as such",
  ['C1', 'C2', 'C5', 'R16q', 'O4', 'C3', 'C4'].every(id => !!A.rById(id)), true);

console.log("\n=== A2 · with nothing saved, the page is today's app ===");
A.clear();
ck("R1  mail nobody has taken is seen by the whole team", A.RON('R1'), true);
ck("R3  a taken conversation is private", A.RON('R3'), true);
ck("R7  Done mail stays in the Inbox", A.RON('R7'), true);
ck("R10 a login code is shown to everyone", A.RON('R10'), true);
ck("R11 Workspace notifications keep their own folder", A.RON('R11'), true);
ck("R17 one row per MAIL is ON (26/27 Nov, plan P1)", A.RON('R17'), true);
ck("R27 replying does NOT take ownership", A.RON('R27'), false);
ck("C5  transfer/assign still follow the per-person ticks", A.RON('C5'), false);

/* ==================================================== A3 · the conflicts  */
console.log("\n=== A3 · changing a rule reports the conflict, the cost and the numbers ===");
let c = A.rChk('R1', false);
ck("R1 off: no hard conflict while the team has a manager", c.hard.length, 0);
has("R1 off: says how many conversations leave the members' Inbox", c.eff, "nobody has taken");
has("R1 off: warns that buyers wait longer", c.warn, "buyers wait longer");
has("R1 off: names the 26 November reports", c.warn, "26 november");
A.dropManager();
c = A.rChk('R1', false);
has("R1 off with no Manager or Lead: REFUSED, and says which team", c.hard, "Team Alpha");
A.addManager();

A.set('R3', false);
c = A.rChk('R1', false);
has("R1 off while R3 is off: warns the two are the wrong way round", c.warn, "wrong way round");
A.clear();

c = A.rChk('R3', false);
has("R3 off: refused, and quotes what was reported on 26 November", c.hard, "ashok");
has("R3 off: counts the conversations that would be opened up", c.eff, "belong to somebody");

c = A.rChk('R7', false);
has("R7 off: refused, and names the 17 November sweep", c.hard, "43,296");
has("R7 off: counts the Done mail that would leave the Inbox", c.eff, "marked Done");
ck("R7 off: the count is the real one (2 of the 6 Inbox conversations are Done)",
  /\b2 conversations of the 6 now in the Inbox\b/.test(c.eff.join(" ")), true);
A.setOld({ hide_before_live: true, live_at: 1 });
c = A.rChk('R7', false);
has("R7 off while old mail is hidden: warns the two together empty the screen", c.warn, "almost nothing");
A.setOld({ hide_before_live: false, live_at: null });

c = A.rChk('R10', false);
has("R10 off: refused, because a code would reach nobody", c.hard, "reach nobody");
has("R10 off: says codes expire in minutes", c.hard, "expire");
has("R10 off: names the 20 November report", c.warn, "otp is not showing");

c = A.rChk('R11', false);
has("R11 off: counts the notifications that would flood the Inbox", c.eff, "workspace notification");
has("R11 off: warns the counts grow with mail nobody answers", c.warn, "nobody ever answers");

c = A.rChk('R17', true);
has("R17 on: says how many rows the list would build", c.eff, "rows instead of");
has("R17 on: warns about the browser doing more work", c.warn, "memory");
c = A.rChk('R17', false);
has("R17 off: warns a single mail then has no row of its own", c.warn, "no row of its own");

c = A.rChk('R27', true);
has("R27 on: refused, and tells the Gulab/Jagjit story", c.hard, "gulab");
has("R27 on: warns it also removes the mail from the team", c.warn, "leave every other member");

c = A.rChk('C5', true);
has("C5 on: counts the people who gain the right", c.eff, "another team");
has("C5 on: warns there is no undo for a transfer", c.warn, "no undo");

console.log("\n=== A4 · manager-first has its own check ===");
c = A.rChkMgr('teamalpha@rugscreation.com', true);
has("manager-first on: says every automatic rule stops for that mailbox", c.hard, "automatic rule");
has("manager-first on: names who it all lands on", c.warn, "Jagjit");
has("manager-first on: tells the Team Designing story", c.warn, "3,857");
A.dropManager();
c = A.rChkMgr('teamalpha@rugscreation.com', true);
has("manager-first on a team with no manager: refused", c.hard, "no Manager");
A.addManager();
c = A.rChkMgr('teamalpha@rugscreation.com', false);
has("manager-first off: says the automatic rules start again", c.eff, "handing it out again");

/* 27 Nov 2026 - rule M1 (mandatory): this tab stays under 250 MB. It is a rule on this page
   with no switch at all, and the page must read the real figure rather than promise one. */
console.log("\n=== A4b · M1 is mandatory, and has no switch ===");
const m1 = A.rById("M1");
ck("M1 is in the registry", !!m1, true);
ck("...as a mandatory rule, not a switch", m1 && m1.k, "req");
ck("...so it is not one of the switchable defaults", "M1" in A.RDEF, false);
ck("...and 'put every rule back' cannot reach it", A.RULES.filter(r => r.id === "M1" && r.k === "sw").length, 0);
ck("...and it lives in its own section", m1 && m1.g, "Speed and memory");
A.setMem({ nowMB: 62.4, timesItHadToAct: 0 });
has("it shows the live figure, not a promise", [m1.now()], "62.4 MB (25% of 250 MB)");
A.setMem({ nowMB: 240, timesItHadToAct: 3 });
has("a tab near the ceiling says so", [m1.now()], "240 MB (96% of 250 MB)");
has("...and says how often it has had to clear copies", [m1.now()], "3 times");
ck("the figure comes straight from the guard", A.rMemNow().mb, 240);

console.log("\n=== A5 · the checks at the top of the page ===");
A.setMem({ nowMB: 62.4, timesItHadToAct: 0 });
A.clear(); A.setMgr([]); A.setLv({}); A.setOld({ hide_before_live: false, live_at: null });
let hz = A.rHealth();
ck("a healthy app flags nothing that hides mail", hz.filter(x => x.bad).length, 0);
has("it says in plain words that M1 is holding", hz.map(x => x.t), "Rule M1 is holding: 62.4 MB of 250 MB");
A.setMem({ nowMB: 268, timesItHadToAct: 2 });
has("a tab over the ceiling is flagged", A.rHealth().filter(x => x.bad).map(x => x.t), "over the 250 MB ceiling (268 MB)");
A.setMem({ nowMB: 210, timesItHadToAct: 1 });
has("...and so is one at 80% of it", A.rHealth().filter(x => x.bad).map(x => x.t), "84% of the 250 MB ceiling");
A.setMem({ nowMB: 62.4, timesItHadToAct: 0 });
A.setOld({ hide_before_live: true, live_at: Date.now() });
has("it flags 'Hide mail from before Go live'", A.rHealth().map(x => x.t), "Go live");
A.setOld({ hide_before_live: false, live_at: null });
A.setLv({ gulab: 'unread' });
hz = A.rHealth();
has("it names the person whose View 'Show' filter is set", hz.map(x => x.t + ' ' + x.d), "Gulab");
has("and says it is the commonest cause of missing mail", hz.map(x => x.d), "commonest cause");
A.setLv({});
A.setMgr(['teamalpha@rugscreation.com']);
has("it flags a manager-first team and the assign rules being off", A.rHealth().map(x => x.d), "automatic assign rule");
A.setMgr([]);
A.dropManager();
has("it flags a team with no Manager or Lead", A.rHealth().map(x => x.t), "no Manager");
A.addManager();

/* ============================================== B · the gates really work */
console.log("\n=== B1 · R1 really hides unassigned mail from a member ===");
A.clear(); A.setME('imran'); A.setView({ type: 'box', dept: 'ta', folder: 'inbox' }); A.setFilt('all');
ck("R1 on  (shipped): a member sees mail nobody has taken", A.seeMine(THREADS[0]), true);
A.set('R1', false);
ck("R1 off: a member does NOT see it in the Inbox", A.seeMine(THREADS[0]), false);
A.setFilt('needs');
ck("R1 off: the same mail IS there behind the Unassigned chip", A.seeMine(THREADS[0]), true);
A.setFilt('all'); A.setView({ type: 'fav', id: 'needs' });
ck("R1 off: and in the Needs owner list", A.seeMine(THREADS[0]), true);
A.setView({ type: 'box', dept: 'ta', folder: 'inbox' });
A.setME('jagjit');
ck("R1 off: the manager is never affected", A.seeMine(THREADS[0]), true);
A.setME('adm');
ck("R1 off: the admin is never affected", A.seeMine(THREADS[0]), true);
A.setME('imran');
ck("R1 off: a conversation I replied in is still mine", A.seeMine({ id: "x", dept: "ta", owner: null, msgs: [buyer, mine] }), true);

console.log("\n=== B2 · R3 really opens up a colleague's mail ===");
A.clear();
ck("R3 on  (shipped): a colleague's conversation is hidden from me", A.seeMine(THREADS[1]), false);
A.set('R3', false);
ck("R3 off: I see it", A.seeMine(THREADS[1]), true);
A.clear();

console.log("\n=== B3 · R10 really decides whether a login code is shown ===");
A.setME('imran');
ck("R10 on  (shipped): a code owned by nobody is shown", A.seeMine(THREADS[4]), true);
ck("R10 on: a code inside a colleague's conversation is still shown",
  A.seeMine({ id: "o", dept: "ta", owner: "gulab", sub: "Your OTP is 448213", msgs: [buyer] }), true);
A.set('R10', false);
ck("R10 off: that same code is hidden with the conversation",
  A.seeMine({ id: "o", dept: "ta", owner: "gulab", sub: "Your OTP is 448213", msgs: [buyer] }), false);
A.clear();

console.log("\n=== B4 · R7 really takes Done mail out of the Inbox counts ===");
ck("R7 on  (shipped): a Done conversation still counts as Inbox mail", A.isInboxMail(THREADS[2]), true);
A.set('R7', false);
ck("R7 off: it does not", A.isInboxMail(THREADS[2]), false);
ck("R7 off: mail that is NOT done is untouched", A.isInboxMail(THREADS[0]), true);
A.clear();

console.log("\n=== B5 · C5 really gives transfer and assign to everybody ===");
ck("C5 off (shipped): a member cannot transfer", A.can('transfer', 'imran'), false);
ck("C5 off: a member cannot assign", A.can('assign', 'imran'), false);
ck("C5 off: an admin always can", A.can('transfer', 'adm'), true);
A.set('C5', true);
ck("C5 on: a member can transfer", A.can('transfer', 'imran'), true);
ck("C5 on: a member can assign", A.can('assign', 'imran'), true);
ck("C5 on: it does NOT hand out delete", A.can('delete', 'imran'), false);
ck("C5 on: it does NOT hand out dashboards", A.can('dashboards', 'imran'), false);
A.clear();

console.log("\n=== B6 · R17 really switches the row model ===");
ck("R17 on (shipped since the night of 26/27 Nov): one row per mail", A.LV().conv, false);
A.set('R17', false);
ck("R17 off: back to one row per conversation, with no build", A.LV().conv, true);
A.set('R17', true);
ck("R17 on again: one row per mail", A.LV().conv, false);
A.clear();
ck("clearing the rule returns to the shipped model", A.LV().conv, false);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
