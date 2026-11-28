/* test-mysent-36.mjs - 28 Nov 2026   (rule R36)
 *
 * R36: your OWN sent mail is shown in your Sent whatever mailbox it landed in - read only,
 * your mail and nothing else from that mailbox.
 *
 * Checked in real headless Edge on the built app (mail-app.html), with the shape the live
 * server really answers (measured first with server/measure-ashish-sent.mjs). The server half
 * is checked against the live office server by server/test-mysent-live.mjs.
 *
 * Run:  node server/test-mysent-36.mjs
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

/* ---------- the fixture: his own mailbox, and three mails of his the server found in
   mailboxes he cannot open (exactly the shape of the "mysent" answer) ---------- */
const setup = await page.evaluate(() => {
  PEOPLE.length = 0;
  PEOPLE.push({ id: "ash", name: "Ashish Deshwal", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {}, access: {} });
  PEOPLE.push({ id: "gul", name: "Gulab Tyagi", login: "merchandiser8@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {}, access: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", mailbox: "teampulse@rugscreation.com", color: "#09c" });
  const BOX = "teampulse@rugscreation.com", at = Date.parse("2026-11-27T10:32:00Z");
  S.threads = [{
    id: "tp:1", box: BOX, dept: "tp", from: "Lily-Sue Martin", email: "lily-sue.martin@flairrugs.com",
    sub: "Romy Sample Delay", pre: "x", last: at, owner: "ash", status: "open", folder: "inbox",
    unread: true, hist: [], cats: [], flag: 0, pinned: 0, full: true, to: [BOX],
    msgs: [
      { gid: "1a", from: "Lily-Sue Martin", fname: "Lily-Sue Martin", email: "lily-sue.martin@flairrugs.com", at: at - 36e5, body: "Buyer writes.", to: BOX, cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", full: true },
      { gid: "1b", from: "Ashish Deshwal", fname: "Ashish Deshwal", email: "merchandiser9@rugscreation.com", at, body: "Noted, shipping on Friday.", to: "lily-sue.martin@flairrugs.com", cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", full: true }
    ]
  }];
  S.settings = {}; ME = "ash"; app = "mail";
  view = { type: "box", dept: "tp", folder: "sent" };
  if (typeof filt !== "undefined") filt = "all";
  if (typeof lfilt !== "undefined") lfilt = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0 }) } catch (e) { }
  window.LIVE = false; api = async () => ({});

  /* what the real server answers - his own mail out of mailboxes he may not open */
  window.__fsCalls = 0;
  window.__fsFixture = [
    { mailbox: "vinay@rugscreation.com", gmail_id: "g1", gmail_thread_id: "t1",
      subject: "RE: New order | Po 26314003986", to_text: '"Robin Vos | Loods 5" <r.vos@loods5.nl>, noorul@a2zbuyingservices.com',
      cc_text: '"Maud Wedman" <m.wedman@loods5.nl>', sent_at: "2026-11-26T09:00:00.000Z", has_attachments: true,
      body: "Dear Robin,\n\nThe order is confirmed and the samples leave on Friday.\n\nAshish" },
    { mailbox: "shipping@rugscreation.com", gmail_id: "g2", gmail_thread_id: "t2",
      subject: "Booking request MUNDRA 40HQ", to_text: "[Geodis]<https://eu.content.exclaimer.net/?url=x> ops@geodis.com",
      cc_text: "", sent_at: "2026-11-25T06:10:00.000Z", has_attachments: false,
      body: "Please book one 40HQ for week 49." },
    { mailbox: "designer@rugscreation.com", gmail_id: "g3", gmail_thread_id: "t3",
      subject: "SS27 CAD approval", to_text: "jai@rugscreation.com", cc_text: "", sent_at: "2026-11-24T11:45:00.000Z",
      has_attachments: false, body: "CADs attached for approval." }
  ];
  window.fs36Api = async () => { window.__fsCalls++; return { mails: window.__fsFixture, closed: ["vinay@rugscreation.com"], now: Date.now() } };

  /* what his Sent and his Inbox look like BEFORE R36 has fetched anything */
  const before = { sentRows: listRows().length, threads: S.threads.length, inboxUnread: inboxUnreadN() };
  render();
  return { before, hasHook: typeof fs36Draw === "function", liveReadyUsed: !window.__liveReady };
});
ck("the R36 block is in the built app", setup.hasHook, true);
ck("nothing is fetched before the app says it is live", setup.liveReadyUsed, true);

