/* 25 Nov 2026 - one-time job: Jatin Munjal gets the same mailbox access as Ashok.

   Why a job and not a hand edit: the live mail database is on the office PC and can
   only be reached from there, so this travels with the normal GitHub update and runs
   itself once on that machine - no manual server steps.

   What it copies (the four fields that decide what a person may open):
       dept_id, role, perm, access
   What it deliberately does NOT touch (everything personal):
       id, name, login, pass_hash, signature, profile, prefs, on_leave, must_change,
       created_at - so he keeps his own login and his own signature.

   Ashok is never written to. Jatin's old values are saved first (rm_settings
   "undo_<id>" and a line in rm_activity), so it can be put back exactly.

   It refuses to guess: if "Ashok" or "Jatin Munjal" does not match exactly one row it
   changes nothing and writes down what it found.

   After copying it checks the result the way the app does - the same access() rule and
   the same rm_list function - and records both people's counts side by side.

   Run:  node server/patch-jatin-access-job.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__jatinjob:start")) { console.log("already there - nothing changed"); process.exit(0); }

const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");

const lines = [
  "/* ---- 25 Nov 2026: one-time job - same mailbox access as somebody else  __jatinjob:start ----",
  "   Asked for: \"Jatin Munjal must see exactly the same mailboxes as Ashok.\" Access in Rugs",
  "   Email comes from the DEPARTMENT, not from the person (see access() in rugs-mail: Admin, or",
  "   your own department, or an entry in \"access\"), so this copies the four fields that decide",
  "   it and nothing else. It runs once, saves the old values first, and never touches Ashok. */",
  "const SAME_ACCESS = {",
  "  id: \"jatin-munjal-same-access-as-ashok-2026-11-25\",",
  "  copyFrom: \"Ashok\",",
  "  copyTo: \"Jatin Munjal\",",
  "  fields: [\"dept_id\", \"role\", \"perm\", \"access\"]",
  "};",
  "const USER_COLS = \"id, name, login, dept_id, role, active, perm, access, on_leave, must_change, (pass_hash is not null) as has_password\";",
  "async function findPerson(c, name) {",
  "  let r = await c.query(\"select \" + USER_COLS + \" from public.rm_users where lower(btrim(name)) = lower(btrim($1))\", [name]);",
  "  if (!r.rowCount) r = await c.query(\"select \" + USER_COLS + \" from public.rm_users where lower(name) like '%' || lower(btrim($1)) || '%'\", [name]);",
  "  return r.rows;",
  "}",
  "/* the same rule the app and rugs-mail use: an Admin sees every mailbox, otherwise your own",
  "   department plus anything shared with you in \"access\" */",
  "function boxesFor(u, depts) {",
  "  return depts.filter((d) => u.role === \"Admin\" || u.dept_id === d.id || (u.access || {})[d.id]);",
  "}",
  "async function countsFor(c, u, depts) {",
  "  const ds = boxesFor(u, depts);",
  "  const boxes = ds.map((d) => d.mailbox), ids = ds.map((d) => d.id);",
  "  const out = { mailboxes: boxes, departments: ids };",
  "  if (!boxes.length) { out.note = \"no mailbox at all - this person can see nothing\"; return out; }",
  "  const j = (await c.query(\"select public.rm_list($1::text[], $2::text[], null, 2000) j\", [boxes, ids])).rows[0].j || {};",
  "  out.rm_list_conversations = (j.threads || []).length;",
  "  const sql = \"select count(*) filter (where coalesce(t.folder,'inbox') = 'inbox' and t.has_in)::int inbox,\"",
  "    + \" count(*) filter (where coalesce(t.folder,'inbox') = 'inbox' and t.has_out and not t.has_in)::int sent_only,\"",
  "    + \" count(*) filter (where 'merchandiser5@rugscreation.com' = any(t.to_addrs))::int via_merchandiser5,\"",
  "    + \" count(*) filter (where 'packaging@rugscreation.com' = any(t.to_addrs))::int via_packaging,\"",
  "    + \" count(*) filter (where t.owner_id = $2)::int owned_by_him,\"",
  "    + \" count(*) filter (where t.owner_id is null and coalesce(t.status,'') <> 'done')::int waiting_for_an_owner\"",
  "    + \" from public.rm_threads t where t.mailbox = any($1::text[])\";",
  "  const r = (await c.query(sql, [boxes, u.id])).rows[0];",
  "  return { ...out, ...r };",
  "}",
  "async function sameAccessJob(j) {",
  "  const mark = \"job_\" + j.id, undo = \"undo_\" + j.id;",
  "  if ((await pool.query(\"select 1 from public.rm_settings where key = $1\", [mark])).rowCount) return;",
  "  const c = await pool.connect();",
  "  try {",
  "    await c.query(\"set lock_timeout = '5s'\");",
  "    await c.query(\"set statement_timeout = '120s'\");",
  "    await c.query(\"begin\");",
  "    const from = await findPerson(c, j.copyFrom), to = await findPerson(c, j.copyTo);",
  "    const names = (rows) => rows.map((r) => r.name + \" [\" + r.id + (r.active ? \"\" : \", switched off\") + \"]\").join(\", \");",
  "    if (from.length !== 1 || to.length !== 1) {",
  "      await c.query(\"rollback\");",
  "      const why = \"NOT run - \" + (from.length !== 1",
  "        ? from.length + \" people match '\" + j.copyFrom + \"' (\" + (names(from) || \"nobody\") + \")\"",
  "        : to.length + \" people match '\" + j.copyTo + \"' (\" + (names(to) || \"nobody\") + \")\")",
  "        + \", so it cannot tell who is meant; nothing was changed\";",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false, summary: why });",
  "      return log(\"one-time job\", j.id, \"-\", why);",
  "    }",
  "    const A = from[0], J = to[0];",
  "    const depts = (await c.query(\"select id, name, mailbox from public.rm_departments\")).rows;",
  "    const before = await countsFor(c, J, depts), his = await countsFor(c, A, depts);",
  "    const diff = j.fields.filter((f) => JSON.stringify(J[f]) !== JSON.stringify(A[f]));",
  "    if (!diff.length) {",
  "      await c.query(\"commit\");",
  "      const why = \"nothing to do - \" + J.name + \" already has the same dept_id / role / perm / access as \"",
  "        + A.name + \" (department \" + (J.dept_id || \"none\") + \")\";",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false, summary: why, jatin: before, ashok: his });",
  "      return log(\"one-time job\", j.id, \"-\", why);",
  "    }",
  "    /* keep the old values first, so this can be undone exactly */",
  "    const old = {}; for (const f of j.fields) old[f] = J[f];",
  "    await put(c, undo, { at: new Date().toISOString(), user_id: J.id, name: J.name, login: J.login, was: old });",
  "    await c.query(\"insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at) values (null, null, $1, 'admin', $2, now())\",",
  "      [J.id, \"Access copied from \" + A.name + \" (\" + j.id + \"). Before: \" + JSON.stringify(old)",
  "        + \". Only dept_id, role, perm and access were changed - login, password and signature were not touched.\"",
  "        + \" To undo, see rm_settings.\" + undo]);",
  "    await c.query(\"update public.rm_users set dept_id = $2, role = $3, perm = $4, access = $5 where id = $1\",",
  "      [J.id, A.dept_id, A.role, A.perm || {}, A.access || {}]);",
  "    /* read him back and check him with the app's own rules */",
  "    const J2 = (await findPerson(c, j.copyTo))[0];",
  "    const after = await countsFor(c, J2, depts);",
  "    const matches = JSON.stringify(after.mailboxes) === JSON.stringify(his.mailboxes)",
  "      && after.rm_list_conversations === his.rm_list_conversations;",
  "    const summary = \"copied \" + diff.join(\", \") + \" from \" + A.name + \" to \" + J.name",
  "      + \"; mailboxes \" + (before.mailboxes.join(\",\") || \"none\") + \" -> \" + (after.mailboxes.join(\",\") || \"none\")",
  "      + \"; conversations \" + (before.rm_list_conversations || 0) + \" -> \" + after.rm_list_conversations",
  "      + \" (\" + A.name + \" \" + his.rm_list_conversations + \")\"",
  "      + \"; \" + (matches ? \"the two now match\" : \"THEY STILL DIFFER - look at the job record\");",
  "    await put(c, mark, { at: new Date().toISOString(), ran: true, summary, copied: diff, from: A.name, to: J.name,",
  "      undo_key: undo, jatin_before: before, jatin_after: after, ashok: his, matches });",
  "    await c.query(\"commit\");",
  "    log(\"one-time job\", j.id, \"- done:\", summary);",
  "    log(\"   \", J.name, \"inbox\", after.inbox, \"sent-only\", after.sent_only, \"via merchandiser5\", after.via_merchandiser5,",
  "      \"via packaging\", after.via_packaging, \"owns\", after.owned_by_him, \"waiting for an owner\", after.waiting_for_an_owner);",
  "    log(\"   \", A.name, \"inbox\", his.inbox, \"sent-only\", his.sent_only, \"via merchandiser5\", his.via_merchandiser5,",
  "      \"via packaging\", his.via_packaging, \"owns\", his.owned_by_him, \"waiting for an owner\", his.waiting_for_an_owner);",
  "    log(\"    NOTE this gives him the same MAILBOX. A mail somebody already owns stays that person's\",",
  "      \"(the 16 Nov rule), so his list is not identical to \" + A.name + \"'s until the app's mirror rule is switched on.\");",
  "  } catch (e) {",
  "    try { await c.query(\"rollback\"); } catch {}",
  "    log(\"one-time job\", j.id, \"FAILED, nothing was changed:\", e.message);",
  "  } finally { c.release(); }",
  "}",
  "if (process.env.ONETIME_OFF !== \"1\") setTimeout(() => sameAccessJob(SAME_ACCESS).catch((e) => log(\"one-time job\", SAME_ACCESS.id, \"error:\", e.message)), 13000);",
  "/* __jatinjob:end */",
  ""
];

const eol = s.includes("\r\n") ? "\r\n" : "\n";
s = s.replace(anchor, lines.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("added the one-time access job to server/local-server/server.mjs");
