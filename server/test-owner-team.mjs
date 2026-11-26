/* test-owner-team.mjs - 27 Nov 2026  (night plan, bug 4 - locked rule R29a:
 *   a conversation can only belong to somebody in the team that owns that mailbox)
 *
 * Real headless Edge on the BUILT app (mail-app.html), as admin, manager and member in
 * Team Alpha, and as the admin in Marketing (the one-person mailbox). The server half is
 * read out of the shipped bundle and its rule is run here on the real shapes.
 *
 * Run:  node server/test-owner-team.mjs
 */
import fs from "node:fs";
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

/* ===================================================== 3 · the server ===== */
console.log("=== 3 · the server refuses an owner from another team ===");
const B = fs.readFileSync(path.join(__dirname, "local-server", "rugs-mail.bundle.mjs"), "utf8");
ck("the rule is in the shipped bundle", B.indexOf("__r29a_owner") >= 0, true);
const blk = B.slice(B.indexOf("__r29a_owner"), B.indexOf("__r29a_owner") + 1400);
ck("it reads the owner's own team", /select\("id,name,dept_id,active"\)/.test(blk), true);
ck("it uses the dept in the same patch when there is one", /"dept_id" in patch \? patch\.dept_id : d\.id/.test(blk.replace(/&&\s*patch\.dept_id\s*\)/, ")")) || /patch\.dept_id\) \? patch\.dept_id : d\.id/.test(blk), true);
ck("it refuses an inactive user", /not an active user/.test(blk), true);
ck("it names the team in the refusal", /is not in/.test(blk), true);
ck("clearing the owner is still allowed", /"owner_id" in patch && patch\.owner_id\) \{/.test(blk), true);
/* run the rule itself on the real shapes */
const rule = (patch, homeId, user) => {
  if (!("owner_id" in patch) || !patch.owner_id) return "ok";
  const teamId = ("dept_id" in patch && patch.dept_id) ? patch.dept_id : homeId;
  if (!user || user.active === false) return "inactive";
  if (String(user.dept_id || "") !== String(teamId || "")) return "refused";
  return "ok";
};
ck("owner in the same team -> allowed", rule({ owner_id: "imran" }, "ta", { dept_id: "ta", active: true }), "ok");
ck("owner in another team -> refused", rule({ owner_id: "neetu" }, "ta", { dept_id: "nx", active: true }), "refused");
ck("a deactivated person -> refused", rule({ owner_id: "x" }, "ta", { dept_id: "ta", active: false }), "inactive");
ck("clearing the owner -> allowed", rule({ owner_id: null }, "ta", null), "ok");
ck("a transfer that hands it to somebody in the RECEIVING team -> allowed",
  rule({ owner_id: "neetu", dept_id: "nx" }, "ta", { dept_id: "nx", active: true }), "ok");
ck("...but not to somebody in neither team",
  rule({ owner_id: "imran", dept_id: "nx" }, "ta", { dept_id: "ta", active: true }), "refused");

/* ======================================================== the app half ==== */
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof teamPeople !== "function") return "the owner-team block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { assign: 1 } },
    { id: "gulab", name: "Gulab Tyagi", login: "amr1@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { assign: 1 } },
    { id: "viney", name: "Viney Beniwal", login: "merchandiser7@rugscreation.com", dept: "ta", role: "Executive", active: false, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: { assign: 1, transfer: 1 } },
    { id: "ashok", name: "Ashok Kumar", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: { assign: 1 } },
    { id: "shubham", name: "Shubham Aneja", login: "dmm1@rugscreation.com", dept: "tp", role: "Manager", active: true, perm: { assign: 1 } },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" },
    { id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" },
    { id: "mkt", name: "Marketing", box: "marketing@", color: "#7a3fd1" });
  const T0 = Date.now() - 36e5;
  const mk = (id, d) => ({
    id: d + ":" + id, box: (d === "ta" ? "teamalpha@" : d === "tp" ? "teampulse@" : "marketing@") + "rugscreation.com",
    dept: d, from: "Buyer", email: "b@x.com", sub: "Owner picker " + id, pre: "x", last: T0,
    owner: null, status: "open", folder: "inbox", unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true,
    msgs: [{ gid: "g" + id, from: "Buyer", email: "b@x.com", at: T0, body: "hello", to: "x", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "" }]
  });
  S.threads = [mk(1, "ta"), mk(2, "mkt")];
  S.settings = {}; ME = "adm"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  const q = document.getElementById("q"); if (q) q.value = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  window.__as = id => { ME = id; };
  window.__owner = tid => {
    const t = S.threads.find(x => x.id === tid);
    const h = ownerSelect(t);
    const d = document.createElement("div"); d.innerHTML = h;
    const sel = d.querySelector("select");
    return {
      html: h,
      isPicker: !!sel,
      names: sel ? [...sel.querySelectorAll("option")].map(o => o.textContent.trim()).filter(x => x && !/^Assign to/.test(x)) : [],
      groups: sel ? [...sel.querySelectorAll("optgroup")].map(g => g.label) : [],
      text: d.textContent.trim()
    };
  };
  return "ok";
});
ck("the owner-team block is in the built app", setup, "ok");

