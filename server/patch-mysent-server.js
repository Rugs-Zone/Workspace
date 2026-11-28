/* patch-mysent-server.js - 28 Nov 2026   (new rule R36)
 *
 * "He sent a mail to a buyer and it is not in his Sent."
 *
 * MEASURED FIRST on the live office database, read only (server/measure-ashish-sent.mjs):
 * inside his own mailbox teampulse@ his Sent is complete - 309 of his conversations loaded,
 * 307 shown, the only 2 missing are in Deleted. The real gap is elsewhere: of his 4,888 sent
 * mails, 1,317 landed in mailboxes his session is never given (vinay@ 605, shipping@ 390,
 * designer@ 253, teamalpha@ 40, dmm3@ 13, merchandiser1@ 8, neetu@ 6, mis@ 1, marketing@ 1).
 * He cannot open those mailboxes, so his own mail in them is invisible to him.
 *
 * THIS ACTION, and nothing more: it returns ONLY messages whose From is the signed-in person's
 * OWN login or alias, ONLY out of mailboxes that person may NOT open, and only the ones that
 * have NO copy in a mailbox he CAN open (so his Sent is never doubled). It reads no other
 * message, no thread row, no owner, no activity, no attachment - and it writes nothing.
 * An admin, who may open every mailbox, gets an empty list by construction.
 *
 * Run:  node server/patch-mysent-server.js
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "local-server", "rugs-mail-list.bundle.mjs");
const V = path.join(__dirname, "local-server", "version.txt");
const WANT = "2026-11-28-d";
let s = fs.readFileSync(F, "utf8");
if (s.includes("__mysent")) { console.log("already applied - nothing to do"); process.exit(0); }

const ANCHOR = '    if (p.action === "find") {';
if (s.split(ANCHOR).length - 1 !== 1) throw new Error("anchor (find action) found " + (s.split(ANCHOR).length - 1) + " times, expected 1");

const BLOCK = [
'    /* __mysent:start  28 Nov 2026 - rule R36: YOUR OWN sent mail, wherever it landed.',
'       Read only, and deliberately narrow: only messages FROM this person\'s own login or alias,',
'       only out of mailboxes this person may NOT open, and only the ones with no copy in a',
'       mailbox he CAN open. Nothing else from those mailboxes is read or returned. */',
'    if (p.action === "mysent") {',
'      const { data: me36 } = await sb.from("rm_users").select("login,perm").eq("id", u.id).maybeSingle();',
'      const mine36 = [String((me36 && me36.login) || "").toLowerCase()]',
'        .concat(String(((me36 && me36.perm) || {}).aliases || "").toLowerCase().split(/[^a-z0-9@._+-]+/))',
'        .map((x) => x.trim()).filter((x) => x.includes("@"));',
'      const shut36 = (all || []).filter((d) => !access(u, d.id)).map((d) => d.mailbox);',
'      const open36 = (all || []).filter((d) => access(u, d.id)).map((d) => d.mailbox);',
'      if (!mine36.length || !shut36.length) return out({ mails: [], closed: shut36, addresses: mine36.length, now: Date.now() });',
'      const lim36 = Math.min(Math.max(Number(p.limit) || 300, 1), 400);',
'      const days36 = Math.min(Math.max(Number(p.days) || 400, 1), 2000);',
'      const c36 = await pool.connect();',
'      try {',
'        await c36.query("set statement_timeout = \'25s\'");',
'        const r36 = await c36.query(',
'          `with mine as (',
'             select m.mailbox, m.gmail_id, m.gmail_thread_id, coalesce(m.subject,\'\') subject,',
'                    coalesce(m.to_text,\'\') to_text, coalesce(m.cc_text,\'\') cc_text, m.sent_at,',
'                    coalesce(m.has_attachments,false) has_attachments,',
'                    left(coalesce(m.body_text,\'\'), 4000) body',
'               from public.rm_messages m',
'              where m.mailbox = any($1::text[])',
'                and lower(coalesce(m.from_email,\'\')) = any($2::text[])',
'                and m.sent_at > now() - ($4::int || \' days\')::interval)',
'           select distinct on (x.sent_at, x.subject) x.*',
'             from mine x',
'            where not exists (select 1 from public.rm_messages o',
'                               where o.mailbox = any($5::text[])',
'                                 and lower(coalesce(o.from_email,\'\')) = any($2::text[])',
'                                 and o.sent_at = x.sent_at',
'                                 and coalesce(o.subject,\'\') = x.subject)',
'            order by x.sent_at desc, x.subject, x.mailbox',
'            limit $3`, [shut36, mine36, lim36, days36, open36]);',
'        return out({ mails: r36.rows, closed: shut36, days: days36, now: Date.now() });',
'      } catch (e) {',
'        return out({ error: "Could not look in the other mailboxes: " + String(e.message || e).slice(0, 160) }, 500);',
'      } finally { c36.release(); }',
'    }',
'    /* __mysent:end */',
''
].join("\n");

s = s.replace(ANCHOR, BLOCK + ANCHOR);
fs.writeFileSync(F, s);
fs.writeFileSync(V, WANT + "\n");
console.log("ok  mysent action added to rugs-mail-list.bundle.mjs, server version -> " + WANT);
