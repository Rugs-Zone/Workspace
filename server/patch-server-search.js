/* 24 Nov 2026 - Rugs Email: SEARCH ASKS THE SERVER.
 *
 * Why: the browser is only ever sent the ~1,500 newest conversations (rm_list, two 1000-row
 * pages sliced to 1500), and the search box filtered THAT list (listRows -> S.threads). As of
 * 21 Nov, 4,015 conversations company-wide (374 of them Team Alpha) were newer than the
 * "MAX ZIPPER // IO 4813" thread, so Jagjit could not find it at all - the mail was in the
 * database the whole time.
 *
 * This adds one action, "find", to rugs-mail-list (which already checks the session and which
 * mailboxes the person may see, and already answers in the exact shape the app merges):
 *
 *   - searches rm_threads (subject, preview, sender name, sender address)
 *   - and rm_messages (subject, preview, From name/address, To, Cc, and the mail text)
 *   - every mailbox the person may see, Done included, any age, no date window
 *   - words may be in any order (up to 4 words, all of them must appear)
 *   - at most 200 conversations, newest first, with their messages and history
 *   - also takes a list of "mailbox|threadId" keys (ids), so the existing "search inside
 *     attachments & all of Gmail" button can finally SHOW the hits it finds but has not loaded
 *
 * Speed: the mail text lives in a TOASTed column, so scanning it is ~10 s on 350k messages -
 * far too slow and far too heavy for the little office server. So the mail text is only
 * searched when the trigram index is in place (the one-time job "search-index-2026-11-24" in
 * server.mjs builds it: 175 s, 468 MB, measured on a full copy); the answer says which of the
 * two happened ("text": true/false) so the app can tell the person.
 *
 * Re-runnable: it replaces its own block if it is already there.
 */
const fs = require('fs');
const F = 'server/local-server/rugs-mail-list.bundle.mjs';
let s = fs.readFileSync(F, 'utf8');
const nl = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const S0 = '// __rzfind:start', S1 = '// __rzfind:end';

