/* 26 Nov 2026 - reproduces the exact situation in the screenshot: signed in (via Switch ID)
   as Shubham Aneja, Team Pulse manager, looking at teampulse@, at the conversation that is
   "Assigned - Ashok". Does the real isMyWork() put it in Shubham's My work?

   Everything is the app's own code, cut verbatim out of .tmp/email.html.
   Run:  node server/test-mywork-shubham.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
const cut = (a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error("not found: " + a.slice(0, 50)); const j = src.indexOf(b, i); if (j < 0) throw new Error("end not found"); return src.slice(i, j); };
const lineOf = (needle) => { const i = src.indexOf(needle); if (i < 0) throw new Error("not found: " + needle.slice(0, 50)); const a = src.lastIndexOf("\n", i) + 1; return src.slice(a, src.indexOf("\n", i)); };

const srcParts  = cut("function partsOf(t) {", "/* the My work view, its count and the Mine filter all follow the same rule */");
const srcSentWho= cut("function sentWho(m,t){", "\nfunction ");
const srcNmKey  = cut("function nmKey(s){", "function sentWho(m,t){");

const env = `
let ME='shubham';
const PEOPLE=[
 {id:'shubham',name:'Shubham Aneja',login:'dmm1@rugscreation.com',dept:'tp',role:'Manager',active:true,perm:{}},
 {id:'ashok',  name:'Ashok',        login:'merchandiser5@rugscreation.com',dept:'tp',role:'Executive',active:true,perm:{}},
 {id:'arun',   name:'Arun',         login:'merchandiser9@rugscreation.com',dept:'tp',role:'Executive',active:true,perm:{}},
 {id:'tpbox',  name:'Team Pulse',   login:'teampulse@rugscreation.com',dept:'tp',role:'Executive',active:true,perm:{}}
];
${srcNmKey.includes("nmKey") ? srcNmKey : "const nmKey=s=>String(s||'').toLowerCase().replace(/[^a-z ]/g,'').split(/\\s+/).filter(Boolean).map(w=>w.replace(/(.)\\1+/g,'$1'));"}
${srcSentWho}
${srcParts}
`;
const api = new Function(env + "; return {partsOf,isMyWork,sentWho,setME:v=>{ME=v}}")();

let pass = 0, fail = 0;
const ck = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(got) + ")"));
  ok ? pass++ : fail++;
};

/* the conversation in the screenshot: owned by Ashok, Ashok replied from the app,
   everything else is from outside. Shubham never touched it. */
const amanConv = {
  id: "tp:1a2092d6750c36d5", box: "teampulse@rugscreation.com", dept: "tp",
  owner: "ashok", status: "open", parts: [],
  msgs: [
    { at: 1, from: "Manfred Mui", email: "Manfred.Mui@nourison.com" },
    { at: 2, from: "Aman Singh Verma", email: "aman@induskrafts.com" },
    { at: 3, from: "Manfred Mui", email: "Manfred.Mui@nourison.com" },
    { at: 4, from: "Aman Singh Verma", email: "aman@induskrafts.com" },
    { at: 5, from: "Ashok – Rugs Creation", email: "teampulse@rugscreation.com", by: "ashok", ours: true },
    { at: 6, from: "Manfred Mui", email: "Manfred.Mui@nourison.com" }
  ]
};

console.log("=== signed in as Shubham (manager), conversation assigned to Ashok ===");
console.log("     partsOf  -> " + JSON.stringify(api.partsOf(amanConv)));
ck("the people on it are only Ashok", api.partsOf(amanConv), ["ashok"]);
ck("IT IS NOT IN SHUBHAM'S MY WORK", api.isMyWork(amanConv), false);

api.setME("ashok");
ck("it IS in Ashok's My work (he owns it and replied)", api.isMyWork(amanConv), true);
api.setME("arun");
ck("it is not in Arun's My work either", api.isMyWork(amanConv), false);

console.log("\n=== the cases that SHOULD put it in someone's My work ===");
api.setME("shubham");
ck("if Shubham owned it, yes", api.isMyWork({ ...amanConv, owner: "shubham" }), true);
ck("if Shubham had replied from the app, yes",
  api.isMyWork({ ...amanConv, msgs: amanConv.msgs.concat([{ at: 7, from: "Shubham", email: "teampulse@rugscreation.com", by: "shubham", ours: true }]) }), true);
ck("if Shubham had replied from Outlook under his own name, yes",
  api.isMyWork({ ...amanConv, msgs: amanConv.msgs.concat([{ at: 7, from: "Shubham Aneja", fname: "Shubham Aneja", email: "dmm1@rugscreation.com", ours: true }]) }), true);

console.log("\n=== the trap: a mail sent from the shared mailbox with nobody's name ===");
const fromBox = { ...amanConv, owner: null, msgs: amanConv.msgs.slice(0, 4).concat([{ at: 5, from: "Team Pulse", email: "teampulse@rugscreation.com", ours: true }]) };
console.log("     partsOf  -> " + JSON.stringify(api.partsOf(fromBox)));
ck("it is not silently handed to the manager", api.isMyWork(fromBox), false);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
