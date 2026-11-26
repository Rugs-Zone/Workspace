/* 26 Nov 2026 - "team owner sees everything; a team member sees only what is auto-assigned
   to them and what they are conversing in; unassigned mail shows only under Needs owner".
   Runs the app's own seeMine / isMyWork / partsOf / sentWho, cut verbatim out of the app.

   Run:  node server/test-member-inbox-own.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
const cut = (a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error("not found: " + a.slice(0, 50)); const j = src.indexOf(b, i); if (j < 0) throw new Error("end not found: " + b.slice(0, 40)); return src.slice(i, j); };

const srcSee = cut("const UNASSIGNED_TEAM_INBOX=", "/* 20 Nov 2026: a mailbox somebody sees ONLY the critical");
const srcParts = cut("function partsOf(t) {", "/* the My work view, its count and the Mine filter all follow the same rule */");
const srcSentWho = cut("function sentWho(m,t){", "\nfunction ");
const srcNmKey = cut("function nmKey(s){", "function sentWho(m,t){");

const env = `
let ME='ashish', view={type:'box',dept:'tp',folder:'inbox'}, filt='all';
const S={settings:{mgr_first_boxes:[]}};
const DEPTS=[{id:'tp',name:'Team Pulse',mailbox:'teampulse@rugscreation.com'},
             {id:'dz',name:'Team Designing',mailbox:'designer@rugscreation.com'}];
const dept=id=>DEPTS.find(d=>d.id===id)||null;
const mailOf=d=>d&&d.mailbox;
const PEOPLE=[
 {id:'ashish', name:'Ashish Deshwal',login:'merchandiser9@rugscreation.com',dept:'tp',role:'Executive',active:true,perm:{}},
 {id:'arun',   name:'Arun',          login:'merchandiser7@rugscreation.com',dept:'tp',role:'Executive',active:true,perm:{}},
 {id:'shubham',name:'Shubham Aneja', login:'dmm1@rugscreation.com',dept:'tp',role:'Manager',active:true,perm:{}},
 {id:'priya',  name:'Priya',         login:'priya@rugscreation.com',dept:'tp',role:'CRM',active:true,perm:{}},
 {id:'adm',    name:'Priyanshu',     login:'marketing@rugscreation.com',dept:'tp',role:'Admin',active:true,perm:{}},
 {id:'nikhil', name:'Nikhil',        login:'cad1@rugscreation.com',dept:'dz',role:'Executive',active:true,perm:{}}
];
const who=id=>PEOPLE.find(p=>p.id===id)||null;
const MGR_FIRST=[];
function mgrFirstBoxes(){const v=S.settings&&S.settings.mgr_first_boxes;return Array.isArray(v)?v.map(x=>String(x).toLowerCase()):MGR_FIRST}
function mgrFirst(d){const x=dept(d);return !!x&&mgrFirstBoxes().indexOf(String(mailOf(x)||'').toLowerCase())>=0}
const msgMine=()=>false;
${srcNmKey}
${srcSentWho}
${srcParts}
${srcSee}
`;
const api = new Function(env + "; return {seeMine,setME:v=>{ME=v},setView:(v,f)=>{view=v;filt=f==null?'all':f}}")();

let pass = 0, fail = 0;
const ck = (n, got, want) => {
  const ok = got === want;
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(got) + ")"));
  ok ? pass++ : fail++;
};
const INBOX = { type: "box", dept: "tp", folder: "inbox" };
const NEEDS = { type: "fav", id: "needs" };

/* four conversations in Team Pulse */
const mine     = { id: "a", dept: "tp", owner: "ashish", msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }] };
const arunsOwn = { id: "b", dept: "tp", owner: "arun",   msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }] };
const unowned  = { id: "c", dept: "tp", owner: null,     msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }] };
const iReplied = { id: "d", dept: "tp", owner: "arun",   msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }, { at: 2, from: "Ashish", by: "ashish", ours: true }] };

console.log("=== a team MEMBER (Ashish, Executive) in the Inbox ===");
api.setME("ashish"); api.setView(INBOX);
ck("mail assigned to him - yes", api.seeMine(mine), true);
ck("a conversation he is having with the buyer - yes", api.seeMine(iReplied), true);
ck("a colleague's assigned mail - no", api.seeMine(arunsOwn), false);
ck("MAIL NOBODY HAS BEEN GIVEN YET - no (this is the change)", api.seeMine(unowned), false);

/* the case that broke on the first attempt: replying does NOT set an owner (26 Nov rule),
   so a conversation a member answers stays "unassigned" - and the unassigned rule was
   deciding first, which hid it from their own Inbox the moment they replied. */
const unownedIReplied = { id: "e", dept: "tp", owner: null, msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }, { at: 2, from: "Ashish Deshwal", by: "ashish", ours: true }] };
ck("UNASSIGNED BUT HE REPLIED IN IT - yes (it must not vanish when he answers)", api.seeMine(unownedIReplied), true);
const unownedOutlook = { id: "f", dept: "tp", owner: null, msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }, { at: 2, from: "Ashish Deshwal", fname: "Ashish Deshwal", email: "merchandiser9@rugscreation.com", ours: true }] };
ck("   ...the same when he replied from Outlook, not the app", api.seeMine(unownedOutlook), true);

console.log("\n=== the same member, under Needs owner ===");
api.setView(NEEDS);
ck("unassigned mail IS there, so it can still be picked up", api.seeMine(unowned), true);
console.log("=== and behind the Unassigned chip in the Inbox ===");
api.setView(INBOX, "needs");
ck("unassigned mail IS there too", api.seeMine(unowned), true);
ck("a colleague's assigned mail is still not", api.seeMine(arunsOwn), false);

console.log("\n=== the team OWNER and the rest see everything ===");
api.setView(INBOX);
for (const [id, label] of [["shubham", "Manager (Shubham)"], ["priya", "CRM"], ["adm", "Admin"]]) {
  api.setME(id);
  ck(label + " - unassigned", api.seeMine(unowned), true);
  ck(label + " - a member's assigned mail", api.seeMine(arunsOwn), true);
}

console.log("\n=== Team Designing is left exactly as it was ===");
const dzUnowned = { id: "e", dept: "dz", owner: null, msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }] };
api.setME("nikhil"); api.setView({ type: "box", dept: "dz", folder: "inbox" });
ck("a designer still sees unassigned design mail in the Inbox", api.seeMine(dzUnowned), true);

console.log("\n=== the switch still works if it is ever turned on ===");
api.setME("ashish"); api.setView(INBOX);
const before = api.seeMine(unowned);
ck("off: hidden from a member's Inbox", before, false);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
