/* test-mgr-sees-sent.mjs - 27 Nov 2026  (night plan, bug 6 - locked rule R8m:
 *   a team manager sees his team members' replies in his Inbox, not only in Sent)
 *
 * Real headless Edge on the BUILT app (mail-app.html), with the reported case: the
 * "AW27 Spec" conversation in Team Pulse, Mia's mail at 5:20 pm and Ashok's reply at
 * 5:08 pm, seen as Shubham (the manager), as Ashok (the sender), as another member, and
 * as the admin.
 *
 * Run:  node server/test-mgr-sees-sent.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = g === w; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof mgrSent !== "function") return "the R8m block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "ashok", name: "Ashok Kumar", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} },
    { id: "arun", name: "Arun Sharma", login: "merchandiser7@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} },
    { id: "shubham", name: "Shubham Aneja", login: "dmm1@rugscreation.com", dept: "tp", role: "Manager", active: true, perm: { assign: 1 } },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: {} },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" },
    { id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" },
    { id: "mkt", name: "Marketing", box: "marketing@", color: "#7a3fd1" });
  const D = (h, m) => Date.parse("2026-11-27T" + h + ":" + m + ":00+05:30");
  /* AW27 Spec: Mia (the buyer) 5:20 pm, Ashok's reply 5:08 pm, Mia's first mail 4:50 pm */
  const msgs = [
    { gid: "g1", from: "Mia Chen", email: "mia@buyer.com", at: D("16", "50"), body: "Please send the AW27 spec.", to: "teampulse@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "" },
    { gid: "g2", from: "Ashok Kumar", email: "teampulse@rugscreation.com", at: D("17", "08"), body: "Spec attached, please confirm.", to: "mia@buyer.com", cc: "", by: "ashok", ours: true, atts: [], files: [], sig: "", raw: "" },
    { gid: "g3", from: "Mia Chen", email: "mia@buyer.com", at: D("17", "20"), body: "Thank you, received.", to: "teampulse@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "" }
  ];
  /* a second conversation: only Arun's outgoing mail, nobody answered (Sent-only) */
  const sentOnly = [
    { gid: "g9", from: "Arun Sharma", email: "teampulse@rugscreation.com", at: D("16", "30"), body: "Reminder about the sample.", to: "buyer2@x.com", cc: "", by: "", ours: true, fname: "Arun Sharma", atts: [], files: [], sig: "", raw: "" }
  ];
  /* and one the MANAGER sent himself - must stay Sent only (rule 3) */
  const mine = [
    { gid: "g7", from: "Shubham Aneja", email: "teampulse@rugscreation.com", at: D("16", "10"), body: "My own note.", to: "buyer3@x.com", cc: "", by: "shubham", ours: true, atts: [], files: [], sig: "", raw: "" }
  ];
  const mk = (id, dp, sub, ms, extra) => Object.assign({
    id: dp + ":" + id, box: (dp === "tp" ? "teampulse@" : dp === "ta" ? "teamalpha@" : "marketing@") + "rugscreation.com",
    dept: dp, from: ms[0].from, email: ms[0].email, sub, pre: ms[0].body, last: ms[ms.length - 1].at,
    owner: null, status: "open", folder: "inbox", unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, msgs: ms
  }, extra || {});
  S.threads = [
    mk(1, "tp", "AW27 Spec", msgs),
    mk(2, "tp", "Sample reminder", sentOnly),
    mk(3, "tp", "My own note", mine),
    mk(4, "ta", "Other team", [{ gid: "g8", from: "Gulab Tyagi", email: "teamalpha@rugscreation.com", at: D("17", "0"), body: "another team", to: "x", cc: "", by: "gulab", ours: true, atts: [], files: [], sig: "", raw: "" }])
  ];
  S.settings = {}; app = "mail";
  if (typeof filt !== "undefined") filt = "all";
  const q = document.getElementById("q"); if (q) q.value = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  window.__look = (me, folder) => {
    ME = me; view = { type: "box", dept: "tp", folder: folder || "inbox" };
    return listRows().map(t => ({
      sub: t.sub, mi: t._mi, mgr: t._mgrSent || "", at: t.last, unread: !!t.unread,
      time: (typeof tShort === "function") ? tShort(rowWhen(t)) : "", pre: t.pre
    }));
  };
  window.__tag = (me) => {
    ME = me; view = { type: "box", dept: "tp", folder: "inbox" };
    const r = listRows().find(t => t._mgrSent);
    return r ? rowHTML(r) : "";
  };
  return "ok";
});
ck("the R8m block is in the built app", setup, "ok");

/* --------------------------------------------- 1 · the manager's Inbox --- */
console.log("\n=== 1 · as Shubham (manager of Team Pulse) ===");
const mgr = await page.evaluate(() => window.__look("shubham", "inbox"));
console.log("     " + mgr.map(r => r.time + "  " + (r.mgr ? "[sent by " + r.mgr + "] " : "") + r.sub).join("\n     "));
const aw = mgr.filter(r => r.sub === "AW27 Spec");
ck("the AW27 conversation gives him three rows", aw.length, 3);
ck("Mia's 5:20 pm mail is there", aw.some(r => /5:20/.test(r.time) && !r.mgr), true);
ck("Ashok's 5:08 pm reply is there too", aw.some(r => /5:08/.test(r.time) && r.mgr === "ashok"), true);
ck("...at its OWN time, not the conversation's", aw.filter(r => r.mgr === "ashok").every(r => /5:08/.test(r.time)), true);
ck("the rows are newest first", mgr.every((r, i) => i === 0 || mgr[i - 1].at >= r.at), true);
ck("a Sent-only mail from Arun also reaches his Inbox", mgr.some(r => r.sub === "Sample reminder" && r.mgr === "arun"), true);
ck("3 · his OWN sent mail does not", mgr.some(r => r.sub === "My own note"), false);
ck("4 · the member's row arrives READ", mgr.filter(r => r.mgr).every(r => r.unread === false), true);
ck("no mail is shown twice", new Set(mgr.map(r => r.sub + "|" + r.mi)).size, mgr.length);
ck("a Sent-only conversation gives exactly one row", mgr.filter(r => r.sub === "Sample reminder").length, 1);
const mgrSent_ = await page.evaluate(() => window.__look("shubham", "sent"));
ck("1 · and Ashok's reply is still in Sent", mgrSent_.some(r => r.sub === "AW27 Spec"), true);

