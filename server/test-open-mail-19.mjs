/* test-open-mail-19.mjs - 27 Nov 2026  (the "Opening this mail... for ever" bug)
 *
 * Real headless Edge on the BUILT app (mail-app.html), as Ashok in Team Pulse, in the
 * conversation the report named: "Very SS27 Po's", 12 mails, where the server sends the
 * newest 3 in full and the 9 older ones as one-line summaries (light:true) - exactly what
 * a long trail looks like on the live server. The 'thread' call is stubbed so the test can
 * make it succeed, fail, or answer with a summary again.
 *
 * Run:  node server/test-open-mail-19.mjs
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
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof openLight !== "function") return "openLight is missing";
  if (typeof window.rzOpenMails !== "function") return "the __openmail19 block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push({ id: "ashok", name: "Ashok Kumar", login: "merchandiser7@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" });
  const D = s => Date.parse(s);
  const N = 12;
  const msgs = [];
  for (let i = 0; i < N; i++) {
    const old = i < N - 3;                      /* the 9 older ones arrive as summaries */
    msgs.push({
      gid: "m" + i, from: "Very Buyer", email: "po@very.com", at: D("2026-11-10T09:00:00+05:30") + i * 3600000,
      body: "Summary line of mail " + i, subject: "Very SS27 Po's", to: "teampulse@rugscreation.com", cc: "",
      by: "", ours: false, atts: [], files: [], sig: "",
      raw: old ? "" : "<p>FULL BODY " + i + "</p>", html: "", full: !old, light: old
    });
  }
  const t = {
    id: "tp:very", box: "teampulse@rugscreation.com", dept: "tp", from: "Very Buyer", email: "po@very.com",
    sub: "Very SS27 Po's", pre: "x", last: msgs[N - 1].at, owner: null, status: "open", folder: "inbox",
    unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, msgs
  };
  S.threads = [t];
  S.settings = {}; ME = "ashok"; app = "mail"; view = { type: "box", dept: "tp", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0; } catch (e) { }

  /* ---- the stubbed server. MODE: 'ok' | 'fail' | 'stilllight' ---- */
  window.__mode = "ok"; window.__calls = [];
  api = async function (action, p) {
    if (action !== "thread") return {};
    window.__calls.push({ ids: (p.ids || []).slice() });
    if (window.__mode === "fail") throw new Error("Gmail did not answer");
    const ids = p.ids && p.ids.length ? p.ids : null;
    const out = (S.threads[0].msgs).map(m => {
      const want = ids ? ids.indexOf(m.gid) >= 0 : !m.light;
      if (!want || window.__mode === "stilllight") return { gmail_id: m.gid, light: true, body_text: "Summary line of mail " + m.gid };
      return { gmail_id: m.gid, body_html: "<p>FULL BODY " + m.gid + "</p>", body_text: "FULL BODY " + m.gid };
    });
    return { messages: out };
  };
  /* no network, no live loader getting in the way of the stub */
  window.LIVE = false;

  window.__openConv = () => { openId = "tp:very"; openMsgs["tp:very"] = new Set([9, 10, 11]); render(); renderRead(); };
  window.__state = () => {
    const t = T_(openId), os = openMsgs[t.id] || new Set();
    const arts = [].slice.call(document.querySelectorAll("#read .mail"));
    return {
      spinners: document.querySelectorAll("#read .mbody").length ? [].slice.call(document.querySelectorAll("#read .mbody")).filter(b => /Opening this mail/.test(b.textContent)).length : 0,
      retries: document.querySelectorAll("#read [data-lretry]").length,
      frames: document.querySelectorAll("#read .mail iframe").length,
      open: os.size,
      collapsed: arts.filter(a => a.classList.contains("collapsed")).length,
      snipsWithWords: arts.filter(a => a.classList.contains("collapsed") && (a.querySelector(".msnip") || {}).textContent && a.querySelector(".msnip").textContent.trim().length > 3).length,
      snipSpinner: arts.filter(a => /Opening this mail/.test(((a.querySelector(".msnip") || {}).textContent) || "")).length,
      sendersAndTimes: arts.filter(a => a.querySelector("header b") && a.querySelector("header time") && a.querySelector("header time").textContent.trim()).length,
      light: t.msgs.filter(m => m.light).length,
      loading: t.msgs.filter(m => m.loading).length,
      failed: t.msgs.filter(m => m.lfail).length,
      withRaw: t.msgs.filter(m => !!m.raw).length,
      rawc: Object.keys(RAWC).length,
      locks: Object.keys(LD1).length
    };
  };
  window.__clickMail = i => { const a = document.getElementById("msg-tp:very-" + i); if (!a) return "no mail " + i; a.querySelector("header").click(); return "ok"; };
  window.__showAll = () => { const b = document.querySelector("#read [data-mall]"); if (!b) return "no show-all button"; b.click(); return b.textContent.trim().slice(0, 30); };
  window.__retry = () => { const b = document.querySelector("#read [data-lretry]"); if (!b) return "no retry"; b.click(); return "ok"; };
  return "ok";
});
ck("fixture built", setup, "ok");

