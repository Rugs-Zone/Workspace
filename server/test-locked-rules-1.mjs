/* 26 Nov 2026 — the four locked rules from patch-locked-rules-1.js, run against the real
   code cut verbatim out of the shipped app (.tmp/email.html):

     C1   the 30-minute shared window, with the clock running 10:00-18:00 IST,
          stopped on Sundays and holidays
     C2   replying takes the conversation; a manager replying takes it over
     C5   transfer and assign on for everybody
     R16q mail sent under nobody's name is manager-only
     O4   critical mail is in the team manager's My work

   and the guard the user asked for - "please dont disturb on earlier emails": every rule
   that hides something must leave a conversation whose newest mail predates RULES_FROM
   exactly as it is.

   Run:  node server/test-locked-rules-1.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");

/* ---- cut the real code out of the app ---- */
const cut = (startsWith, endsBefore) => {
  const i = src.indexOf(startsWith);
  if (i < 0) throw new Error("not found in the app: " + startsWith.slice(0, 60));
  const j = src.indexOf(endsBefore, i);
  if (j < 0) throw new Error("end not found for: " + startsWith.slice(0, 60));
  return src.slice(i, j);
};
const line = (needle) => {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error("not found in the app: " + needle.slice(0, 60));
  return src.slice(src.lastIndexOf("\n", i) + 1, src.indexOf("\n", i));
};

const srcUnowned = cut("const UNASSIGNED_TEAM_INBOX=", "function seeMine(t){");
const srcSeeMine = cut("function seeMine(t){", "/* 20 Nov 2026: a mailbox somebody sees ONLY");
const srcNmKey   = cut("function nmKey(s){", "function sentSeen(t){");
const srcSentSee = cut("function sentSeen(t){", "const _ivSent=inView;");
const srcParts   = cut("function partsOf(t) {", "/* the My work view, its count");
const srcLocked  = cut("/* ===== the guard", "/* __locked1:end */");
const srcC2      = cut("try{const _me=who(ME)||{},_mgr=", "/* __c2:end */");
const srcCan     = line("const can=(k,pid=ME)=>{const p=who(pid);if(!p)return false;")
                 + "\n" + src.split(line("const can=(k,pid=ME)=>{const p=who(pid);if(!p)return false;"))[1]
                     .split("return p.role==='Admin'||!!p.perm?.[k]};")[0]
                 + "return p.role==='Admin'||!!p.perm?.[k]};";

/* ---- the harness: only what those functions really touch ---- */
const harness = `
let NOW=0; Date.now=()=>NOW;
const IST_OFF=19800000;
const ist=(s)=>Date.parse(s+'+05:30');          /* '2026-11-27T11:00' -> ms */

const DEPTS=[{id:'tp',name:'Team Pulse',box:'teampulse@',color:'#111'},
             {id:'ta',name:'Team Alpha',box:'teamalpha@',color:'#222'}];
const dept=id=>DEPTS.find(d=>d.id===id)||null;
const mailOf=d=>d? d.box+'rugscreation.com' : '';

const PEOPLE=[
 {id:'ashok',   name:'Ashok',   dept:'tp', role:'Executive', active:true, perm:{}},
 {id:'arun',    name:'Arun',    dept:'tp', role:'Executive', active:true, perm:{}},
 {id:'shubham', name:'Shubham', dept:'tp', role:'Manager',   active:true, perm:{}},
 {id:'jagjit',  name:'Jagjit',  dept:'ta', role:'Manager',   active:true, perm:{}},
 {id:'adm',     name:'Priyanshu',dept:'mkt',role:'Admin',    active:true, perm:{}},
 {id:'gone',    name:'Gone',    dept:'tp', role:'Executive', active:false,perm:{}}
];
const who=id=>PEOPLE.find(p=>p.id===id)||null;
let ME='ashok';
const S={prefs:{},settings:{},threads:[]};
let view={type:'box',dept:'tp',folder:'inbox'};
let filt='';
let CRIT={};                                     /* thread id -> true when it is critical */
const critOf=t=>CRIT[t&&t.id]?['claim']:[];
const isOtp=t=>!!(t&&t.otp);
const colleagueIn=(m,t)=>!!(m&&m.colleague);
const st=t=>t&&t.status==='done'?'done':'open';
const hasRecv=()=>true;
const HIST=[];
const hist=(t,k,txt)=>{HIST.push({id:t&&t.id,k,txt});(t.h=t.h||[]).push(txt)};
const mgrFirst=()=>false;          /* manager-first is off for every team (26 Nov) */
${srcCan}
${srcUnowned}
${srcSeeMine}
${srcNmKey}
${srcSentSee}
${srcParts}
${srcLocked}
function c2reply(t){${srcC2}}
`;