/* ------------------------------------------------- 2 · the sender -------- */
console.log("\n=== 2 · as Ashok (the sender) ===");
const ash = await page.evaluate(() => window.__look("ashok", "inbox"));
const ashAw = ash.filter(r => r.sub === "AW27 Spec");
ck("he sees Mia's two mails in his Inbox", ashAw.length, 2);
ck("...and his own 5:08 reply is NOT one of them", ashAw.some(r => /5:08/.test(r.time)), false);
ck("no row of his carries the R8m tag", ash.every(r => !r.mgr), true);
const ashSent = await page.evaluate(() => window.__look("ashok", "sent"));
ck("his 5:08 reply is in his Sent", ashSent.some(r => r.sub === "AW27 Spec"), true);

console.log("\n=== 2 · as Arun (another member) ===");
const arun = await page.evaluate(() => window.__look("arun", "inbox"));
ck("Ashok's reply is not in his Inbox", arun.filter(r => r.sub === "AW27 Spec").some(r => /5:08/.test(r.time)), false);
ck("he still sees the buyer's mails", arun.filter(r => r.sub === "AW27 Spec").length, 2);
ck("nothing is tagged for him", arun.every(r => !r.mgr), true);

/* ------------------------------------------------------ 5 · the admin --- */
console.log("\n=== 5 · as the admin ===");
const adm = await page.evaluate(() => window.__look("adm", "inbox"));
ck("the admin gets no R8m rows", adm.every(r => !r.mgr), true);
ck("...and his Inbox is the ordinary two received mails", adm.filter(r => r.sub === "AW27 Spec").length, 2);

console.log("\n=== a manager of ANOTHER team ===");
const other = await page.evaluate(() => { ME = "jagjit"; view = { type: "box", dept: "ta", folder: "inbox" }; return listRows().map(t => ({ sub: t.sub, mgr: t._mgrSent || "" })); });
ck("Jagjit gets nothing from Team Pulse", other.some(r => r.sub === "AW27 Spec"), false);
const tpAsJagjit = await page.evaluate(() => window.__look("jagjit", "inbox"));
ck("...and no R8m row even if he opens Team Pulse", tpAsJagjit.every(r => !r.mgr), true);

/* ------------------------------------------------------- 4 · the row ---- */
console.log("\n=== 4 · what the row looks like ===");
const tag = await page.evaluate(() => window.__tag("shubham"));
ck("it is tagged \"Sent by <name>\"", /Sent by Ashok/.test(tag), true);
ck("...and says why in the tooltip", /so you can see what your team answered/.test(tag), true);
ck("it has NO Done button", /data-qdone/.test(tag), false);
ck("...but the other row buttons are still there", /data-qflag/.test(tag) && /data-qarch/.test(tag), true);

/* --------------------------------------- 4 · never work, never an owner -- */
console.log("\n=== 4 · it is not work ===");
const work = await page.evaluate(() => {
  ME = "shubham";
  const t1 = S.threads.find(x => x.id === "tp:1"), t2 = S.threads.find(x => x.id === "tp:2");
  return {
    owner1: t1.owner, owner2: t2.owner,
    sentOnlyIsWork: isWork(t2), sentOnlyHasRecv: hasRecv(t2),
    needs: (() => { view = { type: "fav", id: "needs" }; return listRows().some(x => x.sub === "Sample reminder"); })(),
    mine: (() => { view = { type: "fav", id: "mine" }; return listRows().some(x => x.sub === "Sample reminder"); })(),
    inboxCount: (() => { view = { type: "box", dept: "tp", folder: "inbox" }; return S.threads.filter(x => x.dept === "tp" && isInboxMail(x)).length; })(),
    unread: inboxUnreadN("tp")
  };
});
ck("the owner is untouched on the AW27 conversation", work.owner1, null);
ck("...and on the Sent-only one", work.owner2, null);
ck("a Sent-only conversation is still not work", work.sentOnlyIsWork, false);
ck("...because hasRecv is untouched", work.sentOnlyHasRecv, false);
ck("it is not in Needs owner", work.needs, false);
ck("it is not in My work", work.mine, false);
ck("the unread count is unchanged (the rows are read)", work.unread, 0);

/* ------------------------------------------------------- memory caps ---- */
console.log("\n=== the memory caps still hold ===");
const mem = await page.evaluate(() => {
  ME = "shubham"; view = { type: "box", dept: "tp", folder: "inbox" }; render();
  const rows = listRows().length;
  return { rows, rhcMax: window.__rhcMax || 600, rhc: (typeof RHC !== "undefined" ? RHC.size : -1), hasRzMem: typeof window.rzMem === "function" };
});
ck("rzMem() is there to read the caps", mem.hasRzMem, true);
ck("the row cache ceiling covers the rows drawn", mem.rhcMax >= mem.rows, true);
ck("...and the cache is inside it", mem.rhc <= mem.rhcMax, true);

console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
if (errs.length) fail += errs.length;
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