const BLOCK = [
S0,
"/* 24 Nov 2026: search the whole database, not only what the browser has loaded.",
"   See server/patch-server-search.js for why, and for the measured speeds. */",
"var RZ_TRGM = null;                                     // is the mail-text index there?",
"async function rzTextIndex() {",
"  if (RZ_TRGM === null) {",
"    try {",
"      const r = await pool.query(\"select count(*)::int n from pg_indexes where schemaname='public' and tablename='rm_messages' and indexname='rm_msg_body_trgm'\");",
"      RZ_TRGM = r.rows[0].n > 0;",
"    } catch { RZ_TRGM = false; }",
"  }",
"  return RZ_TRGM;",
"}",
"var RZ_FIND_BUSY = 0;                                   // at most two heavy searches at once",
"const RZ_T_COLS = \"th.mailbox, th.gmail_thread_id, th.subject, left(th.snippet,160) snippet, th.counterpart_email, th.counterpart_name, th.msg_count, th.last_msg_at, th.has_in, th.has_out, th.unread, th.owner_id, th.status, th.promise, th.due_at, th.topic, th.topic_ai, th.topic_conf, th.topic_checked, th.flagged, th.folder, th.prev_folder, th.updated_at, th.dept_id, th.done_at, th.first_reply_at, th.pinned, th.snooze_until, th.remind_at, th.cats, th.to_addrs, th.for_owner\";",
"/* the same message and history shape rm_list_box returns, so the app merges it unchanged */",
"const RZ_PACK = `select jsonb_build_object(",
"   'threads', coalesce((select jsonb_agg(to_jsonb(t)) from t), '[]'::jsonb),",
"   'messages', coalesce((select jsonb_agg(jsonb_build_object(",
"       'mailbox', m.mailbox, 'gmail_id', m.gmail_id, 'gmail_thread_id', m.gmail_thread_id, 'direction', m.direction,",
"       'from_email', m.from_email, 'from_name', left(m.from_name, 80), 'to_text', left(m.to_text, 200), 'cc_text', left(m.cc_text, 200),",
"       'body_text', left(m.body_text, 300), 'sent_at', m.sent_at, 'sent_by', m.sent_by,",
"       'attachments', case when m.has_attachments then coalesce((select jsonb_agg(jsonb_build_object('name', left(a->>'name', 120), 'mime', a->>'mime', 'size', (a->>'size')::bigint))",
"                                from (select a from jsonb_array_elements(case when jsonb_typeof(m.attachments) = 'array' then m.attachments else '[]'::jsonb end) a",
"                                      where not (coalesce(a->>'mime','') like 'image/%' and coalesce((a->>'size')::bigint,0) < 40000) limit 12) z), '[]'::jsonb) else '[]'::jsonb end,",
"       'drive_status', m.drive_status,",
"       'drive_files', case when m.drive_status = 'done' then (select jsonb_agg(jsonb_build_object('name', left(f->>'name', 120), 'size', f->'size', 'link', f->>'link', 'big', f->'big'))",
"                                from jsonb_array_elements(case when jsonb_typeof(m.drive_files) = 'array' then m.drive_files else '[]'::jsonb end) f) end) order by m.sent_at)",
"     from rm_messages m join t on t.mailbox = m.mailbox and t.gmail_thread_id = m.gmail_thread_id), '[]'::jsonb),",
"   'activity', coalesce((select jsonb_agg(jsonb_build_object('mailbox', a.mailbox, 'gmail_thread_id', a.gmail_thread_id, 'user_id', a.user_id, 'kind', a.kind, 'text', left(a.text, 600), 'at', a.at) order by a.at)",
"     from rm_activity a join t on t.mailbox = a.mailbox and t.gmail_thread_id = a.gmail_thread_id), '[]'::jsonb)",
" ) as j`;",
"async function rzFind(boxes, words, limit, deep, ids) {",
"  const vals = [boxes];",
"  let keys;",
"  if (ids && ids.length) {",
"    vals.push(ids.map((k) => String(k).split(\"|\")[0]), ids.map((k) => String(k).split(\"|\").slice(1).join(\"|\")));",
"    keys = \"select z.mailbox, z.gmail_thread_id from unnest($2::text[], $3::text[]) as z(mailbox, gmail_thread_id) where z.mailbox = any($1)\";",
"  } else {",
"    const pat = words.map((w) => \"%\" + String(w).replace(/[\\\\%_]/g, (c) => \"\\\\\" + c) + \"%\");",
"    const p0 = vals.length + 1;",
"    vals.push(pat);                                       // $2 = every word, as a pattern",
"    const TH = \"(coalesce(th2.subject,'') || ' ' || coalesce(th2.snippet,'') || ' ' || coalesce(th2.counterpart_name,'') || ' ' || coalesce(th2.counterpart_email,''))\";",
"    const MH = \"(coalesce(m2.subject,'') || ' ' || coalesce(m2.snippet,'') || ' ' || coalesce(m2.from_name,'') || ' ' || coalesce(m2.from_email,'') || ' ' || coalesce(m2.to_text,'') || ' ' || coalesce(m2.cc_text,''))\";",
"    keys =",
"      \"(select th2.mailbox, th2.gmail_thread_id from rm_threads th2 where th2.mailbox = any($1) and \" + TH + \" ilike all($\" + p0 + \"::text[]) order by th2.last_msg_at desc nulls last limit 400)\" +",
"      \" union (select m2.mailbox, m2.gmail_thread_id from rm_messages m2 where m2.mailbox = any($1) and \" + MH + \" ilike all($\" + p0 + \"::text[]) group by m2.mailbox, m2.gmail_thread_id limit 400)\";",
"    if (deep) {",
"      /* one condition per word, so the trigram index can be used for each of them */",
"      const w = pat.map((x) => { vals.push(x); return \"m3.body_text ilike $\" + vals.length; }).join(\" and \");",
"      keys += \" union (select m3.mailbox, m3.gmail_thread_id from rm_messages m3 where m3.mailbox = any($1) and \" + w + \" group by m3.mailbox, m3.gmail_thread_id limit 400)\";",
"    }",
"  }",
"  vals.push(Math.min(Math.max(Number(limit) || 200, 1), 200));",
"  const sql = \"with k as (\" + keys + \"), t as materialized (select \" + RZ_T_COLS +",
"    \" from rm_threads th join k on k.mailbox = th.mailbox and k.gmail_thread_id = th.gmail_thread_id\" +",
"    \" order by th.last_msg_at desc nulls last limit $\" + vals.length + \") \" + RZ_PACK;",
"  const c = await pool.connect();",
"  try {",
"    await c.query(\"set statement_timeout = '30s'\");",
"    const r = await c.query(sql, vals);",
"    return r.rows[0].j || {};",
"  } finally { c.release(); }",
"}",
S1
].join('\n');

