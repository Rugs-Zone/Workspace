/* test-sent-names-search.mjs - 28 Nov 2026
 *
 * "Robin's mail is in Sent in Gmail but not in Ashish's Sent" - it WAS there, under the name
 * "Kind reg". Checked here in real headless Edge on the built app, with the exact To: header
 * text of his real mails, read out of the live database first:
 *
 *   "Robin Vos | Loods 5" <r.vos@loods5.nl>, Shubham Aneja <dmm1@rugscreation.com>, …
 *
 * Run:  node server/test-sent-names-search.mjs
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

/* ---------- 1 · the name guard ---------- */
const g = await page.evaluate(() => ({
  signoffs: ["Kind regards", "Kind regards,", "Kind reg", "Best regards", "Regards", "regards,",
    "Thanks", "Thank you", "Rgds", "BR", "Cheers", "Met vriendelijke groet",
    "Mit freundlichen Gr\u00fc\u00dfen", "Cordialement", "Saludos", "Yours sincerely", "Best wishes",
    "Thanks and regards", "Looking forward"].filter(x => goodName(x)),
  names: ["Robin Vos | Loods 5", "Maud Wedman | Loods 5", "Robin Vos", "Shubham Aneja",
    "Merchandiser6 Rugs Creation", "Jarratt, Fiona", "Kloe RAMTAHAL", "Lily-Sue Martin",
    "Rugs Creation \u00b7 Karnal", "Kate O\u2019Meara"].filter(x => !goodName(x)),
  junkStillOut: ["[Loods 5 Home]<https://eu.content.exclaimer.net/?url=x>", "[cid:image001.jpg@01DD4CD7]",
    "[Geodis]", "www.flairrugs.com", "From: Puran Singh <puran@pridel.com>", "12345", "",
    "As mentioned, kindly let us know immediately if you have any"].filter(x => goodName(x))
}));
ck("1 · no sign-off is ever a name", g.signoffs, []);
ck("1 · a name with a bar in it is kept", g.names, []);
ck("1 · the junk of 28 Nov is still refused", g.junkStillOut, []);

/* ---------- 2 · the Sent row, with his real headers ---------- */
const setup = await page.evaluate(() => {
  const TO = '"Robin Vos | Loods 5" <r.vos@loods5.nl>, Shubham Aneja <dmm1@rugscreation.com>, Merchandiser6 Rugs Creation <merchandiser6@rugscreation.com>';
  const CC = 'Vinay Chugh <vinay@rugscreation.com>, Noorul Salam <noorul@a2zbuyingservices.com>, "Maud Wedman | Loods 5" <m.wedman@loods5.nl>';
  PEOPLE.length = 0;
  PEOPLE.push({ id: "ash", name: "Ashish Deshwal", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {}, access: {} });
  DEPTS.length = 0; DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", mailbox: "teampulse@rugscreation.com", color: "#09c" });
  const BOX = "teampulse@rugscreation.com", at = Date.parse("2026-10-01T14:11:00Z");
  const mk = (id, sub, to, cc, from, email, ours, when, body) => ({
    gid: id, from, fname: from, email, at: when, body: body || "Please find the PO attached.", to, cc,
    by: "", ours, atts: [], files: [], sig: "Kind regards\nRobin Vos\nLoods 5", raw: "", full: true
  });
  S.threads = [
    { id: "tp:1", box: BOX, dept: "tp", from: "Robin Vos | Loods 5", email: "r.vos@loods5.nl",
      sub: "New order | Po 26314003986", pre: "x", last: at, owner: "ash", status: "open", folder: "inbox",
      unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, to: [BOX],
      msgs: [
        mk("a", "", BOX, "", "Robin Vos | Loods 5", "r.vos@loods5.nl", false, at - 36e5),
        mk("b", "", TO, CC, "Ashish Deshwal", "merchandiser9@rugscreation.com", true, at)
      ] },
    /* a mail whose To: carries no name at all - the contact name is junk, so the address must win */
    { id: "tp:2", box: BOX, dept: "tp", from: "Ops", email: "ops@geodis.com",
      sub: "Booking", pre: "y", last: at - 864e5, owner: "ash", status: "open", folder: "inbox",
      unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, to: [BOX],
      msgs: [mk("c", "", "<ops@geodis.com>", "", "Ashish Deshwal", "merchandiser9@rugscreation.com", true, at - 864e5, "Please book one 40HQ.")] },
    /* nothing to do with Robin */
    { id: "tp:3", box: BOX, dept: "tp", from: "Kate", email: "kate@dunelm.com",
      sub: "Wren - Relabel", pre: "z", last: at - 1728e5, owner: "ash", status: "open", folder: "inbox",
      unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, to: [BOX],
      msgs: [mk("d", "", "Kate <kate@dunelm.com>", "", "Ashish Deshwal", "merchandiser9@rugscreation.com", true, at - 1728e5, "The relabel is done.")] }
  ];
  S.settings = {}; S.contactEdits = {}; ME = "ash"; app = "mail";
  view = { type: "box", dept: "tp", folder: "sent" };
  if (typeof filt !== "undefined") filt = "all";
  if (typeof lfilt !== "undefined") lfilt = "";
  document.getElementById("login").hidden = true; document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0 }) } catch (e) { }
  window.LIVE = false; api = async () => ({});
  window.__liveReady = false;          /* R36 asks nothing in this test */
  try { _sentCt = { at: 0, m: null } } catch (e) { }
  render();
  return { to1: sentTo(S.threads[0]), to2: sentTo(S.threads[1]), rows: [...document.querySelectorAll(".m .who")].map(x => x.textContent.trim()) };
});
ck("2 · the To: column names Robin as the header wrote him", setup.to1,
  "Robin Vos | Loods 5, Shubham Aneja, Merchandiser6 Rugs Creation");
