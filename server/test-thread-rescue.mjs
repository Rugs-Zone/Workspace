/* test-thread-rescue.mjs - 28 Nov 2026
 *
 * The server half of the "Couldn't load - Retry" fix, run EXACTLY AS IT SHIPS: threadFull and
 * rescueMsg are lifted out of server/local-server/rugs-mail.bundle.mjs (the file the office
 * machine downloads) and run here against stubbed Gmail and database, so the test cannot drift
 * from the code that runs.
 *
 * Run:  node server/test-thread-rescue.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

const bundle = fs.readFileSync(path.join(__dirname, "local-server", "rugs-mail.bundle.mjs"), "utf8");
const i0 = bundle.indexOf("var MISS_CACHE");
const i1 = bundle.indexOf("\n  return { messages: out };\n}", i0);
ck("the shipped code was found", i0 > 0 && i1 > i0, true);
const SRC = bundle.slice(i0, i1 + "\n  return { messages: out };\n}".length);
ck("it is the fixed code", /__threadrescue/.test(SRC) && /saved: true/.test(SRC), true);

/* ---- the rows the office database holds for the real conversation (12 mails) ---- */
const D = s => new Date(s).toISOString();
const ROWS = [
  { gmail_id: "1a1cf9058bac590f", direction: "out", from_email: "teampulse@rugscreation.com", sent_at: D("2026-11-12T11:38:37Z"), body_text: "saved text 1" },
  { gmail_id: "1a1cfc1b2c4d71dc", direction: "in", from_email: "po@very.com", sent_at: D("2026-11-12T12:35:28Z"), body_text: "saved text 2" },
  { gmail_id: "1a1ee4b3ad3cfd30", direction: "in", from_email: "po@very.com", sent_at: D("2026-11-18T10:54:23Z"), body_text: "saved text 18 Nov" },
  { gmail_id: "1a1f4529b122837d", direction: "in", from_email: "po@very.com", sent_at: D("2026-11-19T15:00:02Z"), body_text: "saved text 19 Nov" },
  { gmail_id: "1a2070690e573d9d", direction: "in", from_email: "po@very.com", sent_at: D("2026-11-23T06:09:52Z"), body_text: "saved text 23 Nov a" },
  { gmail_id: "1a207f90869fe324", direction: "in", from_email: "po@very.com", sent_at: D("2026-11-23T10:34:40Z"), body_text: "saved text 23 Nov b" },
  { gmail_id: "1a21c93ba9362bb9", direction: "out", from_email: "teampulse@rugscreation.com", sent_at: D("2026-11-27T10:32:47Z"), body_text: "saved text 27 Nov" }
];

/* ---- the stubs ---- */
function makeEnv(opt) {
  opt = opt || {};
  const calls = [];
  const E = class extends Error { constructor(m, code = 400) { super(m); this.code = code } };
  const gmail = async (tok, p) => {
    calls.push(p);
    let mm = /^messages\/([^?]+)/.exec(p);
    if (mm) {
      const id = mm[1];
      if (/format=minimal/.test(p)) {
        const t = (opt.gmailHas || {})[id];
        if (!t) throw new E("Gmail 404: nope", 404);
        return { internalDate: String(Date.parse(t)) };
      }
      if ((opt.transient || []).includes(id)) throw new E("Gmail 502: upstream", 502);
      const live = (opt.gmailHas || {})[id];
      if (!live) throw new E("Gmail 404: Requested entity was not found.", 404);
      return { id, payload: { mimeType: "text/html", body: { data: "x" }, headers: [] }, __for: id };
    }
    if (/^messages\?/.test(p)) {
      const q = decodeURIComponent((/q=([^&]*)/.exec(p) || [, ""])[1]);
      const from = (/from:([^\s]+)/.exec(q) || [, ""])[1];
      const ids = Object.keys(opt.gmailHas || {}).filter(id => ((opt.gmailFrom || {})[id] || "") === from);
      return { messages: ids.map(id => ({ id })) };
    }
    throw new E("unexpected Gmail path " + p, 500);
  };
  const sb = { from: () => ({ select: () => ({ eq: function () { return this }, order: async () => ({ data: ROWS.slice() }) }) }) };
  const factory = new Function("sb", "gToken", "gmail", "READ", "inlineParts", "cidIndex", "partOf", "withCidLinks", "htmlToText", "console",
    SRC + "\nreturn { threadFull: threadFull, MISS_CACHE: MISS_CACHE };");
  const api = factory(sb, async () => "tok", gmail, "read", () => [], () => ({}),
    (payload, kind) => kind === "text/html" ? "<p>REAL BODY " + (payload.__id || "") + "</p>" : "", (id, p, h) => h, h => h,
    { log: (...a) => calls.push("LOG " + a.join(" ")) });
  return { api, calls };
}
const live = (...ids) => { const o = {}; ids.forEach(id => o[id] = (ROWS.find(r => r.gmail_id === id) || {}).sent_at); return o };
const froms = () => { const o = {}; ROWS.forEach(r => o[r.gmail_id] = r.from_email); return o };

