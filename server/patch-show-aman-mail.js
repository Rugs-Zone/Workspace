/* 26 Nov 2026 - force Aman Singh Verma's 25 Nov mail into the Team Pulse Inbox, and make the
   job itself incapable of the three faults that let the first attempt fail silently.

   THE FIRST JOB (fix-aman-mail-2026-11-26, shipped in server version 2026-11-26-e) had three
   weaknesses, all of which this one fixes:

   1. IT WAS ONE-SHOT ON PAPER ONLY. It wrote its "done" marker whether or not it had actually
      achieved anything - if the conversation was not in the database the moment it ran
      (11 seconds after the server restarted), it logged "nothing forced", marked itself
      complete and could NEVER run again. This job writes the marker only after it has READ
      BACK the row and confirmed the mail is stored and the conversation is in the Inbox,
      unread and pinned. Until then it keeps trying - every 2 minutes, 10 times, and again on
      the next restart - so a sync that is a few minutes behind no longer defeats it.

   2. IT FOUND THE MAIL BY ONE HARD-CODED THREAD ID. If Gmail had put the mail in a different
      conversation (it does that often here - our forwards go out with no threading headers,
      so the same correspondence is spread over 8 Gmail conversations) the job would have
      pinned the wrong row, or nothing. This job finds the mail by its RFC Message-Id
      (<01c401dd7cd5$...@induskrafts.com>), by its Gmail id, and failing both by sender and
      send time, then works on whatever conversation actually holds it.

   3. ITS CURSOR REWIND COULD LEAVE A MAILBOX BEHIND. To import a missing mail it winds the
      mailbox's sync cursor back to an hour before it, but it only restored the old value
      `if (was < to)` - so when the cursor had already moved PAST the mail (the normal case
      by now) it was wound back to 25 Nov and left there, starving every newer mail until the
      day-by-day walk caught up again. This job always restores the cursor to the LATER of
      where it was and where it has reached, so it can never move a mailbox backwards.

   Run:  node server/patch-show-aman-mail.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__showaman")) { console.log("already there - nothing changed"); process.exit(0); }
const anchor = "/* __amanfix:end */";
if (s.split(anchor).length !== 2) { console.error("STOP - the __amanfix:end marker was not found exactly once"); process.exit(1); }

const L = [];
const p = (x) => L.push(x);