ck("2 · never again \u201cKind reg\u201d", /kind reg/i.test(setup.to1 + " " + setup.to2 + " " + setup.rows.join(" ")), false);
ck("2 · a To: with no name shows the address, not a sign-off", setup.to2, "ops@geodis.com");
ck("2 · the row on screen says Robin", setup.rows[0], "To: Robin Vos | Loods 5, Shubham Aneja, Merchandiser6 Rugs Creation");

/* ---------- 3 · the signature reader and Contacts ask the same guard ---------- */
const three = await page.evaluate(() => ({
  sig: parseSig("Kind regards\nRobin Vos\nLoods 5", "r.vos@loods5.nl", "Robin Vos | Loods 5").name,
  contact: (contacts() || []).filter(c => String(c.email).toLowerCase() === "r.vos@loods5.nl").map(c => c.name)
}));
ck("3 · a signature's sign-off is not taken as the contact's name", /kind/i.test(three.sig), false);
ck("3 · Contacts does not call him \u201cKind reg\u201d", three.contact.filter(n => /kind reg/i.test(n)), []);

/* ---------- 4 · searching for the person we wrote TO ---------- */
const four = await page.evaluate(() => {
  const q = document.getElementById("q");
  const hits = (text) => { q.value = text; render(); return [...document.querySelectorAll(".m .sub")].map(x => x.textContent.trim()) };
  const o = {
    robin: hits("robin"),
    loods: hits("loods5.nl"),
    shubham: hits("shubham aneja"),
    maudCc: hits("maud"),
    kate: hits("kate"),
    nobody: hits("zzzznothing")
  };
  q.value = ""; render();
  o.after = [...document.querySelectorAll(".m .sub")].length;
  return o;
});
ck("4 · \u201crobin\u201d finds the mail we sent him", four.robin, ["New order | Po 26314003986"]);
ck("4 · so does his domain", four.loods, ["New order | Po 26314003986"]);
ck("4 · a colleague in the To: is found too", four.shubham, ["New order | Po 26314003986"]);
ck("4 · somebody only in the Cc is found", four.maudCc, ["New order | Po 26314003986"]);
ck("4 · an unrelated name still finds its own mail", four.kate, ["Wren - Relabel"]);
ck("4 · a word nobody wrote finds nothing", four.nobody, []);
ck("4 · clearing the box brings the list back", four.after, 3);

/* ---------- 5 · it stays cheap ---------- */
const five = await page.evaluate(() => {
  const big = [];
  for (let i = 0; i < 3000; i++) big.push({
    id: "x:" + i, box: "teampulse@rugscreation.com", dept: "tp", from: "Buyer " + i, email: "b" + i + "@x.com",
    sub: "Order " + i, pre: "p", last: Date.now() - i * 6e4, owner: "ash", status: "open", folder: "inbox",
    unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, to: [],
    msgs: [{ gid: "m" + i, from: "Ashish Deshwal", email: "merchandiser9@rugscreation.com", at: Date.now() - i * 6e4,
      body: "b", to: "Buyer" + i + " <b" + i + "@x.com>, Shubham Aneja <dmm1@rugscreation.com>", cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", full: true }]
  });
  S.threads = S.threads.concat(big);
  const q = document.getElementById("q");
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) { q.value = "robin"; listRows(); q.value = "shubham"; listRows() }
  const ms = (performance.now() - t0) / 40;
  q.value = "";
  return { perSearch: Math.round(ms), threads: S.threads.length };
});
ck("5 · a search over 3,003 conversations is under 60 ms", five.perSearch < 60, true);
console.log("   (" + five.perSearch + " ms per search over " + five.threads + " conversations)");

console.log("\npage errors: " + JSON.stringify(errs));
ck("no page errors", errs.length, 0);
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
