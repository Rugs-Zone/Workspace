/* test-design-13.mjs - 27 Nov 2026  (bug 13: design / UI / UX / theme pass)
 *
 * Real headless Edge on the BUILT app (mail-app.html), at laptop (1280px) and phone
 * (390px) width, in light mode and in dark mode. It checks the six things asked for:
 *   1  no [cid:...] and no <https://linkprotect...> in a PREVIEW, while the real mail keeps them
 *   2  the "You are using X's ID" bar reserves its own space and covers nothing
 *   3  one font family for list / reading pane / app chrome; list 13-14px, mail body 14-15px,
 *      nothing with words in it below 12px; buyer mail never overflows sideways
 *   4  every bit of text at 4.5:1 or better in BOTH themes, unread rows clearly bold
 *   5  phone: every button at least 40px tall, nothing scrolls sideways
 *   6  an empty list says something useful
 *
 * Run:  node server/test-design-13.mjs
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
await page.waitForTimeout(1200);

/* ---------------------------------------------------------------- set-up -- */
const CID = "[cid:image001.png@01DC5E7A.11AA22BB]";
const LP = "<https://linkprotect.cudasvc.com/url?a=https%3a%2f%2frugscreation.com&c=E,1,abc>";

const setup = await page.evaluate(({ CID, LP }) => {
  if (typeof pvClean !== "function") return "the __design13 block is not in the app";
  if (typeof emptyBox !== "function") return "emptyBox is not in the app";
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
  const mk = (o) => {
    const i = ++k;
    const base = {
      id: "x" + i, box: "teamalpha@rugscreation.com", dept: "ta", from: "A Buyer " + i, email: "b" + i + "@induskrafts.com",
      sub: "PO 174871 pillows " + i, pre: "Kindly confirm the packing list.", last: T("26", "10"),
      owner: null, status: "open", folder: "inbox", unread: true, hist: [], cats: [], flag: 0, pinned: 0, full: true,
      msgs: [{ gid: "g" + i, from: "A Buyer " + i, email: "b" + i + "@induskrafts.com", at: T("26", "10"), body: "Kindly confirm the packing list.", subject: "PO 174871 pillows " + i, to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
    };
    return Object.assign(base, o);
  };
  /* the one that carries the plumbing, in BOTH the row snippet and the mail body */
  const dirty = "Dear sir " + CID + " please see " + LP + " for the revised file.";
  const t1 = mk({ sub: "Revised file", pre: dirty });
  t1.msgs[0].body = dirty;
  S.threads = [t1, mk({ sub: "Second mail" }), mk({ sub: "Third mail", unread: false, owner: "imran" })];
  S.prefs = S.prefs || {}; S.prefs.folders = ["Claims"];
  S.settings = {}; app = "mail"; ME = "imran";
  view = { type: "box", dept: "ta", folder: "inbox" }; filt = "all"; openId = null;
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }

  window.__dirtyId = t1.id;
  window.__draw = () => { openId = null; render(); };
  window.__open = (id) => { openId = id; render(); };

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
  /* the colour a piece of text really sits on: walk up until something paints */
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
  window.__lum = (rgb) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  /* text colour over its real background, alpha composited the way the browser does */
  window.__contrast = (sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const p = window.__rgba(getComputedStyle(el).color); if (!p) return null;
    const a = p[3];
    const bg = window.__bgOf(el);
    const fg = [0, 1, 2].map(i => p[i] * a + bg[i] * (1 - a));
    const L1 = window.__lum(fg), L2 = window.__lum(bg);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  window.__px = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
  window.__fam = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "") : null; };
  /* every element that actually carries words, and how small its type is */
  window.__tooSmall = () => {
    const out = [];
    document.querySelectorAll("#folders *,.list *,.read *,.stbar *,#swBar *,.rail *,.mobnav *").forEach(el => {
      if (el.children.length) return;
      if (el.closest(".av,.ddot,.cfb,.src")) return;                  /* initials and dots are graphics, not words */
      const txt = (el.textContent || "").trim();
      if (txt.length < 2 || !/[A-Za-z]{2}/.test(txt)) return;        /* a single digit badge is not a sentence */
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) out.push((el.className || el.tagName) + " " + fs + "px :: " + txt.slice(0, 24));
    });
    return out;
  };
  window.__smallButtons = () => {
    const out = [];
    document.querySelectorAll("button,.btn,.chip,.fi").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;                        /* not on screen */
      if (el.closest("#login,#layer")) return;
      if (el.classList.contains("tick") || el.classList.contains("msel")) return;   /* a tick box is a tick box */
      if (r.height < 40) out.push((el.className || el.tagName) + " " + Math.round(r.height) + "px :: " + (el.textContent || "").trim().slice(0, 18));
    });
    return out;
  };
  window.__sideways = () => {
    const out = [];
    ["body", ".list", ".msgs", ".read", ".rbody"].forEach(sel => {
      const el = document.querySelector(sel); if (!el) return;
      if (el.scrollWidth - el.clientWidth > 1) out.push(sel + " " + el.scrollWidth + ">" + el.clientWidth + " [" + window.__wide().join(" / ") + "]");
    });
    return out;
  };
  /* what is actually sticking out past the right edge */
  window.__wide = () => {
    const out = [];
    document.querySelectorAll("body *").forEach(el => {
      const q = el.getBoundingClientRect();
      if (q.width && q.right > window.innerWidth + 0.5 && !el.closest("#login")) out.push((el.className || el.tagName) + "@" + Math.round(q.right));
    });
    return out.slice(0, 6);
  };
  return "ok";
}, { CID, LP });
ck("the app and the test mail are set up", setup, "ok");

