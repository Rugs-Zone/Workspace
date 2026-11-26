/* test-search-rank.mjs - 27 Nov 2026  (night plan, bug 1: "search hides mail")
 *
 * Runs against the BUILT app (mail-app.html) in real headless Edge, so the whole shipped
 * chain is in play - including seeMine / sentSeen, which decide who may see a conversation.
 * That matters here: the task said "do not change any ownership rule", and the only honest
 * way to show that is to search as three different people and check they each still get
 * their own rows.
 *
 * It also reads server/local-server/rugs-mail-list.bundle.mjs in node and checks the SQL
 * that actually ships: the filters, the ORDER BY on every subquery, and the 500 + paging.
 *
 * Run:  node server/test-search-rank.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = g === w; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };
const hasIn = (n, hay, word) => { const ok = String(hay).toLowerCase().includes(String(word).toLowerCase()); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (\"" + word + "\" is not there)")); ok ? pass++ : fail++; };

/* ===================================================== the server half ===== */
console.log("=== the SQL that ships ===");
const B = fs.readFileSync(path.join(__dirname, "local-server", "rugs-mail-list.bundle.mjs"), "utf8");
const find = B.slice(B.indexOf("async function rzFind"), B.indexOf("p.action === \"more\""));
ck("the thread subquery is ordered newest first", /from rm_threads th2 where[\s\S]{0,400}?order by th2\.last_msg_at desc/.test(find), true);
ck("the message subquery is ordered newest first", /group by m2\.mailbox, m2\.gmail_thread_id order by max\(m2\.sent_at\) desc/.test(find), true);
ck("the mail-text subquery is ordered newest first", /group by m3\.mailbox, m3\.gmail_thread_id order by max\(m3\.sent_at\) desc/.test(find), true);
["from", "to", "subject", "att", "before", "after"].forEach(k =>
  ck("the server filters on " + k + ":", find.indexOf("f." + k) >= 0, true));
ck("in: picks the folder on the server", /th\.folder = /.test(find), true);
ck("it answers up to 500", /Number\(limit\) \|\| 500, 1\), 500\)/.test(find), true);
ck("it pages with an offset", /offset/.test(find), true);
ck("it says whether there is a next page", /j\.more = more/.test(find), true);
ck("a filter with no words is allowed", B.indexOf("Type at least 3 letters, or use a filter chip") >= 0, true);
ck("the app's filters really reach rzFind", B.indexOf("rzFind(boxes2, words, p.limit, deep, ids, f, p.offset)") >= 0, true);

/* ======================================================= the app half ===== */
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof srchRank !== "function") return "the search block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "gulab", name: "Gulab Tyagi", login: "amr1@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: {} },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "ta", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  const D = n => Date.now() - n * 36e5;
  const inc = (at, body, from, to, atts) => ({ at, from: from || "Hershika", email: "h@linear.com", body: body || "", to: to || "teamalpha@rugscreation.com", cc: "", atts: atts || [], files: [] });
  const T = (id, sub, msgs, extra) => Object.assign({
    id: "ta:" + id, box: "teamalpha@rugscreation.com", dept: "ta", from: msgs[0].from, email: msgs[0].email,
    sub, pre: String(msgs[0].body || "").slice(0, 120), last: msgs[msgs.length - 1].at,
    owner: null, status: "open", folder: "inbox", unread: false, hist: [], cats: [], msgs, flag: 0, pinned: 0
  }, extra || {});
  S.threads = [
    /* the one we must find. It is NOT the newest mail in the mailbox - "Weekly update"
       below is newer - so being row 1 can only come from the ranking. */
    T(1, "MAX ZIPPER // IO 4815 // 5 NO ZIPPER", [inc(D(2), "Please confirm the zipper count.")]),
    /* must NOT match 4815 at all */
    T(2, "Order 24815 confirmation", [inc(D(5), "Order 24815 is confirmed.")]),
    T(3, "Invoice 148150 attached", [inc(D(4), "Invoice 148150.")]),
    /* rank 1 - the number is in the sender / To line, not the subject */
    T(4, "Packing list", [inc(D(30), "See attached.", "4815 Logistics Ltd", "teamalpha@rugscreation.com")]),
    /* rank 2 - only in the mail text, and the NEWEST conversation of the lot */
    T(5, "Weekly update", [inc(D(0.1), "We shipped against IO 4815 yesterday.")]),
    /* rank 3 - only an attachment name */
    T(6, "Documents", [inc(D(20), "Files attached.", "Hershika", "teamalpha@rugscreation.com", [{ name: "4815.pdf", mime: "application/pdf", size: 1000 }])]),
    /* folder tags */
    T(7, "IO 4815 archived copy", [inc(D(60), "archived")], { folder: "archive" }),
    T(8, "IO 4815 junk copy", [inc(D(61), "junk")], { folder: "junk" }),
    T(9, "IO 4815 deleted copy", [inc(D(62), "deleted")], { folder: "deleted" }),
    T(10, "IO 4815 finished", [inc(D(63), "done")], { status: "done" }),
    /* a colleague owns this one - the ownership rule must still hide it from a member */
    T(11, "IO 4815 private to Gulab", [inc(D(64), "gulab only")], { owner: "gulab" })
  ];
  S.settings = {}; S.lvOf = {};
  ME = "adm";
  app = "mail";                      /* the app starts on Home, and Home has no mail list */
  view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  if (typeof tab !== "undefined") tab = "focused";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  const q = document.getElementById("q"); if (!q) return "no search box";
  window.__q = (v) => { document.getElementById("q").value = v; };
  window.__rows = () => listRows().map(t => ({ sub: t.sub, id: t.id, rank: srchRank(t, parseQ(document.getElementById("q").value.trim())) }));
  window.__as = (id) => { ME = id; };
  return "ok";
});
ck("the search block is in the built app", setup, "ok");

