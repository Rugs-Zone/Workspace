/* test-arun-sent-cap.mjs - 28 Nov 2026
 *
 * "Arun's Gmail-sent mails of today (12:10 Re: Order 13742 to n.pelzer, 12:06 / 12:17
 *  AW27 FLAIR CADS to designer) must show in his Sent. If any are missing, is it the
 *  build -13 cap of 1500 conversations that dropped them?"
 *
 * Real headless Edge on the BUILT mail-app.html, as Arun (a member) in Team Pulse, with a
 * mailbox far bigger than the cap, his three mails of today sitting at the top of it, and
 * the From name in the shape the live mail really carries ("Arun <en dash> Rugs Creation").
 * Nothing is written anywhere and no network call is made.
 *
 * Run:  node server/test-arun-sent-cap.mjs
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
const ck = (n, g, w) => {
  const ok = typeof w === "function" ? !!w(g) : JSON.stringify(g) === JSON.stringify(w);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + (typeof w === "function" ? "" : ", wanted " + JSON.stringify(w)) + ")"));
  ok ? pass++ : fail++;
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) {} });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

/* ---------- Arun, a member of Team Pulse, with a mailbox bigger than the cap ---------- */
const setup = await page.evaluate((N) => {
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "arun", name: "Arun", login: "merchandiser7@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} },
    { id: "mgrtp", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "tp", role: "Manager", active: true, perm: { assign: 1 } });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" });
  ME = "arun";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  window.__liveReady = true;

  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const at = (h, m) => today.getTime() + h * 3600000 + m * 60000;
  const BOX = "teampulse@rugscreation.com";

  /* His three real mails of today, in the shape the LIVE mail carries: he sent them from
     Gmail, so sent_by is empty, and the From ADDRESS is one of our own addresses that is
     NOT the mailbox and NOT a registered login - so colleagueIn() calls it "a colleague
     wrote in" and sentByUs() has only the From NAME to go on. The From NAME
     "Arun <en dash> Rugs Creation" is therefore the ONLY thing that says it was him, which
     is exactly what build -14's cleanSender has to see through. */
  const MINE = [
    { tid: "arun-13742", sub: "Re: Order 13742", to: "n.pelzer@example.com", when: at(12, 10) },
    { tid: "arun-flair1", sub: "AW27 FLAIR CADS", to: "designer@rugscreation.com", when: at(12, 6) },
    { tid: "arun-flair2", sub: "AW27 FLAIR CADS 2", to: "designer@rugscreation.com", when: at(12, 17) },
  ];
  const row = (tid, sub, when, folder, cp) => ({
    gmail_thread_id: tid, mailbox: BOX, dept_id: "tp",
    counterpart_name: cp.name, counterpart_email: cp.email,
    subject: sub, snippet: String(sub).slice(0, 160),
    last_msg_at: new Date(when).toISOString(), unread: false, flagged: false,
    owner_id: "", status: "new", folder, topic: "", topic_checked: true,
    cats: [], to_addrs: [], participants: [],
  });
  const outMsg = (tid, sub, when, to) => ({
    gmail_id: tid + "-m", direction: "out", sent_by: null,
    from_email: "arun@rugscreation.com", from_name: "Arun \u2013 Rugs Creation", mailbox: BOX,
    sent_at: new Date(when).toISOString(), body_text: "body of " + sub,
    to_text: to, cc_text: "", attachments: [],
  });
  const inMsg = (tid, sub, when, cp) => ({
    gmail_id: tid + "-m", direction: "in", sent_by: null,
    from_email: cp.email, from_name: cp.name, mailbox: BOX,
    sent_at: new Date(when).toISOString(), body_text: "enquiry " + sub,
    to_text: BOX, cc_text: "", attachments: [],
  });

  S.threads = [];
  /* a mailbox far bigger than the 1500 cap, every one of them older than today */
  for (let i = 0; i < N; i++) {
    const when = now - (i + 2) * 3600000;
    const cp = { name: "Buyer " + i, email: "buyer" + i + "@outside.com" };
    const tid = "old" + i;
    S.threads.push(mapRow(row(tid, "Old enquiry " + i, when, "inbox", cp), [inMsg(tid, "Old enquiry " + i, when, cp)], [], null, "tp"));
  }
  /* and his three, which are the NEWEST in the mailbox */
  MINE.forEach(x => {
    const cp = { name: x.to, email: x.to };
    S.threads.push(mapRow(row(x.tid, x.sub, x.when, "sent", cp), [outMsg(x.tid, x.sub, x.when, x.to)], [], null, "tp"));
  });

  /* The case that really hides mail (R15): a conversation holding BOTH his Gmail-sent mail
     AND a colleague's mail sent from Rugs Email. If his own mail cannot be named, the
     conversation counts as the COLLEAGUE'S sent mail and R15 hides the whole thing from him. */
  const cpm = { name: "n.pelzer@example.com", email: "n.pelzer@example.com" };
  S.threads.push(mapRow(row("arun-mixed", "Re: Order 13742 (also Jagjit)", at(12, 20), "sent", cpm), [
    outMsg("arun-mixed", "Re: Order 13742 (also Jagjit)", at(12, 20), "n.pelzer@example.com"),
    { gmail_id: "arun-mixed-j", direction: "out", sent_by: "mgrtp",
      from_email: BOX, from_name: "Jagjit Singh", mailbox: BOX,
      sent_at: new Date(at(11, 0)).toISOString(), body_text: "Jagjit's own note",
      to_text: "n.pelzer@example.com", cc_text: "", attachments: [] },
  ], [], null, "tp"));

  return { total: S.threads.length, ids: MINE.map(x => "tp:" + x.tid) };
}, 15000);
ck("a mailbox far bigger than the cap is loaded", setup.total, 15004);