/* ============================================================ 1 · preview = */
console.log("\n=== 1 · [cid:...] and <https://linkprotect...> are out of the PREVIEW only ===");
await page.evaluate(() => window.__draw());
await page.waitForTimeout(250);

const prev = await page.evaluate(() => {
  const row = [].slice.call(document.querySelectorAll(".msgs .m")).find(el => /Revised file/.test(el.textContent));
  return {
    pre: row ? (row.querySelector(".pre") || {}).textContent || "" : null,
    body: (S.threads.find(t => t.id === window.__dirtyId).msgs[0].body) || "",
    snippet: S.threads.find(t => t.id === window.__dirtyId).pre
  };
});
ckT("1 · the row preview has no [cid:...]", !/\[?cid:/i.test(prev.pre));
ckT("1 · the row preview has no <https://linkprotect...>", !/linkprotect|^</i.test(prev.pre) && !/</.test(prev.pre));
ck("1 · it still reads as a sentence", prev.pre.replace(/\s+/g, " ").trim(), "Dear sir please see for the revised file.");
ckT("1 · THE REAL MAIL still has the cid marker (nothing was taken out of the mail)", /\[cid:image001\.png/.test(prev.body));
ckT("1 · the real mail still has the linkprotect link", /linkprotect\.cudasvc\.com/.test(prev.body));
ckT("1 · the stored snippet on the conversation is untouched too", /\[cid:/.test(prev.snippet));

const snip = await page.evaluate(() => {
  window.__open(window.__dirtyId);
  const s = document.querySelector(".read .mail .msnip, .read .mail.collapsed .msnip");
  const all = [].slice.call(document.querySelectorAll(".read .msnip")).map(e => e.textContent);
  return { one: s ? s.textContent : null, all };
});
ckT("1 · the folded-mail one-liner has no plumbing either", snip.all.every(x => !/\[?cid:|linkprotect/i.test(x)));

/* a few shapes that must not be mangled */
const pv = await page.evaluate(() => [
  pvClean("Price is < 10 USD and > 5"),
  pvClean("see [cid:x] now"),
  pvClean("a&nbsp;b"),
  pvClean(null),
  pvClean("tail [cid:unclosed"),
  pvClean("<https://x.com/a> ok"),
  pvClean("plain words only")
]);
ck("1 · a real less-than in a sentence survives", pv[0], "Price is < 10 USD and > 5");
ck("1 · a cid marker goes, the words stay", pv[1], "see now");
ck("1 · &nbsp; becomes a space", pv[2], "a b");
ck("1 · nothing at all is safe", pv[3], "");
ck("1 · an unclosed cid marker goes too", pv[4], "tail");
ck("1 · an angle-bracketed link goes", pv[5], "ok");
ck("1 · ordinary words are untouched", pv[6], "plain words only");

/* ============================================================ 2 · swBar === */
console.log("\n=== 2 · the \"You are using X's ID\" bar reserves its own space ===");
const sw = await page.evaluate(() => {
  try {
    localStorage.setItem("rugs-admin-token", "aaa");
    localStorage.setItem("rugs-switch-token", "bbb");
    localStorage.setItem("rugs-admin-name", "Priyanshu Tomar");
  } catch (e) { }
  TOKEN = "bbb"; window.__liveReady = true;
  openId = null; render();
  const el = document.getElementById("swBar");
  if (!el) return { there: false };
  const st = document.getElementById("statusbar");
  const r = el.getBoundingClientRect();
  const msgs = document.querySelector(".msgs").getBoundingClientRect();
  const sr = st ? st.getBoundingClientRect() : null;
  return {
    there: true, pos: getComputedStyle(el).position,
    parentIsBody: el.parentElement === document.body,
    beforeStatus: !!(st && el.nextElementSibling === st),
    h: Math.round(r.height),
    overlapsList: r.top < msgs.bottom - 1,
    overlapsStatus: !!(sr && r.bottom > sr.top + 1),
    text: el.textContent.replace(/\s+/g, " ").trim(),
    btn: Math.round((el.querySelector(".btn") || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height)
  };
});
ckT("2 · the bar is drawn", sw.there);
ck("2 · it is in the page, not floating over it", sw.pos, "static");
ckT("2 · it is a direct row of the app", sw.parentIsBody);
ckT("2 · it sits straight above the Items/Unread bar", sw.beforeStatus);
ckT("2 · it is slim (30-44px on a laptop)", sw.h >= 28 && sw.h <= 44);
ckT("2 · it covers no part of the mail list", !sw.overlapsList);
ckT("2 · it covers no part of the Items/Unread bar", !sw.overlapsStatus);
ckT("2 · it still says whose ID this is and how to get back", /using Priyanshu|using /.test(sw.text) && /Back to my ID/.test(sw.text));
ckT("2 · its text is readable on it (4.5:1 or better)", await page.evaluate(() => window.__contrast("#swBar>span")) >= 4.5);
ckT("2 · its button is readable too", await page.evaluate(() => window.__contrast("#swBar .btn")) >= 4.5);

/* ============================================================ 3 · type ==== */
console.log("\n=== 3 · one font family, and sane sizes ===");
const fam = await page.evaluate(() => ({
  body: window.__fam("body"), who: window.__fam(".msgs .m .who"), sub: window.__fam(".msgs .m .sub"),
  pre: window.__fam(".msgs .m .pre"), h2: window.__fam(".lhead h2"), fi: window.__fam("#folders .fi"),
  btn: window.__fam(".read .btn"), day: window.__fam(".msgs .day"), st: window.__fam(".stbar")
}));
const one = Object.values(fam).filter(Boolean);
ck("3 · list, folder pane, reading pane and status bar are all one family", [...new Set(one)], [fam.body]);
ck("3 · and it is the app's own face", fam.body, "Plus Jakarta Sans");

const sz = await page.evaluate(() => ({
  who: parseFloat(window.__px(".msgs .m .who", "fontSize")),
  sub: parseFloat(window.__px(".msgs .m .sub", "fontSize")),
  pre: parseFloat(window.__px(".msgs .m .pre", "fontSize")),
  time: parseFloat(window.__px(".msgs .m .time", "fontSize")),
  tag: parseFloat(window.__px(".msgs .m .tag", "fontSize")),
  day: parseFloat(window.__px(".msgs .day", "fontSize"))
}));
console.log("     list sizes: " + JSON.stringify(sz));
ckT("3 · the list is 13-14px", sz.who >= 13 && sz.who <= 14 && sz.sub >= 13 && sz.sub <= 14);
ckT("3 · its preview and time are 12px or more", sz.pre >= 12 && sz.time >= 12);
ckT("3 · the day heading is 12px or more", sz.day >= 12);
ckT("3 · a tag is 12px or more", !sz.tag || sz.tag >= 12);

const mb = await page.evaluate(() => {
  /* a plain-text mail of ours ( .mail p ) and an HTML one ( .rich ) */
  const t2 = S.threads[1], t3 = S.threads[2];
  t2.msgs[0].by = "imran"; t2.msgs[0].html = ""; delete t2.msgs[0].raw;
  t3.msgs[0].by = "imran"; t3.msgs[0].html = "<p>Please find the packing list attached.</p>"; delete t3.msgs[0].raw;
  window.__open(t2.id);
  const p = document.querySelector(".read .mail .mbody p");
  const hd = document.querySelector(".read .mail header .w b");
  const plain = p ? parseFloat(getComputedStyle(p).fontSize) : null;
  const head = hd ? parseFloat(getComputedStyle(hd).fontSize) : null;
  window.__open(t3.id);
  const r = document.querySelector(".read .mail .mbody .rich");
  return { plain, head, rich: r ? parseFloat(getComputedStyle(r).fontSize) : null };
});
console.log("     mail body: plain " + mb.plain + "px, HTML " + mb.rich + "px, sender line " + mb.head + "px");
ckT("3 · a plain mail body is 14-15px", mb.plain >= 14 && mb.plain <= 15);
ckT("3 · an HTML mail body is 14-15px", mb.rich >= 14 && mb.rich <= 15);
ckT("3 · the sender line is 12px or more", mb.head >= 12);

const small = await page.evaluate(() => window.__tooSmall());
if (small.length) console.log("     under 12px: " + small.join(" | "));
ck("3 · nothing with words in it is under 12px", small, []);

const ovf = await page.evaluate(() => {
  /* a buyer's own HTML with a 4000px picture and an unbreakable URL */
  const t = S.threads.find(x => x.id === window.__dirtyId);
  t.msgs[0].html = '<div class="x">' +
    '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAAAAAAALAAAAAABAAEAAAIBRAA7" style="width:4000px">' +
    '<p>https://example.com/' + "a".repeat(400) + '</p></div>';
  delete t.msgs[0].raw; t.msgs[0].by = "imran";
  window.__open(t.id);
  const r = document.querySelector(".read .rbody");
  const img = document.querySelector(".read .mbody img");
  return { side: r.scrollWidth - r.clientWidth, imgW: img ? Math.round(img.getBoundingClientRect().width) : null, paneW: Math.round(r.clientWidth) };
});
ckT("3 · a buyer's 4000px picture is held inside the pane", ovf.imgW !== null && ovf.imgW <= ovf.paneW);
ckT("3 · and the reading pane does not scroll sideways", ovf.side <= 1);

/* ============================================================ 4 · themes == */
console.log("\n=== 4 · light mode: every piece of text at 4.5:1 or better ===");
await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "light"); window.__draw(); });
await page.waitForTimeout(2300);                                        /* the style block puts itself again at 2s */
const SEL = [[".msgs .m .who", "a sender name"], [".msgs .m .sub", "a subject"], [".msgs .m .pre", "a preview"],
  [".msgs .m .time", "a time"], [".msgs .day", "a day heading"], ["#folders .fi .lbl", "a folder name"],
  [".lhead h2", "the list heading"], [".stbar", "the Items bar"], [".chip", "a filter chip"],
  [".msgs .m.unread .who", "an unread sender name"]];
for (const [s, n] of SEL) {
  const c = await page.evaluate(x => window.__contrast(x), s);
  if (c === null) { console.log("     (skipped, not on screen: " + n + ")"); continue; }
  ckT("4 light · " + n + " = " + c + ":1", c >= 4.5);
}
const tagLight = await page.evaluate(() => {
  const out = {};
  document.body.insertAdjacentHTML("beforeend", '<div id="tgx" style="background:var(--pane);padding:4px"><span class="tag t-new">New</span><span class="tag t-prom">Promise</span><span class="tag t-late">Late</span><span class="tag t-done">Done</span><span class="tag t-xfer">Moved</span><span class="tag t-asg">Imran</span></div>');
  ["t-new", "t-prom", "t-late", "t-done", "t-xfer", "t-asg"].forEach(c => { out[c] = window.__contrast("#tgx ." + c); });
  return out;
});
Object.keys(tagLight).forEach(k => ckT("4 light · tag ." + k + " = " + tagLight[k] + ":1", tagLight[k] >= 4.5));

const unread = await page.evaluate(() => {
  const u = document.querySelector(".msgs .m.unread"), r = document.querySelector(".msgs .m:not(.unread)");
  return {
    uw: u ? getComputedStyle(u.querySelector(".who")).fontWeight : null,
    rw: r ? getComputedStyle(r.querySelector(".who")).fontWeight : null,
    bar: u ? getComputedStyle(u).borderLeftWidth : null
  };
});
ck("4 · an unread row is weight 800, a read one is not", [unread.uw, unread.rw], ["800", "600"]);
ck("4 · and it carries the 4px bar", unread.bar, "4px");

console.log("\n=== 4 · dark mode: the same text, the same rule ===");
await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "dark"); window.__draw(); });
await page.waitForTimeout(400);
for (const [s, n] of SEL) {
  const c = await page.evaluate(x => window.__contrast(x), s);
  if (c === null) { console.log("     (skipped, not on screen: " + n + ")"); continue; }
  ckT("4 dark · " + n + " = " + c + ":1", c >= 4.5);
}
const tagDark = await page.evaluate(() => {
  const out = {}; ["t-new", "t-prom", "t-late", "t-done", "t-xfer", "t-asg"].forEach(c => { out[c] = window.__contrast("#tgx ." + c); });
  return out;
});
Object.keys(tagDark).forEach(k => ckT("4 dark · tag ." + k + " = " + tagDark[k] + ":1", tagDark[k] >= 4.5));
const dfg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--fg").trim());
ck("4 · dark mode really is the dark palette (not the light near-black)", dfg, "#f2eeeb");
await page.evaluate(() => { const x = document.getElementById("tgx"); if (x) x.remove(); document.documentElement.setAttribute("data-theme", "light"); window.__draw(); });

