/* patch-onetime-ashish-sent.js - 28 Nov 2026
 *
 * The office-server half of "check and fix Ashish Deshwal's Sent folder". A one-time job that
 * runs ONCE on the live database (it writes itself down in rm_settings and never runs again),
 * in ONE transaction, saving the old values first so it can be put back exactly.
 *
 * It REPORTS (steps 1-3 of the brief, named columns and a LIMIT everywhere, never select *):
 *   - his first login:  min(created_at) from rm_sessions where user_id = 'umvkv0zd039'
 *     (that column is checked in information_schema first; if the database does not have it,
 *      min(expires_at) - 8 hours is used, which is how long a session lasts)
 *   - every mail he sent from that day to now - sent_by = him OR from_email = his login - in
 *     ANY mailbox, counted per mailbox, with how many are not direction='out' and how many
 *     have no sent_by at all
 *   - his mail to Robin: to_text / cc_text ilike '%robin%', with the subject of its conversation
 *
 * It FIXES (step 4), narrowly:
 *   - direction is not 'out'  ->  direction='out', sent_by='umvkv0zd039'
 *   - a conversation holding his outgoing mail with has_out false  ->  has_out=true
 *   It refuses to run if it finds more than 2,000 of either, because then the data is not what
 *   this job was written for.
 *
 * It deliberately does NOT mass-write sent_by on the mails that are already direction='out'.
 * Measured first: there are 261 of those and all of them show correctly once the app's rule is
 * fixed (build 2026-11-28-3, server/patch-sent-by-login.js). Writing sent_by on them would make
 * colleagueIn() false for each one, which is the flag that keeps a colleague's mail in the TEAM
 * INBOX - so a careless repair there could empty work out of Team Pulse's Inbox. The report says
 * how many there are instead.
 *
 * Tables touched: rm_messages (direction, sent_by), rm_threads (has_out, updated_at),
 * rm_activity (one line per repaired conversation), rm_settings (the mark, the undo, the report).
 * NOTHING else - and never deleg_private_details, deleg_google_tokens, dev_secrets or pass_hash.
 *
 * Run:  node server/patch-onetime-ashish-sent.js      (then version.txt is bumped by hand)
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "local-server", "server.mjs");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__ashsent")) { console.log("already applied - nothing to do"); process.exit(0); }

const ANCHOR = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start";
if (s.indexOf(ANCHOR) < 0) throw new Error("the anchor in server.mjs was not found");

const BLOCK = `/* ---- 28 Nov 2026: Ashish Deshwal's Sent folder   __ashsent:start -------------------
   Reported: "his Sent folder does not show the mail he sent". Measured on this database before
   this job was written: 262 messages whose from_email is his own login, 261 already out, sent_by
   NULL on all of them (he writes in Gmail, not in Rugs Email). The app's rule was the fault and
   is fixed in build 2026-11-28-3. This job reports the numbers from the database itself and
   repairs the two things that are data, not rule: a message that is not marked 'out', and a
   conversation whose has_out flag is stale. Once, in one transaction, with an undo. */
