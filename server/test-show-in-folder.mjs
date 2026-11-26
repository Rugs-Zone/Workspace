/* test-show-in-folder.mjs - 27 Nov 2026  (bug 9: "Show in Inbox" from a quoted mail)
 *
 * Real headless Edge on the BUILT app (mail-app.html), as Imran in Team Alpha. One
 * conversation holds his own reply, which carries a Mail trail of two earlier mails: the
 * buyer's Tue 24 Nov 10:37 pm mail, which REALLY came to teamalpha@ (it is a row in his
 * Inbox), and a mail that was only ever quoted. Checked: the ... button on each quoted mail,
 * the label naming the real folder, the jump (folder switched, filters cleared, row drawn,
 * flashed, selected, not opened), the three "never silent" messages, R3 and R15 untouched,
 * the keyboard, and phone width.
 *
 * Run:  node server/test-show-in-folder.mjs
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
  if (typeof sibShow !== "function") return "the __showin block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "gulab", name: "Gulab Tyagi", login: "amr1@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" },
    { id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" });
  const D = s => Date.parse(s);
  const T_BUYER = D("2026-11-24T22:37:00+05:30");          /* Tue 24 Nov 10:37 pm */
  const T_OLD = D("2026-11-20T11:00:00+05:30");
  const T_MINE = D("2026-11-25T09:15:00+05:30");

  /* the quoted mails, exactly the shape trailOf() builds */
  const qBuyer = { from: "A Buyer", email: "buyer@induskrafts.com", at: T_BUYER, to: "teamalpha@rugscreation.com", cc: "", sub: "IO 4815 zipper", body: "Please confirm the zipper.", sig: "", html: "<p>Please confirm the zipper.</p>" };
  const qGhost = { from: "Someone Else", email: "ghost@nowhere.com", at: T_OLD, to: "buyer@induskrafts.com", cc: "", sub: "IO 4815 zipper", body: "Only ever quoted.", sig: "", html: "<p>Only ever quoted.</p>" };

  const mk = (o) => Object.assign({
    box: "teamalpha@rugscreation.com", dept: "ta", pre: "x", owner: null, status: "open",
    folder: "inbox", unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true
  }, o);

  /* 1 · the conversation being read: the buyer's real mail + Imran's reply carrying the trail */
  const conv = mk({
    id: "ta:1", from: "A Buyer", email: "buyer@induskrafts.com", sub: "IO 4815 zipper", last: T_MINE,
    msgs: [
      { gid: "g1", from: "A Buyer", email: "buyer@induskrafts.com", at: T_BUYER, body: "Please confirm the zipper.", subject: "IO 4815 zipper", to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" },
      { gid: "g2", from: "Imran Khan", email: "teamalpha@rugscreation.com", at: T_MINE, body: "Confirmed.", subject: "RE: IO 4815 zipper", to: "buyer@induskrafts.com", cc: "", by: "imran", ours: true, atts: [], files: [], sig: "", raw: "", html: "<p>Confirmed.</p>", trail: [qGhost, qBuyer] }
    ]
  });
  /* 2 · a conversation Gulab owns, with a mail at the same time as a quoted one (R3) */
  const owned = mk({
    id: "ta:2", from: "Other Buyer", email: "other@x.com", sub: "Owned by Gulab", last: D("2026-11-23T10:00:00+05:30"), owner: "gulab",
    msgs: [{ gid: "g3", from: "Other Buyer", email: "other@x.com", at: D("2026-11-23T10:00:00+05:30"), body: "Owned.", subject: "Owned by Gulab", to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
  });
  /* 3 · a conversation in another mailbox Imran may not see */
  const far = mk({
    id: "tp:9", dept: "tp", box: "teampulse@rugscreation.com", from: "Far Buyer", email: "far@x.com", sub: "Another mailbox", last: D("2026-11-22T10:00:00+05:30"),
    msgs: [{ gid: "g4", from: "Far Buyer", email: "far@x.com", at: D("2026-11-22T10:00:00+05:30"), body: "Far away.", subject: "Another mailbox", to: "teampulse@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
  });
  /* 4 · a conversation only Gulab's sent mail is in - R15 in Sent */
  const colSent = mk({
    id: "ta:3", from: "Gulab Tyagi", email: "teamalpha@rugscreation.com", sub: "Gulab wrote this", last: D("2026-11-21T10:00:00+05:30"),
    msgs: [{ gid: "g5", from: "Gulab Tyagi", email: "teamalpha@rugscreation.com", at: D("2026-11-21T10:00:00+05:30"), body: "Mine.", subject: "Gulab wrote this", to: "x@y.com", cc: "", by: "", ours: true, fname: "Gulab Tyagi", atts: [], files: [], sig: "", raw: "", html: "" }]
  });
  /* 5 · an archived conversation, so the label must say Archive */
  const arch = mk({
    id: "ta:4", folder: "archive", from: "Arch Buyer", email: "arch@x.com", sub: "Archived one", last: D("2026-11-19T10:00:00+05:30"),
    msgs: [{ gid: "g6", from: "Arch Buyer", email: "arch@x.com", at: D("2026-11-19T10:00:00+05:30"), body: "Filed away.", subject: "Archived one", to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
  });
  S.threads = [conv, owned, far, colSent, arch];
  /* plus 400 fillers, so the wanted row is far outside the 150-row draw window */
  for (let i = 0; i < 400; i++) {
    const at = D("2026-11-26T12:00:00+05:30") - i * 60000;
    S.threads.push(mk({
      id: "ta:f" + i, from: "Filler " + i, email: "f" + i + "@x.com", sub: "Filler " + i, last: at,
      msgs: [{ gid: "f" + i, from: "Filler " + i, email: "f" + i + "@x.com", at, body: "filler", subject: "Filler " + i, to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
    }));
  }
  S.settings = {}; ME = "imran"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }
  window.__Q = { buyer: qBuyer, ghost: qGhost };

  /* open Imran's own reply, the mail that carries the Mail trail */
  window.__openReply = () => {
    ME = "imran"; app = "mail"; view = { type: "box", dept: "ta", folder: "sent" };
    openId = "ta:1"; openMsgs["ta:1"] = new Set([1]);
    render();
    const d = document.querySelector("#read details.trail");
    if (d) d.setAttribute("open", "");
    renderRead();
    return document.querySelectorAll("#read details.trail .q > div").length;
  };
  window.__trailBtns = () => [].slice.call(document.querySelectorAll("#read details.trail .q > div")).map(b => ({
    who: (b.querySelector(".qh") || {}).textContent ? b.querySelector(".qh").textContent.replace(/\s+/g, " ").slice(0, 40) : "",
    btn: !!b.querySelector("[data-sibm]"), tag: b.querySelector("[data-sibm]") ? b.querySelector("[data-sibm]").tagName : ""
  }));
  /* click the ... of quoted mail number n (1 = oldest, as the trail numbers them) */
  window.__menu = n => {
    const box = document.querySelectorAll("#read details.trail .q > div")[n - 1];
    if (!box) return "no quoted mail " + n;
    const b = box.querySelector("[data-sibm]"); if (!b) return "no ... button";
    b.click();
    const m = document.querySelector(".cmenu");
    if (!m) return "no menu";
    return { label: m.textContent.replace(/\s+/g, " ").trim(), focused: document.activeElement === m.querySelector("button"), items: m.querySelectorAll("[data-cm]").length };
  };
  window.__pick = () => { const b = document.querySelector('.cmenu [data-cm="sibq"]'); if (!b) return "no item"; b.click(); return "ok"; };
  window.__esc = () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return !!document.querySelector(".cmenu"); };
  window.__toast = () => { const t = document.querySelector(".toast"); return t ? t.textContent : ""; };
  window.__row = () => {
    const el = document.querySelector('.list .m[data-open="ta:1"][data-mi="0"]');
    return {
      there: !!el, flash: el ? el.classList.contains("sibhit") : null, sel: el ? el.classList.contains("sibsel") : null,
      focused: el ? document.activeElement === el : null,
      folder: view.folder, filt: typeof filt === "undefined" ? "" : filt, q: (document.getElementById("q") || {}).value || "",
      opened: openId, rows: document.querySelectorAll(".list .m[data-open]").length
    };
  };
  /* the reading pane's own ... More menu, on the open mail */
  window.__paneMore = () => {
    const b = document.querySelector("#read article.mail:not(.collapsed) [data-olkmore]");
    if (!b) return "no ... button in the pane";
    b.click();
    const m = document.querySelector(".cmenu");
    const it = m && m.querySelector('[data-cm^="sib:"]');
    return { item: it ? it.textContent.replace(/\s+/g, " ").trim() : "", onScreen: m ? (m.getBoundingClientRect().bottom <= innerHeight) : null };
  };
  window.__paneGo = () => { const b = document.querySelector('.cmenu [data-cm^="sib:"]'); if (!b) return "no item"; b.click(); return "ok"; };
  return "ok";
});
ck("the app and the test data are set up", setup, "ok");

/* ------------------------------------------------- 1 · the ... buttons --- */
console.log("\n=== 1 · the Mail trail ===");
ck("Imran's reply carries two quoted mails", await page.evaluate(() => window.__openReply()), 2);
const btns = await page.evaluate(() => window.__trailBtns());
console.log("     " + JSON.stringify(btns));
ck("every quoted mail has a ... button", btns.map(b => b.btn), [true, true]);
ck("...and it is a real button, so the keyboard reaches it", btns.map(b => b.tag), ["BUTTON", "BUTTON"]);
ck("drawing again does not double them", await page.evaluate(() => { renderRead(); return document.querySelectorAll("#read details.trail [data-sibm]").length; }), 2);

/* ------------------------------------------------- 2+3 · the real mail --- */
console.log("\n=== 2+3 · the Tue 24 Nov 10:37 pm mail (it really came to teamalpha@) ===");
const m2 = await page.evaluate(() => window.__menu(2));
console.log("     " + JSON.stringify(m2));
ck("the menu names the folder that mail's row lives in", m2.label, "\u{1F4CD} Show in Inbox");
ck("...with the item focused for the keyboard", m2.focused, true);
ck("Escape closes the menu", await page.evaluate(() => window.__esc()), false);
await page.evaluate(() => window.__menu(2));
ck("pressing it works", await page.evaluate(() => window.__pick()), "ok");
await page.waitForTimeout(900);
const row = await page.evaluate(() => window.__row());
console.log("     " + JSON.stringify(row));
ck("3 · it switched to the Inbox", row.folder, "inbox");
ck("3 · the row is drawn, past the 150-row window", row.there, true);
ck("3 · it is flashing", row.flash, true);
ck("3 · it is left selected", row.sel, true);
ck("3 · and focused, so the keyboard carries on from there", row.focused, true);
ck("3 · the chips are cleared", row.filt, "all");
ck("3 · the search box is empty", row.q, "");
ck("3 · the mail was NOT opened", row.opened, "ta:1");
ck("3 · the toast says where it went", await page.evaluate(() => window.__toast()), "Shown in Inbox");
await page.waitForTimeout(2600);
ck("the flash stops after 3 seconds", await page.evaluate(() => { const el = document.querySelector('.list .m[data-open="ta:1"][data-mi="0"]'); return el ? el.classList.contains("sibhit") : null; }), false);
ck("...but it stays selected", await page.evaluate(() => { const el = document.querySelector('.list .m[data-open="ta:1"][data-mi="0"]'); return el ? el.classList.contains("sibsel") : null; }), true);
ck("a redraw keeps it selected", await page.evaluate(() => { render(); const el = document.querySelector('.list .m[data-open="ta:1"][data-mi="0"]'); return el ? el.classList.contains("sibsel") : null; }), true);

/* ------------------------------------------------- 4 · only quoted ------- */
console.log("\n=== 4 · the mail that was only ever quoted ===");
const ghost = await page.evaluate(async () => {
  /* the server is stubbed with the answer it really gives when nothing matches, so the
     test does not depend on a live office server - and the ASK is checked too */
  const real = api; let asked = null;
  api = (a, p) => { if (a !== "find") return real(a, p); asked = p; return Promise.resolve({ threads: [], messages: [], activity: [], words: [], text: true }); };
  window.__openReply();
  const m = window.__menu(1);
  const r = window.__pick();
  await new Promise(r2 => setTimeout(r2, 700));
  const out = { label: m.label, picked: r, toast: window.__toast(), folder: view.folder, asked };
  api = real;
  return out;
});
console.log("     " + JSON.stringify(ghost));
ck("the menu offers to look for it", ghost.label, "\u{1F4CD} Find this mail");
ck("2 · it really asks the server, by sender and subject", [!!ghost.asked, ghost.asked && ghost.asked.f.from, ghost.asked && ghost.asked.f.subject], [true, "ghost@nowhere.com", "io 4815 zipper"]);
ck("...and round that mail's own time", !!(ghost.asked && ghost.asked.f.after && ghost.asked.f.before), true);
ck("4 · and says plainly that it never came here", ghost.toast, "Only quoted here \u2014 this mail never came to this mailbox");
ck("...nothing was moved or opened", ghost.folder, "sent");
/* a server that cannot answer must never be reported as "it was never here" */
const dead = await page.evaluate(async () => {
  const real = api;
  api = (a, p) => a === "find" ? Promise.reject(new Error("the mail server was busy")) : real(a, p);
  window.__openReply(); window.__menu(1); window.__pick();
  await new Promise(r => setTimeout(r, 700));
  const t = window.__toast(); api = real; return t;
});
ck("4 · a server that could not answer says so instead", dead, "Could not look for it on the server \u2014 the mail server was busy");

/* ------------------------------------------------- 4b · R3 and R15 ------- */
console.log("\n=== 4b · the rules are asked, never bent ===");
const rules = await page.evaluate(() => {
  const out = {};
  ME = "imran";
  out.folderBefore = view.folder;
  sibShow(T_("ta:2"), 0); out.owned = window.__toast();            /* R3 - Gulab owns it */
  sibShow(T_("tp:9"), 0); out.far = window.__toast();              /* another mailbox */
  sibShow(T_("ta:3"), 0); out.colleague = window.__toast();        /* R15 - his sent mail */
  out.folderAfter = view.folder;
  return out;
});
console.log("     " + JSON.stringify(rules));
ck("R3 · a conversation Gulab owns says so", rules.owned, "This mail belongs to Gulab Tyagi");
ck("a mailbox he may not see says so", rules.far, "Not in your mailboxes");
ck("R15 · a colleague's sent mail says so", rules.colleague, "This mail belongs to Gulab Tyagi");
ck("...and none of the three moved him anywhere", rules.folderAfter, rules.folderBefore);

/* ------------------------------------------------- 5 · other folders ----- */
console.log("\n=== 5 · an archived mail, and the pane's own ... menu ===");
ck("the label follows the real folder", await page.evaluate(() => sibFolderName(sibFolderOf(T_("ta:4"), 0))), "Archive");
const arch = await page.evaluate(async () => { sibShow(T_("ta:4"), 0); await new Promise(r => setTimeout(r, 700)); return { folder: view.folder, there: !!document.querySelector('.list .m[data-open="ta:4"]') }; });
ck("...and it goes there", [arch.folder, arch.there], ["archive", true]);
const pane = await page.evaluate(() => { window.__openReply(); return window.__paneMore(); });
console.log("     " + JSON.stringify(pane));
ck('the reading pane\'s ... menu has the item too ("Show all N mails" mails)', pane.item, "\u{1F4CD} Show in Sent");
ck("...and the menu is still on the screen after it grew", pane.onScreen, true);
const paneGo = await page.evaluate(async () => { const r = window.__paneGo(); await new Promise(x => setTimeout(x, 800)); return { r, folder: view.folder, there: !!document.querySelector('.list .m[data-open="ta:1"][data-mi="1"]'), toast: window.__toast() }; });
ck("pressing it goes to that mail's own row in Sent", [paneGo.folder, paneGo.there], ["sent", true]);

/* ------------------------------------------------- 5b · phone width ----- */
console.log("\n=== 5b · phone width ===");
await page.setViewportSize({ width: 390, height: 780 });
const phone = await page.evaluate(async () => {
  /* what the app does at this width on its own, before the feature is used at all */
  ME = "imran"; app = "mail"; openId = null; view = { type: "box", dept: "ta", folder: "inbox" }; render();
  const wasWide = document.scrollingElement.scrollWidth > window.innerWidth + 1;
  window.__openReply();
  /* measure the quoted header WHILE the trail is on the screen, with its new ... on it */
  const qh = document.querySelector("#read .trail .qh");
  const qhFits = qh ? qh.getBoundingClientRect().right <= window.innerWidth + 1 : null;
  const sibOn = !!document.querySelector("#read .trail .qh [data-sibm]");
  const m = window.__menu(2); const p = window.__pick();
  await new Promise(r => setTimeout(r, 900));
  const el = document.querySelector('.list .m[data-open="ta:1"][data-mi="0"]');
  const list = document.querySelector(".list");
  return {
    label: m.label, picked: p, folder: view.folder, opened: openId,
    reading: document.body.classList.contains("reading"),
    listShown: list ? getComputedStyle(list).display !== "none" : null,
    rowShown: el ? !!(el.offsetParent || el.getClientRects().length) : null,
    sel: el ? el.classList.contains("sibsel") : null,
    wasWide,
    isWide: document.scrollingElement.scrollWidth > window.innerWidth + 1,
    qhFits, sibOn
  };
});
console.log("     " + JSON.stringify(phone));
ck("the menu works on a phone", phone.label, "\u{1F4CD} Show in Inbox");
ck("the ... is drawn on the quoted mail at phone width", phone.sibOn, true);
ck("...and its header still fits the screen", phone.qhFits, true);
ck("it leaves the reading pane so the list can be seen", phone.reading, false);
ck("...the list is shown", phone.listShown, true);
ck("...the row is really on the screen", phone.rowShown, true);
ck("...and selected", phone.sel, true);
ck("...and the page is no wider sideways than it was without the feature", phone.isWide, phone.wasWide);
await page.setViewportSize({ width: 1280, height: 900 });

/* ------------------------------------------------- 6 · no errors -------- */
console.log("\n=== 6 · the browser console ===");
ck("no page errors", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