/* --------------------------------------------------- 1 + 2 · the ranking - */
console.log("\n=== searching 4815 ===");
for (const [id, label] of [["adm", "admin"], ["jagjit", "manager (Jagjit)"], ["imran", "member (Imran)"]]) {
  const r = await page.evaluate((who) => { window.__as(who); window.__q("4815"); return window.__rows(); }, id);
  ck("as " + label + ": the IO 4815 mail is ROW 1", /IO 4815 \/\/ 5 NO ZIPPER/.test(r[0] ? r[0].sub : ""), true);
  ck("as " + label + ": 24815 is not in the results", r.some(x => /24815/.test(x.sub)), false);
  ck("as " + label + ": 148150 is not in the results", r.some(x => /148150/.test(x.sub)), false);
}
const rA = await page.evaluate(() => { window.__as("adm"); window.__q("4815"); return window.__rows(); });
console.log("     " + rA.map(x => "r" + x.rank + " " + x.sub).join("\n     "));
ck("the subject hit outranks the sender hit", rA.findIndex(x => /MAX ZIPPER/.test(x.sub)) < rA.findIndex(x => /Packing list/.test(x.sub)), true);
ck("the sender hit outranks the mail-text hit", rA.findIndex(x => /Packing list/.test(x.sub)) < rA.findIndex(x => /Weekly update/.test(x.sub)), true);
ck("the mail-text hit outranks the attachment-name hit", rA.findIndex(x => /Weekly update/.test(x.sub)) < rA.findIndex(x => /Documents/.test(x.sub)), true);
ck("the NEWEST mail is not first just because it is newest", /Weekly update/.test(rA[0].sub), false);
ck("ranks come out as 0,1,2,3", [0, 1, 2, 3].every(n => rA.some(x => x.rank === n)), true);

console.log("\n=== newest first INSIDE one rank ===");
const sameRank = await page.evaluate(() => {
  window.__as("adm"); window.__q("4815");
  const r = listRows().filter(t => srchRank(t, parseQ("4815")) === 0);
  return r.map(t => ({ sub: t.sub, at: rowWhen(t) }));
});
ck("every subject hit is together at the top", sameRank.length >= 2, true);
ck("and they are newest first", sameRank.every((x, i) => i === 0 || sameRank[i - 1].at >= x.at), true);

console.log("\n=== the ownership rules are untouched ===");
const seen = await page.evaluate(() => {
  const out = {};
  ["adm", "jagjit", "imran", "gulab"].forEach(id => {
    ME = id; document.getElementById("q").value = "4815";
    out[id] = listRows().some(t => /private to Gulab/.test(t.sub));
  });
  ME = "adm"; return out;
});
ck("a member does not find a colleague's conversation (R3)", seen.imran, false);
ck("its owner does find it", seen.gulab, true);
ck("the manager finds it (R31)", seen.jagjit, true);
ck("the admin finds it (R31)", seen.adm, true);

/* ------------------------------------------------------- 5 · folder tags - */
console.log("\n=== the folder tag on a result row ===");
const tags = await page.evaluate(() => {
  ME = "adm"; document.getElementById("q").value = "4815";
  const out = {};
  listRows().forEach(t => { const m = rowHTML(t).match(/class="tag sfold"[^>]*>([^<]+)</); if (m) out[t.sub] = m[1]; });
  return out;
});
ck("an archived one says Archive", tags["IO 4815 archived copy"], "Archive");
ck("a junk one says Junk", tags["IO 4815 junk copy"], "Junk");
ck("a deleted one says Deleted", tags["IO 4815 deleted copy"], "Deleted");
ck("a finished one says Done", tags["IO 4815 finished"], "Done");
ck("an ordinary one says Inbox", tags["MAX ZIPPER // IO 4815 // 5 NO ZIPPER"], "Inbox");
const noTag = await page.evaluate(() => { document.getElementById("q").value = ""; return /class="tag sfold"/.test(rowHTML(S.threads[0])); });
ck("no folder tag when nothing is being searched", noTag, false);

