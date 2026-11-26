/* 26 Nov 2026 - take the pin back off Aman's conversation.

   The pin was the right thing when the mail had no row of its own: it was the only way to be
   sure it could not be missed. Now that every mail is its own row, the mail sits in the Inbox
   at its own time (25 Nov 5:34 pm) under its own name, so the pin has nothing left to do -
   and it is actively harmful, because the pinned sort (repaired in patch-mail-per-row.js)
   floats ALL FIVE of that conversation's rows above everything else. That is why the Inbox
   opened on "YESTERDAY" and "TUESDAY" with today's mail, including the 11 unread, pushed
   below them - which reads exactly like "all mail is not showing".

   Two changes:
     1. show-aman-mail-2026-11-26b no longer pins (and no longer demands a pin to call itself
        verified), so it cannot put the pin back on a later run.
     2. A new one-time job takes the pin off both copies (teampulse@ and shipping@). It finds
        them the same way - by RFC Message-Id, Gmail id, then sender and time - touches ONLY
        the `pinned` column, and records what it changed so it can be undone.

   Run:  node server/patch-unpin-aman.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__unpinaman")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;
const sub = (what, from, to) => {
  if (s.split(from).length !== 2) { console.error("STOP - " + what + ": not found exactly once"); process.exit(1); }
  s = s.replace(from, to); n++;
};

/* 1. the pinner stops pinning */
sub("the force update",
  '        "   set folder = \'inbox\', unread = true, pinned = true," +',
  '        "   set folder = \'inbox\', unread = true," +     /* __unpinaman: no pin - the mail has its own row now */');
sub("the verification",
  '      B.verified = !!(after && after.folder === "inbox" && after.unread && after.pinned);',
  '      B.verified = !!(after && after.folder === "inbox" && after.unread);   /* __unpinaman: a pin is no longer part of being visible */');

/* 2. the unpin job */
const anchor = "/* __showaman:end */";
if (s.split(anchor).length !== 2) { console.error("STOP - __showaman:end not found exactly once"); process.exit(1); }

const L = [];
const p = (x) => L.push(x);
p('');
p('/* ---- 26 Nov 2026: take the pin back off   __unpinaman:start -------------------------- */');
p('const UNPIN_AMAN = { id: "unpin-aman-2026-11-26c",');
p('  rfc: "<01c401dd7cd5$139df460$3ad9dd20$@induskrafts.com>",');
p('  from_email: "aman@induskrafts.com",');
p('  sent_at: "2026-11-25T12:04:08Z",');
p('  want: [{ box: "teampulse@rugscreation.com", mid: "1a21297bd1d17233" },');
p('         { box: "shipping@rugscreation.com",  mid: "1a21297bc317a045" }] };');
p('async function unpinAman(j) {');
p('  const mark = "job_" + j.id;');
p('  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;');
p('  const out = { at: new Date().toISOString(), boxes: {}, unpinned: 0 };');
p('  try {');
p('    for (const w of j.want) {');
p('      const msg = await amanFind(j, w.box, w.mid);');
p('      if (!msg) { out.boxes[w.box] = "the mail is not in the database here"; continue; }');
p('      /* ONLY the pinned column. Nothing else is named, so no trigger can fire and the');
p('         folder, owner, status, read state and dates are all left exactly as they are. */');
p('      const r = await pool.query(');
p('        "update public.rm_threads set pinned = false, updated_at = now()" +');
p('        " where mailbox = $1 and gmail_thread_id = $2 and pinned is true",');
p('        [w.box, msg.gmail_thread_id]);');
p('      out.boxes[w.box] = { thread: msg.gmail_thread_id, unpinned: r.rowCount };');
p('      out.unpinned += r.rowCount;');
p('      log("unpin aman", w.box.split("@")[0], "-", r.rowCount ? "pin removed" : "was not pinned");');
p('    }');
p('    out.summary = "pin removed from " + out.unpinned + " conversation(s) - the mail keeps its own row at 25 Nov 5:34 pm, and the Inbox opens on today again";');
p('    await put(pool, "undo_" + j.id, { at: new Date().toISOString(), note: "to undo: set pinned = true on the conversations listed in boxes", boxes: out.boxes });');
p('    await put(pool, mark, out);');
p('    log("one-time job", j.id, "- done:", out.summary);');
p('  } catch (e) {');
p('    log("one-time job", j.id, "FAILED:", e.message);');
p('  }');
p('}');
p('/* late enough that show-aman-mail-2026-11-26b has had its first go */');
p('if (process.env.ONETIME_OFF !== "1") setTimeout(() => unpinAman(UNPIN_AMAN).catch((e) => log("one-time job", UNPIN_AMAN.id, "error:", e.message)), 75000);');
p('/* __unpinaman:end */');
p('');

s = s.replace(anchor, anchor + "\n" + L.join("\n"));
fs.writeFileSync(file, s);
console.log("patch-unpin-aman: " + (n + 1) + " change(s) applied (" + L.length + " lines of job)");