const has = s.indexOf(S0) >= 0;
if (has) {
  const a = s.indexOf(S0), b = s.indexOf(S1) + S1.length;
  s = s.slice(0, a) + BLOCK.replace(/\n/g, nl) + s.slice(b);
  console.log('replaced the existing block');
} else {
  const anchor = 'Deno.serve(async (req) => {';
  if (s.split(anchor).length - 1 !== 1) throw new Error('anchor Deno.serve not found exactly once');
  s = s.replace(anchor, BLOCK.replace(/\n/g, nl) + nl + anchor);
  console.log('block inserted');
}

/* the action itself, next to "more" (same session and mailbox checks) */
const ACT_FIND = [
'    if (p.action === "find") {',
'      const ds2 = (all || []).filter((d) => access(u, d.id));',
'      const boxes2 = ds2.map((d) => d.mailbox);',
'      if (!boxes2.length) return out({ threads: [], messages: [], activity: [], text: false });',
'      const ids = Array.isArray(p.ids) ? p.ids.filter((x) => typeof x === "string").slice(0, 400) : null;',
'      const words = String(p.q || "").toLowerCase().replace(/[a-z]+:("[^"]*"|\\S+)/g, " ").replace(/["\']/g, " ").split(/\\s+/).filter((w) => w.length >= 2).slice(0, 4);',
'      if (!ids && (String(p.q || "").trim().length < 3 || !words.length)) return out({ error: "Type at least 3 letters to search" }, 400);',
'      const deep = !ids && await rzTextIndex();',
'      if (deep) {',
'        if (RZ_FIND_BUSY >= 2) return out({ error: "The search is busy for a moment - try again" }, 429);',
'        RZ_FIND_BUSY++;',
'      }',
'      const t0 = Date.now();',
'      try {',
'        const j = await rzFind(boxes2, words, p.limit, deep, ids);',
'        const seen2 = new Set((j.threads || []).map((t) => t.mailbox + "|" + t.gmail_thread_id));',
'        const k2 = (x) => x.mailbox + "|" + x.gmail_thread_id;',
'        return out({',
'          threads: j.threads || [], messages: (j.messages || []).filter((x) => seen2.has(k2(x))),',
'          activity: (j.activity || []).filter((x) => seen2.has(k2(x))),',
'          text: !!deep, words, ms: Date.now() - t0, now: Date.now(), history_days: await historyDays()',
'        });',
'      } catch (e) {',
'        return out({ error: /timeout|canceling/i.test(String(e.message)) ? "The search took too long - try a longer or more exact word" : "Search failed: " + e.message }, 500);',
'      } finally { if (deep) RZ_FIND_BUSY--; }',
'    }',
''
].join('\n');

if (s.indexOf('p.action === "find"') < 0) {
  const a2 = '    if (p.action === "more") {';
  if (s.split(a2).length - 1 !== 1) throw new Error('anchor "more" not found exactly once');
  s = s.replace(a2, ACT_FIND.replace(/\n/g, nl) + a2);
  console.log('action inserted');
} else console.log('action already there - left as it is');

fs.writeFileSync(F, s);
console.log('patch-server-search: done');