const w = (ms) => page.waitForTimeout(ms);

/* ---------- 1 · open the conversation: the folded mails show words, never a spinner ---------- */
await page.evaluate(() => window.__openConv());
await w(120);
let st = await page.evaluate(() => window.__state());
ck("1 · nine mails folded", st.collapsed, 9);
ck("1 · every folded mail has a one-line preview", st.snipsWithWords, 9);
ck("1 · no spinner in any folded one-liner", st.snipSpinner, 0);
ck("1 · every mail shows its sender and its time", st.sendersAndTimes, 12);
ck("1 · nothing is spinning (nothing older is open yet)", st.spinners, 0);
ck("1 · the three newest are drawn as mail", st.frames, 3);

/* ---------- 2 · clicking a folded mail loads and opens it ---------- */
ck("2 · clicked mail 4", await page.evaluate(() => window.__clickMail(4)), "ok");
await w(400);
st = await page.evaluate(() => window.__state());
ck("2 · it is open", st.open, 4);
ck("2 · it is no longer a summary", st.light, 8);
ck("2 · nothing left spinning", st.spinners, 0);
ck("2 · no failure shown", st.retries, 0);
ck("2 · its body is drawn", st.frames, 4);
ck("2 · the in-flight lock came off again", st.locks, 0);
ck("2 · its text really arrived", await page.evaluate(() => /FULL BODY m4/.test(document.getElementById("msg-tp:very-4").textContent)), true);

/* ---------- 3 · the bug itself: the memory guard strips it, and it loads AGAIN ---------- */
const again = await page.evaluate(() => {
  const t = T_("tp:very");
  stripLoaded(t);                                  /* exactly what rule M1 does when the tab is full */
  t.msgs.forEach(m => { if (m.gid !== "m9" && m.gid !== "m10" && m.gid !== "m11") m.light = true; });
  renderRead();
  return { light: t.msgs.filter(m => m.light).length, locks: Object.keys(LD1).length };
});
ck("3 · after the memory guard it is a summary again", again.light >= 9, true);
ck("3 · no stale lock is left behind", again.locks, 0);
await w(700);
st = await page.evaluate(() => window.__state());
ck("3 · the open mail fetched itself again, no spinner left", st.spinners, 0);
ck("3 · it is loaded again", await page.evaluate(() => { const m = T_("tp:very").msgs[4]; return !m.light && !!m.raw }), true);

/* ---------- 4 · Show all N mails: every one of them loads ---------- */
await page.evaluate(() => window.__showAll());
await w(1200);
st = await page.evaluate(() => window.__state());
ck("4 · all twelve are open", st.open, 12);
ck("4 · not one is still a summary", st.light, 0);
ck("4 · not one is still spinning", st.spinners, 0);
ck("4 · not one failed", st.failed, 0);
ck("4 · twelve mails drawn", st.frames, 12);

/* ---------- 5 · folding them up again frees the frames (rule M1) ---------- */
const folded = await page.evaluate(() => {
  const before = { frames: document.querySelectorAll("#read .mail iframe").length, raw: T_("tp:very").msgs.filter(m => !!m.raw).length, rawc: Object.keys(RAWC).length };
  const b = [].slice.call(document.querySelectorAll("#read [data-mall]")).pop(); b.click();
  return new Promise(r => setTimeout(() => {
    r({ before, after: { frames: document.querySelectorAll("#read .mail iframe").length, raw: T_("tp:very").msgs.filter(m => !!m.raw).length, rawc: Object.keys(RAWC).length } });
  }, 300));
});
ck("5 · the frames are gone", folded.after.frames < folded.before.frames, true);
ck("5 · the fetched text is freed", folded.after.raw < folded.before.raw, true);
ck("5 · its cached copy is freed too", folded.after.rawc <= folded.before.rawc, true);
ck("5 · one mail is left open", await page.evaluate(() => (openMsgs["tp:very"] || new Set()).size), 1);
st = await page.evaluate(() => window.__state());
ck("5 · the folded ones show their preview, not a spinner", st.snipSpinner, 0);
ck("5 · and they still show sender and time", st.sendersAndTimes, 12);