const A = await import("data:text/javascript," + encodeURIComponent(
  harness + "\nexport {NOW,ist,seeMine,sentSeen,isMyWork,can,c2reply,S,HIST,CRIT,workMins,sharedWindowOver,RULES_FROM};"
  + "\nexport function set(o){ if('NOW' in o) NOW=o.NOW; if('ME' in o) ME=o.ME; if('view' in o) view=o.view; if('filt' in o) filt=o.filt; }"
  + "\nexport function holidays_(list){ S.settings.holidays=list; }"
));

/* ---- checks ---- */
let pass = 0, fail = 0;
function ck(what, got, want) {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}` + (ok ? "" : `   (got ${JSON.stringify(got)})`));
  ok ? pass++ : fail++;
}
const IST = (s) => Date.parse(s + "+05:30");

/* a fresh unassigned conversation, so the 30-second cache in sharedWindowOver cannot
   carry an answer from one check into the next */
let seq = 0;
function mk(o) {
  return Object.assign({
    id: "t" + (++seq), dept: "tp", box: "teampulse@rugscreation.com",
    folder: "inbox", status: "new", owner: "", sub: "PO 174871", pre: "please confirm",
    msgs: [{ from: "Aman", email: "aman@induskrafts.com", at: o.last, ours: false }],
    parts: []
  }, o);
}

console.log("\n=== C1 · the shared half hour, during the working day ===");
A.set({ ME: "ashok", view: { type: "box", dept: "tp", folder: "inbox" }, filt: "" });

A.set({ NOW: IST("2026-11-27T11:05") });
ck("5 minutes old — in the member's Inbox", A.seeMine(mk({ last: IST("2026-11-27T11:00") })), true);

A.set({ NOW: IST("2026-11-27T11:35") });
ck("35 minutes old — out of the member's Inbox", A.seeMine(mk({ last: IST("2026-11-27T11:00") })), false);

A.set({ filt: "needs" });
ck("...but still there under the Unassigned chip", A.seeMine(mk({ last: IST("2026-11-27T11:00") })), true);
A.set({ filt: "" });

A.set({ ME: "shubham" });
ck("...and the manager still sees it in his Inbox", A.seeMine(mk({ last: IST("2026-11-27T11:00") })), true);
A.set({ ME: "adm" });
ck("...and so does the admin", A.seeMine(mk({ last: IST("2026-11-27T11:00") })), true);
A.set({ ME: "ashok" });

console.log("\n=== C1 · the clock stops outside 10:00–18:00 ===");
A.set({ NOW: IST("2026-11-27T21:00") });
ck("arrived 19:00, now 21:00 — nobody loses it in the evening", A.seeMine(mk({ last: IST("2026-11-27T19:00") })), true);

A.set({ NOW: IST("2026-11-28T10:20") });
ck("arrived 19:00, now 10:20 next day — 20 minutes used, still there", A.seeMine(mk({ last: IST("2026-11-27T19:00") })), true);

A.set({ NOW: IST("2026-11-28T10:40") });
ck("arrived 19:00, now 10:40 next day — 40 minutes, now under Needs owner", A.seeMine(mk({ last: IST("2026-11-27T19:00") })), false);

ck("the clock really counts only working minutes (19:00 -> 10:40 = 40)",
  Math.round(A.workMins(IST("2026-11-27T19:00"), IST("2026-11-28T10:40"))), 40);

console.log("\n=== C1 · Sundays and holidays ===");
A.set({ NOW: IST("2026-11-29T12:00") });
ck("Sat 17:50 mail, Sunday noon — Sunday does not count, still there",
  A.seeMine(mk({ last: IST("2026-11-28T17:50") })), true);

A.set({ NOW: IST("2026-11-30T10:15") });
ck("...Monday 10:15, 25 minutes used — still there", A.seeMine(mk({ last: IST("2026-11-28T17:50") })), true);

A.set({ NOW: IST("2026-11-30T10:35") });
ck("...Monday 10:35, 45 minutes — out of the member's Inbox", A.seeMine(mk({ last: IST("2026-11-28T17:50") })), false);

A.holidays_(["2026-11-30"]);
A.set({ NOW: IST("2026-11-30T12:00") });
ck("Monday is a holiday — the clock does not run at all that day",
  A.seeMine(mk({ last: IST("2026-11-28T17:50") })), true);
A.holidays_([]);

console.log("\n=== the guard · earlier emails are not disturbed ===");
A.set({ NOW: IST("2026-11-27T11:35") });
ck("an unassigned mail from 20 Nov is still in the member's Inbox",
  A.seeMine(mk({ last: IST("2026-11-20T11:00") })), true);
ck("an unassigned mail from this morning (before the rule) is too",
  A.seeMine(mk({ last: IST("2026-11-26T09:00") })), true);
ck("the cut-off is the moment the rule went live", A.RULES_FROM, IST("2026-11-26T18:30"));

console.log("\n=== C1 · who keeps it anyway ===");
const worked = mk({ last: IST("2026-11-27T11:00"), parts: ["ashok"] });
ck("a member who replied keeps it after the half hour", A.seeMine(worked), true);
ck("a login code is never hidden", A.seeMine(mk({ last: IST("2026-11-27T11:00"), otp: true })), true);
ck("a colleague's OWNED conversation is still hidden, as before",
  A.seeMine(mk({ last: IST("2026-11-27T11:00"), owner: "arun" })), false);
ck("my own conversation is mine", A.seeMine(mk({ last: IST("2026-11-27T11:00"), owner: "ashok" })), true);

console.log("\n=== C2 · replying takes the conversation ===");
A.set({ ME: "ashok", NOW: IST("2026-11-27T11:00") });
let t1 = mk({ last: IST("2026-11-27T10:00") });
A.c2reply(t1);
ck("nobody owned it — the replier becomes the owner", t1.owner, "ashok");
ck("...and it is written in the history", (t1.h || []).join(" | "), (g) => /Taken by Ashok/.test(g));
ck("...and a new conversation becomes open", t1.status, "open");

let t2 = mk({ last: IST("2026-11-27T10:00"), owner: "arun", status: "open" });
A.c2reply(t2);
ck("a member replying to a colleague's — owner unchanged", t2.owner, "arun");
ck("...and nothing written in the history", (t2.h || []).length, 0);

A.set({ ME: "shubham" });
let t3 = mk({ last: IST("2026-11-27T10:00"), owner: "arun", status: "open" });
A.c2reply(t3);
ck("the manager replying takes it over completely", t3.owner, "shubham");
ck("...and the history names who had it", (t3.h || []).join(" | "), (g) => /Taken over by Shubham.*Was Arun/.test(g));

let t4 = mk({ last: IST("2026-11-27T10:00"), owner: "shubham", status: "open" });
A.c2reply(t4);
ck("the manager replying to his own — nothing happens", [t4.owner, (t4.h || []).length], ["shubham", 0]);

console.log("\n=== C5 · transfer and assign for everybody ===");
ck("a plain member may transfer", A.can("transfer", "ashok"), true);
ck("a plain member may assign", A.can("assign", "ashok"), true);
ck("delete still needs its own tick", A.can("delete", "ashok"), false);
ck("a switched-off login gets neither", [A.can("transfer", "gone"), A.can("assign", "gone")], [false, false]);
ck("the admin is unaffected", A.can("delete", "adm"), true);

console.log("\n=== R16q · sent under nobody's name ===");
A.set({ ME: "ashok", view: { type: "box", dept: "tp", folder: "sent" } });
const nameless = (at) => mk({ last: at, msgs: [{ from: "Team Pulse", email: "teampulse@rugscreation.com", at, ours: true }] });
ck("new mail nobody can be traced for — hidden from a member", A.sentSeen(nameless(IST("2026-11-27T11:00"))), false);
A.set({ ME: "shubham" });
ck("...the manager sees it", A.sentSeen(nameless(IST("2026-11-27T11:00"))), true);
A.set({ ME: "ashok" });
ck("...mail from before the rule is untouched", A.sentSeen(nameless(IST("2026-11-20T11:00"))), true);
const mine = mk({ last: IST("2026-11-27T11:00"), msgs: [{ by: "ashok", from: "Ashok", at: IST("2026-11-27T11:00"), ours: true }] });
ck("a mail I sent myself is still mine", A.sentSeen(mine), true);
A.set({ view: { type: "box", dept: "tp", folder: "inbox" } });

console.log("\n=== O4 · critical mail is the manager's work ===");
const crit = mk({ last: IST("2026-11-27T11:00"), owner: "arun", status: "open" });
A.CRIT[crit.id] = true;
A.set({ ME: "shubham" });
ck("a critical mail a member owns is in his manager's My work", A.isMyWork(crit), true);
const plain = mk({ last: IST("2026-11-27T11:00"), owner: "arun", status: "open" });
ck("an ordinary mail a member owns is not", A.isMyWork(plain), false);
const other = mk({ last: IST("2026-11-27T11:00"), owner: "jagjit", dept: "ta", status: "open" });
A.CRIT[other.id] = true;
ck("another team's critical mail is not his", A.isMyWork(other), false);
const oldCrit = mk({ last: IST("2026-11-20T11:00"), owner: "arun", status: "open" });
A.CRIT[oldCrit.id] = true;
ck("a critical mail from before the rule is not added to his plate", A.isMyWork(oldCrit), false);
A.set({ ME: "arun" });
ck("the member who owns it still has it", A.isMyWork(crit), true);
A.set({ ME: "ashok" });
ck("a member who is not the owner does not", A.isMyWork(crit), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
