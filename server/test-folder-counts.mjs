/* test-folder-counts.mjs - 27 Nov 2026  (bug 10: folder counts, like Outlook)
 *
 * Real headless Edge on the BUILT app (mail-app.html). One Team Alpha mailbox with unread
 * mail spread over Inbox, Archive, Junk, Deleted and a personal folder, plus a Marketing
 * mailbox, a Workspace notification and a conversation the manager owns - seen as the admin,
 * as the manager and as a member, then at phone width and in dark mode.
 *
 * Run:  node server/test-folder-counts.mjs
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
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof fcPaint !== "function") return "the __folcount block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { delete: 1 } },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: { delete: 1, assign: 1 } },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: { delete: 1, assign: 1 } });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" },
    { id: "mkt", name: "Marketing", box: "marketing@", color: "#7a3fd1" });
  const T = (d, h) => Date.parse("2026-11-" + d + "T" + h + ":00:00+05:30");
  let k = 0;
  const mk = (o) => Object.assign({
    id: "x" + (++k), box: "teamalpha@rugscreation.com", dept: "ta", from: "A Buyer", email: "b" + k + "@x.com",
    sub: "Mail " + k, pre: "x", last: T("26", "10"), owner: null, status: "open", folder: "inbox",
    unread: true, hist: [], cats: [], flag: 0, pinned: 0, full: true,
    msgs: [{ gid: "g" + k, from: "A Buyer", email: "b" + k + "@x.com", at: T("26", "10"), body: "hello", subject: "Mail " + k, to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
  }, o);
  const T_NEW = T("27", "09");
  S.threads = [
    mk({ sub: "Inbox one" }), mk({ sub: "Inbox two" }), mk({ sub: "Inbox three", last: T_NEW }),
    mk({ sub: "Inbox read", unread: false }),
    mk({ sub: "Jagjit owns this", owner: "jagjit" }),                        /* R3: a member must not count it */
    mk({ sub: "Archive one", folder: "archive" }), mk({ sub: "Archive two", folder: "archive" }),
    mk({ sub: "Junk one", folder: "junk" }),
    mk({ sub: "Deleted one", folder: "deleted" }),
    mk({ sub: "Claims one", folder: "Claims" }),                             /* a personal folder */
    mk({ sub: "Sent only", folder: "inbox", unread: false }),
    mk({
      sub: "Your pending tasks", from: "Rugs Creation Workspace", email: "noreply@rugscreation.com",
      msgs: [{ gid: "gw", from: "Rugs Creation Workspace", email: "noreply@rugscreation.com", at: T("26", "10"), body: "report", subject: "Your pending tasks", to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
    }),                                                                       /* must not be counted */
    mk({ dept: "mkt", box: "marketing@rugscreation.com", sub: "Marketing one" })
  ];
  S.prefs = S.prefs || {}; S.prefs.folders = ["Claims"];
  S.settings = {}; app = "mail";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }

  window.__as = (me, folder) => {
    ME = me; openId = null;
    const myDept = who(me).dept;
    view = { type: "box", dept: myDept === "mkt" ? "mkt" : "ta", folder: folder || "inbox" };
    if (typeof filt !== "undefined") filt = "all";
    render();
  };
  /* every folder row as it is drawn: its label, its number and how the number is styled */
  window.__pane = () => [].slice.call(document.querySelectorAll("#folders .fi")).map(el => {
    const c = el.querySelector(".c");
    return {
      lbl: (el.querySelector(".lbl") || {}).textContent || "",
      box: el.getAttribute("data-box") || "", f: el.getAttribute("data-f") || "",
      uf: el.getAttribute("data-userf") || "", fav: el.getAttribute("data-fav") || "",
      all: el.hasAttribute("data-allbox"),
      n: c ? c.textContent : null,
      bold: c ? c.classList.contains("fcb") : null,
      grey: c ? c.classList.contains("fcg") : null,
      weight: c ? getComputedStyle(c).fontWeight : null,
      nameBold: el.classList.contains("fcnew"),
      nameWeight: el.querySelector(".lbl") ? getComputedStyle(el.querySelector(".lbl")).fontWeight : null
    };
  });
  window.__row = (f) => window.__pane().find(r => (f === "all" ? r.all : f === "Claims" ? r.uf === "Claims" : (r.f === f && r.box === (ME === "adm" ? "mkt" : "ta")))) || null;
  window.__fav = (id) => window.__pane().find(r => r.fav === id) || null;
  window.__listUnread = () => listRows().filter(t => t.unread).length;
  window.__inboxN = () => inboxUnreadN(view.dept);
  return "ok";
});
ck("the app and the test mail are set up", setup, "ok");