/* -------------------------------------------------------- 7 · highlight -- */
console.log("\n=== the words are highlighted ===");
const hi = await page.evaluate(() => {
  document.getElementById("q").value = "4815";
  const h = rowHTML(S.threads[0]);
  return { mark: (h.match(/<mark class="shl">4815<\/mark>/g) || []).length, bad: /<mark class="shl">481<\/mark>/.test(h) };
});
ck("the searched number is marked on the row", hi.mark > 0, true);
ck("and only the whole number", hi.bad, false);
const hiNo = await page.evaluate(() => { document.getElementById("q").value = "4815"; return /<mark class="shl">/.test(rowHTML(S.threads[1])); });
ck("a row that only contains 24815 gets no mark", hiNo, false);
const hiDomOk = await page.evaluate(() => {
  const d = document.createElement("div");
  d.innerHTML = '<p>Please confirm IO 4815 today</p><p>and 24815 is a different order</p>';
  document.body.appendChild(d);
  hiDom(d, ["4815"]);
  const n = d.querySelectorAll("mark.shl").length, txt = d.textContent;
  hiClear(d); const after = d.querySelectorAll("mark.shl").length;
  const same = d.textContent === txt;
  d.remove();
  return { n, after, same };
});
ck("the open mail gets exactly one mark for the whole number", hiDomOk.n, 1);
ck("clearing takes every mark away again", hiDomOk.after, 0);
ck("...and leaves the text exactly as it was", hiDomOk.same, true);

/* ------------------------------------------------------------ 6 · chips -- */
console.log("\n=== the filter chips ===");
const chips = await page.evaluate(() => {
  ME = "adm"; document.getElementById("q").value = "4815";
  render();
  const c = document.querySelectorAll(".list .lhead .schips [data-sq]");
  return { n: c.length, labels: [...c].map(b => b.textContent.trim()) };
});
ck("five chips are drawn under the search box", chips.n, 5);
ck("they are the five that were asked for",
  JSON.stringify(chips.labels), JSON.stringify(["From", "To", "Has attachment", "Date range", "Folder"]));
const writes = await page.evaluate(() => {
  const out = {};
  [["from:", "From"], ["to:", "To"], ["has:attachment", "Has attachment"], ["date", "Date range"], ["folder", "Folder"]].forEach(([code]) => {
    document.getElementById("q").value = "";
    const b = document.querySelector('.list .lhead .schips [data-sq="' + code + '"]');
    if (b) b.click();
    out[code] = document.getElementById("q").value;
  });
  return out;
});
ck("From writes from: into the box", writes["from:"], "from:");
ck("To writes to:", writes["to:"], "to:");
ck("Has attachment writes has:attachment", writes["has:attachment"], "has:attachment");
ck("Date range writes a real after:/before: pair", /^after:\d{4}-\d{2}-\d{2} before:\d{4}-\d{2}-\d{2}$/.test(writes["date"]), true);
ck("Folder writes in:inbox", writes["folder"], "in:inbox");
const parsed = await page.evaluate(() => {
  const o = parseQ("4815 from:ikea to:priya subject:invoice has:attachment after:2026-10-01 before:2026-11-01 in:sent");
  return { f: srchFilters("4815 from:ikea to:priya subject:invoice has:attachment after:2026-10-01 before:2026-11-01 in:sent"), w: o.words };
});
ck("what the chips write is sent to the server as filters",
  JSON.stringify(Object.keys(parsed.f).sort()), JSON.stringify(["after", "att", "before", "from", "in", "subject", "to"]));
ck("and the plain words are still the words", JSON.stringify(parsed.w), JSON.stringify(["4815"]));

/* ------------------------------------------------- what goes on the wire -- */
console.log("\n=== what the app actually asks the server ===");
const sent = await page.evaluate(() => new Promise(res => {
  const real = window.api;
  window.api = (a, p) => { if (a === "find") { window.api = real; res({ a, p }); return new Promise(() => { }); } return real(a, p); };
  try { api = window.api; } catch (e) { }
  document.getElementById("q").value = "4815 from:ikea has:attachment";
  serverFind("4815 from:ikea has:attachment", true, 0);
  setTimeout(() => res({ a: "none", p: null }), 1500);
}));
ck("it calls find", sent.a, "find");
ck("...asking for 500", sent.p && sent.p.limit, 500);
ck("...with the filters", sent.p && sent.p.f && sent.p.f.from, "ikea");
ck("...including has:attachment", sent.p && sent.p.f && sent.p.f.att, true);
ck("...and an offset for paging", sent.p && sent.p.offset, 0);

console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
if (errs.length) fail += errs.length;
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
