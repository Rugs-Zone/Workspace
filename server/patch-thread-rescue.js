/* patch-thread-rescue.js - 28 Nov 2026  URGENT (live)
 *
 * "Older mails show '⚠ Couldn't load — Retry' and Retry fails (Ashok via Switch ID, Team Pulse,
 *  'Very SS27 Po's', mails of 18 Nov). Preview works, body doesn't."
 *
 * WHAT THE LIVE SERVER ACTUALLY ANSWERED (read with an admin token against
 * mail-api.rugserp.com, then again through a REAL Switch ID session as Ashok):
 *
 *   thread  (no ids)  -> 200, 12 messages, 10 of them light:true
 *   thread  (ids=...) -> 200, the five asked for come back light:true AGAIN
 *   as Ashok via Switch ID -> 200, exactly the same answer as the admin got
 *   server log         -> "thread msg miss <id> Gmail 404: Requested entity was not found"
 *                         for every one of those ids, twice (the retry)
 *
 * So NOTHING is refused: not bug 12's role checks, not Switch ID (the switch creates a real
 * session row whose user_id IS Ashok, and the only place the server looks at switched_by for
 * this path is the "set your own password first" gate, which excludes 'thread' anyway), and
 * not the lazy loader's endpoint or ids - the server received exactly the right ids. GMAIL
 * answers 404 for those message ids. Checked further with the app's own Gmail search: the
 * thread 1a1cf9058bac590f still exists in teampulse@, but it only holds mail from 23 Nov
 * onwards - every window up to 19 Nov, "in:anywhere" included (so Trash and Spam too), comes
 * back without it. The 12-19 Nov mails are NOT in that Gmail mailbox under those ids any more,
 * while Rugs Email still holds its own saved copy of their text. That is why the preview reads
 * and the body does not.
 *
 * THE FIX, all on the server, no rule and no permission change:
 *
 *  1. A 404 is not retried. It is permanent, so the second go only doubled the log.
 *  2. RESCUE: when the stored id is gone, the mail is looked for in that same mailbox by
 *     sender and time (Gmail search over a two-day window, then the candidate whose
 *     internalDate is within two minutes of ours) - because an id can also be stale rather
 *     than deleted, and then the real original is still there under another id. If it is
 *     found the real mail is served, under the id the app asked for so nothing on the client
 *     has to change, and the log says "rescued". The answer is cached in memory for 30
 *     minutes, hit or miss, so a second open costs nothing. At most 4 rescues per request.
 *  3. If Gmail really does not have it, the mail is no longer an ERROR: the server sends the
 *     copy Rugs Email saved (up to 60,000 characters, the same cap as a normal mail) with
 *     saved:true and a plain reason. The app then shows the mail instead of "Couldn't load",
 *     and there is nothing to retry for ever.
 *  4. A mail that was never asked for still comes back light:true, exactly as before, and a
 *     TRANSIENT failure (502, a timeout) still comes back light:true so Retry can work.
 *
 * Run:  node server/patch-thread-rescue.js
 *       (the office machine picks the new bundle up within ten minutes, by version.txt)
 */
const fs = require("fs");
const path = require("path");

const BUNDLE = path.join(__dirname, "local-server", "rugs-mail.bundle.mjs");
const TS = path.join(__dirname, "rugs-mail.index.ts");
const VER = path.join(__dirname, "local-server", "version.txt");
const NEW_VER = "2026-11-28-a";

let b = fs.readFileSync(BUNDLE, "utf8");
if (b.includes("__threadrescue")) { console.log("already applied - nothing to do"); process.exit(0); }

/* ---------------- 1. the bundle (this is what the office server runs) ---------------- */

const OLD_FN_START = 'async function threadFull(box, tid, ids) {';
const OLD_FN_END = '\n  return { messages: out };\n}';
const i0 = b.indexOf(OLD_FN_START);
if (i0 < 0) throw new Error("threadFull not found in the bundle");
const i1 = b.indexOf(OLD_FN_END, i0);
if (i1 < 0) throw new Error("the end of threadFull not found in the bundle");
const oldFn = b.slice(i0, i1 + OLD_FN_END.length);
if (!oldFn.includes("thread msg miss")) throw new Error("threadFull does not look like the one we read");