const ASH = {
  id: "ashish-sent-2026-11-28",
  user: "umvkv0zd039",
  login: "merchandiser9@rugscreation.com",
  max: 2000
};
async function ashishSentJob(j) {
  const mark = "job_" + j.id, undo = "undo_" + j.id, rep = "report_" + j.id;
  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;
  const c = await pool.connect();
  try {
    await c.query("set lock_timeout = '5s'");
    await c.query("set statement_timeout = '240s'");
    await c.query("begin");

    /* ---- 1 · his first login ---- */
    const hasCreated = (await c.query(
      "select 1 from information_schema.columns where table_schema='public' and table_name='rm_sessions' and column_name='created_at'")).rowCount > 0;
    const firstQ = hasCreated
      ? "select min(created_at) first_login, count(*)::int sessions from public.rm_sessions where user_id = $1"
      : "select min(expires_at) - interval '8 hours' first_login, count(*)::int sessions from public.rm_sessions where user_id = $1";
    const f0 = (await c.query(firstQ, [j.user])).rows[0];
    /* a session row is deleted when it ends, so the oldest one still here is a floor, not a
       certainty. His own mail is older than that, so the counts below use the EARLIER of the
       two: the first login we can still see, and his oldest mail in the database. */
    const m0 = (await c.query(
      "select min(sent_at) first_mail from public.rm_messages where sent_by = $1 or lower(from_email) = $2",
      [j.user, j.login])).rows[0];
    const since = [f0 && f0.first_login, m0 && m0.first_mail].filter(Boolean).sort()[0] || new Date(0).toISOString();

    /* ---- 2 · everything he sent, per mailbox ---- */
    const per = (await c.query(
      \`select mailbox,
              count(*)::int n,
              count(*) filter (where direction <> 'out')::int not_out,
              count(*) filter (where sent_by is null)::int no_sender,
              min(sent_at) oldest, max(sent_at) newest
         from public.rm_messages
        where (sent_by = $1 or lower(from_email) = $2)
          and sent_at >= $3
        group by mailbox
        order by n desc
        limit 50\`, [j.user, j.login, since])).rows;
    const total = per.reduce((a, r) => a + r.n, 0);
    const notOutN = per.reduce((a, r) => a + r.not_out, 0);
    const noSender = per.reduce((a, r) => a + r.no_sender, 0);

    /* ---- 3 · his mail to Robin ---- */
    const robin = (await c.query(
      \`select m.mailbox, m.gmail_thread_id, m.gmail_id, m.sent_at, m.direction, m.sent_by,
              left(coalesce(m.to_text,''),160) to_text, left(coalesce(m.cc_text,''),120) cc_text,
              left(coalesce(t.subject,''),90) subject, coalesce(t.folder,'inbox') folder, t.has_out
         from public.rm_messages m
         left join public.rm_threads t on t.mailbox = m.mailbox and t.gmail_thread_id = m.gmail_thread_id
        where (m.sent_by = $1 or lower(m.from_email) = $2)
          and (coalesce(m.to_text,'') ilike '%robin%' or coalesce(m.cc_text,'') ilike '%robin%')
        order by m.sent_at desc
        limit 50\`, [j.user, j.login])).rows;

    /* ---- 4a · messages of his that are not marked 'out' ---- */
    const bad = (await c.query(
      \`select mailbox, gmail_id, gmail_thread_id, direction, sent_by, sent_at
         from public.rm_messages
        where lower(from_email) = $1 and direction <> 'out'
        order by sent_at
        limit 2001\`, [j.login])).rows;
    /* ---- 4b · his conversations whose has_out is stale ---- */
    const stale = (await c.query(
      \`select t.mailbox, t.gmail_thread_id, t.has_out, left(coalesce(t.subject,''),90) subject
         from public.rm_threads t
        where coalesce(t.has_out, false) = false
          and exists (select 1 from public.rm_messages m
                       where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id
                         and m.direction = 'out'
                         and (m.sent_by = $1 or lower(m.from_email) = $2))
        order by t.last_msg_at desc nulls last
        limit 2001\`, [j.user, j.login])).rows;

    if (bad.length > j.max || stale.length > j.max) {
      await c.query("rollback");
      return log("one-time job", j.id, "- NOT run:", bad.length, "messages and", stale.length,
        "conversations found, more than this job was written for (" + j.max + "); nothing was changed");
    }

    await put(c, undo, {
      at: new Date().toISOString(),
      note: "to put it back: set direction and sent_by on each row of messages, and has_out on each row of threads",
      messages: bad.map((r) => ({ mailbox: r.mailbox, gmail_id: r.gmail_id, direction: r.direction, sent_by: r.sent_by })),
      threads: stale.map((r) => ({ mailbox: r.mailbox, gmail_thread_id: r.gmail_thread_id, has_out: r.has_out }))
    });

    let fixedMsgs = 0, fixedThreads = 0;
    for (const r of bad) {
      fixedMsgs += (await c.query(
        "update public.rm_messages set direction = 'out', sent_by = $3 where mailbox = $1 and gmail_id = $2",
        [r.mailbox, r.gmail_id, j.user])).rowCount;
    }
    for (const r of stale) {
      fixedThreads += (await c.query(
        "update public.rm_threads set has_out = true, updated_at = now() where mailbox = $1 and gmail_thread_id = $2",
        [r.mailbox, r.gmail_thread_id])).rowCount;
      await c.query(
        "insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at) values ($1, $2, null, 'fix', 'Sent flag rebuilt: this conversation holds mail we sent', now())",
        [r.mailbox, r.gmail_thread_id]);
    }

    const summary = "Ashish Deshwal's sent mail: " + total + " mails since " + String(since).slice(0, 10)
      + " in " + per.length + " mailbox(es); " + notOutN + " were not marked out (" + fixedMsgs + " fixed), "
      + fixedThreads + " conversation(s) had a stale Sent flag (fixed), " + noSender
      + " have no sent_by (he writes them in Gmail - the app rule of build 2026-11-28-3 shows those in his Sent), "
      + robin.length + " mail(s) to/cc Robin found";
    const report = {
      at: new Date().toISOString(),
      first_login_seen: f0 ? f0.first_login : null,
      sessions_still_on_record: f0 ? f0.sessions : 0,
      first_mail_in_database: m0 ? m0.first_mail : null,
      counted_since: since,
      total_sent: total,
      per_mailbox: per.map((r) => ({ mailbox: r.mailbox, sent: r.n, not_out: r.not_out, no_sent_by: r.no_sender, oldest: r.oldest, newest: r.newest })),
      not_out_found: notOutN, messages_fixed: fixedMsgs,
      stale_has_out_found: stale.length, threads_fixed: fixedThreads,
      no_sent_by: noSender,
      robin: robin.map((r) => ({ mailbox: r.mailbox, thread: r.gmail_thread_id, at: r.sent_at, direction: r.direction, sent_by: r.sent_by, subject: r.subject, folder: r.folder, has_out: r.has_out, to: r.to_text, cc: r.cc_text })),
      summary: summary, undo_key: undo
    };
    await put(c, rep, report);
    await put(c, mark, { at: new Date().toISOString(), summary: summary, report_key: rep, undo_key: undo });
    await c.query("commit");
    log("one-time job", j.id, "- done:", summary);
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    log("one-time job", j.id, "FAILED, nothing was changed:", e.message);
  } finally { c.release(); }
}
if (process.env.ONETIME_OFF !== "1") setTimeout(() => ashishSentJob(ASH).catch((e) => log("one-time job", ASH.id, "error:", e.message)), 95000);
/* __ashsent:end */

`;

s = s.replace(ANCHOR, BLOCK + ANCHOR);
fs.writeFileSync(F, s);
console.log("ok  the one-time job was added to server/local-server/server.mjs");
