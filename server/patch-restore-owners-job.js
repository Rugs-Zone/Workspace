/* 26 Nov 2026 - one-time job "restore-owners-2026-11-26".

   HOW A WRONGLY CHANGED OWNER IS RECOGNISED. Every legitimate owner change writes a line in
   rm_activity:

       a person   kind 'a'       "Assigned to <name> by <who>"  /  "Taken by <name>"
       a rule     kind 'assign'  "Auto-assigned to <name> - ... (alias rule)"

   The app's auto-take on reply wrote NOTHING. So a conversation whose current owner is not
   the person named in its own last owner line - with no later line - changed hands with no
   record, and that is the fingerprint of the bug. This job finds exactly those and puts the
   recorded owner back.

   It is careful on purpose:
     * only conversations touched since 16 Nov (when the auto-take went in);
     * only when the name in the last owner line maps to EXACTLY ONE active user, so an
       ambiguous name is reported and left alone;
     * it writes `owner_id` and nothing else - read state, status, Done, done_at, topic,
       folder and every date are not in the UPDATE;
     * the dry run reports the count per mailbox and ten samples before anything is written;
     * backup.mjs runs first, but only if there is something to change;
     * every previous owner is written to rm_settings AND one rm_activity line per
       conversation, so the whole set can be found and undone.

   Run:  node server/patch-restore-owners-job.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__restoreowners:start")) { console.log("already there - nothing changed"); process.exit(0); }
const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");
const eol = s.includes("\r\n") ? "\r\n" : "\n";

const L = [
  "/* ---- 26 Nov 2026: put back owners that changed with no record   __restoreowners:start ---- */",
  "const RESTORE_OWN = { id: \"restore-owners-2026-11-26\", since: \"2026-11-16\", max: 5000 };",
  "/* the last line that RECORDS an owner for each conversation, and who it named */",
  "const OWN_SQL = `with last_rec as (",
  "    select distinct on (a.mailbox, a.gmail_thread_id)",
  "           a.mailbox, a.gmail_thread_id, a.text, a.at, a.kind",
  "      from public.rm_activity a",
  "     where a.at >= $1::date",
  "       and (a.text ilike 'Assigned to % by %' or a.text ilike 'Taken by %')   /* a PERSON's choice only */",
  "     order by a.mailbox, a.gmail_thread_id, a.at desc)",
  "  select t.mailbox, t.gmail_thread_id, left(t.subject,80) subject, t.owner_id,",
  "         (select u.name from public.rm_users u where u.id = t.owner_id) owner_now,",
  "         r.text, r.at recorded_at,",
  "         btrim(split_part(regexp_replace(r.text, '^(Auto-assigned to |Assigned to |Taken by )', ''), ' by ', 1)) recorded_raw",
  "    from public.rm_threads t join last_rec r",
  "      on r.mailbox = t.mailbox and r.gmail_thread_id = t.gmail_thread_id",
  "   where t.owner_id is not null",
  "     and not exists (select 1 from public.rm_activity x where x.mailbox=t.mailbox and x.gmail_thread_id=t.gmail_thread_id and x.kind='x' and x.at > r.at)",
  "     and t.last_msg_at >= $1::date",
  "   order by t.mailbox, t.last_msg_at desc`;",
  "async function restoreOwnersJob(j) {",
  "  const mark = \"job_\" + j.id, undo = \"undo_\" + j.id;",
  "  if ((await pool.query(\"select 1 from public.rm_settings where key = $1\", [mark])).rowCount) return;",
  "  const c = await pool.connect();",
  "  try {",
  "    await c.query(\"set lock_timeout = '5s'\");",
  "    await c.query(\"set statement_timeout = '300s'\");",
  "    const users = (await c.query(\"select id, name from public.rm_users where active\")).rows;",
  "    const byName = new Map();",
  "    users.forEach((u) => { const k = String(u.name).trim().toLowerCase(); byName.set(k, byName.has(k) ? \"AMBIGUOUS\" : u.id); });",
  "    const rows = (await c.query(OWN_SQL, [j.since])).rows;",
  "    const bad = [], ambiguous = [];",
  "    for (const r of rows) {",
  "      const want = byName.get(String(r.recorded_raw || \"\").trim().toLowerCase());",
  "      if (!want) continue;                       /* the name is not a user we know - leave it */",
  "      if (want === \"AMBIGUOUS\") { ambiguous.push(r.recorded_raw); continue; }",
  "      if (want === r.owner_id) continue;         /* the owner matches the record - fine */",
  "      bad.push({ mailbox: r.mailbox, id: r.gmail_thread_id, subject: r.subject,",
  "        now: r.owner_id, now_name: r.owner_now, back_to: want, back_to_name: r.recorded_raw,",
  "        recorded: r.text, at: r.recorded_at });",
  "    }",
  "    const per = {};",
  "    bad.forEach((b) => { per[b.mailbox] = (per[b.mailbox] || 0) + 1; });",
  "    log(\"dry run\", j.id, \"-\", bad.length, \"conversation(s) whose owner changed with no record\",",
  "      bad.length ? \"(\" + Object.keys(per).map((k) => k.split(\"@\")[0] + \" \" + per[k]).join(\", \") + \")\" : \"\",",
  "      ambiguous.length ? \"| \" + ambiguous.length + \" left alone because the recorded name is not unique\" : \"\");",
  "    bad.slice(0, 10).forEach((b) => log(\"   would restore:\", b.mailbox.split(\"@\")[0], \"|\", String(b.subject).slice(0, 52),",
  "      \"| now\", b.now_name || b.now, \"-> back to\", b.back_to_name));",
  "    if (!bad.length) {",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false, restored: 0, ambiguous: ambiguous.length,",
  "        summary: \"nothing to do - every conversation's owner matches the last owner recorded in its history\" });",
  "      return;",
  "    }",
  "    if (bad.length > j.max) {",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false, summary: \"NOT run - \" + bad.length + \" is more than the \" + j.max + \" this job was written for\", per_mailbox: per });",
  "      return log(\"one-time job\", j.id, \"- NOT run:\", bad.length, \"is more than\", j.max);",
  "    }",
  "    let backup = \"not taken\";",
  "    try {",
  "      const bf = path.join(here, \"backup.mjs\");",
  "      if (fs.existsSync(bf)) {",
  "        const { spawnSync } = await import(\"node:child_process\");",
  "        const r = spawnSync(process.execPath, [bf], { encoding: \"utf8\", timeout: 20 * 60000 });",
  "        backup = r.status === 0 ? \"taken with backup.mjs\" : \"backup.mjs failed: \" + String(r.stderr || \"\").slice(0, 140);",
  "      } else backup = \"backup.mjs is not on this server yet\";",
  "    } catch (e) { backup = \"backup could not run: \" + e.message; }",
  "    log(\"one-time job\", j.id, \"- backup:\", backup);",
  "    await c.query(\"begin\");",
  "    await put(c, undo, { at: new Date().toISOString(), note: \"the owner each conversation had before this job\",",
  "      rows: bad.map((b) => ({ mailbox: b.mailbox, id: b.id, was: b.now, now: b.back_to })) });",
  "    let n = 0;",
  "    for (const b of bad) {",
  "      n += (await c.query(\"update public.rm_threads set owner_id = $3 where mailbox = $1 and gmail_thread_id = $2\",",
  "        [b.mailbox, b.id, b.back_to])).rowCount;",
  "    }",
  "    await c.query(",
  "      `insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at)",
  "       select x.mailbox, x.id, null, 'a', $2 || x.back_to_name || ' (it had been changed to ' || coalesce(x.now_name,'somebody') || ' with no record)', now()",
  "         from jsonb_to_recordset($1::jsonb) as x(mailbox text, id text, back_to_name text, now_name text)`,",
  "      [JSON.stringify(bad.map((b) => ({ mailbox: b.mailbox, id: b.id, back_to_name: b.back_to_name, now_name: b.now_name }))),",
  "       \"Owner put back by the system (\" + j.id + \") to \"]);",
  "    await put(c, mark, { at: new Date().toISOString(), ran: true, restored: n, per_mailbox: per, backup: backup,",
  "      ambiguous: ambiguous.length, undo_key: undo,",
  "      samples: bad.slice(0, 10).map((b) => ({ mailbox: b.mailbox, subject: b.subject, from: b.now_name, to: b.back_to_name })),",
  "      summary: \"put \" + n + \" owner(s) back (\" + Object.keys(per).map((k) => k.split(\"@\")[0] + \" \" + per[k]).join(\", \") +",
  "        \"); owner only - read state, status, Done, topic, folder and dates untouched; backup: \" + backup });",
  "    await c.query(\"commit\");",
  "    log(\"one-time job\", j.id, \"- done:\", n, \"owners put back\");",
  "  } catch (e) {",
  "    try { await c.query(\"rollback\"); } catch {}",
  "    log(\"one-time job\", j.id, \"FAILED, nothing was changed:\", e.message);",
  "  } finally { c.release(); }",
  "}",
  "if (process.env.ONETIME_OFF !== \"1\") setTimeout(() => restoreOwnersJob(RESTORE_OWN).catch((e) => log(\"one-time job\", RESTORE_OWN.id, \"error:\", e.message)), 37000);",
  "/* __restoreowners:end */",
  ""
];
s = s.replace(anchor, L.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("added the one-time job restore-owners-2026-11-26 to server/local-server/server.mjs");