/* ---------- 1. does the app call these three HIS? (the build -14 fix) ---------- */
console.log("\n=== 1 - the suffixed sender name is traced to Arun (build -14) ===");
const whose = await page.evaluate(() => {
  const ids = ["tp:arun-13742", "tp:arun-flair1", "tp:arun-flair2"];
  return ids.map(id => {
    const t = S.threads.find(x => x.id === id);
    return { id, who: sentWho(t.msgs[0], t), mine: msgMine(t.msgs[0], t), seen: sentSeen(t) };
  });
});
whose.forEach(r => {
  ck(r.id + " was sent by Arun", r.who, "arun");
  ck(r.id + " counts as his own", r.mine, true);
  ck(r.id + " is allowed in his Sent", r.seen, true);
});

/* ---------- 2. the cap: do today's mails survive it? ---------- */
console.log("\n=== 2 - the build -13 cap of 1500 conversations ===");
const capped = await page.evaluate(() => {
  const before = S.threads.length;
  const dropped = window.__memTrimConvs();
  const ids = ["tp:arun-13742", "tp:arun-flair1", "tp:arun-flair2"];
  return {
    before, dropped, after: S.threads.length,
    survived: ids.filter(id => S.threads.some(t => t.id === id)),
    oldestKept: Math.min.apply(null, S.threads.map(t => t.last)),
    newestKept: Math.max.apply(null, S.threads.map(t => t.last)),
  };
});
ck("the cap really fires on a mailbox this big", capped.dropped > 13000, true);
ck("...and brings the list down to the cap", capped.after, 1500);
ck("ALL THREE of today's mails survive the cap", capped.survived.length, 3);
ck("...Re: Order 13742 kept", capped.survived.includes("tp:arun-13742"), true);
ck("...AW27 FLAIR 12:06 kept", capped.survived.includes("tp:arun-flair1"), true);
ck("...AW27 FLAIR 12:17 kept", capped.survived.includes("tp:arun-flair2"), true);
ck("it dropped the OLDEST, not the newest", capped.newestKept >= capped.oldestKept, true);

/* ---------- 3. and they are really drawn in his Sent ---------- */
console.log("\n=== 3 - his Sent folder, drawn on the screen ===");
const sent = await page.evaluate(() => {
  view = { type: "box", dept: "tp", folder: "sent" }; app = "mail";
  try { filt = "all"; } catch (e) {}
  render();
  const rows = listRows();
  const txt = document.querySelector(".list .msgs").textContent;
  return {
    n: rows.length,
    has13742: rows.some(t => /13742/.test(t.sub)),
    hasFlair: rows.filter(t => /FLAIR/.test(t.sub)).length,
    drawn13742: /13742/.test(txt),
    drawnFlair: (txt.match(/FLAIR/g) || []).length,
  };
});
ck("his Sent is not empty", sent.n > 0, true);
ck("Re: Order 13742 is in his Sent list", sent.has13742, true);
ck("both AW27 FLAIR CADS are in his Sent list", sent.hasFlair, 2);
ck("...13742 is really drawn on the screen", sent.drawn13742, true);
ck("...and both FLAIR rows are drawn", sent.drawnFlair >= 2, true);