const NEW_FN = `var MISS_CACHE = /* __threadrescue */ new Map();   /* mailbox|stored id -> { at, id } ; id null = Gmail really does not have it */
var MISS_TTL = 30 * 60 * 1e3;
var gDay = (t) => { const d = new Date(t); return d.getUTCFullYear() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); };
/* 28 Nov 2026 (__threadrescue): a stored gmail_id Gmail answers 404 for. Look the same mail up
   in the same mailbox by sender and time - an id can be stale rather than the mail gone. */
async function rescueMsg(tok, box, x) {
  const key = box + "|" + x.gmail_id;
  const c = MISS_CACHE.get(key);
  if (c && Date.now() - c.at < MISS_TTL) {
    if (!c.id) return null;
    try { return await gmail(tok, \`messages/\${c.id}?format=full\`); } catch { return null; }
  }
  let found = null;
  try {
    const at = Date.parse(x.sent_at);
    if (at) {
      const q = [x.from_email ? "from:" + String(x.from_email).trim() : "", "in:anywhere",
        "after:" + gDay(at - 864e5), "before:" + gDay(at + 864e5)].filter(Boolean).join(" ");
      const j = await gmail(tok, \`messages?maxResults=10&q=\${encodeURIComponent(q)}&fields=messages(id)\`);
      const cand = (j.messages || []).map((y) => String(y.id)).slice(0, 5);
      for (const id of cand) {
        if (id === String(x.gmail_id)) continue;
        let h = null;
        try { h = await gmail(tok, \`messages/\${id}?format=minimal&fields=internalDate\`); } catch { continue; }
        if (Math.abs(Number(h && h.internalDate || 0) - at) <= 12e4) {
          try { found = await gmail(tok, \`messages/\${id}?format=full\`); } catch { found = null; }
          if (found) { console.log("thread msg rescued", x.gmail_id, "->", id, "(the stored id was stale)"); break; }
        }
      }
    }
  } catch (e) { console.log("thread msg rescue failed", x.gmail_id, String(e && e.message || e).slice(0, 120)); }
  MISS_CACHE.set(key, { at: Date.now(), id: found ? String(found.id) : null });
  if (MISS_CACHE.size > 5e3) MISS_CACHE.clear();
  return found;
}
async function threadFull(box, tid, ids) {
  const { data: m } = await sb.from("rm_messages").select("gmail_id,direction,body_text,sent_at,from_email").eq("mailbox", box).eq("gmail_thread_id", tid).order("sent_at");
  const tok = await gToken(box, READ);
  const FULL_N = 3;   /* 25 Nov 2026: the pane opens the newest, a reply quotes the newest 3 - see server/patch-thread-full3.js */
  const rows = m || [];
  const want = Array.isArray(ids) && ids.length ? new Set(ids.slice(0, 20).map(String)) : null;
  const need = want ? rows.filter((x) => want.has(String(x.gmail_id))) : rows.slice(-FULL_N);
  const asked = new Set(need.map((x) => String(x.gmail_id)));
  const gone = new Set();     /* Gmail said 404 for this stored id - permanent, never retried */
  const getMsg = async (id) => {
    for (let i = 0; i < 2; i++) {
      try {
        return await gmail(tok, \`messages/\${id}?format=full\`);
      } catch (e) {
        if (e && e.code === 404) { gone.add(String(id)); console.log("thread msg miss", id, "- Gmail does not have this id (404), not retried"); return null; }
        if (i) { console.log("thread msg miss", id, String(e && e.message || e).slice(0, 140)); return null; }
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return null;
  };
  const got = (await Promise.all(need.map((x) => getMsg(String(x.gmail_id))))).filter(Boolean);
  const byId = new Map(got.map((x) => [x.id, x]));
  /* __threadrescue: only for the ones Gmail answered 404 for, at most four in a request */
  const rescued = new Map();
  const lost = need.filter((x) => gone.has(String(x.gmail_id))).slice(0, 4);
  if (lost.length) {
    const rs = await Promise.all(lost.map((x) => rescueMsg(tok, box, x)));
    rs.forEach((r, i) => { if (r) rescued.set(String(lost[i].gmail_id), r); });
  }
  const pool2 = [];
  for (const gm of got) for (const x of inlineParts(gm.payload)) pool2.push({ ...x, mid: gm.id, data: "" });
  for (const gm of rescued.values()) for (const x of inlineParts(gm.payload)) pool2.push({ ...x, mid: gm.id, data: "" });
  const allIx = cidIndex(pool2);
  const out = await Promise.all(rows.map(async (x) => {
    const gm = byId.get(x.gmail_id) || rescued.get(String(x.gmail_id)) || null;
    if (!gm) {
      /* never asked for, or a transient failure: a one-line summary, exactly as before */
      if (!asked.has(String(x.gmail_id)) || !gone.has(String(x.gmail_id)))
        return { ...x, body_html: "", body_text: (x.body_text || "").slice(0, 4e3), light: true };
      /* asked for, and Gmail really does not have it: send the copy we saved, so it can be read */
      return { ...x, body_html: "", body_text: (x.body_text || "").slice(0, 6e4), light: false, saved: true,
        why: "Google Mail no longer has this message, so Rugs Email is showing the copy it saved." };
    }
    /* the mail Gmail gave us. A rescued one keeps the id the app asked for on purpose. */
    let html = partOf(gm.payload, "text/html");
    const text = partOf(gm.payload, "text/plain") || (html ? htmlToText(html.slice(0, 15e4)) : "");
    if (html) html = withCidLinks(x.gmail_id, gm.payload, html, allIx);
    return { ...x, body_html: html, body_text: (text || x.body_text || "").slice(0, 6e4) };
  }));
  return { messages: out };
}`;

b = b.slice(0, i0) + NEW_FN + b.slice(i1 + OLD_FN_END.length);
fs.writeFileSync(BUNDLE, b);
console.log("ok  bundle: threadFull replaced (rescue + saved copy + no 404 retry)");

/* ---------------- 2. the TypeScript source, so the next build does not lose it ---------------- */
let t = fs.readFileSync(TS, "utf8");
if (!t.includes("__threadrescue")) {
  const mark = '      if (!gm) return { ...x, body_html: "", body_text: (x.body_text || "").slice(0, 4000), light: true };';
  if (t.includes(mark)) {
    t = t.replace(mark,
      '      // __threadrescue 28 Nov 2026: this file has DRIFTED from the bundle the office server runs\n' +
      '      // (server/local-server/rugs-mail.bundle.mjs, FULL_N there is 3 and it carries the rescue +\n' +
      '      // saved-copy fix of 28 Nov). Patch the BUNDLE; see server/patch-thread-rescue.js.\n' +
      mark);
    fs.writeFileSync(TS, t);
    console.log("ok  TS source: drift note added (the bundle is what runs)");
  } else console.log("note: the TS source has moved on - left untouched");
}

/* ---------------- 3. the version the office machine watches ---------------- */
fs.writeFileSync(VER, NEW_VER);
console.log("ok  version.txt -> " + NEW_VER + " (the office server self-updates within ten minutes)");