/* ---------- 1 · the live situation: Gmail only has the two newest ---------- */
{
  const { api, calls } = makeEnv({ gmailHas: live("1a207f90869fe324", "1a21c93ba9362bb9"), gmailFrom: froms() });
  const r = await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f");
  const by = {}; r.messages.forEach(m => by[m.gmail_id] = m);
  ck("1 · every mail is still in the answer", r.messages.length, ROWS.length);
  ck("1 · the newest two read", [!!by["1a207f90869fe324"].body_html, !!by["1a21c93ba9362bb9"].body_html], [true, true]);
  ck("1 · the newest one Gmail lost comes back as the SAVED copy, not an error",
    [by["1a2070690e573d9d"].saved === true, by["1a2070690e573d9d"].light, by["1a2070690e573d9d"].body_text],
    [true, false, "saved text 23 Nov a"]);
  ck("1 · it says why", /no longer has this message/.test(by["1a2070690e573d9d"].why || ""), true);
  ck("1 · the older mails nobody asked for are still one-line summaries",
    [by["1a1ee4b3ad3cfd30"].light, by["1a1cf9058bac590f"].light], [true, true]);
  ck("1 · and nothing was fetched for them", calls.filter(c => /^messages\/1a1ee4b3|^messages\/1a1cf905/.test(c)).length, 0);
  ck("1 · a 404 is asked once, never retried", calls.filter(c => c === "messages/1a2070690e573d9d?format=full").length, 1);
}

/* ---------- 2 · the app asks for the 18 Nov mails by id ---------- */
{
  const { api, calls } = makeEnv({ gmailHas: live("1a207f90869fe324"), gmailFrom: froms() });
  const ids = ["1a1cf9058bac590f", "1a1cfc1b2c4d71dc", "1a1ee4b3ad3cfd30", "1a1f4529b122837d"];
  const r = await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ids);
  const by = {}; r.messages.forEach(m => by[m.gmail_id] = m);
  ck("2 · all four come back readable, none of them an error",
    ids.map(i => by[i].saved === true && by[i].light === false), [true, true, true, true]);
  ck("2 · with the text Rugs Email saved", ids.map(i => by[i].body_text),
    ["saved text 1", "saved text 2", "saved text 18 Nov", "saved text 19 Nov"]);
  ck("2 · the rescue looked for them by sender and time", calls.filter(c => /^messages\?/.test(c)).length, 4);
  ck("2 · a mail NOT asked for is untouched", by["1a21c93ba9362bb9"].light, true);
}

/* ---------- 3 · a stale id: Gmail still has the mail under another id ---------- */
{
  const has = { "zzNEWID": ROWS[2].sent_at };                      /* same minute as our 18 Nov row */
  const { api, calls } = makeEnv({ gmailHas: has, gmailFrom: { zzNEWID: "po@very.com" } });
  const r = await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ["1a1ee4b3ad3cfd30"]);
  const m = r.messages.find(x => x.gmail_id === "1a1ee4b3ad3cfd30");
  ck("3 · the real mail is found and served", !!m.body_html, true);
  ck("3 · under the id the app asked for", m.gmail_id, "1a1ee4b3ad3cfd30");
  ck("3 · so it is not marked as a saved copy", !!m.saved, false);
  ck("3 · and the log says it was rescued", calls.some(c => /LOG thread msg rescued/.test(c)), true);
}

/* ---------- 4 · a mail whose time does not match is NOT grabbed by mistake ---------- */
{
  const has = { "zzOTHER": new Date(Date.parse(ROWS[2].sent_at) + 36e5).toISOString() };   /* an hour out */
  const { api } = makeEnv({ gmailHas: has, gmailFrom: { zzOTHER: "po@very.com" } });
  const r = await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ["1a1ee4b3ad3cfd30"]);
  const m = r.messages.find(x => x.gmail_id === "1a1ee4b3ad3cfd30");
  ck("4 · no wrong body is attached", !!m.body_html, false);
  ck("4 · it falls back to the saved copy", [m.saved, m.body_text], [true, "saved text 18 Nov"]);
}

/* ---------- 5 · a transient failure still leaves Retry something to do ---------- */
{
  const { api, calls } = makeEnv({ gmailHas: live("1a1ee4b3ad3cfd30"), gmailFrom: froms(), transient: ["1a1ee4b3ad3cfd30"] });
  const r = await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ["1a1ee4b3ad3cfd30"]);
  const m = r.messages.find(x => x.gmail_id === "1a1ee4b3ad3cfd30");
  ck("5 · a 502 is NOT turned into a saved copy", !!m.saved, false);
  ck("5 · it stays a summary, so the app can offer Retry", m.light, true);
  ck("5 · and a transient failure IS retried once", calls.filter(c => c === "messages/1a1ee4b3ad3cfd30?format=full").length, 2);
  ck("5 · no rescue search is made for a transient failure", calls.filter(c => /^messages\?/.test(c)).length, 0);
}

/* ---------- 6 · the second open costs nothing (the miss is remembered) ---------- */
{
  const { api, calls } = makeEnv({ gmailHas: {}, gmailFrom: froms() });
  await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ["1a1ee4b3ad3cfd30"]);
  const n1 = calls.filter(c => /^messages\?/.test(c)).length;
  await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ["1a1ee4b3ad3cfd30"]);
  const n2 = calls.filter(c => /^messages\?/.test(c)).length;
  ck("6 · it searched once", n1, 1);
  ck("6 · and not again", n2, 1);
  ck("6 · the answer is still the saved copy",
    (await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ["1a1ee4b3ad3cfd30"])).messages.find(x => x.gmail_id === "1a1ee4b3ad3cfd30").saved, true);
}

/* ---------- 7 · at most four rescues in one request ---------- */
{
  const { api, calls } = makeEnv({ gmailHas: {}, gmailFrom: froms() });
  const ids = ROWS.slice(0, 6).map(r => r.gmail_id);
  const r = await api.threadFull("teampulse@rugscreation.com", "1a1cf9058bac590f", ids);
  ck("7 · four searches, not six", calls.filter(c => /^messages\?/.test(c)).length, 4);
  ck("7 · but all six still come back readable as the saved copy",
    ids.every(i => r.messages.find(x => x.gmail_id === i).saved === true), true);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