p('');
p('/* ---- 26 Nov 2026: Aman\'s mail, done so it cannot fail quietly   __showaman:start ------- */');
p('const SHOW_AMAN = {');
p('  id: "show-aman-mail-2026-11-26b",');
p('  rfc: "<01c401dd7cd5$139df460$3ad9dd20$@induskrafts.com>",');
p('  from_email: "aman@induskrafts.com",');
p('  sent_at: "2026-11-25T12:04:08Z",');
p('  want: [{ box: "teampulse@rugscreation.com", mid: "1a21297bd1d17233" },');
p('         { box: "shipping@rugscreation.com",  mid: "1a21297bc317a045" }],');
p('  must: ["teampulse@rugscreation.com"],      /* the Team Pulse Inbox is what was asked for */');
p('  tries: 10, gap_ms: 120000');
p('};');
p('/* find the mail itself - by Message-Id, by Gmail id, or by sender and send time */');
p('async function amanFind(j, box, mid) {');
p('  const r = await pool.query(');
p('    "select mailbox, gmail_id, gmail_thread_id, sent_at, from_name, from_email, left(subject,90) subject" +');
p('    "  from public.rm_messages" +');
p('    " where mailbox = $1" +');
p('    "   and (gmail_id = $2 or rfc_message_id = $3" +');
p('    "        or (lower(from_email) = $4" +');
p('    "            and sent_at between $5::timestamptz - interval \'5 minutes\'" +');
p('    "                            and $5::timestamptz + interval \'5 minutes\'))" +');
p('    " order by sent_at desc limit 1", [box, mid, j.rfc, j.from_email, j.sent_at]);');
p('  return r.rows[0] || null;');
p('}');
p('async function amanThread(box, tid) {');
p('  const t = (await pool.query(');
p('    "select left(subject,90) subject, coalesce(folder,\'inbox\') folder," +');
p('    "       coalesce(status,\'new\') status, owner_id, unread, pinned, msg_count," +');
p('    "       last_msg_at, done_at, prev_folder, coalesce(cats,\'[]\'::jsonb) cats," +');
p('    "       (coalesce(cats,\'[]\'::jsonb) ? \'ignored\') ignored," +');
p('    "       (select u.name from public.rm_users u where u.id = owner_id) owner_name" +');
p('    "  from public.rm_threads where mailbox = $1 and gmail_thread_id = $2", [box, tid])).rows[0] || null;');
p('  if (!t) return null;');
p('  const n = (await pool.query(');
p('    "select count(*)::int n, max(sent_at) newest," +');
p('    "       (select coalesce(nullif(from_name,\'\'), from_email) from public.rm_messages z" +');
p('    "         where z.mailbox = $1 and z.gmail_thread_id = $2 order by sent_at desc limit 1) newest_from" +');
p('    "  from public.rm_messages where mailbox = $1 and gmail_thread_id = $2", [box, tid])).rows[0];');
p('  t.stored_messages = n.n; t.newest_stored = n.newest; t.row_is_named_after = n.newest_from;');
p('  return t;');
p('}');
p('/* wind the sync back so the server\'s own sync re-reads that window, then always put the');
p('   cursor back to the LATER of where it was and where it has got to - never backwards. */');
p('async function amanImport(j, box) {');
p('  const mb = (await pool.query("select cursor_s from public.rm_mailboxes where mailbox = $1", [box])).rows[0];');
p('  const was = mb && mb.cursor_s ? String(mb.cursor_s) : null;');
p('  const to = String(Math.floor(Date.parse(j.sent_at) / 1000) - 3600);');
p('  await pool.query("update public.rm_mailboxes set cursor_s = $2, status = \'backfilling\', note = $3 where mailbox = $1",');
p('    [box, to, "re-reading 25 Nov for one missing mail (" + j.id + ")"]);');
p('  log("aman", box.split("@")[0], "- the mail is not stored; the sync has been pointed at 25 Nov to fetch it");');
p('  return { was: was, to: to };');
p('}');
p('async function amanCursorBack(j, box, c) {');
p('  if (!c || !c.was) return;');
p('  const now = (await pool.query("select cursor_s from public.rm_mailboxes where mailbox = $1", [box])).rows[0];');
p('  const here = now && now.cursor_s ? Number(now.cursor_s) : 0;');
p('  const keep = Math.max(Number(c.was), here);');
p('  if (keep > here) {');
p('    await pool.query("update public.rm_mailboxes set cursor_s = $2, note = $3 where mailbox = $1",');
p('      [box, String(keep), "catch-up resumed where it was before " + j.id]);');
p('    log("aman", box.split("@")[0], "- sync cursor put back to where it had reached (never moved backwards)");');
p('  }');
p('}');
p('async function amanShow(j, attempt) {');
p('  const mark = "job_" + j.id, rep = "report_" + j.id, undo = "undo_" + j.id;');
p('  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return true;');
p('  const out = { at: new Date().toISOString(), attempt: attempt, boxes: {} };');
p('  let allOk = true;');
p('  for (const w of j.want) {');
p('    const nm = w.box.split("@")[0];');
p('    const B = out.boxes[w.box] = {};');
p('    try {');
p('      let msg = await amanFind(j, w.box, w.mid);');
p('      B.was_in_db = !!msg;');
p('      /* import it only if it really is not there */');
p('      if (!msg) {');
p('        const c = await amanImport(j, w.box);');
p('        for (let i = 0; i < 6 && !msg; i++) {');
p('          await new Promise((r) => setTimeout(r, 20000));');
p('          msg = await amanFind(j, w.box, w.mid);');
p('          log("aman", nm, "- waiting for the sync, check", (i + 1) + " of 6:", msg ? "it has arrived" : "not yet");');
p('        }');
p('        await amanCursorBack(j, w.box, c);');
p('        B.imported = !!msg;');
p('      }');
p('      if (!msg) { B.result = "the mail is still not in the database"; if (j.must.includes(w.box)) allOk = false; continue; }');
p('      B.thread_id = msg.gmail_thread_id;');
p('      const before = await amanThread(w.box, msg.gmail_thread_id);');
p('      B.before = before;');
p('      if (!before) { B.result = "the mail is stored but its conversation row is not - the sync will build it"; if (j.must.includes(w.box)) allOk = false; continue; }');
p('      const ownerWas = before.owner_id;');
p('      const newest = before.newest_stored && Date.parse(before.newest_stored) > Date.parse(j.sent_at) ? before.newest_stored : j.sent_at;');
p('      /* a) "ignored" off FIRST - this update does not raise last_msg_at, so rm_ignore_trg');
p('            cannot act; left on, correcting the date below would send it to Deleted. */');
p('      if (before.ignored) {');
p('        await pool.query("update public.rm_threads set cats = coalesce(cats,\'[]\'::jsonb) - \'ignored\' where mailbox=$1 and gmail_thread_id=$2", [w.box, msg.gmail_thread_id]);');
p('        B.was_ignored = true;');
p('      }');
p('      /* b) the date on its own, and only while the row is still out of the Inbox and closed,');
p('            so rm_assign_now\'s condition is false and no auto-assign rule can fire. */');
p('      B.date_fixed = Date.parse(before.last_msg_at || 0) < Date.parse(newest);');
p('      if (B.date_fixed) await pool.query("update public.rm_threads set last_msg_at = $3::timestamptz where mailbox=$1 and gmail_thread_id=$2", [w.box, msg.gmail_thread_id, newest]);');
p('      /* c) into view. No last_msg_at and no to_addrs here, so neither trigger fires. */');
p('      await pool.query(');
p('        "update public.rm_threads" +');
p('        "   set folder = \'inbox\', unread = true, pinned = true," +');
p('        "       status = case when coalesce(status,\'new\') = \'done\' then (case when owner_id is null then \'new\' else \'open\' end) else coalesce(status,\'new\') end," +');
p('        "       done_at = case when coalesce(status,\'new\') = \'done\' then null else done_at end," +');
p('        "       prev_folder = null, updated_at = now()" +');
p('        " where mailbox = $1 and gmail_thread_id = $2", [w.box, msg.gmail_thread_id]);');
p('      /* d) THE OWNER IS UNCHANGED. If anything took it, put it straight back. */');
p('      const o2 = (await pool.query("select owner_id from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [w.box, msg.gmail_thread_id])).rows[0];');
p('      if (o2 && o2.owner_id !== ownerWas) {');
p('        await pool.query("update public.rm_threads set owner_id = $3 where mailbox=$1 and gmail_thread_id=$2", [w.box, msg.gmail_thread_id, ownerWas]);');
p('        B.owner_put_back = true;');
p('      }');
p('      /* e) READ IT BACK - this, not the update, is what decides success */');
p('      const after = await amanThread(w.box, msg.gmail_thread_id);');
p('      B.after = after;');
p('      B.verified = !!(after && after.folder === "inbox" && after.unread && after.pinned);');
p('      B.result = B.verified ? "in the Inbox, unread, pinned to the top" : "the update did not stick";');
p('      if (!B.verified && j.must.includes(w.box)) allOk = false;');
p('      if (B.verified) {');
p('        await pool.query(');
p('          "insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at)" +');
p('          " values ($1,$2,null,\'n\',$3,now())",');
p('          [w.box, msg.gmail_thread_id, "Put back in the Inbox, marked unread and pinned to the top by the system (" + j.id +');
p('           "). The mail from " + j.from_email + " of 25 Nov 17:34 IST is in this conversation. The owner, the folder history and the mail itself were not changed."]);');
p('      }');
p('      log("aman", nm, "-", B.result, "| conversation", msg.gmail_thread_id, "| the row is named after", (after && after.row_is_named_after) || "?");');
p('    } catch (e) {');
p('      B.result = "FAILED: " + String(e.message || e).slice(0, 180);');
p('      if (j.must.includes(w.box)) allOk = false;');
p('      log("aman", nm, "- FAILED:", String(e.message || e).slice(0, 180));');
p('    }');
p('  }');
p('  const tp = out.boxes["teampulse@rugscreation.com"] || {};');
p('  out.was_in_gmail = "yes - teampulse@ message 1a21297bd1d17233 and shipping@ message 1a21297bc317a045, both labelled INBOX, read from Gmail with the service account";');
p('  out.was_in_db = tp.was_in_db ? "yes - it was already stored" : (tp.imported ? "no - this job imported it from Gmail" : "no - and it had not arrived yet when this job ran");');
p('  out.why_hidden = "no rule hid it. The list shows ONE row per conversation, named after the NEWEST mail, and Manfred Mui wrote in the same conversation at 20:21 IST after Aman\'s 17:34 - so the row read \\"Manfred Mui, 8:21 pm\\" and there was no row called Aman Singh Verma anywhere. Ashok had already replied in it at 18:42 from Rugs Email, which proves it was in the database and open to him.";');
p('  out.summary = (allOk ? "DONE - " : "NOT DONE YET (attempt " + attempt + ") - ") + out.was_in_db +');
p('    "; Team Pulse: " + (tp.result || "not reached") + ". The row now names the conversation\'s people, so Aman Singh Verma is on it.";');
p('  await put(pool, rep, out);');
p('  if (allOk) {');
p('    await put(pool, undo, { at: new Date().toISOString(),');
p('      note: "to undo: put folder / unread / pinned / status / done_at / last_msg_at back from each box\'s \'before\'",');
p('      boxes: out.boxes });');
p('    await put(pool, mark, out);');
p('    log("one-time job", j.id, "- done:", out.summary);');
p('  } else {');
p('    log("one-time job", j.id, "- not done yet, will try again:", out.summary);');
p('  }');
p('  return allOk;');
p('}');
p('if (process.env.ONETIME_OFF !== "1") {');
p('  let left = SHOW_AMAN.tries;');
p('  const go = () => amanShow(SHOW_AMAN, SHOW_AMAN.tries - left + 1)');
p('    .then((ok) => { if (!ok && --left > 0) setTimeout(go, SHOW_AMAN.gap_ms); })');
p('    .catch((e) => { log("one-time job", SHOW_AMAN.id, "error:", e.message); if (--left > 0) setTimeout(go, SHOW_AMAN.gap_ms); });');
p('  setTimeout(go, 14000);');
p('}');
p('/* __showaman:end */');
p('');

s = s.replace(anchor, anchor + "\n" + L.join("\n"));
fs.writeFileSync(file, s);
console.log("patch-show-aman-mail: job added to server.mjs (" + L.length + " lines)");
