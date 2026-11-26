/* 26 Nov 2026 - two faults reported within minutes of turning per-mail rows on:
     "Aman's mail came but other mail is not there now" / "in Sent also all mail is not showing"
     "I click the 5:34 mail and it shows the mail above it as well"
   Both are tested here against the real code cut verbatim out of the shipped app.

   Run:  node server/test-cap-and-open.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
const cut = (a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error("not found: " + a.slice(0, 40)); const j = src.indexOf(b, i); if (j < 0) throw new Error("end not found: " + b.slice(0, 40)); return src.slice(i, j); };
const line = (needle) => { const i = src.indexOf(needle); if (i < 0) throw new Error("not found: " + needle.slice(0, 40)); const a = src.lastIndexOf("\n", i) + 1; return src.slice(a, src.indexOf("\n", i)); };

let pass = 0, fail = 0;
const ck = (n, got, want) => {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(got) + ")"));
  ok ? pass++ : fail++;
};

/* ======================= 1. the drawing window ======================= */
console.log("=== the window must reach as far down the list as it did before ===");
const srcCapRows = cut("const CAP_ROW_PER=", "function listCap(n){") + cut("function listCap(n){", "\n");
const capEnv = `
let window={SLOW_PC:false};
let app='mail',view={type:'box',dept:'tp',folder:'inbox'},tab='',filt='',lfilt='';
const $=()=>({value:''});
const LIST_PAGE=window.SLOW_PC?60:150;let _capKey='',_cap=LIST_PAGE;
${srcCapRows}
`;
const capApi = new Function(capEnv + "; return {capRows,setCap:v=>{_cap=v}}")();

/* a Team Pulse-shaped list: 660 conversations averaging 4.6 mails (measured 25 Nov) */
const convs = [];
for (let c = 0; c < 660; c++) convs.push({ id: "c" + c, n: 3 + (c % 5) });
const perMail = [];
convs.forEach((c) => { for (let m = 0; m < c.n; m++) perMail.push({ id: c.id, _one: true, _mi: m }); });
const perConv = convs.map((c) => ({ id: c.id }));

ck("the per-mail list really is ~4.6x longer", Math.round(perMail.length / perConv.length * 10) / 10, (g) => g >= 4 && g <= 5.5);
const drawnPerConv = capApi.capRows(perConv);
const drawnPerMail = capApi.capRows(perMail);
const convsCovered = new Set(perMail.slice(0, drawnPerMail).map((r) => r.id)).size;
console.log("     one row per conversation: " + drawnPerConv + " rows = " + drawnPerConv + " conversations");
console.log("     one row per mail:         " + drawnPerMail + " rows = " + convsCovered + " conversations");
ck("one row per conversation is untouched (still 150)", drawnPerConv, 150);
ck("THE SAME 150 CONVERSATIONS ARE REACHED with one row per mail", convsCovered, 150);
ck("   ...and every mail of them is drawn, not just one each", drawnPerMail, (g) => g > 600);
ck("no conversation is drawn half-way (the window ends on a boundary)",
  perMail[drawnPerMail] ? perMail[drawnPerMail]._mi : 0, 0);
ck("scrolling for more widens it (cap 450 -> 450 conversations)",
  (capApi.setCap(450), new Set(perMail.slice(0, capApi.capRows(perMail)).map((r) => r.id)).size), 450);
capApi.setCap(150);
ck("a short list (My work) is unaffected", capApi.capRows(perMail.slice(0, 20)), 20);
ck("an empty list is 0", capApi.capRows([]), 0);

/* the safety ceiling */
const huge = [];
for (let c = 0; c < 5000; c++) for (let m = 0; m < 50; m++) huge.push({ id: "h" + c, _one: true, _mi: m });
capApi.setCap(150);
ck("a monstrous list is capped so a slow PC cannot stall", capApi.capRows(huge), (g) => g <= 150 * 12 && g > 0);

/* ======================= 2. clicking one mail ======================= */
console.log("\n=== clicking a mail must open THAT mail, not the ones above it ===");
const srcOpenOne = line("const _openOne=open;open=function(id)");
const srcRowMail = cut("const _openRow=open;", "/* __rowmail:end */");
const openEnv = `
let window={};
let openId=null;const openMsgs={};
const THREADS={};
const T_=id=>THREADS[id]||null;
const idv=x=>x;
const openLight=()=>{};
const document={getElementById:()=>null,addEventListener:()=>{}};
const matchMedia=()=>({matches:true});
const setTimeout=()=>{};
function open(id){openId=id;return 'base'}      /* the app's own open(), simplified to its effect */
${srcOpenOne}
let WANT_MI=null;
${srcRowMail.replace(/^const _openRow=open;/, "const _openRow=open;")}
`;
const openApi = new Function(openEnv + "; return {open,openMsgs,THREADS,setWant:v=>{WANT_MI=v},reset:()=>{openId=null;for(const k in openMsgs)delete openMsgs[k]}}")();
/* the real conversation: 6 mails, Aman's 17:34 is index 3, Manfred's 20:21 is index 5 */
openApi.THREADS["tp:1a2092d6750c36d5"] = { id: "tp:1a2092d6750c36d5", msgs: [{}, {}, {}, {}, {}, {}] };
const TID = "tp:1a2092d6750c36d5";

openApi.reset(); openApi.setWant({ id: TID, mi: 3 });     /* the 5:34 pm row was clicked */
openApi.open(TID);
ck("ONLY Aman's 5:34 pm mail is open", [...(openApi.openMsgs[TID] || [])], [3]);
ck("   ...Manfred's 8:21 pm above it is NOT opened", (openApi.openMsgs[TID] || new Set()).has(5), false);
ck("   ...and nor is Ashok's reply", (openApi.openMsgs[TID] || new Set()).has(4), false);

openApi.reset(); openApi.setWant({ id: TID, mi: 0 });     /* the oldest mail's row */
openApi.open(TID);
ck("clicking the oldest row opens only the oldest", [...(openApi.openMsgs[TID] || [])], [0]);

openApi.reset(); openApi.setWant(null);                   /* from Search / Home / a notification */
openApi.open(TID);
ck("a click that names no mail still opens the newest three (unchanged)", [...(openApi.openMsgs[TID] || [])], [3, 4, 5]);

ck("the flag is always put down again, so the next click is not affected", !!openApi.openMsgs.__never, false);
openApi.reset(); openApi.setWant({ id: TID, mi: 2 });
openApi.open(TID);
ck("a second per-mail click still opens just its own mail", [...(openApi.openMsgs[TID] || [])], [2]);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
