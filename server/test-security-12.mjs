/* test-security-12.mjs - 27 Nov 2026  (bug 12 - two small security holes)
 *
 *  A) the SERVER's delete right now covers 'purged' (what "Empty Deleted" writes). The check
 *     is taken OUT OF THE SHIPPED BUNDLE and run as it ships, with the bundle's own can()
 *     and a stub for E, against four shapes: admin, a person with the right, a person
 *     without it, and an ordinary move. (It cannot be tried against the live server from
 *     this laptop: that needs a non-admin session token, and the live database is on the
 *     office machine.)
 *
 *  B) the APP's maintenance window only lets a signed-in ADMIN through, judged on the role
 *     the server sent with the session - checked as an admin, as a manager, as a member, and
 *     with the old localStorage escape hatch set, which must now do nothing.
 *
 * Run:  node server/test-security-12.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

/* ====================================================== A · the server ==== */
console.log("=== A \u00b7 the server: the delete right covers 'purged' ===");
const src = fs.readFileSync(path.join(__dirname, "local-server", "rugs-mail.bundle.mjs"), "utf8");

const canLine = (src.match(/var can = \(u, k\) => [^\n]+/) || [""])[0];
ck("the bundle's own can() was found", /u\.role === "Admin"/.test(canLine), true);
const guard = (src.match(/if \(\(patch\.folder === "deleted" \|\| patch\.folder === "purged"\)[^\n]+/) || [""])[0];
ck("one line now gates both 'deleted' and 'purged'", !!guard, true);
ck("...and nothing is left gating 'deleted' on its own", /if \(patch\.folder === "deleted" && !can\(u, "delete"\)\)/.test(src), false);

/* run the shipped line as it ships */
function tryIt(user, folder) {
  const ctx = { out: "" };
  const code = canLine + "\nclass E extends Error{constructor(m,s){super(m);this.s=s}}\n"
    + "const u=" + JSON.stringify(user) + ", patch={folder:" + JSON.stringify(folder) + "};\n"
    + "try{" + guard + " out='allowed'}catch(e){out='refused: '+e.message+' '+e.s}";
  vm.createContext(ctx);
  new vm.Script(code + ";\nglobalThis.out=out;").runInContext(ctx);
  return ctx.out;
}
const admin = { id: "adm", role: "Admin", perm: {} };
const withRight = { id: "imran", role: "Executive", perm: { delete: 1 } };
const without = { id: "arun", role: "Executive", perm: {} };
ck("an admin may purge", tryIt(admin, "purged"), "allowed");
ck("somebody with the delete right may purge", tryIt(withRight, "purged"), "allowed");
ck("somebody WITHOUT it is refused, 403", tryIt(without, "purged"), "refused: You can't delete mail 403");
ck("...and is still refused a plain delete", tryIt(without, "deleted"), "refused: You can't delete mail 403");
ck("an ordinary move is untouched", tryIt(without, "archive"), "allowed");
ck("...and so is Archive for an admin", tryIt(admin, "archive"), "allowed");

/* ========================================================= B · the app ==== */
console.log("\n=== B \u00b7 the maintenance window ===");
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
/* the old escape hatch is deliberately SET for the whole run: it must not help anybody */
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof maintMe !== "function") return "the maintenance block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: { delete: 1 } },
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { delete: 1 } },
    { id: "arun", name: "Arun Sharma", login: "merchandiser7@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "gone", name: "Old Admin", login: "old@rugscreation.com", dept: "ta", role: "Admin", active: false, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" }, { id: "mkt", name: "Marketing", box: "marketing@", color: "#7a3fd1" });
  S.threads = []; S.settings = {}; app = "mail"; ME = "imran";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  /* the window itself is a fixed date in the shipped build, so the test makes it "now" by
     stubbing the one function that says whether it is open - everything else is the app's */
  window.__lock = (me) => {
    ME = me;
    const realOn = maintOn; maintOn = () => true;
    try {
      maintPaint();
      return { locked: !!document.getElementById("maintWrap"), mine: maintMe() };
    } finally {
      maintOn = realOn;
      const w = document.getElementById("maintWrap"); if (w) w.remove();
    }
  };
  window.__hatch = () => { try { return localStorage.getItem("rugs-maint-ok"); } catch (e) { return "?"; } };
  return "ok";
});
ck("the app is set up", setup, "ok");
ck("the old escape hatch is set in this browser", await page.evaluate(() => window.__hatch()), "1");
ck("the hard-coded id list is gone from the app", await page.evaluate(() => typeof MAINT_IDS === "undefined"), true);

const member = await page.evaluate(() => window.__lock("imran"));
ck("a member is locked out, hatch or no hatch", [member.locked, member.mine], [true, false]);
const mgr = await page.evaluate(() => window.__lock("jagjit"));
ck("a manager is locked out too", [mgr.locked, mgr.mine], [true, false]);
const adm = await page.evaluate(() => window.__lock("adm"));
ck("a signed-in admin keeps working", [adm.locked, adm.mine], [false, true]);
const off = await page.evaluate(() => window.__lock("gone"));
ck("a deactivated admin does not", [off.locked, off.mine], [true, false]);
const out = await page.evaluate(() => { const r = window.__lock(""); return r; });
ck("nobody signed in: no bypass", out.mine, false);
const faked = await page.evaluate(() => {
  /* the browser cannot promote itself: the role comes from the server's own answer */
  ME = "imran"; localStorage.setItem("rugs-maint-ok", "1");
  const a = maintMe();
  localStorage.setItem("rugs-maint-ok", "yes please");
  const b = maintMe();
  return [a, b];
});
ck("setting the browser value in any form changes nothing", faked, [false, false]);

/* and the app side of fix 1: "Empty Deleted" is only offered to somebody who may delete */
console.log("\n=== B2 \u00b7 the app only offers Empty Deleted to somebody who may delete ===");
const empty = await page.evaluate(() => {
  const T0 = Date.parse("2026-11-27T10:00:00+05:30");
  S.threads = [{
    id: "d1", box: "teamalpha@rugscreation.com", dept: "ta", from: "A Buyer", email: "b@x.com",
    sub: "In the bin", pre: "x", last: T0, owner: null, status: "done", folder: "deleted",
    unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true,
    msgs: [{ gid: "g1", from: "A Buyer", email: "b@x.com", at: T0, body: "x", subject: "In the bin", to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
  }];
  const look = (me) => {
    ME = me; app = "mail"; view = { type: "box", dept: "ta", folder: "deleted" };
    render();
    const b = document.querySelector('#folders [data-empty]');
    return { btn: !!b, what: b ? b.getAttribute("data-empty") : "", may: can("delete") };
  };
  const withRight = look("imran");          /* has the delete right */
  const withoutRight = look("arun");        /* has not */
  return { withRight, withoutRight };
});
console.log("     " + JSON.stringify(empty));
ck("somebody with the delete right is offered it", [empty.withRight.btn, empty.withRight.may], [true, true]);
ck("...and somebody without it is not", [empty.withoutRight.btn, empty.withoutRight.may], [false, false]);
ck("no page errors", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
