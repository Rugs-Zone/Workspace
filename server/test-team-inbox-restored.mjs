import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
const cut = (a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i); return src.slice(i, j); };
const env = `
let ME='ashish', view={type:'box',dept:'tp',folder:'inbox'}, filt='all';
const S={settings:{mgr_first_boxes:[]}};
const DEPTS=[{id:'tp',name:'Team Pulse',box:'teampulse'}];
const DOMAIN='@rugscreation.com';
const dept=id=>DEPTS.find(d=>d.id===id)||{id,box:'unknown@'};
const mailOf=d=>d.box+DOMAIN;
const PEOPLE=[
 {id:'ashish',name:'Ashish Deshwal',login:'merchandiser9@rugscreation.com',dept:'tp',role:'Executive',active:true,perm:{}},
 {id:'arun',name:'Arun',login:'merchandiser7@rugscreation.com',dept:'tp',role:'Executive',active:true,perm:{}},
 {id:'shubham',name:'Shubham Aneja',login:'dmm1@rugscreation.com',dept:'tp',role:'Manager',active:true,perm:{}}];
const who=id=>PEOPLE.find(p=>p.id===id)||null;
const MGR_FIRST=[];
function mgrFirstBoxes(){return MGR_FIRST}
function mgrFirst(d){return false}
const msgMine=()=>false;
${cut("function nmKey(s){", "function sentWho(m,t){")}
${cut("function sentWho(m,t){", "\nfunction ")}
${cut("function partsOf(t) {", "/* the My work view, its count and the Mine filter all follow the same rule */")}
${cut("const UNASSIGNED_TEAM_INBOX=", "/* 20 Nov 2026: a mailbox somebody sees ONLY the critical")}
`;
const api = new Function(env + "; return {seeMine,setME:v=>{ME=v}}")();
const buyer = { at: 1, from: "Buyer", email: "b@x.com" };
const myReply = { at: 2, from: "Ashish Deshwal", by: "ashish", ours: true };
let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = g === w; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ")")); ok ? pass++ : fail++; };
console.log("=== yesterday's rule (25 Nov) is back ===");
ck("unassigned mail is in the whole team's Inbox again", api.seeMine({ id: "1", dept: "tp", owner: null, msgs: [buyer] }), true);
ck("a conversation I replied in - still mine", api.seeMine({ id: "2", dept: "tp", owner: null, msgs: [buyer, myReply] }), true);
ck("mail assigned to me - mine", api.seeMine({ id: "3", dept: "tp", owner: "ashish", msgs: [buyer] }), true);
ck("a colleague's assigned mail - still hidden (that is the 25 Nov rule)", api.seeMine({ id: "4", dept: "tp", owner: "arun", msgs: [buyer] }), false);
ck("owned by a colleague but I replied - mine", api.seeMine({ id: "5", dept: "tp", owner: "arun", msgs: [buyer, myReply] }), true);
api.setME("shubham");
ck("the manager still sees a member's assigned mail", api.seeMine({ id: "6", dept: "tp", owner: "arun", msgs: [buyer] }), true);
ck("the manager still sees unassigned mail", api.seeMine({ id: "7", dept: "tp", owner: null, msgs: [buyer] }), true);
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