/* nothing happens at all until the session is live */
const offline = await page.evaluate(() => ({ group: !!document.querySelector("[data-fs36group]"), calls: window.__fsCalls }));
ck("signed out / not live: no group, no call", offline, { group: false, calls: 0 });

/* ---------- 1 · the group appears in Sent ---------- */
const one = await page.evaluate(async () => {
  window.__liveReady = true;
  render();                       /* draws, sees FS36 === null, asks the server */
  await new Promise(r => setTimeout(r, 120));
  const box = document.querySelector(".list .msgs");
  const head = document.querySelector("[data-fs36group]");
  const rows = [...document.querySelectorAll("[data-fs36]")];
  return {
    calls: window.__fsCalls,
    head: head ? head.textContent.trim() : "",
    rows: rows.length,
    first: rows[0] ? {
      to: rows[0].querySelector(".who").textContent.trim(),
      sub: rows[0].querySelector(".sub").textContent.trim(),
      pre: rows[0].querySelector(".pre").textContent.trim().slice(0, 40),
      tag: rows[0].querySelector(".tags .tag").textContent.trim(),
      clip: !!rows[0].querySelector('[title="Has attachment"]'),
      opens: rows[0].hasAttribute("data-open")
    } : null,
    second: rows[1] ? rows[1].querySelector(".who").textContent.trim() : "",
    lastIsOurs: box ? box.lastElementChild.hasAttribute("data-fs36") : false,
    report: window.rzMySent()
  };
});
ck("1 · the server was asked once", one.calls, 1);
ck("1 · the group names itself and counts", one.head, "📤 Also sent by you · in mailboxes you cannot open · 3");
ck("1 · three rows", one.rows, 3);
ck("1 · the row says who it went to", one.first.to, "To: r.vos@loods5.nl, noorul@a2zbuyingservices.com");
ck("1 · the subject", one.first.sub, "New order | Po 26314003986");
ck("1 · the preview is his own words", one.first.pre, "Dear Robin, The order is confirmed and t");
ck("1 · the row says which mailbox, and read only", one.first.tag, "vinay@ · read only");
ck("1 · an attachment is shown", one.first.clip, true);
ck("1 · the row is NOT an ordinary mail row (no data-open)", one.first.opens, false);
ck("1 · a junk To: still finds the real address", one.second, "To: ops@geodis.com");
ck("1 · the group sits at the end of the list", one.lastIsOurs, true);
ck("1 · rzMySent() reports", { mails: one.report.mails, loadedFor: one.report.loadedFor, error: one.report.error }, { mails: 3, loadedFor: "ash", error: "none" });

/* ---------- 2 · nothing else in the app moved ---------- */
const two = await page.evaluate(() => ({
  threads: S.threads.length,
  sentRows: listRows().length,
  inboxUnread: inboxUnreadN(),
  inboxHasThem: (() => { view = { type: "box", dept: "tp", folder: "inbox" }; render(); return !!document.querySelector("[data-fs36]") || !!document.querySelector("[data-fs36group]") })(),
  archiveHasThem: (() => { view = { type: "box", dept: "tp", folder: "archive" }; render(); return !!document.querySelector("[data-fs36]") })(),
  needsHasThem: (() => { view = { type: "fav", id: "needs" }; render(); return !!document.querySelector("[data-fs36]") })(),
  deletedHasThem: (() => { view = { type: "box", dept: "tp", folder: "deleted" }; render(); return !!document.querySelector("[data-fs36]") })()
}));
ck("2 · the mail list itself is untouched", { t: two.threads, s: two.sentRows }, { t: setup.before.threads, s: setup.before.sentRows });
ck("2 · the Inbox count is untouched", two.inboxUnread, setup.before.inboxUnread);
ck("2 · not in the Inbox", two.inboxHasThem, false);
ck("2 · not in Archive", two.archiveHasThem, false);
ck("2 · not in Needs owner", two.needsHasThem, false);
ck("2 · not in Deleted", two.deletedHasThem, false);