/* ------------------------------------------------- 1 · the member -------- */
console.log("\n=== 1 · as Imran (a member of Team Alpha) ===");
await page.evaluate(() => window.__as("imran", "inbox"));
const pane = await page.evaluate(() => window.__pane().filter(r => r.f || r.uf).map(r => r.lbl + "=" + (r.n == null ? "-" : r.n) + (r.bold ? " bold" : "") + (r.grey ? " grey" : "") + (r.nameBold ? " NAME-BOLD" : "")));
console.log("     " + pane.join("\n     "));
const inbox = await page.evaluate(() => window.__row("inbox"));
ck("1 · the Inbox shows its unread count", inbox.n, "3");
ck("...it is the same number every other Inbox count uses", await page.evaluate(() => String(window.__inboxN())), "3");
ck("...and the same as the unread rows in the list", await page.evaluate(() => window.__listUnread()), 3);
ck("R3 · the conversation Jagjit owns is not counted for him", inbox.n, "3");
ck("1 · the count is bold", [inbox.bold, inbox.weight], [true, "800"]);
const arch = await page.evaluate(() => window.__row("archive"));
ck("1 · Archive has a count now", arch.n, "2");
ck("...in bold", [arch.bold, arch.weight], [true, "800"]);
const claims = await page.evaluate(() => window.__row("Claims"));
ck("1 · a personal folder has a count", claims.n, "1");
ck("1 · a folder with nothing unread shows no number (Sent)", (await page.evaluate(() => window.__row("sent"))).n, null);
ck("1 · Drafts keeps its own number, not an unread count", (await page.evaluate(() => window.__pane().find(r => r.f === "drafts").n)), null);
ck("a Workspace notification is not counted anywhere", await page.evaluate(() => { const C = fcCounts(); return Object.keys(C.box).map(k => k + "=" + C.box[k].n).sort(); }), ["all=3", "b|ta|archive=2", "b|ta|deleted=1", "b|ta|inbox=3", "b|ta|junk=1", "u|Claims=1"]);

/* ------------------------------------------------- 4 · junk and deleted -- */
console.log("\n=== 4 · Junk and Deleted ===");
const junk = await page.evaluate(() => window.__row("junk"));
const del = await page.evaluate(() => window.__row("deleted"));
ck("4 · Junk shows its count", junk.n, "1");
ck("4 · ...in grey, not bold", [junk.grey, junk.bold, junk.weight], [true, false, "500"]);
ck("4 · Deleted shows its count", del.n, "1");
ck("4 · ...in grey, not bold", [del.grey, del.bold, del.weight], [true, false, "500"]);

/* ------------------------------------------------- 2 · the bold name ----- */
console.log("\n=== 2 · a folder with new mail has a bold name ===");
ck("2 · Archive's name is bold while its mail is new to him", [arch.nameBold, arch.nameWeight], [true, "800"]);
ck("2 · the Inbox he is looking at is not bold", inbox.nameBold, false);
const opened = await page.evaluate(() => { window.__as("imran", "archive"); return window.__row("archive"); });
ck("2 · opening Archive clears the bold", opened.nameBold, false);
ck("...but the number stays", opened.n, "2");
const back = await page.evaluate(() => { window.__as("imran", "inbox"); return { arch: window.__row("archive"), inbox: window.__row("inbox") }; });
ck("2 · and it stays cleared once it has been opened", back.arch.nameBold, false);
ck("2 · while the Inbox, now left, goes bold again when its mail is newer than the visit", back.inbox.nameBold, false);
const arrived = await page.evaluate(() => {
  /* new mail lands in Archive while he is in the Inbox */
  const t = S.threads.find(x => x.sub === "Archive one");
  t.last = Date.now(); t.msgs[0].at = t.last; t.unread = true;
  render();
  return window.__row("archive");
});
ck("2 · new mail in a folder he is not in turns the name bold again", arrived.nameBold, true);