/* ============================================================ 6 · empty === */
console.log("\n=== 6 · an empty list says something useful ===");
const empties = await page.evaluate(() => {
  const keep = S.threads; S.threads = [];
  const say = (fn) => { fn(); render(); const e = document.querySelector(".msgs .empty"); return e ? e.textContent.replace(/\s+/g, " ").trim() : null; };
  const out = {
    needs: say(() => { view = { type: "fav", id: "needs" }; filt = "all"; document.getElementById("q").value = ""; }),
    inbox: say(() => { view = { type: "box", dept: "ta", folder: "inbox" }; }),
    sent: say(() => { view = { type: "box", dept: "ta", folder: "sent" }; }),
    deleted: say(() => { view = { type: "box", dept: "ta", folder: "deleted" }; }),
    mine: say(() => { view = { type: "fav", id: "mine" }; }),
    late: say(() => { view = { type: "fav", id: "late" }; }),
    folder: say(() => { view = { type: "folder", folder: "Claims" }; }),
    unread: say(() => { view = { type: "box", dept: "ta", folder: "inbox" }; filt = "unread"; }),
    search: say(() => { filt = "all"; document.getElementById("q").value = "zzzqqq"; })
  };
  document.getElementById("q").value = "";
  S.threads = keep; view = { type: "box", dept: "ta", folder: "inbox" }; filt = "all"; render();
  return out;
});
console.log("     " + Object.keys(empties).map(k => k + ": " + empties[k]).join("\n     "));
ck("6 · Needs owner", empties.needs, "No mail needs an ownerEvery conversation in your team has somebody working on it.");
ckT("6 · the Inbox says it is clear, not \"All clear / No mail here\"", /Inbox is clear/.test(empties.inbox));
ckT("6 · Sent explains what would be here", /Nothing sent from here yet/.test(empties.sent));
ckT("6 · Deleted explains what would be here", /Deleted is empty/.test(empties.deleted));
ckT("6 · My work", /Nothing on your plate/.test(empties.mine));
ckT("6 · Late promises", /Nothing is late/.test(empties.late));
ckT("6 · a personal folder names itself and says how to fill it", /Claims/.test(empties.folder) && /My rules/.test(empties.folder));
ckT("6 · the Unread chip", /Nothing unread/.test(empties.unread));
ckT("6 · a search that finds nothing says so, with the words searched", /Nothing matches/.test(empties.search) && /zzzqqq/.test(empties.search));

