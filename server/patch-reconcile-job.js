/* 25 Nov 2026 - one-time job "reconcile-gmail-21nov-2026-11-25".

   WHY: "Bhawna's mail is missing from Team Designing" - from dmm3@, Mon 23 Nov 1:19 PM,
   subject "FW: Geo Chenille Cushion".

   WHAT WAS ESTABLISHED FROM THIS LAPTOP FIRST (Gmail can be read from here, the live
   database cannot):

     Gmail HAS it. designer@rugscreation.com, INBOX, Gmail id 1a207622f7acfac1,
     thread 1a207622f7acfac1, sent 2026-11-23T07:48:59Z = 13:18:59 IST, from
     Bhawna <dmm3@rugscreation.com> to Designer Rugs Creation <designer@rugscreation.com>,
     Message-Id <a493c4891c27b66642df590224ca2b1f@mail.gmail.com>. The same thread also
     holds Nikhil's replies of 23 Nov 07:52 and 24 Nov 06:43 / 06:48, sent from designer@.

   This job answers the two things that can only be answered on the office machine:

     1  is that message in rm_messages / rm_threads, and if so in which thread and folder;
     2  across ALL NINE mailboxes, which Gmail messages since 21 Nov 2026 are not in
        rm_messages at all.

   It reads Gmail directly (service account, gmail.readonly, the same key the sync uses) and
   compares ids with the database. That is a DRY RUN: it changes nothing and writes what it
   found into rm_settings, so it can be read in Rugs Email -> Admin -> Server.

   Then, and only for a mailbox that really is missing mail, it IMPORTS by rewinding that
   mailbox's sync cursor to just before the oldest missing message, so the server's own sync
   walks that window again and upserts what it finds. Nothing is deleted and nothing can be
   duplicated (rm_messages is keyed on mailbox + gmail_id), and the cursor values it changes
   are written down first so they can be put back exactly. The rewind never goes further back
   than 21 Nov and never applies to more than 2,000 missing messages in one mailbox - past
   that it reports and leaves it alone.

   Run:  node server/patch-reconcile-job.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__recon:start")) { console.log("already there - nothing changed"); process.exit(0); }

const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");

const L = [
  "/* ---- 25 Nov 2026: Gmail vs the database since 21 Nov   __recon:start ---------------- */",
  "const RECON = {",
  "  id: \"reconcile-gmail-21nov-2026-11-25\",",
  "  since: Date.parse(\"2026-11-21T00:00:00Z\"),",
  "  look: { box: \"designer@rugscreation.com\", gmail_id: \"1a207622f7acfac1\",",
  "          rfc: \"<a493c4891c27b66642df590224ca2b1f@mail.gmail.com>\", subject: \"Geo Chenille Cushion\" },",
  "  max_rewind: 2000",
  "};",
  "/* a Gmail token for one mailbox, read-only - the same service account the sync uses */",
  "async function reconToken(user) {",
  "  const key = JSON.parse(process.env.RUGS_SA_JSON || \"{}\");",
  "  if (!key.client_email) throw new Error(\"no Gmail key on this server\");",
  "  const b64u = (b) => Buffer.from(b).toString(\"base64\").replace(/\\+/g, \"-\").replace(/\\//g, \"_\").replace(/=+$/, \"\");",
  "  const now = Math.floor(Date.now() / 1000);",
  "  const head = b64u(JSON.stringify({ alg: \"RS256\", typ: \"JWT\" }));",
  "  const body = b64u(JSON.stringify({ iss: key.client_email, sub: user,",
  "    scope: \"https://www.googleapis.com/auth/gmail.readonly\", aud: \"https://oauth2.googleapis.com/token\", iat: now, exp: now + 3600 }));",
  "  const sig = crypto.createSign(\"RSA-SHA256\").update(head + \".\" + body).sign(key.private_key);",
  "  const r = await fetch(\"https://oauth2.googleapis.com/token\", { method: \"POST\",",
  "    headers: { \"content-type\": \"application/x-www-form-urlencoded\" },",
  "    body: \"grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=\" + head + \".\" + body + \".\" + b64u(sig) });",
  "  const j = await r.json();",
  "  if (!j.access_token) throw new Error(String(j.error_description || j.error || \"no token\"));",
  "  return j.access_token;",
  "}",
  "async function reconList(tok, afterEpochS) {",
  "  const out = [];",
  "  let page = \"\";",
  "  for (let i = 0; i < 40; i++) {",
  "    const u = \"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500&q=\" +",
  "      encodeURIComponent(\"after:\" + afterEpochS) + (page ? \"&pageToken=\" + page : \"\");",
  "    const r = await fetch(u, { headers: { authorization: \"Bearer \" + tok } });",
  "    if (!r.ok) throw new Error(\"Gmail list \" + r.status);",
  "    const j = await r.json();",
  "    (j.messages || []).forEach((m) => out.push(m.id));",
  "    page = j.nextPageToken || \"\";",
  "    if (!page) break;",
  "  }",
  "  return out;",
  "}",
  "async function reconJob(j) {",
  "  const mark = \"job_\" + j.id, undo = \"undo_\" + j.id;",
  "  if ((await pool.query(\"select 1 from public.rm_settings where key = $1\", [mark])).rowCount) return;",
  "  const out = { at: new Date().toISOString(), since: new Date(j.since).toISOString(), boxes: {}, looked_for: {} };",
  "  try {",
  "    /* ---- 1. the one mail that was reported ---- */",
  "    const m1 = (await pool.query(",
  "      `select mailbox, gmail_id, gmail_thread_id, from_email, sent_at, left(subject,60) subject",
  "         from public.rm_messages where gmail_id = $1 or rfc_message_id = $2`,",
  "      [j.look.gmail_id, j.look.rfc])).rows;",
  "    const t1 = (await pool.query(",
  "      `select mailbox, gmail_thread_id, left(subject,60) subject, folder, status, owner_id, unread, msg_count, last_msg_at",
  "         from public.rm_threads where mailbox = $1 and gmail_thread_id = $2`,",
  "      [j.look.box, j.look.gmail_id])).rows;",
  "    out.looked_for = { message: m1, thread: t1,",
  "      in_db: m1.length > 0,",
  "      note: m1.length ? \"the message IS in the database\" : \"the message is NOT in the database\" };",
  "    log(\"reconcile\", j.id, \"- the reported mail:\", out.looked_for.note,",
  "      m1.length ? \"(thread \" + m1[0].gmail_thread_id + \")\" : \"\",",
  "      t1.length ? \"| conversation folder \" + t1[0].folder + \", status \" + t1[0].status + \", owner \" + (t1[0].owner_id || \"nobody\") : \"\");",
  "    /* ---- 2. all nine mailboxes, Gmail vs the database ---- */",
  "    const boxes = (await pool.query(\"select mailbox from public.rm_departments order by mailbox\")).rows.map((r) => r.mailbox);",
  "    const afterS = Math.floor(j.since / 1000);",
  "    const rewind = [];",
  "    for (const box of boxes) {",
  "      const b = { gmail: 0, in_db: 0, missing: 0, samples: [], error: \"\" };",
  "      try {",
  "        const tok = await reconToken(box);",
  "        const ids = await reconList(tok, afterS);",
  "        b.gmail = ids.length;",
  "        if (ids.length) {",
  "          const have = (await pool.query(",
  "            \"select gmail_id from public.rm_messages where mailbox = $1 and gmail_id = any($2::text[])\",",
  "            [box, ids])).rows.map((r) => r.gmail_id);",
  "          const hs = new Set(have);",
  "          b.in_db = have.length;",
  "          const miss = ids.filter((x) => !hs.has(x));",
  "          b.missing = miss.length;",
  "          b.samples = miss.slice(0, 10);",
  "          if (miss.length) rewind.push({ box: box, n: miss.length });",
  "        }",
  "      } catch (e) { b.error = String(e.message || e).slice(0, 140); }",
  "      out.boxes[box] = b;",
  "      log(\"reconcile\", box.split(\"@\")[0], \"- Gmail\", b.gmail, \"| in the database\", b.in_db, \"| MISSING\", b.missing,",
  "        b.error ? \"| error: \" + b.error : \"\");",
  "    }",
  "    out.total_missing = Object.values(out.boxes).reduce((a, b) => a + b.missing, 0);",
  "    /* ---- 3. import what is missing, by letting the sync walk that window again ---- */",
  "    out.imported = [];",
  "    for (const r of rewind) {",
  "      if (r.n > j.max_rewind) { out.imported.push({ box: r.box, done: false, why: r.n + \" missing is more than \" + j.max_rewind + \" - left alone\" }); continue; }",
  "      const cur = (await pool.query(\"select mailbox, cursor_s, back_s, status, note from public.rm_mailboxes where mailbox = $1\", [r.box])).rows[0];",
  "      out.imported.push({ box: r.box, missing: r.n, cursor_was: cur ? cur.cursor_s : null, back_was: cur ? cur.back_s : null });",
  "      await pool.query(",
  "        \"update public.rm_mailboxes set cursor_s = $2, status = 'backfilling', note = $3 where mailbox = $1\",",
  "        [r.box, String(afterS), \"re-reading from 21 Nov to pick up \" + r.n + \" missing mail (\" + j.id + \")\"]);",
  "    }",
  "    await put(pool, undo, { at: new Date().toISOString(),",
  "      note: \"put a mailbox back with: update rm_mailboxes set cursor_s = <cursor_was>, back_s = <back_was> where mailbox = <box>\",",
  "      rows: out.imported });",
  "    out.summary = \"the reported mail \" + (out.looked_for.in_db ? \"IS\" : \"is NOT\") + \" in the database; \" +",
  "      out.total_missing + \" Gmail messages since 21 Nov were not stored; \" +",
  "      out.imported.filter((x) => x.done !== false).length + \" mailbox(es) set to re-read that window\";",
  "    await put(pool, mark, out);",
  "    log(\"reconcile\", j.id, \"- done:\", out.summary);",
  "  } catch (e) {",
  "    log(\"reconcile\", j.id, \"FAILED:\", e.message);",
  "    try { await put(pool, mark, { at: new Date().toISOString(), summary: \"FAILED: \" + e.message, partial: out }); } catch (x) {}",
  "  }",
  "}",
  "if (process.env.ONETIME_OFF !== \"1\") setTimeout(() => reconJob(RECON).catch((e) => log(\"reconcile error:\", e.message)), 25000);",
  "/* __recon:end */",
  ""
];

const eol = s.includes("\r\n") ? "\r\n" : "\n";
s = s.replace(anchor, L.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("added the one-time job reconcile-gmail-21nov-2026-11-25 to server/local-server/server.mjs");