/* ---------- 3 · reading one, read only ---------- */
const three = await page.evaluate(async () => {
  view = { type: "box", dept: "tp", folder: "sent" }; render();
  await new Promise(r => setTimeout(r, 60));
  const row = document.querySelector('[data-fs36="0"]');
  row.click();
  const d = document.getElementById("fs36dlg");
  const txt = d ? d.textContent : "";
  const out = {
    opened: !!d,
    hasBody: txt.includes("The order is confirmed and the samples leave on Friday"),
    saysWhere: txt.includes("vinay@rugscreation.com") && txt.includes("your own mail only"),
    saysCc: txt.includes("m.wedman@loods5.nl"),
    reply: /\bReply\b|\bForward\b|\bMark done\b/.test(txt),
    buttons: [...d.querySelectorAll("button")].length,
    openId: typeof openId === "undefined" ? "?" : (openId || ""),
    role: d.getAttribute("role") + "/" + d.getAttribute("aria-modal")
  };
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  out.closed = !document.getElementById("fs36dlg");
  return out;
});
ck("3 · a click opens the reader", three.opened, true);
ck("3 · it shows his own mail", three.hasBody, true);
ck("3 · it says which mailbox and that it is his mail only", three.saysWhere, true);
ck("3 · Cc is shown", three.saysCc, true);
ck("3 · no Reply / Forward / Done anywhere on it", three.reply, false);
ck("3 · one button only (close)", three.buttons, 1);
ck("3 · it did NOT open a conversation", three.openId, "");
ck("3 · it is a real dialog for a screen reader", three.role, "dialog/true");
ck("3 · Escape closes it", three.closed, true);

/* ---------- 4 · keyboard ---------- */
const four = await page.evaluate(() => {
  const row = document.querySelector('[data-fs36="1"]');
  row.focus();
  const focused = document.activeElement === row;
  row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const opened = !!document.getElementById("fs36dlg");
  const txt = (document.getElementById("fs36dlg") || {}).textContent || "";
  document.querySelector("[data-fs36close]").click();
  return { focused, opened, right: txt.includes("Please book one 40HQ"), closedByButton: !document.getElementById("fs36dlg") };
});
ck("4 · the row takes keyboard focus", four.focused, true);
ck("4 · Enter opens it", four.opened, true);
ck("4 · the right mail is opened", four.right, true);
ck("4 · the ✕ closes it", four.closedByButton, true);

/* ---------- 5 · filters, search, redraw, Switch ID ---------- */
const five = await page.evaluate(async () => {
  const o = {};
  render(); o.once = document.querySelectorAll("[data-fs36group]").length;
  render(); render(); o.stillOnce = document.querySelectorAll("[data-fs36group]").length;
  filt = "unread"; render(); o.hiddenByChip = document.querySelectorAll("[data-fs36]").length;
  filt = "all"; render(); o.backAfterChip = document.querySelectorAll("[data-fs36]").length;
  document.getElementById("q").value = "40HQ"; render();
  o.search = [...document.querySelectorAll("[data-fs36]")].map(r => r.querySelector(".sub").textContent.trim());
  document.getElementById("q").value = ""; render();
  o.afterSearch = document.querySelectorAll("[data-fs36]").length;
  /* Switch ID: another person's session must not be served his answer */
  ME = "gul"; render(); await new Promise(r => setTimeout(r, 120));
  o.reloadedFor = window.rzMySent().loadedFor; o.calls = window.__fsCalls;
  ME = "ash"; render(); await new Promise(r => setTimeout(r, 120));
  return o;
});
ck("5 · one group, not two", five.once, 1);
ck("5 · three redraws still one group", five.stillOnce, 1);
ck("5 · a chip filter leaves it out", five.hiddenByChip, 0);
ck("5 · and it comes back", five.backAfterChip, 3);
ck("5 · the search box filters it", five.search, ["Booking request MUNDRA 40HQ"]);
ck("5 · clearing the search brings all three back", five.afterSearch, 3);
ck("5 · Switch ID asks the server again, as that person", { who: five.reloadedFor, calls: five.calls }, { who: "gul", calls: 2 });