/* ---------- 4. the cap repeated, the way a long day does it ---------- */
console.log("\n=== 4 - a whole day of trims never eats them ===");
const many = await page.evaluate(() => {
  for (let i = 0; i < 25; i++) { window.__memTrimConvs(); window.__memGuard(true); }
  const ids = ["tp:arun-13742", "tp:arun-flair1", "tp:arun-flair2"];
  return { survived: ids.filter(id => S.threads.some(t => t.id === id)).length, n: S.threads.length,
    cap: window.rzMemCap ? window.rzMemCap() : null };
});
ck("after 25 trims and 25 guard runs they are still there", many.survived, 3);
ck("...and the list is still at the cap", many.n <= 1500, true);
console.log("     the tab reports: " + JSON.stringify(many.cap));

/* ---------- 5. R36's own list is not touched by the cap ---------- */
console.log("\n=== 5 - R36 (sent from a mailbox he cannot open) is a separate list ===");
const r36 = await page.evaluate(() => {
  FS36 = [{ subject: "Re: Order 13742", to_text: "n.pelzer@example.com", mailbox: "designer@rugscreation.com",
    sent_at: new Date().toISOString(), body: "x", has_attachments: false }];
  FS36at = Date.now(); FS36who = ME; FS36err = "";
  const n0 = FS36.length;
  window.__memTrimConvs(); window.__memGuard(true);
  return { before: n0, after: (FS36 || []).length };
});
ck("the cap does not drop R36 mail", r36.after, r36.before);

/* ---------- 6. WHICH of the two was the cause? ---------- */
/* The cap is innocent above. Now take build -14's cleanSender away again (replace it with
   the identity it effectively was before today) and see what changes in his Sent. */
console.log("\n=== 6 - the cause: the sender name, not the cap ===");
const without = await page.evaluate(() => {
  const keep = cleanSender;
  const solo = ["tp:arun-13742", "tp:arun-flair1", "tp:arun-flair2"];
  const look = (ids) => {
    view = { type: "box", dept: "tp", folder: "sent" }; app = "mail";
    try { filt = "all"; } catch (e) {}
    try { RHC.clear(); } catch (e) {}
    /* listRows() is cached for 1 second (LRC, patch-speed-everywhere). This test swaps
       cleanSender inside that second, which the real app never does, so the cache has to be
       dropped by hand or every snapshot below reads the first one's rows. */
    try { LRC = {}; } catch (e) {}
    render();
    return listRows().filter(t => ids.indexOf(t.id) >= 0).length;
  };
  const mixed = S.threads.find(t => t.id === "tp:arun-mixed");
  const read = () => ({
    solo: look(solo),
    mixed: look(["tp:arun-mixed"]),
    who: solo.map(id => { const t = S.threads.find(x => x.id === id); return sentWho(t.msgs[0], t); }),
    byUs: solo.map(id => { const t = S.threads.find(x => x.id === id); return sentByUs(t.msgs[0], t); }),
    mixedSeen: sentSeen(mixed),
    mixedInView: inView(mixed),
  });
  const withFix = read();
  cleanSender = function (x) { return String(x || ""); };   /* exactly the old behaviour */
  const withoutFix = read();
  cleanSender = keep;                                        /* put the shipped app back */
  const again = read();
  return { withFix, withoutFix, again };
});
ck("with build -14 his three are in his Sent", without.withFix.solo, 3);
ck("...and the mixed conversation too (2 rows: his mail and Jagjit's)", without.withFix.mixed, 2);
ck("...R15 lets him see it, because it is partly his", without.withFix.mixedSeen, true);

console.log("  -- with the fix taken away (the app as it was before build -14) --");
ck("nobody can be named as the sender", without.withoutFix.who, [null, null, null]);
ck("...so his mail does not even count as sent mail", without.withoutFix.byUs, [false, false, false]);
/* this is the reported bug, reproduced: his own Gmail-sent mail is not in his Sent at all */
ck("all three of today's mails VANISH from his Sent (the reported bug)", without.withoutFix.solo, 0);
/* but the one that also holds a colleague's mail is HIDDEN by R15 - this is the real loss */
ck("the conversation that also holds Jagjit's mail is HIDDEN from him by R15", without.withoutFix.mixedSeen, false);
ck("...so it is not in his Sent at all", without.withoutFix.mixed, 0);
ck("...and inView agrees it is gone", without.withoutFix.mixedInView, false);

console.log("  -- with build -14 put back --");
ck("he can see it again", without.again.mixedSeen, true);
ck("...and it is back in his Sent", without.again.mixed, 2);

ck("no page errors", errs, []);
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