/* ------------------------------------------------- 3 · live updates ------ */
console.log("\n=== 3 · the numbers update without redrawing the page ===");
const live = await page.evaluate(() => {
  const rowOf = () => document.querySelector('#folders .fi[data-box="ta"][data-f="archive"]');
  const before = rowOf(), beforeN = before.querySelector(".c").textContent;
  S.threads.find(x => x.sub === "Archive two").unread = false;    /* Mark read */
  fcPaint();                                                      /* no render() at all */
  const after = rowOf();
  return { beforeN, afterN: after.querySelector(".c") ? after.querySelector(".c").textContent : null, sameNode: before === after, drew: false };
});
ck("3 · Mark read drops the number", [live.beforeN, live.afterN], ["2", "1"]);
ck("3 · ...and the folder row is the very same element (nothing was rebuilt)", live.sameNode, true);
const moved = await page.evaluate(() => {
  const t = S.threads.find(x => x.sub === "Inbox two");
  t.folder = "junk"; t.prev = "inbox";                            /* a move */
  fcPaint();
  return { inbox: window.__row("inbox").n, junk: window.__row("junk").n };
});
ck("3 · a move takes it off one folder and adds it to the other", moved, { inbox: "2", junk: "2" });
const unread = await page.evaluate(() => {
  S.threads.find(x => x.sub === "Inbox read").unread = true;      /* Mark unread */
  fcPaint(); return window.__row("inbox").n;
});
ck("3 · Mark unread puts it back up", unread, "3");
const gone = await page.evaluate(() => {
  S.threads.forEach(t => { if (t.folder === "Claims") t.unread = false });
  fcPaint(); return window.__row("Claims").n;
});
ck("3 · a folder that falls to 0 loses its number", gone, null);

/* ------------------------------------------------- 5 · manager and admin - */
console.log("\n=== 5 · the manager and the admin ===");
const mgr = await page.evaluate(() => { window.__as("jagjit", "inbox"); return { inbox: window.__row("inbox").n, n: window.__inboxN(), list: window.__listUnread() }; });
console.log("     manager: " + JSON.stringify(mgr));
ck("the manager sees the one the member could not (R3)", mgr.inbox, "4");
ck("...and his count still equals his list", [mgr.n, mgr.list], [4, 4]);
const adm = await page.evaluate(() => {
  window.__as("adm", "inbox");
  const all = window.__row("all"), shared = window.__pane().filter(r => r.f === "inbox" && r.box && r.box !== "mkt");
  return { mkt: window.__row("inbox").n, all: all ? all.n : null, shared: shared.map(r => r.lbl + "=" + r.n) };
});
console.log("     admin: " + JSON.stringify(adm));
ck("the admin's own mailbox count", adm.mkt, "1");
ck("...the shared Team Alpha row carries its count too", adm.shared.some(x => /Team Alpha=/.test(x)), true);
ck('..."All inboxes" counts every mailbox he may see', adm.all, "5");

/* ------------------------------------------------- 6 · phone and dark --- */
console.log("\n=== 6 · phone width and dark mode ===");
await page.setViewportSize({ width: 390, height: 780 });
const phone = await page.evaluate(() => {
  window.__as("imran", "inbox");
  const sel = document.querySelector("#mpick");
  const opts = sel ? [].slice.call(sel.options).map(o => o.textContent) : [];
  const wide = () => document.scrollingElement.scrollWidth - window.innerWidth;
  const withCounts = wide();
  const mine = mobilePicker; mobilePicker = _mpFC; render();     /* the app's own picker */
  const without = wide();
  mobilePicker = mine; render();
  return {
    paneHidden: getComputedStyle(document.querySelector("#folders")).display === "none",
    opts: opts.filter(x => /\(\d+\)/.test(x)),
    withCounts, without, selFits: (() => { const sl = document.querySelector("#mpick"); return sl ? sl.getBoundingClientRect().right <= window.innerWidth + 1 : null; })()
  };
});
console.log("     " + JSON.stringify(phone));
ck("the folder pane is hidden on a phone, as before", phone.paneHidden, true);
ck("...so the picker carries the counts instead", phone.opts.length > 0, true);
ck("...the Inbox one is there", phone.opts.some(x => /Inbox \(3\)/.test(x)), true);
ck("...the picker itself fits the screen", phone.selFits, true);
ck("...and the counts in it make the page no wider than the app already was", phone.withCounts <= phone.without, true);
await page.setViewportSize({ width: 1280, height: 900 });
const dark = await page.evaluate(() => {
  const read = () => { window.__as("imran", "inbox"); const r = window.__row("inbox"); const c = document.querySelector('#folders .fi[data-f="inbox"] .c'); return { w: r.weight, col: getComputedStyle(c).color }; };
  document.documentElement.dataset.theme = "light"; const light = read();
  document.documentElement.dataset.theme = "dark"; const night = read();
  document.documentElement.dataset.theme = "light";
  return { light, night };
});
console.log("     " + JSON.stringify(dark));
ck("dark mode keeps the count bold", dark.night.w, "800");
ck("...and gives it the dark theme's own colour", dark.night.col !== dark.light.col, true);
ck("...which is not see-through", /rgba\(.*,\s*0\)/.test(dark.night.col), false);

/* ------------------------------------------------- 7 · no errors -------- */
console.log("\n=== 7 · the browser console ===");
ck("no page errors", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
