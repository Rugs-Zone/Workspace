/* 25 Nov 2026 - one-time job "add-team-aman-2026-11-25".

   Asked for: merchandiser1@rugscreation.com becomes a department of its own, "Team Aman",
   with Aman Sharma working in it.

   WHY THIS WAS NEEDED: merchandiser1@ was not a mailbox in Rugs Email at all - only nine
   were synced - so its mail only ever appeared inside whichever TEAM mailbox it was
   delivered to (2,705 conversations, of which ~2,625 had been marked Done by the 17 Nov
   sweep, which is why "all emails are not showing"). It is a real Gmail mailbox though -
   checked with the service account: 56,679 messages, 11,884 conversations, readable - so
   it can be synced with no work on the Google side.

   Aman Sharma (login merchandiser1@) was switched OFF and had NO department, so even
   reactivating him would have shown him nothing: access comes from the department.

   WHAT THIS JOB DOES, once, on the live database:
     1  adds the department "Team Aman" with mailbox merchandiser1@ (a colour nobody else
        uses, and track_from = now, so work counting starts today and the year of history
        it is about to download does not land in anybody's work lists - the existing
        rm_old_history_done_trg trigger files pre-Go-live mail as Done and read)
     2  reactivates Aman Sharma into it, keeping his own login, password and signature
     3  gives him the ordinary executive permissions if his were empty

   It does NOT create the rm_mailboxes row: the sync does that itself and starts 30 days
   back (FIRST_DAYS), and because cronRun orders mailboxes by least-recently-synced a new
   one goes first. Expect the newest 30 days within about half an hour, then roughly a day
   or two of quiet backfilling to the 365-day history setting.

   Safe to leave in place: it runs once, does nothing if a department with that mailbox
   already exists, keeps what it changed in rm_settings so it can be undone, and is all in
   one transaction.

   Run:  node server/patch-team-aman-job.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__teamaman:start")) { console.log("already there - nothing changed"); process.exit(0); }

const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");

const lines = [
  "/* ---- 25 Nov 2026: one-time job - the department \"Team Aman\" on merchandiser1@   __teamaman:start ---- */",
  "const TEAM_AMAN = { id: \"add-team-aman-2026-11-25\", name: \"Team Aman\",",
  "  box: \"merchandiser1@rugscreation.com\", person: \"Aman Sharma\",",
  "  colors: [\"#2f6fe0\", \"#c026d3\", \"#0ea5e9\", \"#65a30d\"] };",
  "async function teamAmanJob(j) {",
  "  const mark = \"job_\" + j.id, undo = \"undo_\" + j.id;",
  "  if ((await pool.query(\"select 1 from public.rm_settings where key = $1\", [mark])).rowCount) return;",
  "  const c = await pool.connect();",
  "  try {",
  "    await c.query(\"set lock_timeout = '5s'\");",
  "    await c.query(\"set statement_timeout = '60s'\");",
  "    await c.query(\"begin\");",
  "    /* already there? then there is nothing to do */",
  "    const have = (await c.query(\"select id, name from public.rm_departments where lower(mailbox) = lower($1)\", [j.box])).rows[0];",
  "    if (have) {",
  "      await c.query(\"commit\");",
  "      const why = \"nothing to do - the mailbox \" + j.box + \" is already the department '\" + have.name + \"' (\" + have.id + \")\";",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false, summary: why });",
  "      return log(\"one-time job\", j.id, \"-\", why);",
  "    }",
  "    const who = (await c.query(\"select id, name, login, dept_id, role, active, perm from public.rm_users where lower(login) = lower($1)\", [j.box])).rows[0];",
  "    const used = (await c.query(\"select lower(color) c from public.rm_departments\")).rows.map((r) => r.c);",
  "    const colour = j.colors.find((x) => !used.includes(x.toLowerCase())) || j.colors[0];",
  "    const id = \"d\" + Date.now().toString(36);",
  "    await put(c, undo, { at: new Date().toISOString(),",
  "      note: \"to undo: delete the department row below, and put the person back as they were\",",
  "      department_added: { id, name: j.name, mailbox: j.box },",
  "      person_was: who ? { id: who.id, name: who.name, dept_id: who.dept_id, active: who.active, role: who.role, perm: who.perm } : null });",
  "    await c.query(\"insert into public.rm_departments (id, name, mailbox, color, track_from, created_at) values ($1,$2,$3,$4, now(), now())\",",
  "      [id, j.name, j.box, colour]);",
  "    let said = \"added the department '\" + j.name + \"' (\" + id + \") on \" + j.box + \", colour \" + colour + \", work counted from now\";",
  "    if (who) {",
  "      const perm = who.perm && Object.keys(who.perm).length ? who.perm",
  "        : { buddy: 0, assign: 0, delete: 0, aliases: \"\", domains: \"\", transfer: 1, dashboards: 0 };",
  "      await c.query(\"update public.rm_users set dept_id = $2, active = true, role = coalesce(nullif(role,''),'Executive'), perm = $3 where id = $1\",",
  "        [who.id, id, perm]);",
  "      said += \"; \" + who.name + \" switched back on and put in it (login, password and signature untouched)\";",
  "    } else said += \"; no user has the login \" + j.box + \", so nobody was changed\";",
  "    await put(c, mark, { at: new Date().toISOString(), ran: true, summary: said, dept_id: id, undo_key: undo });",
  "    await c.query(\"commit\");",
  "    log(\"one-time job\", j.id, \"- done:\", said);",
  "    log(\"    the sync will create the mailbox row itself and start 30 days back; the newest mail\",",
  "      \"should appear within about half an hour, then it loads the year of history quietly.\");",
  "    if (who) log(\"    NOTE\", who.name + \"'s password is stored as a hash and cannot be read -\",",
  "      \"set him a one-time one in Admin -> Users -> Set password before he tries to sign in.\");",
  "  } catch (e) {",
  "    try { await c.query(\"rollback\"); } catch {}",
  "    log(\"one-time job\", j.id, \"FAILED, nothing was changed:\", e.message);",
  "  } finally { c.release(); }",
  "}",
  "if (process.env.ONETIME_OFF !== \"1\") setTimeout(() => teamAmanJob(TEAM_AMAN).catch((e) => log(\"one-time job\", TEAM_AMAN.id, \"error:\", e.message)), 21000);",
  "/* __teamaman:end */",
  ""
];

const eol = s.includes("\r\n") ? "\r\n" : "\n";
s = s.replace(anchor, lines.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("added the one-time job add-team-aman-2026-11-25 to server/local-server/server.mjs");