/* ---------- 6 · the server saying no, and saying nothing ---------- */
const six = await page.evaluate(async () => {
  const o = {};
  window.fs36Api = async () => { throw new Error("No access to this mailbox") };
  FS36 = null; FS36err = ""; FS36at = 0; render(); await new Promise(r => setTimeout(r, 120));
  const more = document.querySelector("[data-fs36group]") ? document.querySelector("[data-fs36group]").nextElementSibling : null;
  o.saysWhy = more ? more.textContent.includes("Could not look in the mailboxes you cannot open") && more.textContent.includes("No access") : false;
  o.tryAgain = !!document.querySelector("[data-fs36ref]");
  o.noRows = document.querySelectorAll("[data-fs36]").length;
  window.fs36Api = async () => ({ mails: [] });
  FS36 = null; FS36err = ""; FS36at = 0; render(); await new Promise(r => setTimeout(r, 120));
  o.emptyIsQuiet = !document.querySelector("[data-fs36group]") && !document.querySelector("[data-fs36]");
  window.fs36Api = async () => { window.__fsCalls++; return { mails: window.__fsFixture } };
  FS36 = null; FS36at = 0; render(); await new Promise(r => setTimeout(r, 120));
  o.back = document.querySelectorAll("[data-fs36]").length;
  return o;
});
ck("6 · a refusal is said in words, never silently", six.saysWhy, true);
ck("6 · with a Try again", six.tryAgain, true);
ck("6 · and no rows are invented", six.noRows, 0);
ck("6 · nothing to show = nothing on screen", six.emptyIsQuiet, true);
ck("6 · it recovers", six.back, 3);

/* ---------- 7 · phone ---------- */
await page.setViewportSize({ width: 390, height: 780 });
const seven = await page.evaluate(async () => {
  render(); await new Promise(r => setTimeout(r, 80));
  const row = document.querySelector('[data-fs36="0"]');
  const r = row.getBoundingClientRect();
  row.click();
  const d = document.getElementById("fs36dlg"), card = d.firstElementChild.getBoundingClientRect();
  const btn = d.querySelector("[data-fs36close]").getBoundingClientRect();
  const o = { rows: document.querySelectorAll("[data-fs36]").length, rowFits: r.right <= 390.5, cardFits: card.width <= 390 && card.left >= 0,
    btn40: Math.round(btn.height) >= 40, wide: document.documentElement.scrollWidth };
  d.querySelector("[data-fs36close]").click();
  return o;
});
ck("7 · the rows are there on a phone", seven.rows, 3);
ck("7 · the row fits the screen", seven.rowFits, true);
ck("7 · the reader fits the screen", seven.cardFits, true);
ck("7 · the close button is 40px", seven.btn40, true);
ck("7 · the page is no wider than the phone (393 or less)", seven.wide <= 393, true);
await page.setViewportSize({ width: 1400, height: 900 });

/* ---------- 8 · dark mode ---------- */
const eight = await page.evaluate(async () => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 };
  const read = () => { const d = document.getElementById("fs36dlg"), card = d.firstElementChild;
    return { bg: lum(getComputedStyle(card).backgroundColor), fg: lum(getComputedStyle(card).color) } };
  document.documentElement.setAttribute("data-theme", "light"); render(); await new Promise(r => setTimeout(r, 60));
  document.querySelector('[data-fs36="0"]').click(); const light = read();
  document.querySelector("[data-fs36close]").click();
  document.documentElement.setAttribute("data-theme", "dark"); render(); await new Promise(r => setTimeout(r, 60));
  document.querySelector('[data-fs36="0"]').click(); const dark = read();
  document.querySelector("[data-fs36close]").click();
  document.documentElement.removeAttribute("data-theme");
  return { light, dark };
});
ck("8 · light mode: dark words on a light card", eight.light.bg > 0.7 && eight.light.fg < 0.3, true);
ck("8 · dark mode: light words on a dark card", eight.dark.bg < 0.3 && eight.dark.fg > 0.7, true);

/* ---------- 9 · it writes nothing ---------- */
const nine = await page.evaluate(() => {
  const t = S.threads[0];
  return { folder: t.folder, owner: t.owner, status: t.status, unread: t.unread, msgs: t.msgs.length, threads: S.threads.length };
});
ck("9 · the conversation on the list is byte-for-byte as it was", nine,
  { folder: "inbox", owner: "ash", status: "open", unread: true, msgs: 2, threads: 1 });

console.log("\npage errors: " + JSON.stringify(errs));
ck("no page errors", errs.length, 0);
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