/* ============================================================ 5 · phone === */
console.log("\n=== 5 · phone (390px): 40px to press, nothing sideways ===");
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.__draw());
await page.waitForTimeout(500);
const ph = await page.evaluate(() => ({ small: window.__smallButtons(), side: window.__sideways() }));
if (ph.small.length) console.log("     under 40px: " + ph.small.join(" | "));
ck("5 · every button on the list screen is at least 40px tall", ph.small, []);
ck("5 · nothing scrolls sideways on the list screen", ph.side, []);

const phSw = await page.evaluate(() => {
  /* the 15-second poll cannot reach a server from a file:// page, so the session may have
     ended itself (which correctly puts a switched admin back) - put it back for this check */
  try { localStorage.setItem("rugs-admin-token", "aaa"); localStorage.setItem("rugs-switch-token", "bbb"); localStorage.setItem("rugs-admin-name", "Priyanshu Tomar"); } catch (e) { }
  TOKEN = "bbb"; window.__liveReady = true; render();
  const el = document.getElementById("swBar"), st = document.getElementById("statusbar");
  if (!el) return { missing: true };
  const r = el.getBoundingClientRect(), msgs = document.querySelector(".msgs").getBoundingClientRect();
  const b = el.querySelector(".btn").getBoundingClientRect();
  return { h: Math.round(r.height), btn: Math.round(b.height), overlapsList: r.top < msgs.bottom - 1, within: r.right <= window.innerWidth + 1 };
});
ckT("5 · the switched-ID bar still covers no mail on a phone", !phSw.overlapsList);
ckT("5 · its Back button is 40px tall on a phone", phSw.btn >= 40);
ckT("5 · and it stays inside the screen", phSw.within);

const phRead = await page.evaluate(() => {
  window.__open(window.__dirtyId);
  return { small: window.__smallButtons(), side: window.__sideways() };
});
await page.waitForTimeout(300);
const phRead2 = await page.evaluate(() => ({ small: window.__smallButtons(), side: window.__sideways() }));
if (phRead2.small.length) console.log("     reading pane under 40px: " + phRead2.small.join(" | "));
ck("5 · every button in the reading pane is at least 40px tall", phRead2.small, []);
ck("5 · the reading pane does not scroll sideways on a phone", phRead2.side, []);

await page.setViewportSize({ width: 1280, height: 900 });

/* ---------------------------------------------------------------- errors -- */
const real = errs.filter(e => !/sandbox|allow-scripts|ERR_UNKNOWN_URL_SCHEME/i.test(e));
if (real.length) console.log("\n  page errors: " + real.join(" | "));
ck("no page errors", real, []);

console.log("\n" + pass + " passed, " + fail + " failed");
await browser.close();
process.exit(fail ? 1 : 0);
