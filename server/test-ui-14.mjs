/* test-ui-14.mjs - 27 Nov 2026  (bug 14: classic-blue header / footer / left pane / reading pane)
 *
 * Real headless Edge on the BUILT app (mail-app.html), at laptop (1280px) and phone (390px)
 * width, in light mode and in dark mode. It checks what the brief asked for and, just as
 * important, that the CENTRE MAIL LIST was not touched and no rule moved:
 *   1  colours: header #0F6CBD + white text, left pane + footer #F5F5F5, selected folder
 *      #DCEBFA with a 3px #0F6CBD left bar, lines #E1E1E1, Reply #0F6CBD, New mail #FF5000
 *   2  header: every existing control still there, in the same order, each with a tooltip,
 *      equal icon size; "Send / Receive" that spins while syncing
 *   3  the search scope "All mailboxes / This folder" - and that "All mailboxes" (the
 *      default) returns exactly what the app returned before
 *   4  phone: text size + full screen inside one "..." menu, no sideways scroll
 *   5  reading pane: subject 18-20px, one toolbar, each mail in a white card
 *   6  footer: "Items - Unread" left, "* Connected - All folders are up to date - HH:MM" right
 *   7  the centre list is untouched (no ui14 rule can reach it, row styles unchanged)
 *   8  rule M1: the tab stays under 250 MB
 *
 * Run:  node server/test-ui-14.mjs
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
const ckT = (n, g) => ck(n, g, true);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);

/* ---------------------------------------------------------------- set-up -- */
const setup = await page.evaluate(() => {
  if (typeof u14scopeSync !== "function") return "the __ui14 block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { delete: 1 }, access: {} },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: { delete: 1, assign: 1, transfer: 1 }, access: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" },
    { id: "mkt", name: "Marketing", box: "marketing@", color: "#7a3fd1" });
  const T = (d, h) => Date.parse("2026-11-" + d + "T" + h + ":00:00+05:30");
  let k = 0;
  const mk = (o) => {
    const i = ++k;
    const base = {
      id: "x" + i, box: "teamalpha@rugscreation.com", dept: "ta", from: "A Buyer " + i, email: "b" + i + "@induskrafts.com",
      sub: "PO 174871 pillows " + i, pre: "Kindly confirm the packing list.", last: T("26", "1" + (i % 9)),
      owner: null, status: "open", folder: "inbox", unread: true, hist: [], cats: [], flag: 0, pinned: 0, full: true,
      msgs: [{ gid: "g" + i, from: "A Buyer " + i, email: "b" + i + "@induskrafts.com", at: T("26", "1" + (i % 9)), body: "Kindly confirm the packing list for the pillows.", subject: "PO 174871 pillows " + i, to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
    };
    return Object.assign(base, o);
  };
  const a1 = mk({ sub: "PO 174871 pillows one" });
  const a2 = mk({ sub: "PO 174871 pillows two", unread: false });
  const m1 = mk({ sub: "PO 174871 pillows in marketing", box: "marketing@rugscreation.com", dept: "mkt", email: "zz@induskrafts.com" });
  m1.msgs[0].to = "marketing@rugscreation.com";
  /* a two-mail conversation for the reading pane */
  const r1 = mk({ sub: "Geo chenille cushion" });
  r1.msgs[0].body = "Kindly confirm the packing list for the cushions.";
  r1.pre = "Kindly confirm the packing list for the cushions.";
  r1.msgs.push({ gid: "gz", from: "A Buyer 4", email: "b4@induskrafts.com", at: T("26", "17"), body: "And here is the second mail of the trail.", subject: "Geo chenille cushion", to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" });
  S.threads = [a1, a2, m1, r1];
  S.prefs = S.prefs || {}; S.prefs.folders = ["Claims"];
  S.settings = {}; S.lastSync = Date.parse("2026-11-27T09:41:00+05:30");
  app = "mail"; ME = "adm";
  view = { type: "box", dept: "ta", folder: "inbox" }; filt = "all"; openId = null;
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  window.__liveReady = true;
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }

  window.__draw = () => { openId = null; render(); };
  window.__open = (id) => { openId = id; render(); };
  window.__q = (v) => { const q = document.getElementById("q"); q.value = v; render(); };
  window.__ids = () => { try { return Array.from(new Set(listRows().map(t => t.id))).sort(); } catch (e) { return ["ERR " + e.message]; } };

  /* any CSS colour as rgba, including color-mix(), which Chrome hands back as color(srgb ...) */
  const CV = document.createElement("canvas"); CV.width = CV.height = 1;
  const CX = CV.getContext("2d", { willReadFrequently: true });
  window.__rgba = (css) => {
    try {
      CX.clearRect(0, 0, 1, 1); CX.fillStyle = "#000"; CX.fillStyle = css;
      if (CX.fillStyle === "#000000" && !/^#0{3,6}$|black|rgba?\(0, ?0, ?0/i.test(String(css))) return null;
      CX.clearRect(0, 0, 1, 1); CX.fillRect(0, 0, 1, 1);
      const d = CX.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    } catch (e) { return null; }
  };
  window.__hex = (sel, prop) => {
    const el = document.querySelector(sel); if (!el) return null;
    const p = window.__rgba(getComputedStyle(el)[prop]); if (!p) return null;
    return "#" + [0, 1, 2].map(i => p[i].toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  window.__bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const p = window.__rgba(getComputedStyle(n).backgroundColor);
      if (p && p[3] > 0.95) return [p[0], p[1], p[2]];
      n = n.parentElement;
    }
    const p = window.__rgba(getComputedStyle(document.documentElement).backgroundColor);
    return p && p[3] > 0.95 ? [p[0], p[1], p[2]] : [255, 255, 255];
  };
  window.__lum = (rgb) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
  window.__contrast = (sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const p = window.__rgba(getComputedStyle(el).color); if (!p) return null;
    const bg = window.__bgOf(el), a = p[3];
    const fg = [0, 1, 2].map(i => p[i] * a + bg[i] * (1 - a));
    const L1 = window.__lum(fg), L2 = window.__lum(bg), hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  window.__draw();
  return "ok";
});
ck("set-up: the __ui14 block is in the built app", setup, "ok");

/* ============================================================ 1 - colours = */
ck("header background is #0F6CBD", await page.evaluate(() => window.__hex("header.top", "backgroundColor")), "#0F6CBD");
ck("header text is white", await page.evaluate(() => window.__hex("header.top", "color")), "#FFFFFF");
ckT("header text contrast is 4.5:1 or better", await page.evaluate(() => (window.__contrast("header.top .logo span") || 0) >= 4.5));
ck("left folder pane is #F5F5F5", await page.evaluate(() => window.__hex("#folders", "backgroundColor")), "#F5F5F5");
ck("the app rail matches the folder pane", await page.evaluate(() => window.__hex(".rail", "backgroundColor")), "#F5F5F5");
ck("the footer is #F5F5F5", await page.evaluate(() => window.__hex(".stbar", "backgroundColor")), "#F5F5F5");
ck("folder pane divider line is #E1E1E1", await page.evaluate(() => window.__hex("#folders", "borderRightColor")), "#E1E1E1");
ck("the footer's top line is #E1E1E1", await page.evaluate(() => window.__hex(".stbar", "borderTopColor")), "#E1E1E1");
ck("New mail is #FF5000", await page.evaluate(() => window.__hex(".newmail", "backgroundColor")), "#FF5000");

const sel = await page.evaluate(() => {
  /* the Inbox row of your OWN mailbox is the plainest "selected folder" there is
     (for a shared mailbox the app lights up that mailbox's row instead) */
  view = { type: "box", dept: "mkt", folder: "inbox" }; render();
  const on = Array.from(document.querySelectorAll('#folders .fi[aria-current="true"]'))
    .find(x => (x.querySelector(".lbl") || x).textContent.trim() === "Inbox");
  const off = Array.from(document.querySelectorAll("#folders .fi")).find(x => x.getAttribute("aria-current") !== "true");
  const g = el => el ? { bg: window.__hex("#" + (el.id || "") || "x", "backgroundColor") } : null;
  const cs = el => getComputedStyle(el);
  return {
    label: on ? (on.querySelector(".lbl") || on).textContent.trim() : null,
    bg: on ? (() => { const p = window.__rgba(cs(on).backgroundColor); return "#" + [0, 1, 2].map(i => p[i].toString(16).padStart(2, "0")).join("").toUpperCase(); })() : null,
    bar: on ? cs(on).borderLeftWidth + " " + (() => { const p = window.__rgba(cs(on).borderLeftColor); return "#" + [0, 1, 2].map(i => p[i].toString(16).padStart(2, "0")).join("").toUpperCase(); })() : null,
    offBar: off ? cs(off).borderLeftWidth : null,
    offBarClear: off ? (window.__rgba(cs(off).borderLeftColor) || [0, 0, 0, 1])[3] : null,
    contrast: (() => { if (!on) return null; const lbl = on.querySelector(".lbl"); if (!lbl) return null; lbl.id = "u14t"; const c = window.__contrast("#u14t"); lbl.removeAttribute("id"); return c; })()
  };
});
await page.evaluate(() => { view = { type: "box", dept: "ta", folder: "inbox" }; window.__draw(); });
ck("the Inbox row is the selected folder", sel.label, "Inbox");
ck("the selected folder is #DCEBFA", sel.bg, "#DCEBFA");
ck("the selected folder has a 3px #0F6CBD left bar", sel.bar, "3px #0F6CBD");
ck("an unselected folder keeps the same 3px gap, see-through", [sel.offBar, sel.offBarClear], ["3px", 0]);
ckT("the selected folder's name is 4.5:1 or better", (sel.contrast || 0) >= 4.5);

/* ============================================= 2 - header controls and order = */
const hdr = await page.evaluate(() => {
  const ids = Array.from(document.querySelectorAll("header.top [id]")).map(x => x.id);
  const tip = id => { const x = document.getElementById(id); return x ? !!(x.title || "").trim() : "missing"; };
  const box = id => { const x = document.getElementById(id); if (!x) return null; const r = x.getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); };
  return {
    ids,
    order: ["hamb", "logoImg", "q", "mbx", "syncBtn", "zOut", "zReset", "zIn", "fsBtn", "bell", "meBtn"].every((id, i, a) => i === 0 || ids.indexOf(a[i - 1]) < ids.indexOf(id)),
    tips: ["hamb", "syncBtn", "zOut", "zReset", "zIn", "fsBtn", "bell", "meBtn", "qscope", "hdrMore"].map(tip),
    sizes: ["hamb", "fsBtn", "bell"].map(box),
    srText: (document.getElementById("syncBtn") || {}).textContent,
    srTip: (document.getElementById("syncBtn") || {}).title
  };
});
ckT("every control that was in the header is still there", ["hamb", "logoImg", "q", "mbx", "syncBtn", "zOut", "zReset", "zIn", "fsBtn", "bellN", "meAv", "meName"].every(id => hdr.ids.includes(id)));
ckT("they are in the same order as before", hdr.order);
ck("every header control has a tooltip", hdr.tips, [true, true, true, true, true, true, true, true, true, true]);
ck("the plain icon buttons are all the same size", hdr.sizes, ["36x36", "36x36", "36x36"]);
ck('Sync now reads "Send / Receive"', (hdr.srText || "").trim(), "Send / Receive");
ckT("...and says so in its tooltip", /Send \/ Receive/.test(hdr.srTip || ""));

const spin = await page.evaluate(() => {
  const b = document.getElementById("syncBtn"), svg = b.querySelector("svg");
  const idle = getComputedStyle(svg).animationName;
  b.classList.add("spin");
  const busy = getComputedStyle(svg).animationName;
  b.classList.remove("spin");
  return [idle, busy, getComputedStyle(svg).animationName];
});
ck("the Send / Receive icon spins only while syncing", spin, ["none", "spin", "none"]);

/* ======================================================= 3 - search scope = */
const sc0 = await page.evaluate(() => {
  const b = document.getElementById("qscope");
  return { inSearch: !!(b && b.closest("label.search")), text: b ? b.textContent.trim() : null, scope: U14SCOPE };
});
ckT("the scope button sits inside the search box", sc0.inSearch);
ck("it starts on All mailboxes - what the app has always done", [sc0.scope, sc0.text], ["all", "All mailboxes \u25be"]);

const sAll = await page.evaluate(() => { window.__q("pillows"); return window.__ids(); });
ck("All mailboxes: the search finds all three, Marketing included", sAll, ["x1", "x2", "x3"]);

await page.click("#qscope");
const menu = await page.evaluate(() => {
  const m = document.getElementById("u14menu");
  return m ? { items: Array.from(m.querySelectorAll("button")).map(b => b.textContent), checked: Array.from(m.querySelectorAll('button[aria-checked="true"]')).map(b => b.textContent) } : null;
});
ck("the menu offers both, with today's one ticked", menu, { items: ["This folder", "All mailboxes"], checked: ["All mailboxes"] });
await page.click('#u14menu button:has-text("This folder")');
await page.waitForTimeout(150);
const sFolder = await page.evaluate(() => ({ ids: window.__ids(), text: document.getElementById("qscope").textContent.trim(), gone: !document.getElementById("u14menu") }));
ck("This folder: only the mailbox and folder on screen", sFolder.ids, ["x1", "x2"]);
ck("...and the button says so", sFolder.text, "This folder \u25be");
ckT("the menu closes when something is chosen", sFolder.gone);
const back = await page.evaluate(() => { u14setScope("all"); return window.__ids(); });
ck("back on All mailboxes it finds all three again", back, ["x1", "x2", "x3"]);
const empty = await page.evaluate(() => {
  u14setScope("folder");
  window.__q("");
  const a = window.__ids();
  u14setScope("all");
  window.__q("");
  return [a, window.__ids()];
});
ck("with an empty search box the scope changes nothing", empty[0], empty[1]);
ck("the plain Inbox list is the three Team Alpha conversations", empty[1], ["x1", "x2", "x4"]);

/* ================================================= 5 - the reading pane = */
const rp = await page.evaluate(() => {
  window.__open("x4");
  const cs = s => { const el = document.querySelector(s); return el ? getComputedStyle(el) : null; };
  const h1 = cs("#read .rtop h1"), acts = cs("#read .acts:not(.xacts)"), card = cs("#read .rbody>article.mail");
  const hex = (v) => { const p = window.__rgba(v); return p ? "#" + [0, 1, 2].map(i => p[i].toString(16).padStart(2, "0")).join("").toUpperCase() : null; };
  const kids = Array.from(document.querySelectorAll("#read > *")).map(x => x.className.split(" ")[0]);
  return {
    subject: h1 ? parseFloat(h1.fontSize) : null,
    toolbars: document.querySelectorAll("#read .acts:not(.xacts)").length,
    toolbarLine: acts ? hex(acts.borderTopColor) : null,
    reply: hex(getComputedStyle(document.querySelector("#read .acts .btn.pri")).backgroundColor),
    replyText: document.querySelector("#read .acts .btn.pri").textContent.trim(),
    replyContrast: window.__contrast("#read .acts .btn.pri"),
    cards: document.querySelectorAll("#read .rbody>article.mail").length,
    cardBg: card ? hex(card.backgroundColor) : null,
    cardLine: card ? card.borderTopWidth + " " + hex(card.borderTopColor) : null,
    cardRound: card ? parseFloat(card.borderTopLeftRadius) > 0 : null,
    ground: hex(cs("#read .rbody").backgroundColor),
    order: kids
  };
});
ckT("the subject is 18-20px", rp.subject >= 18 && rp.subject <= 20);
ck("there is one toolbar in the reading pane", rp.toolbars, 1);
ck("its line is #E1E1E1", rp.toolbarLine, "#E1E1E1");
ck("Reply is #0F6CBD", rp.reply, "#0F6CBD");
ckT("Reply is still the Reply button", /Reply/.test(rp.replyText));
ckT("white on that blue is 4.5:1 or better", (rp.replyContrast || 0) >= 4.5);
ck("both mails of the conversation are drawn", rp.cards, 2);
ck("each mail sits in a white card", rp.cardBg, "#FFFFFF");
ck("the card's line is #E1E1E1", rp.cardLine, "1px #E1E1E1");
ckT("the card has rounded corners", rp.cardRound);
ckT("the cards sit on a ground, not on white", rp.ground !== "#FFFFFF");
ckT("the subject comes before anything else in the reading pane", rp.order[0] === "rtop");

/* ===================================================== 6 - the footer = */
const ft = await page.evaluate(() => {
  window.__draw();
  try { DLS.busy = false; DLS.doneAt = 0; S.loadingMail = false; syncing = false; polling = false; } catch (e) { }
  try { stbarPaint(); } catch (e) { }
  const el = document.getElementById("statusbar");
  const L = el.querySelector("#stL"), T = el.querySelector("#stT"), D = el.querySelector("#stD");
  const hex = (v) => { const p = window.__rgba(v); return p ? "#" + [0, 1, 2].map(i => p[i].toString(16).padStart(2, "0")).join("").toUpperCase() : null; };
  return {
    hidden: el.hidden,
    left: L.textContent,
    right: T.textContent,
    dotBeforeText: D.getBoundingClientRect().left < T.getBoundingClientRect().left,
    dotLeftOfNothing: D.getBoundingClientRect().left > L.getBoundingClientRect().right,
    dotGreen: hex(getComputedStyle(D).backgroundColor),
    contrast: window.__contrast(".stbar #stT")
  };
});
ckT("the footer is shown", !ft.hidden);
ckT('the left says "Items" and "Unread"', /^Items: \d/.test(ft.left) && /Unread/.test(ft.left));
ck("the right reads Connected - All folders are up to date - HH:MM", ft.right, "Connected \u00b7 All folders are up to date \u00b7 9:41 am");
ckT("the green dot is in front of that line", ft.dotBeforeText && ft.dotLeftOfNothing);
ck("the dot is green", ft.dotGreen, "#22C55E");
ckT("the footer text is 4.5:1 or better", (ft.contrast || 0) >= 4.5);

const off = await page.evaluate(() => {
  const real = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
  Object.defineProperty(Navigator.prototype, "onLine", { get: () => false, configurable: true });
  try { stbarPaint(); } catch (e) { }
  const t = document.getElementById("stT").textContent;
  if (real) Object.defineProperty(Navigator.prototype, "onLine", real);
  try { stbarPaint(); } catch (e) { }
  return [t, document.getElementById("stT").textContent];
});
ckT("with no internet it says so instead", /^Not connected \u00b7 /.test(off[0]));
ckT("...and goes back to Connected when it returns", /^Connected \u00b7 /.test(off[1]));

/* ======================================= 7 - the centre list is untouched = */
const list = await page.evaluate(() => {
  const css = document.getElementById("ui14css").textContent;
  /* every selector this build added, and whether any of them can reach the centre list */
  const sels = css.split("}").map(b => b.split("{")[0]).join(",").split(",").map(x => x.trim()).filter(Boolean);
  const listish = sels.filter(x => /(^|[\s>])\.(m|msgs|list|lhead|day|chip|lchip|seg|qa|tag|t-[a-z]+)(?![\w-])/.test(x));
  const row = document.querySelector(".msgs .m");
  const cs = row ? getComputedStyle(row) : null;
  const hex = (v) => { const p = window.__rgba(v); return p ? "#" + [0, 1, 2].map(i => p[i].toString(16).padStart(2, "0")).join("").toUpperCase() : null; };
  return {
    listish,
    listBg: hex(getComputedStyle(document.querySelector(".list")).backgroundColor),
    rowLine: cs ? hex(cs.borderBottomColor) : null,
    rowWho: cs ? getComputedStyle(row.querySelector(".who")).fontSize : null,
    rows: document.querySelectorAll(".msgs .m").length
  };
});
ck("no rule in this build can reach the centre list", list.listish, []);
ck("the list is still white", list.listBg, "#FFFFFF");
ck("a row's line is still the app's own #EBE6E1", list.rowLine, "#EBE6E1");
ck("a row's sender is still 14px", list.rowWho, "14px");
ck("the Inbox rows are drawn - one per mail (rule R17)", list.rows, 4);

/* ====================================================== 8 - rule M1 = */
const mem = await page.evaluate(() => { try { const r = rzMemCap(); return { cap: r.capMB, now: r.nowMB }; } catch (e) { return { err: String(e.message || e) }; } });
ck("rule M1 still says the ceiling is 250 MB", mem.cap, 250);
ckT("the tab is under it (" + mem.now + " MB)", typeof mem.now === "number" && mem.now < 250);

/* ========================================================= 4 - phone = */
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__draw());
const ph = await page.evaluate(() => {
  const vis = id => { const x = document.getElementById(id); if (!x) return "missing"; const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return { zoom: vis("zOut"), fs: vis("fsBtn"), more: vis("hdrMore"), scope: vis("qscope"), sync: vis("syncBtn") };
});
ck("on a phone text size and full screen leave the bar", [ph.zoom, ph.fs], [false, false]);
ckT("...and the ... button takes their place", ph.more);
ckT("the search scope and Send / Receive are still reachable", ph.scope === true && ph.sync === true);

await page.click("#hdrMore");
const pm = await page.evaluate(() => {
  const m = document.getElementById("u14menu");
  if (!m) return null;
  const r = m.getBoundingClientRect();
  return {
    items: Array.from(m.querySelectorAll("button")).map(b => b.textContent.replace(/\s+/g, " ").trim()),
    heads: Array.from(m.querySelectorAll("h6")).map(b => b.textContent),
    tall: Array.from(m.querySelectorAll("button")).every(b => b.getBoundingClientRect().height >= 40),
    onScreen: r.left >= 0 && r.right <= innerWidth + 1
  };
});
ck("the menu holds text size and full screen", pm.items, ["A\u2212 Smaller", "100% Reset size", "A+ Bigger", "\u2922 Full screen"]);
ck("...under their own headings", pm.heads, ["Text size", "View"]);
ckT("every item is at least 40px tall", pm.tall);
ckT("the menu stays on the screen", pm.onScreen);

const zoomed = await page.evaluate(async () => {
  const before = S.ui.zoom || 1;
  document.querySelectorAll("#u14menu button")[2].click();   /* A+ Bigger */
  await new Promise(r => setTimeout(r, 120));
  const after = S.ui.zoom || 1;
  setZoom(1);
  return [before, after, document.documentElement.style.zoom];
});
ckT("A+ really makes the text bigger", zoomed[1] > zoomed[0]);
ck("...and it can be put back", String(zoomed[2]), "1");

const fsq = await page.evaluate(async () => {
  document.getElementById("hdrMore").click();
  await new Promise(r => setTimeout(r, 60));
  const items = document.querySelectorAll("#u14menu button");
  items[items.length - 1].click();                            /* Full screen */
  await new Promise(r => setTimeout(r, 200));
  const max = document.body.classList.contains("maxread");
  if (max) { document.body.classList.remove("maxread"); render(); }
  return max || !!document.fullscreenElement;
});
ckT("Full screen in the menu does what the old button did", fsq);

const wide = await page.evaluate(() => { window.__draw(); return [document.documentElement.scrollWidth, innerWidth]; });
ckT("the phone page does not scroll sideways (" + wide[0] + " vs " + wide[1] + ")", wide[0] <= wide[1] + 1);

/* ====================================================== dark mode = */
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "dark"); window.__draw(); try { stbarPaint(); } catch (e) { } });
await page.waitForTimeout(250);
const dk = await page.evaluate(() => {
  const hex = (sel, prop) => window.__hex(sel, prop);
  return {
    hdr: hex("header.top", "backgroundColor"),
    side: hex("#folders", "backgroundColor"),
    foot: hex(".stbar", "backgroundColor"),
    card: hex("#read .rbody>article.mail", "backgroundColor"),
    sel: hex('#folders .fi[aria-current="true"]', "backgroundColor"),
    cHdr: window.__contrast("header.top .logo span"),
    cFoot: window.__contrast(".stbar #stT"),
    cSel: window.__contrast('#folders .fi[aria-current="true"] .lbl')
  };
});
ckT("dark mode: the header is its own dark blue, not the light one", dk.hdr !== "#0F6CBD" && dk.hdr !== null);
ckT("dark mode: the left pane and footer are dark", dk.side !== "#F5F5F5" && dk.foot !== "#F5F5F5");
ckT("dark mode: the selected folder is a dark blue", dk.sel !== "#DCEBFA" && dk.sel !== null);
ckT("dark mode: header text is 4.5:1 or better", (dk.cHdr || 0) >= 4.5);
ckT("dark mode: footer text is 4.5:1 or better", (dk.cFoot || 0) >= 4.5);
ckT("dark mode: the selected folder's name is 4.5:1 or better", (dk.cSel || 0) >= 4.5);
await page.evaluate(() => { document.documentElement.removeAttribute("data-theme"); });

/* ====================================================== page errors = */
const real = errs.filter(e => !/ERR_UNKNOWN_URL_SCHEME|sandboxed|allow-scripts/i.test(e));
ck("no page errors", real, []);

console.log("\n" + pass + " passed, " + fail + " failed");
await browser.close();
process.exit(fail ? 1 : 0);
