/* test-saved-copy.mjs - 28 Nov 2026
 *
 * The app half of the "Couldn't load - Retry" fix, in real headless Edge on the built
 * mail-app.html, on the conversation from the report ("Very SS27 Po's", Team Pulse, Ashok):
 * the server answers saved:true for the 18 Nov mails whose original Gmail no longer has, and
 * the pane must READ them - with one honest line saying it is the copy Rugs Email saved, no
 * spinner, and nothing to retry for ever. Run twice: as a plain member session, and as the
 * same user through a Switch ID session (the admin using Ashok's ID).
 *
 * Run:  node server/test-saved-copy.mjs
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
const errs = [];

for (const MODE of ["member", "switchid"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", e => errs.push(MODE + ": " + String(e.message || e)));
  if (MODE === "switchid") await page.addInitScript(() => {
    try { localStorage.setItem("rugs-admin-token", "ADMINTOK"); localStorage.setItem("rugs-admin-name", "Priyanshu Tomar"); localStorage.setItem("rugs-switch-token", "SWTOK"); } catch (e) { }
  });
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  const setup = await page.evaluate((MODE) => {
    PEOPLE.length = 0;
    PEOPLE.push({ id: "ashok", name: "Ashok", login: "merchandiser5@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} });
    DEPTS.length = 0; DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" });
    const D = s => Date.parse(s);
    /* the real shape: 12 mails, the newest two in full, the rest one-line summaries */
    const msgs = [];
    const AT = ["2026-11-12T11:38:37Z", "2026-11-12T12:35:28Z", "2026-11-12T13:17:53Z", "2026-11-16T09:42:42Z",
      "2026-11-18T10:54:23Z", "2026-11-18T11:14:54Z", "2026-11-18T13:34:46Z", "2026-11-19T15:00:02Z",
      "2026-11-23T06:09:18Z", "2026-11-23T06:09:52Z", "2026-11-23T10:34:40Z", "2026-11-27T10:32:47Z"];
    AT.forEach((t, i) => {
      const old = i < 10;
      msgs.push({
        gid: "g" + i, from: "Very Buyer", email: "po@very.com", at: D(t), body: "saved text " + i,
        subject: "Very SS27 Po's", to: "teampulse@rugscreation.com", cc: "", by: "", ours: false,
        atts: [], files: [], sig: "", raw: old ? "" : "<p>REAL BODY " + i + "</p>", html: "", full: !old, light: old
      });
    });
    const t = {
      id: "tp:very", box: "teampulse@rugscreation.com", dept: "tp", from: "Very Buyer", email: "po@very.com",
      sub: "Very SS27 Po's - Rugs Creation", pre: "x", last: msgs[11].at, owner: "ashok", status: "open",
      folder: "inbox", unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, msgs
    };
    S.threads = [t]; S.settings = {}; ME = "ashok"; app = "mail";
    view = { type: "box", dept: "tp", folder: "inbox" };
    if (typeof filt !== "undefined") filt = "all";
    const lg = document.getElementById("login"); if (lg) lg.hidden = true;
    document.body.classList.remove("signedout");
    try { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0 } catch (e) { }
    if (MODE === "switchid") { TOKEN = "SWTOK"; window.__liveReady = true; }

    /* the server as it now answers: the 18 Nov mails come back as the SAVED copy, and g3 is
       a transient failure (still a summary, so Retry has something to do) */
    window.__calls = [];
    api = async function (action, p) {
      if (action !== "thread") return {};
      window.__calls.push((p.ids || []).join(","));
      const ids = p.ids && p.ids.length ? p.ids : null;
      return {
        messages: S.threads[0].msgs.map(m => {
          const askedFor = ids ? ids.indexOf(m.gid) >= 0 : !m.light;
          if (!askedFor) return { gmail_id: m.gid, light: true, body_text: "saved text " + m.gid.slice(1) };
          if (m.gid === "g3") return { gmail_id: m.gid, light: true, body_text: "saved text 3" };   /* transient */
          return {
            gmail_id: m.gid, light: false, saved: true, body_html: "",
            body_text: "SAVED COPY of mail " + m.gid.slice(1) + " - the buyer's own words are here",
            why: "Google Mail no longer has this message, so Rugs Email is showing the copy it saved."
          };
        })
      };
    };
    window.LIVE = false;
    openId = "tp:very"; openMsgs["tp:very"] = new Set([9, 10, 11]); render(); renderRead();
    return "ok";
  }, MODE);
  ck(MODE + " · fixture built", setup, "ok");

  const w = ms => page.waitForTimeout(ms);
  const state = () => page.evaluate(() => {
    const t = T_(openId), arts = [].slice.call(document.querySelectorAll("#read .mail"));
    const txt = (document.getElementById("read") || {}).textContent || "";
    return {
      spinners: arts.filter(a => /Opening this mail/.test(a.textContent)).length,
      retries: document.querySelectorAll("#read [data-lretry]").length,
      savedNotes: (txt.match(/no longer has this message/g) || []).length,
      asReceived: (txt.match(/Shown exactly as received/g) || []).length,
      light: t.msgs.filter(m => m.light).length,
      saved: t.msgs.filter(m => m.saved).length,
      loading: t.msgs.filter(m => m.loading).length,
      failed: t.msgs.filter(m => m.lfail).length,
      swBar: !!document.getElementById("swBar")
    };
  });

  /* 1 - open an 18 Nov mail (index 4) */
  await page.evaluate(() => { document.getElementById("msg-tp:very-4").querySelector("header").click() });
  await w(500);
  let st = await state();
  ck(MODE + " · 1 the mail reads instead of failing", st.failed, 0);
  ck(MODE + " · 1 no spinner", st.spinners, 0);
  ck(MODE + " · 1 nothing to retry", st.retries, 0);
  /* two: the mail just opened AND the newest summary (23 Nov 06:09), which Gmail lost too and
     which the pane had already opened - build 19 fetches every open summary by itself */
  ck(MODE + " · 1 it is marked as the saved copy", st.saved, 2);
  ck(MODE + " · 1 the buyer's words are on the screen",
    await page.evaluate(() => /SAVED COPY of mail 4/.test(document.getElementById("msg-tp:very-4").textContent)), true);
  ck(MODE + " · 1 one honest line per saved mail, said once each", st.savedNotes, 2);
  ck(MODE + " · 1 and it does NOT claim to be exactly as received", st.asReceived, 2);   /* the two real mails only */

  /* 2 - Show all 12: every mail reads, nothing spins, nothing fails */
  await page.evaluate(() => { const b = document.querySelector("#read [data-mall]"); if (b) b.click() });
  await w(1500);
  st = await state();
  ck(MODE + " · 2 all twelve open", await page.evaluate(() => openMsgs["tp:very"].size), 12);
  ck(MODE + " · 2 nothing is spinning", st.spinners, 0);
  ck(MODE + " · 2 the nine Gmail lost read as saved copies", st.saved, 9);
  ck(MODE + " · 2 the transient one is the only thing offering Retry", st.retries, 1);
  ck(MODE + " · 2 one note per saved mail", st.savedNotes, 9);

  /* 3 - Retry on the transient one works once the server is well */
  await page.evaluate(() => {
    const _a = api;
    api = async function (action, p) { const r = await _a(action, p); (r.messages || []).forEach(m => { if (m.gmail_id === "g3") { m.light = false; m.saved = false; m.body_html = "<p>REAL BODY 3</p>"; m.body_text = "REAL BODY 3" } }); return r };
    document.querySelector("#read [data-lretry]").click();
  });
  await w(600);
  st = await state();
  ck(MODE + " · 3 Retry loaded the real mail", await page.evaluate(() => { const m = T_("tp:very").msgs[3]; return !m.light && /REAL BODY 3/.test(String(m.raw || "")) }), true);
  ck(MODE + " · 3 no Retry left", st.retries, 0);
  ck(MODE + " · 3 nothing is spinning", st.spinners, 0);

  /* 4 - folding up and opening again must not lose the saved copy (M1) */
  await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll("#read [data-mall]")).pop(); b.click() });
  await w(400);
  await page.evaluate(() => { document.getElementById("msg-tp:very-4").querySelector("header").click() });
  await w(500);
  st = await state();
  ck(MODE + " · 4 still the saved copy, not a spinner", [st.spinners, st.retries], [0, 0]);
  ck(MODE + " · 4 its text is still there",
    await page.evaluate(() => /SAVED COPY of mail 4/.test(document.getElementById("msg-tp:very-4").textContent)), true);
  ck(MODE + " · 4 and it was not fetched again", await page.evaluate(() => window.__calls.filter(c => c.indexOf("g4") >= 0).length), 1);

  /* 5 - a poll must not lose the note */
  const poll = await page.evaluate(() => {
    const t = T_("tp:very");
    const row = {
      mailbox: t.box, gmail_thread_id: "very", dept_id: "tp", subject: t.sub, snippet: "x",
      last_msg_at: new Date(t.last).toISOString(), folder: "inbox", status: "open", owner_id: "ashok", unread: false
    };
    const ms = t.msgs.map(m => ({
      gmail_id: m.gid, mailbox: t.box, gmail_thread_id: "very", direction: "in", from_email: m.email,
      from_name: m.from, sent_at: new Date(m.at).toISOString(), body_text: m.body, attachments: []
    }));
    const t2 = mapRow(row, ms, [], t, "tp");
    return { saved: t2.msgs.filter(m => m.saved).length, body: /SAVED COPY of mail 4/.test(String(t2.msgs[4].body || "")) };
  });
  ck(MODE + " · 5 the saved mark survives a poll", poll.saved >= 9, true);
  ck(MODE + " · 5 and so does the text", poll.body, true);

  /* 6 - rule M1 */
  const mem = await page.evaluate(() => { const r = window.rzMemCap ? window.rzMemCap() : null; return r ? { mb: r.nowMB, cap: window.MEM_CAP_MB } : null });
  ck(MODE + " · 6 the tab is under 250 MB", !!mem && mem.mb < 250, true);

  /* 7 - the Switch ID run really was a switched session */
  if (MODE === "switchid") ck("switchid · the switched-ID bar is showing", st.swBar, true);
  else ck("member · no switched-ID bar", st.swBar, false);

  await page.close();
}

ck("no page errors", errs, []);
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
