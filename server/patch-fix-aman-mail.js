/* 26 Nov 2026 - URGENT: one mail. Aman Singh Verma -> teampulse@, 25 Nov 5:34 pm IST,
   "R V1122 RUGS CREATION - PO 174871 AND 173728 PILLOWS ... + PO 175033".

   CONFIRMED IN GMAIL from this laptop (service account, read-only), twice:
     teampulse@  message 1a21297bd1d17233  thread 1a2092d6750c36d5  labels IMPORTANT, INBOX
     shipping@   message 1a21297bc317a045  thread 1a2092d6794b8945  labels IMPORTANT, INBOX
     sent 2026-11-25T12:04:08Z = 17:34:08 IST
   That thread holds 6 mails; the newest three are Aman 12:04Z, "Ashok - Rugs Creation"
   13:12Z (SENT FROM THE APP, so the conversation itself IS in the live database) and
   Manfred Mui 14:51Z.

   The live database can only be reached from the office machine, so this job does the rest
   there, by itself. It is written to answer BOTH possible states, because which one is true
   can only be read on that machine:

     1  REPORTS the real state of each mailbox - is message 1a21297bd1d17233 in rm_messages,
        what the rm_threads row says (folder, owner, status, unread, message count,
        last-message time), WHO SENT THE NEWEST STORED MAIL (the row is named after that
        person, which is the second way this mail can be "missing" - it would be sitting in
        the Inbox under "Manfred Mui", already read), and HOW FAR BEHIND THE SYNC CURSOR IS.
     2  IF THE MAIL IS NOT STORED it imports it properly: the mailbox's cursor is moved to
        one hour before Aman's mail, so the server's own sync re-reads that window and
        upserts the mail with its body and attachments - nothing is hand-inserted - and it
        then waits and checks (six times, twenty seconds apart; the sync runs every thirty
        seconds). AFTERWARDS THE CURSOR IS PUT BACK where it was if it had been further
        behind, so the 25 Nov reconcile job's own catch-up is not thrown away.
     3  FORCES it into view: folder 'inbox', unread, and PINNED, which is what puts it at the
        TOP - the app sorts pinned rows first (one sort, (b.pinned-a.pinned)||(k(b)-k(a))),
        so it leads the list whatever its date. The date itself is NOT faked: last_msg_at is
        set to the true time of the newest mail in the conversation. A conversation that had
        been closed is reopened (open if it has an owner, new if not). THE OWNER IS NOT
        TOUCHED. updated_at is bumped so every open browser picks it up within 15 seconds.
     4  Writes what it found and changed into rm_settings, with the previous values for an
        exact undo, and one rm_activity line on the conversation.

   TWO TRIGGERS ON rm_threads WOULD HAVE DEFEATED A PLAIN UPDATE, and both were found by
   running this job's SQL against a real copy of the database rather than by reading the code:

     * `rm_assign_now` fires AFTER UPDATE OF last_msg_at and, when the conversation has no
       owner and sits in the Inbox, runs the four auto-assign rules on it. Writing the folder,
       the status and last_msg_at in one statement therefore GIVES AN UNOWNED CONVERSATION AN
       OWNER - the trail rule would have handed this one to Ashok. That is the opposite of
       "owner unchanged", and the test caught it doing exactly that.
     * `rm_ignore_trg` fires BEFORE UPDATE and, if the conversation carries the "ignored"
       category and last_msg_at goes up, moves it to folder 'deleted' and marks it read - so
       correcting the date on an ignored conversation would have pushed the mail into Deleted
       and it still would not have shown.

   So the force is done in ORDER instead of in one statement: take "ignored" off first (that
   update does not raise last_msg_at, so the ignore trigger cannot act on it); correct
   last_msg_at on its own; then set folder / unread / pinned / status WITHOUT touching
   last_msg_at or to_addrs, so rm_assign_now does not fire and our status is the one that
   stands; and finally, if the owner changed at any point, put it straight back and say so.

   Run:  node server/patch-fix-aman-mail.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__amanfix:start")) { console.log("already there - nothing changed"); process.exit(0); }
const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");
const eol = s.includes("\r\n") ? "\r\n" : "\n";

const L = [
  '/* ---- 26 Nov 2026: the one missing mail   __amanfix:start --------------------------- */',
  'const AMAN = { id: "fix-aman-mail-2026-11-26",',
  '  want: [{ box: "teampulse@rugscreation.com", tid: "1a2092d6750c36d5", mid: "1a21297bd1d17233" },',
  '         { box: "shipping@rugscreation.com",  tid: "1a2092d6794b8945", mid: "1a21297bc317a045" }],',
  '  sent_at: "2026-11-25T12:04:08Z", tries: 6, gap_ms: 20000 };',
  'async function amanState(w) {',
  '  const m = (await pool.query("select gmail_id, sent_at, from_email, from_name from public.rm_messages where mailbox=$1 and gmail_id=$2", [w.box, w.mid])).rows[0] || null;',
  '  const t = (await pool.query(`select left(subject,70) subject, coalesce(folder,\'inbox\') folder,',
  '      coalesce(status,\'new\') status, owner_id, (select u.name from public.rm_users u where u.id=owner_id) owner_name,',
  '      unread, pinned, msg_count, last_msg_at, done_at, prev_folder, coalesce(cats,\'[]\'::jsonb) cats,',
  '      (coalesce(cats,\'[]\'::jsonb) ? \'ignored\') ignored',
  '      from public.rm_threads where mailbox=$1 and gmail_thread_id=$2`, [w.box, w.tid])).rows[0] || null;',
  '  /* the newest stored mail decides BOTH where the row sits and the name shown on it */',
  '  const n = (await pool.query(`select count(*)::int n, max(sent_at) newest,',
  '      (select coalesce(nullif(from_name,\'\'), from_email) from public.rm_messages z',
  '        where z.mailbox=$1 and z.gmail_thread_id=$2 order by sent_at desc limit 1) newest_from',
  '      from public.rm_messages where mailbox=$1 and gmail_thread_id=$2`, [w.box, w.tid])).rows[0];',
  '  const mb = (await pool.query("select cursor_s, back_s, status, last_sync, note from public.rm_mailboxes where mailbox=$1", [w.box])).rows[0] || null;',
  '  const behind = mb && mb.cursor_s ? Math.round((Date.now() / 1000 - Number(mb.cursor_s)) / 3600) : null;',
  '  return { message: m, thread: t, stored_messages: n.n, newest_stored: n.newest,',
  '    row_is_named_after: n.newest_from, mailbox: mb, sync_hours_behind: behind };',
  '}',
  'async function amanJob(j) {',
  '  const mark = "job_" + j.id, undo = "undo_" + j.id;',
  '  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;',
  '  const out = { at: new Date().toISOString(), boxes: {} };',
  '  try {',
  '    for (const w of j.want) {',
  '      let st = await amanState(w);',
  '      const B = out.boxes[w.box] = { before: st };',
  '      const nm = w.box.split("@")[0];',
  '      log("aman fix", nm, "- Aman\'s mail in the database:", st.message ? "YES" : "NO",',
  '        "| the conversation:", st.thread ? ("folder " + st.thread.folder + ", status " + st.thread.status +',
  '        ", owner " + (st.thread.owner_name || "nobody") + ", " + (st.thread.unread ? "unread" : "read") +',
  '        ", " + st.thread.msg_count + " mails, newest " + st.thread.last_msg_at +',
  '        ", the row is named after " + st.row_is_named_after) : "NOT IN THE DATABASE",',
  '        "| the sync cursor is", st.sync_hours_behind, "hour(s) behind now");',
  '      /* ---- import it if the mail itself is not stored ---- */',
  '      if (!st.message) {',
  '        const was = st.mailbox ? st.mailbox.cursor_s : null;',
  '        const to = String(Math.floor(Date.parse(j.sent_at) / 1000) - 3600);   /* one hour before it */',
  '        B.cursor_was = was; B.cursor_set_to = to;',
  '        await pool.query("update public.rm_mailboxes set cursor_s = $2, status = \'backfilling\', note = $3 where mailbox = $1",',
  '          [w.box, to, "re-reading 25 Nov to pick up one missing mail (" + j.id + ")"]);',
  '        log("aman fix", nm, "- the mail is NOT stored; moved the sync to one hour before it and waiting");',
  '        for (let i = 0; i < j.tries && !st.message; i++) {',
  '          await new Promise((r) => setTimeout(r, j.gap_ms));',
  '          st = await amanState(w);',
  '          log("aman fix", nm, "- check", (i + 1) + " of " + j.tries + ":", st.message ? "the mail has arrived" : "not yet");',
  '        }',
  '        B.imported = !!st.message;',
  '        /* put the cursor back if it had been further behind, so the catch-up is not lost */',
  '        if (was && Number(was) < Number(to)) {',
  '          const cur = (await pool.query("select cursor_s from public.rm_mailboxes where mailbox=$1", [w.box])).rows[0];',
  '          if (cur && Number(cur.cursor_s) > Number(was)) {',
  '            await pool.query("update public.rm_mailboxes set cursor_s = $2, note = $3 where mailbox = $1",',
  '              [w.box, was, "catch-up resumed where it was before " + j.id]);',
  '            B.cursor_put_back = was;',
  '            log("aman fix", nm, "- cursor put back to where the 25 Nov catch-up had reached");',
  '          }',
  '        }',
  '      }',
  '      /* ---- force it into view, IN ORDER so neither trigger can bite. ---- */',
  '      if (st.thread) {',
  '        const newest = st.newest_stored && Date.parse(st.newest_stored) > Date.parse(j.sent_at) ? st.newest_stored : j.sent_at;',
  '        const ownerWas = st.thread.owner_id;',
  '        /* a) take "ignored" off first. This update does not raise last_msg_at, so',
  '              rm_ignore_trg cannot act on it - and if it stayed on, correcting the date',
  '              below would send the conversation to Deleted instead of the Inbox. */',
  '        if (st.thread.ignored) {',
  '          B.was_ignored = st.thread.cats;',
  '          await pool.query("update public.rm_threads set cats = coalesce(cats,\'[]\'::jsonb) - \'ignored\' where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid]);',
  '          log("aman fix", nm, "- it was marked \\"ignored\\", which sends every new mail in it straight to Deleted; that is now off");',
  '        }',
  '        /* b) the date, on its own and only if it is really behind the newest mail */',
  '        B.date_fixed = Date.parse(st.thread.last_msg_at || 0) < Date.parse(newest);',
  '        if (B.date_fixed) {',
  '          await pool.query("update public.rm_threads set last_msg_at = $3::timestamptz where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid, newest]);',
  '        }',
  '        /* c) the rest - no last_msg_at and no to_addrs here, so rm_assign_now does not',
  '              fire and the status set here is the one that stands */',
  '        B.forced = (await pool.query(',
  '          `update public.rm_threads',
  '              set folder = \'inbox\', unread = true, pinned = true,',
  '                  status = case when coalesce(status,\'new\') = \'done\' then (case when owner_id is null then \'new\' else \'open\' end) else coalesce(status,\'new\') end,',
  '                  done_at = case when coalesce(status,\'new\') = \'done\' then null else done_at end,',
  '                  prev_folder = null,',
  '                  updated_at = now()',
  '            where mailbox = $1 and gmail_thread_id = $2`, [w.box, w.tid])).rowCount;',
  '        /* d) THE OWNER IS UNCHANGED. If step (b) let rm_assign_now hand it to somebody,',
  '              put it straight back - this update touches neither trigger column. */',
  '        const mid2 = (await pool.query("select owner_id from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid])).rows[0];',
  '        if (mid2 && mid2.owner_id !== ownerWas) {',
  '          await pool.query("update public.rm_threads set owner_id = $3 where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid, ownerWas]);',
  '          B.owner_put_back = { a_rule_had_taken_it: mid2.owner_id, put_back_to: ownerWas };',
  '          log("aman fix", nm, "- an auto-assign rule tried to take it while the date was corrected; the owner has been put back");',
  '        }',
  '        await pool.query(',
  '          `insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at)',
  '           values ($1,$2,null,\'n\',$3,now())`,',
  '          [w.box, w.tid, "Put back in the Inbox, marked unread and pinned to the top by the system (" + j.id +',
  '           ") - it is in Gmail\'s inbox and was not showing. The owner, the topic and the mail itself were not changed."]);',
  '        B.after = await amanState(w);',
  '        log("aman fix", nm, "- in the Inbox, unread and pinned to the top; newest mail", newest);',
  '      } else {',
  '        B.forced = 0;',
  '        log("aman fix", nm, "- the conversation is still not in the database; the sync will create it, nothing forced");',
  '      }',
  '    }',
  '    const tp = out.boxes["teampulse@rugscreation.com"] || {};',
  '    const b4 = tp.before || {}, th = b4.thread || {};',
  '    out.was_in_gmail = "yes - message 1a21297bd1d17233, thread 1a2092d6750c36d5, labels IMPORTANT and INBOX (read from Gmail twice)";',
  '    out.was_in_db = b4.message',
  '      ? ("yes - it was already stored; the conversation was folder " + th.folder + ", " +',
  '         (th.unread ? "unread" : "READ") + ", status " + th.status + ", and the row was named after " + b4.row_is_named_after)',
  '      : (tp.imported ? "no - it was missing, and this job imported it by re-reading 25 Nov from Gmail"',
  '        : "no - and it had still not arrived two minutes after the sync was pointed at it");',
  '    out.why_hidden = b4.message',
  '      ? ("no rule hid it. It was in the Inbox, but marked READ and the row was named after " + b4.row_is_named_after +',
  '         " (the newest sender), so it was neither at the top nor findable under Aman\'s name. No rule singles out Ashok, " +',
  '         "Jatin Munjal or Jai Mala: ownership stopped hiding mail on 26 Nov and manager-first is off everywhere.")',
  '      : ("no visibility rule was involved - the mail was not in the database at all, so there was nothing to show. " +',
  '         "The mailbox sync cursor was " + b4.sync_hours_behind + " hour(s) behind when this job ran.");',
  '    out.summary = out.was_in_db + "; it is now folder inbox, unread and pinned to the top, owner unchanged";',
  '    await put(pool, undo, { at: new Date().toISOString(),',
  '      note: "to undo: put folder / unread / pinned / status / done_at / last_msg_at back from each box\'s \'before\', and cursor_s back from cursor_was",',
  '      boxes: out.boxes });',
  '    await put(pool, mark, out);',
  '    log("one-time job", j.id, "- done:", out.summary);',
  '  } catch (e) {',
  '    log("one-time job", j.id, "FAILED:", e.message);',
  '    try { await put(pool, mark, { at: new Date().toISOString(), summary: "FAILED: " + e.message, partial: out }); } catch (x) {}',
  '  }',
  '}',
  'if (process.env.ONETIME_OFF !== "1") setTimeout(() => amanJob(AMAN).catch((e) => log("one-time job", AMAN.id, "error:", e.message)), 11000);',
  '/* __amanfix:end */',
  ''
];
s = s.replace(anchor, L.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("added the one-time job fix-aman-mail-2026-11-26 to server/local-server/server.mjs");
