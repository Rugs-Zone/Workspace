/* test-private-pics.mjs - 28 Nov 2026
 *
 * The reported console error, reproduced and then proved gone, in real headless Edge on the
 * built mail-app.html. The mail carries the exact picture address from the report (a Gmail
 * signature logo on work.fife.usercontent.google.com/rd-mail-sig/...), plus pictures that MUST
 * keep working: an ordinary one on the internet, a Google Drive one, and one that came attached
 * to the mail (cid:). Every request the page makes is recorded, so "nothing is asked for" is
 * measured, not assumed.
 *
 * Run:  node server/test-private-pics.mjs
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

const SIG = "https://work.fife.usercontent.google.com/rd-mail-sig/AIorK4yuqX_sdZdV7GMllqeEauCgTMDwRAzRX6VU8_GWkP-k0VIOC6lqpSCyVnTIXTUWJmhYU_CxIZJJgIbwj1kHGX_sym4AHF3vsNfK_5GyoCcPUV1ai7jZ6pV3IsOvS9XGBioXoXRkohL6z03Vz296-nOxV94oO-RlRuDWi4cPbPI3hYAn-Nfk5BewdjVmZlx6TflNF-akju9q8Zr3ebK_gnUswIu2XJWP245BfbVmuOqowAv3=s1600";
const PROXY = "https://ci3.googleusercontent.com/proxy/abc123=s0-d-e1-ft#https://x.com/logo.png";
const GMAIL = "https://mail.google.com/mail/u/0?ui=2&ik=abc&view=fimg&disp=emb";
const OK_NET = "https://cdn.example.com/buyer-logo.png";
const OK_DRIVE = "https://lh3.googleusercontent.com/d/1AbCdEfGhIjK=w800";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [], asked = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
page.on("request", r => { const u = r.url(); if (/^https?:/.test(u)) asked.push(u); });
/* nothing really leaves this machine: every outside picture is answered here */
await page.route("**/*", async route => {
  const u = route.request().url();
  if (/^file:/.test(u)) return route.continue();
  if (/usercontent\.google\.com|mail\.google\.com/.test(u)) return route.fulfill({ status: 403, body: "no" });
  return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") });
});
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(({ SIG, PROXY, GMAIL, OK_NET, OK_DRIVE }) => {
  if (typeof window.noPriv !== "function") return "the __privpic block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push({ id: "ashok", name: "Ashok", login: "merchandiser5@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} },
    { id: "vinay", name: "Vinay", login: "vinay@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} });
  DEPTS.length = 0; DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" });
  const at = Date.parse("2026-11-27T10:00:00+05:30");
  /* 1 - a colleague's mail (so pictures are allowed - this is the reported case) with the
         signature logo, Gmail's proxy, a Gmail inline link, a plain internet picture and a Drive one */
  const raw = '<html><body><p>Please confirm.</p>' +
    '<img src="' + SIG + '" width="200" height="60" alt="">' +
    '<img src="' + PROXY + '">' +
    '<img src="' + GMAIL + '">' +
    '<img src="' + OK_NET + '">' +
    '<img src="' + OK_DRIVE + '">' +
    '<img src="cid:logo001@rugs">' +
    '</body></html>';
  const q = { from: "Vinay", email: "vinay@rugscreation.com", at: at - 864e5, to: "teampulse@rugscreation.com", cc: "", sub: "older", body: "older", sig: "", html: '<p>older</p><img src="' + SIG + '">' };
  const msgs = [
    { gid: "g0", from: "Vinay", email: "vinay@rugscreation.com", at: at - 864e5, body: "older", subject: "s", to: "teampulse@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "", full: true },
    { gid: "g1", from: "Vinay", email: "vinay@rugscreation.com", at, body: "Please confirm.", subject: "s", to: "teampulse@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: fixMailImgs(raw), html: "", full: true, trail: [q] }
  ];
  const t = {
    id: "tp:pic", box: "teampulse@rugscreation.com", dept: "tp", from: "Vinay", email: "vinay@rugscreation.com",
    sub: "Signature logo", pre: "x", last: at, owner: "ashok", status: "open", folder: "inbox", unread: false,
    hist: [], cats: [], flag: 0, pinned: 0, full: true, msgs
  };
  /* 2 - the same picture in an INTERNAL rich body (drawn in the page, not in the frame) */
  const t2 = {
    ...t, id: "tp:rich", sub: "Internal note",
    msgs: [{ gid: "r1", from: "Vinay", email: "vinay@rugscreation.com", at, body: "hi", subject: "s", to: "teampulse@rugscreation.com", cc: "", by: "vinay", ours: true, atts: [], files: [], sig: "", raw: "", html: '<p>hi</p><img src="' + SIG + '">', full: true, trail: [q] }]
  };
  S.threads = [t, t2]; S.settings = {}; ME = "ashok"; app = "mail";
  view = { type: "box", dept: "tp", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(x => { metaSaved[x.id] = JSON.stringify(metaOf(x)); x._hn = 0 }) } catch (e) { }
  window.LIVE = false;
  api = async () => ({});
  openId = "tp:pic"; openMsgs["tp:pic"] = new Set([0, 1]); render(); renderRead();
  return "ok";
}, { SIG, PROXY, GMAIL, OK_NET, OK_DRIVE });
ck("fixture built", setup, "ok");

/* ---------- the unit: what noPriv does to each address ---------- */
const unit = await page.evaluate(({ SIG, PROXY, GMAIL, OK_NET, OK_DRIVE }) => {
  const one = u => { const h = noPriv('<img src="' + u + '">'); return { gone: /data-rzpriv/.test(h), n: noPrivN(), keptUrl: h.indexOf(u) >= 0 } };
  return {
    sig: one(SIG), proxy: one(PROXY), gmail: one(GMAIL), net: one(OK_NET), drive: one(OK_DRIVE),
    cid: one("cid:logo001@rugs"), rmcid: one("rmcid:abc/def"),
    quoted: /data-rzpriv/.test(noPriv("<img src='" + SIG + "' width=10>")),
    bare: /data-rzpriv/.test(noPriv("<IMG SRC=" + SIG + " >")),
    untouched: noPriv("<p>no pictures here</p>")
  };
}, { SIG, PROXY, GMAIL, OK_NET, OK_DRIVE });
ck("1 · the reported signature address is taken out", [unit.sig.gone, unit.sig.keptUrl, unit.sig.n], [true, false, 1]);
ck("1 · so is Gmail's own picture proxy", unit.proxy.gone, true);
ck("1 · so is a Gmail inline-picture link", unit.gmail.gone, true);
ck("1 · an ordinary picture on the internet is NOT touched", [unit.net.gone, unit.net.keptUrl], [false, true]);
ck("1 · a Google Drive picture is NOT touched", [unit.drive.gone, unit.drive.keptUrl], [false, true]);
ck("1 · an attached picture (cid:) is NOT touched", unit.cid.gone, false);
ck("1 · a picture still arriving (rmcid:) is NOT touched", unit.rmcid.gone, false);
ck("1 · single quotes and no quotes are handled too", [unit.quoted, unit.bare], [true, true]);
ck("1 · a mail with no pictures comes back unchanged", unit.untouched, "<p>no pictures here</p>");

/* ---------- the real screen ---------- */
await page.waitForTimeout(700);
const seen = () => ({
  sig: asked.filter(u => u.indexOf("usercontent.google.com") >= 0).length,
  proxy: asked.filter(u => u.indexOf("ci3.googleusercontent.com") >= 0).length,
  gmail: asked.filter(u => u.indexOf("mail.google.com") >= 0).length,
  net: asked.filter(u => u.indexOf("cdn.example.com") >= 0).length,
  drive: asked.filter(u => u.indexOf("lh3.googleusercontent.com") >= 0).length
});
let s1 = seen();
ck("2 · the browser never asks Google for the signature picture", s1.sig, 0);
ck("2 · nor for Gmail's proxy", s1.proxy, 0);
ck("2 · nor for the Gmail inline link", s1.gmail, 0);
ck("2 · but the buyer's ordinary picture IS still fetched", s1.net > 0, true);
ck("2 · and so is the Drive picture", s1.drive > 0, true);
ck("2 · no page errors", errs, []);

const pane = await page.evaluate(() => {
  const txt = (document.getElementById("read") || {}).textContent || "";
  const fr = document.querySelector("#read .mail iframe");
  let inFrame = { priv: 0, imgs: 0, srcHasGoogleSig: 0 };
  try {
    const d = fr.contentDocument;
    inFrame.priv = d.querySelectorAll("img[data-rzpriv]").length;
    inFrame.imgs = d.querySelectorAll("img").length;
    inFrame.srcHasGoogleSig = [].slice.call(d.querySelectorAll("img")).filter(i => (i.getAttribute("src") || "").indexOf("rd-mail-sig") >= 0).length;
  } catch (e) { inFrame.err = String(e.message || e) }
  return {
    note: (txt.match(/cannot be shown/g) || []).length,
    noteSays: /Gmail signature logo/.test(txt) && /inside the sender/.test(txt),
    asReceived: (txt.match(/Shown exactly as received/g) || []).length,
    inFrame, privPics: T_("tp:pic").msgs[1].privPics,
    reportLine: JSON.stringify(window.rzPrivPics())
  };
});
ck("3 · the frame holds the three hidden pictures", pane.inFrame.priv, 3);
ck("3 · and no picture tag still carries the Google address", pane.inFrame.srcHasGoogleSig, 0);
ck("3 · the other three pictures are still in the mail", pane.inFrame.imgs, 6);
ck("3 · the pane says it once, in plain words", [pane.note, pane.noteSays], [1, true]);
ck("3 · and still says the mail is shown as received", pane.asReceived, 1);
ck("3 · the mail remembers how many were hidden", pane.privPics, 3);
ck("3 · rzPrivPics() reports it", /"hidden":3/.test(pane.reportLine), true);

/* an internal rich body (drawn in the page itself) and its Mail trail */
const rich = await page.evaluate(() => {
  openId = "tp:rich"; openMsgs["tp:rich"] = new Set([0]); render(); renderRead();
  const d = document.querySelector("#read details.trail"); if (d) d.setAttribute("open", "");
  renderRead();
  const r = document.querySelector("#read .rich");
  const im = r ? r.querySelector("img[data-rzpriv]") : null;
  const q = document.querySelector("#read details.trail .qb");
  return {
    priv: r ? r.querySelectorAll("img[data-rzpriv]").length : -1,
    sig: r ? (r.innerHTML.indexOf("rd-mail-sig") >= 0) : true,
    hidden: im ? getComputedStyle(im).display : "?",
    trailPriv: q ? q.querySelectorAll("img[data-rzpriv]").length : -1,
    trailSig: q ? (q.innerHTML.indexOf("rd-mail-sig") >= 0) : true
  };
});
ck("4 · the Mail trail quote is cleaned too", [rich.trailPriv, rich.trailSig], [1, false]);
ck("5 · an internal rich body is cleaned", [rich.priv, rich.sig], [1, false]);
ck("5 · and what is left is really hidden", rich.hidden, "none");
await page.waitForTimeout(400);
let s2 = seen();
ck("5 · still nothing asked of Google", [s2.sig, s2.proxy, s2.gmail], [0, 0, 0]);

/* M1 */
const mem = await page.evaluate(() => { const r = window.rzMemCap ? window.rzMemCap() : null; return r ? r.nowMB : null });
ck("6 · the tab is under 250 MB", mem !== null && mem < 250, true);
ck("no page errors at the end", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