/* ---------- 6 · re-opening a freed mail fetches it again ---------- */
await page.evaluate(() => window.__clickMail(2));
await w(500);
ck("6 · it loaded again after being freed", await page.evaluate(() => { const m = T_("tp:very").msgs[2]; return !m.light && /FULL BODY/.test(String(m.raw || "")) }), true);
ck("6 · nothing is spinning", (await page.evaluate(() => window.__state())).spinners, 0);

/* ---------- 7 · when the server fails, the spinner becomes "Couldn't load - Retry" ---------- */
const fcase = await page.evaluate(() => {
  window.__mode = "fail";
  const t = T_("tp:very");
  const m = t.msgs[1];
  m.light = true; m.full = false; delete m.raw; m.lfail = false;
  openMsgs[t.id].add(1);
  renderRead();
  return new Promise(r => setTimeout(() => r({
    txt: (document.getElementById("msg-tp:very-1").textContent || "").replace(/\s+/g, " "),
    retries: document.querySelectorAll("#read [data-lretry]").length,
    loading: t.msgs.filter(x => x.loading).length
  }), 900));
});
ck("7 · the loader finished", fcase.loading, 0);
ck("7 · a Retry button is offered", fcase.retries, 1);
ck("7 · it says it could not load", /Couldn.t load/.test(fcase.txt), true);
ck("7 · it is not spinning any more", /Opening this mail/.test(fcase.txt), false);
ck("7 · and the text it has is still readable", /BODY|Summary/.test(fcase.txt), true);

/* ---------- 8 · Retry works once the server is back ---------- */
await page.evaluate(() => { window.__mode = "ok"; return window.__retry(); });
await w(600);
ck("8 · Retry loaded the mail", await page.evaluate(() => { const m = T_("tp:very").msgs[1]; return !m.light && /FULL BODY/.test(String(m.raw || "")) }), true);
ck("8 · no Retry button left", (await page.evaluate(() => window.__state())).retries, 0);

/* ---------- 9 · a server that keeps answering with a summary is not an endless spinner ---------- */
const sl = await page.evaluate(() => {
  window.__mode = "stilllight";
  const t = T_("tp:very"), m = t.msgs[0];
  m.light = true; m.full = false; delete m.raw; m.lfail = false;
  openMsgs[t.id].add(0);
  renderRead();
  return new Promise(r => setTimeout(() => r({
    retries: document.querySelectorAll("#read [data-lretry]").length,
    loading: t.msgs.filter(x => x.loading).length,
    calls: window.__calls.length
  }), 1200));
});
ck("9 · the loader finished", sl.loading, 0);
ck("9 · Retry is offered instead of spinning", sl.retries, 1);

/* ---------- 10 · the Mail trail's "View mail" and a jump both load the mail ---------- */
const jump = await page.evaluate(() => {
  window.__mode = "ok";
  const t = T_("tp:very");
  t.msgs.forEach((m, i) => { if (i < 9) { m.light = true; m.full = false; delete m.raw } });
  openMsgs[t.id] = new Set([11]);
  renderRead();
  /* this is exactly what data-jump (Mail trail "View mail ^") and sibShow do */
  openMsgs[t.id].add(3);
  renderRead();
  return new Promise(r => setTimeout(() => r({
    light3: T_("tp:very").msgs[3].light,
    txt: /FULL BODY m3/.test(document.getElementById("msg-tp:very-3").textContent)
  }), 800));
});
ck("10 · a jumped-to mail loads itself", jump.light3, false);
ck("10 · and its text is on the screen", jump.txt, true);

/* ---------- 11 · rule M1: the tab stays well under 250 MB ---------- */
const mem = await page.evaluate(() => { const r = window.rzMemCap ? window.rzMemCap() : null; return r ? { mb: r.nowMB, cap: window.MEM_CAP_MB } : null; });
ck("11 · M1 still reports", !!mem, true);
ck("11 · the ceiling is still 250 MB", mem && mem.cap, 250);
ck("11 · the tab is under it", !!mem && mem.mb < 250, true);
const rep = await page.evaluate(() => window.rzOpenMails());
ck("11 · nothing is left locked", rep.inFlightLocks, 0);
ck("11 · nothing is left spinning", rep.loadingNow, 0);

/* ---------- 12 · phone width ---------- */
await page.setViewportSize({ width: 390, height: 844 });
await w(300);
const ph = await page.evaluate(() => {
  renderRead();
  return { wide: document.documentElement.scrollWidth - document.documentElement.clientWidth, snip: document.querySelectorAll("#read .mail.collapsed .msnip").length };
});
ck("12 · no sideways scroll at 390px", ph.wide <= 3, true);
ck("12 · the folded one-liners are still there", ph.snip > 0, true);

ck("no page errors", errs, []);
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
