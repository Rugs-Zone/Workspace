/* 25 Nov 2026 - one-time job "restore-inbox-after-reply-2026-11-25".

   WHAT WAS CHECKED FIRST, and it matters, because it changes what this job is for:

     * NOTHING in the app or the server writes a folder when you reply. `sendReply`
       touches the owner and the status only (email.html:1355), and the server's `send`
       sets owner + status only for a brand-new mail. There is no `folder = 'sent'`
       anywhere, and on 23 Nov a sweep of the whole database found not one conversation
       with that folder.
     * Proved with the app's own rules on the real shapes of "Geo Chenille Cushion":
       after Nikhil's reply the conversation is STILL in the Inbox for the manager, for
       Nikhil and for the admin, and it shows in Sent as well; when the buyer answers it
       comes back unread at the top of the Inbox with its status open. So the behaviour
       asked for in steps 2 and 3 is already what the app does.

   So this job is a safety net rather than a repair: it finds any conversation that HAS
   received mail but has somehow ended up outside the Inbox in a folder that is not one
   anybody chose - that is, not inbox / archive / junk / deleted / purged and not one of
   the personal folders people make - and puts it back in the Inbox. On the data as it
   stands that should be none, and the dry run says so in plain numbers.

   Deliberately left alone: Archive, Junk, Deleted, purged, every personal folder, and
   any conversation that holds only mail we sent. It writes `folder` and nothing else -
   read state, owner, topic, status, Done, done_at and last_msg_at are not in the UPDATE.

   Before changing anything it takes a backup with backup.mjs (only if there is actually
   something to change - a 1.2 GB dump for zero rows would be silly), writes every old
   value into rm_settings for an exact rollback, and records one rm_activity line per
   conversation so the set can be found and undone later.

   Run:  node server/patch-restore-inbox-job.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__restoreinbox:start")) { console.log("already there - nothing changed"); process.exit(0); }

const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");

const L = [
  "/* ---- 25 Nov 2026: put a received conversation back in the Inbox   __restoreinbox:start ---- */",
  "const RESTORE_IN = { id: \"restore-inbox-after-reply-2026-11-25\", max: 5000,",
  "  keep: [\"inbox\", \"archive\", \"junk\", \"deleted\", \"purged\"] };",
  "/* a conversation that received mail but sits in a folder nobody chose. Personal folders are",
  "   whatever people have made, so they are read out of rm_users.prefs and never touched. */",
  "const RESTORE_SQL = `with mine as (",
  "    select distinct f from (",
  "      select jsonb_array_elements_text(coalesce(u.prefs->'folders','[]'::jsonb)) f from public.rm_users u) x",
  "    where f is not null and f <> '')",
  "  select t.mailbox, t.gmail_thread_id, t.folder, left(t.subject,70) subject, t.status, t.owner_id, t.unread, t.last_msg_at",
  "    from public.rm_threads t",
  "   where coalesce(t.folder,'inbox') <> all($1::text[])",
  "     and coalesce(t.folder,'inbox') not in (select f from mine)",
  "     and exists (select 1 from public.rm_messages m",
  "                  where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id",
  "                    and (m.direction = 'in'",
  "                         or (m.sent_by is null and lower(coalesce(m.from_email,'')) <> lower(t.mailbox))))",
  "   order by t.mailbox, t.last_msg_at desc`;",
  "async function restoreInboxJob(j) {",
  "  const mark = \"job_\" + j.id, undo = \"undo_\" + j.id;",
  "  if ((await pool.query(\"select 1 from public.rm_settings where key = $1\", [mark])).rowCount) return;",
  "  const c = await pool.connect();",
  "  try {",
  "    await c.query(\"set lock_timeout = '5s'\");",
  "    await c.query(\"set statement_timeout = '300s'\");",
  "    /* ---- the dry run ---- */",
  "    const rows = (await c.query(RESTORE_SQL, [j.keep])).rows;",
  "    const per = {};",
  "    rows.forEach((r) => { per[r.mailbox] = (per[r.mailbox] || 0) + 1; });",
  "    log(\"dry run\", j.id, \"-\", rows.length, \"conversation(s) have received mail but sit outside the Inbox\",",
  "      rows.length ? \"(\" + Object.keys(per).map((k) => k.split(\"@\")[0] + \" \" + per[k]).join(\", \") + \")\" : \"- nothing to put back\");",
  "    rows.slice(0, 10).forEach((r) => log(\"   would restore:\", String(r.mailbox).split(\"@\")[0], \"| folder\", r.folder,",
  "      \"|\", String(r.subject || \"\").slice(0, 60)));",
  "    if (!rows.length) {",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false, restored: 0,",
  "        summary: \"nothing to do - no conversation with received mail is sitting outside the Inbox, which is what the checks predicted (a reply never moves a conversation; it only sets the owner)\" });",
  "      return;",
  "    }",
  "    if (rows.length > j.max) {",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false,",
  "        summary: \"NOT run - \" + rows.length + \" is more than the \" + j.max + \" this job was written for; nothing was changed\", per_mailbox: per });",
  "      return log(\"one-time job\", j.id, \"- NOT run:\", rows.length, \"is more than\", j.max);",
  "    }",
  "    /* ---- a backup first, since this one really is going to change rows ---- */",
  "    let backup = \"not taken\";",
  "    try {",
  "      const bf = path.join(here, \"backup.mjs\");",
  "      if (fs.existsSync(bf)) {",
  "        const { spawnSync } = await import(\"node:child_process\");",
  "        const r = spawnSync(process.execPath, [bf], { encoding: \"utf8\", timeout: 20 * 60000 });",
  "        backup = r.status === 0 ? \"taken with backup.mjs\" : \"backup.mjs failed: \" + String(r.stderr || \"\").slice(0, 160);",
  "      } else backup = \"backup.mjs is not on this server yet\";",
  "    } catch (e) { backup = \"backup could not run: \" + e.message; }",
  "    log(\"one-time job\", j.id, \"- backup:\", backup);",
  "    /* ---- apply ---- */",
  "    await c.query(\"begin\");",
  "    await put(c, undo, { at: new Date().toISOString(), note: \"the folder each conversation had before\",",
  "      rows: rows.map((r) => ({ mailbox: r.mailbox, id: r.gmail_thread_id, was: r.folder })) });",
  "    let n = 0;",
  "    for (const r of rows) {",
  "      n += (await c.query(\"update public.rm_threads set folder = 'inbox' where mailbox = $1 and gmail_thread_id = $2\",",
  "        [r.mailbox, r.gmail_thread_id])).rowCount;",
  "    }",
  "    await c.query(",
  "      `insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at)",
  "       select x.mailbox, x.id, null, 'n', $2, now() from jsonb_to_recordset($1::jsonb) as x(mailbox text, id text, was text)`,",
  "      [JSON.stringify(rows.map((r) => ({ mailbox: r.mailbox, id: r.gmail_thread_id, was: r.folder }))),",
  "       \"Put back in the Inbox by the system (\" + j.id + \") - it has mail somebody sent us. Read state, owner, topic, Done and the mail itself were not touched.\"]);",
  "    await put(c, mark, { at: new Date().toISOString(), ran: true, restored: n, per_mailbox: per, backup: backup,",
  "      undo_key: undo, samples: rows.slice(0, 10).map((r) => ({ mailbox: r.mailbox, was: r.folder, subject: r.subject })),",
  "      summary: \"put \" + n + \" conversation(s) back in the Inbox (\" + Object.keys(per).map((k) => k.split(\"@\")[0] + \" \" + per[k]).join(\", \") + \"); folder only - read state, owner, topic, Done and last-message time untouched; backup: \" + backup });",
  "    await c.query(\"commit\");",
  "    log(\"one-time job\", j.id, \"- done:\", n, \"put back in the Inbox\");",
  "  } catch (e) {",
  "    try { await c.query(\"rollback\"); } catch {}",
  "    log(\"one-time job\", j.id, \"FAILED, nothing was changed:\", e.message);",
  "  } finally { c.release(); }",
  "}",
  "if (process.env.ONETIME_OFF !== \"1\") setTimeout(() => restoreInboxJob(RESTORE_IN).catch((e) => log(\"one-time job\", RESTORE_IN.id, \"error:\", e.message)), 29000);",
  "/* __restoreinbox:end */",
  ""
];

const eol = s.includes("\r\n") ? "\r\n" : "\n";
s = s.replace(anchor, L.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("added the one-time job restore-inbox-after-reply-2026-11-25 to server/local-server/server.mjs");
