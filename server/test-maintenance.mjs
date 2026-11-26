/* 26 Nov 2026 — the maintenance window: who is locked out, who keeps working, and that it
   opens again by itself tomorrow morning. Runs the real block cut out of the shipped app.

   Run:  node server/test-maintenance.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
const i = src.indexOf("const MAINT_OFF=");
const j = src.indexOf("/* __maint:end */");
if (i < 0 || j < 0) throw new Error("the __maint block is not in the app");
/* the drawing half needs a browser; the rules half is what matters */
const rules = src.slice(i, src.indexOf("(function(){", i));

const harness = `
let NOW=0; const RealNow=Date.now; Date.now=()=>NOW;
let ME='ashok', SW=false, HATCH=null;
const USERS={ashok:{login:'ashok@rugscreation.com'},adm:{login:'marketing@rugscreation.com'},
             pr:{login:'priya@rugscreation.com'},mala:{login:'designer@rugscreation.com'}};
const who=id=>USERS[id]||null;
const swOn=()=>SW;
const localStorage={getItem:k=>(k==='rugs-maint-ok'?HATCH:null)};
${rules}
export {MAINT_FROM,MAINT_UNTIL,MAINT_LABEL,MAINT_BACK,maintMe,maintOn,maintLeft};
export function set(o){if('NOW' in o)NOW=o.NOW;if('ME' in o)ME=o.ME;if('SW' in o)SW=o.SW;if('HATCH' in o)HATCH=o.HATCH}
export function locked(){return maintOn()&&!maintMe()}
`;
const A = await import("data:text/javascript," + encodeURIComponent(harness));

let pass = 0, fail = 0;
const ck = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}` + (ok ? "" : `   (got ${JSON.stringify(got)})`));
  ok ? pass++ : fail++;
};
const before = A.MAINT_FROM - 10 * 60000;      /* 10 minutes before it locks */
const after = A.MAINT_FROM + 60000;            /* a minute after */
const night = A.MAINT_UNTIL - 60000;           /* just before morning */
const morning = A.MAINT_UNTIL + 60000;         /* just after */

console.log("\n=== the window ===");
ck("it locks at 18:52", A.MAINT_LABEL, "18:52");
ck("it opens again by itself", A.MAINT_BACK, "9:30 tomorrow morning");
ck("that is 27 Nov 09:30 IST", new Date(A.MAINT_UNTIL + 19800000).toISOString().slice(0, 16), "2026-11-27T09:30");

console.log("\n=== during the 20 minutes everybody still works ===");
A.set({ NOW: before, ME: "ashok", SW: false, HATCH: null });
ck("a member is not locked out yet", A.locked(), false);
ck("...and is shown a countdown", Math.round(A.maintLeft() / 60000), 10);

console.log("\n=== after 18:52 ===");
A.set({ NOW: after });
ck("a member is locked out", A.locked(), true);
A.set({ ME: "mala" });
ck("so is a manager", A.locked(), true);
A.set({ ME: "pr" });
ck("so is the other admin id", A.locked(), true);

console.log("\n=== who keeps working ===");
A.set({ ME: "adm" });
ck("Priyanshu, by id", A.locked(), false);
A.set({ ME: "unknown-id" });
ck("...and by a marketing@ login", A.maintMe(), false);          /* unknown id has no login */
A.set({ ME: "adm" });
ck("...his own id is enough", A.maintMe(), true);
A.set({ ME: "ashok", SW: true });
ck("a SWITCHED session works - he can open anyone's ID", A.locked(), false);
A.set({ SW: false, HATCH: "1" });
ck("the escape hatch works, so he can never lock himself out", A.locked(), false);
A.set({ HATCH: null });

console.log("\n=== it stays shut all night and opens itself in the morning ===");
A.set({ ME: "ashok", NOW: night });
ck("still shut at 09:29", A.locked(), true);
A.set({ NOW: morning });
ck("open again at 09:31, with no new build", A.locked(), false);
A.set({ NOW: morning + 8 * 3600000 });
ck("...and stays open", A.locked(), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