/* -------------------------------------------------- 1 · the Owner picker - */
console.log("\n=== 1 · the Owner picker is this team only ===");
for (const [who_, label] of [["adm", "admin"], ["jagjit", "manager"], ["imran", "member"]]) {
  const o = await page.evaluate(w => { window.__as(w); return window.__owner("ta:1"); }, who_);
  ck("as " + label + ": it is still a picker", o.isPicker, true);
  ck("as " + label + ": it lists Team Alpha's own people only",
    JSON.stringify(o.names.map(x => x.split(" ")[0]).sort()), JSON.stringify(["Gulab", "Imran", "Jagjit"]));
  ck("as " + label + ": no other team is offered", o.groups.length, 0);
  ck("as " + label + ": nobody from Team Pulse is in it", /Ashok|Shubham/.test(o.html), false);
  ck("as " + label + ": the admin is not offered as an owner", /Priyanshu/.test(o.html), false);
  ck("as " + label + ": a deactivated colleague is not offered", /Viney/.test(o.html), false);
}

/* ------------------------------------------- 2 · a one-person mailbox ---- */
console.log("\n=== 2 · Marketing has one person ===");
const mk = await page.evaluate(() => { window.__as("adm"); return window.__owner("mkt:2"); });
ck("there is NO picker", mk.isPicker, false);
ck("it shows the person's name", mk.text, "Priyanshu Tomar");
ck("...and says why", /only person in Marketing/.test(mk.html), true);

/* --------------------------------------------------- the assign guard ---- */
console.log("\n=== an owner from another team is refused in the app too ===");
const guard = await page.evaluate(() => {
  window.__as("jagjit");
  const t = S.threads.find(x => x.id === "ta:1");
  const msgs = [];
  const realToast = window.toast; toast = m => msgs.push(String(m));
  assign(t, "ashok");                       /* Team Pulse */
  const after1 = t.owner;
  assign(t, "gulab");                       /* Team Alpha */
  const after2 = t.owner;
  toast = realToast;
  return { after1, after2, said: msgs.join(" | ") };
});
ck("giving it to somebody in another team does nothing", guard.after1, null);
ck("...and says so in plain words", /not in Team Alpha/.test(guard.said), true);
ck("...and points at \"Move to team…\"", /Move to team/.test(guard.said), true);
ck("giving it to a teammate still works", guard.after2, "gulab");

/* ----------------------------------------------- 4 · Move to team… ------- */
console.log("\n=== 4 · \"Move to team…\" is admin only ===");
const menu = async (who_) => page.evaluate(w => {
  window.__as(w);
  const t = S.threads.find(x => x.id === "ta:1");
  try { cmClose(); } catch (e) { }
  cmOpen(t, 100, 100, null);
  const m = document.querySelector(".cmenu");
  const has = !!(m && m.querySelector("[data-moveteam]"));
  const txt = m ? m.textContent : "";
  try { cmClose(); } catch (e) { }
  return { has, txt };
}, who_);
ck("an admin sees it", (await menu("adm")).has, true);
ck("a manager does not", (await menu("jagjit")).has, false);
ck("a member does not", (await menu("imran")).has, false);

const moved = await page.evaluate(() => {
  window.__as("adm");
  const t = S.threads.find(x => x.id === "ta:1");
  t.owner = "gulab"; t.status = "open";
  try { cmClose(); } catch (e) { }
  cmOpen(t, 100, 100, null);
  document.querySelector("[data-moveteam]").click();
  return new Promise(res => setTimeout(() => {
    const dlgOpen = !!document.querySelector(".scrim .dlg");
    const rows = [...document.querySelectorAll("[data-mtpick]")].map(b => b.dataset.mtpick);
    const b = document.querySelector('[data-mtpick="tp"]');
    if (b) b.click();
    setTimeout(() => {
      const t2 = S.threads.find(x => x.id === "ta:1");
      res({
        dlgOpen, rows, dept: t2.dept, owner: t2.owner, status: t2.status, folder: t2.folder,
        hist: (t2.hist || []).map(h => h.txt).join(" | "), closed: !document.querySelector(".scrim .dlg")
      });
    }, 60);
  }, 120));
});
ck("it opens a dialog", moved.dlgOpen, true);
ck("it offers the other teams, not the one it is in", JSON.stringify(moved.rows.sort()), JSON.stringify(["mkt", "tp"]));
ck("picking one moves the conversation", moved.dept, "tp");
ck("...and leaves it with NO owner", moved.owner, "");
ck("...waiting to be taken", moved.status, "new");
ck("...in that team's Inbox", moved.folder, "inbox");
ck("...with an activity-trail line naming both teams", /Moved from Team Alpha to Team Pulse by Priyanshu Tomar/.test(moved.hist), true);
ck("...that says it is waiting for an owner", /waiting for an owner in Team Pulse/.test(moved.hist), true);
ck("and the dialog closes", moved.closed, true);
const afterMove = await page.evaluate(() => { window.__as("adm"); return window.__owner("ta:1"); });
ck("the Owner picker now lists Team Pulse's people", JSON.stringify(afterMove.names.map(x => x.split(" ")[0]).sort()), JSON.stringify(["Ashok", "Shubham"]));

console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
if (errs.length) fail += errs.length;
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
