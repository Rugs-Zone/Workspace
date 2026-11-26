/* 26 Nov 2026 - "where is this conversation, really?" - a lookup on the Server page.

   Four times this week a mail has been reported missing, and each time the answer lived in
   the live database on the office PC, which cannot be read from the laptop: is it stored at
   all, which folder is it in, who owns it, is it Done, is it unread. Guessing from Gmail and
   the rules gets close but not all the way.

   So the Server page (Admin -> Server, admin only, read-only) gets a box: type part of a
   subject, a Gmail id or a sender address and it answers from rm_threads / rm_messages:

     mailbox | folder | status | owner | unread | messages | newest mail | Gmail thread id

   That is the whole diagnosis in one line, for anybody, in seconds - instead of a code
   change and a ten-minute update cycle each time.

   Read-only: it is a SELECT with a LIMIT, behind the same admin check as the rest of the
   page, and it never returns body text - subject, addresses and state only.

   Run:  node server/patch-find-conversation.js     (server side)
   then: node server/patch-find-conversation.js app (the page), then mailapp-b64 encode
*/
const fs = require("fs");
const which = process.argv[2] === "app" ? "app" : "server";

if (which === "server") {
  const file = __dirname + "/local-server/server.mjs";
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("__findconv:start")) { console.log("server: already there"); process.exit(0); }
  const anchor = "  const f = logFileTail(n);";
  if (!s.includes(anchor)) throw new Error("serverStatus was not found");
  const add = [
    "  /* __findconv:start 26 Nov 2026: look a conversation up in the live database */",
    "  if (p.look && String(p.look).trim().length >= 3) {",
    "    const q = String(p.look).trim().slice(0, 120);",
    "    try {",
    "      const r = await pool.query(",
    "        `select t.mailbox, t.gmail_thread_id, left(t.subject,90) subject, coalesce(t.folder,'inbox') folder,",
    "                coalesce(t.status,'new') status, t.owner_id, t.unread, t.msg_count, t.last_msg_at,",
    "                t.counterpart_email, (select u.name from public.rm_users u where u.id = t.owner_id) owner_name",
    "           from public.rm_threads t",
    "          where t.subject ilike '%' || $1 || '%'",
    "             or t.gmail_thread_id = $1",
    "             or t.counterpart_email ilike '%' || $1 || '%'",
    "             or exists (select 1 from public.rm_messages m",
    "                         where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id",
    "                           and (m.gmail_id = $1 or lower(m.from_email) = lower($1)))",
    "          order by t.last_msg_at desc limit 25`, [q]);",
    "      out.found = r.rows;",
    "      out.found_for = q;",
    "    } catch (e) { out.found = []; out.found_error = String(e.message || e).slice(0, 160); }",
    "  }",
    "  /* __findconv:end */"
  ].join(s.includes("\r\n") ? "\r\n" : "\n");
  s = s.replace(anchor, add + (s.includes("\r\n") ? "\r\n" : "\n") + anchor);
  fs.writeFileSync(file, s);
  console.log("server: the Server page can now look a conversation up in the live database");
  process.exit(0);
}

/* ---- the page ---- */
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__findconvui:start")) { console.log("app: already there"); process.exit(0); }

const block = String.raw`
<script>/* __findconvui:start  26 Nov 2026: "where is this conversation?" on the Server page */
let SRVFIND2 = '', SRVFOUND = null;
const _srvH = srvHTML;
srvHTML = function () {
 let h = _srvH.apply(this, arguments);
 try {
  const rows = (SRV && SRV.found) || null;
  const box = '<section class="box"><h3>Where is a conversation?</h3>'
   + '<p class="lead" style="margin:0 0 8px">Type part of a subject, a sender’s address or a Gmail id. It answers from the live database — which mailbox it is in, which folder, who owns it, whether it is Done or unread. Read-only.</p>'
   + '<div class="srvbar"><input type="search" id="srvlook" value="' + esc(SRVFIND2) + '" placeholder="e.g. Geo Chenille, or aman@induskrafts.com">'
   + '<button class="btn pri" data-srvlook>Look it up</button></div>'
   + (rows ? (rows.length
      ? '<div class="atable"><table><thead><tr><th>Mailbox</th><th>Subject</th><th>Folder</th><th>Status</th><th>Owner</th><th>Unread</th><th>Mails</th><th>Newest</th></tr></thead><tbody>'
        + rows.map(function (r) {
            const bad = (r.folder !== 'inbox');
            return '<tr' + (bad ? ' style="background:color-mix(in srgb,var(--bad) 10%,transparent)"' : '') + '>'
             + '<td>' + esc(String(r.mailbox).split('@')[0]) + '</td>'
             + '<td>' + esc(String(r.subject || '').slice(0, 60)) + '</td>'
             + '<td><b>' + esc(r.folder) + '</b></td>'
             + '<td>' + esc(r.status) + '</td>'
             + '<td>' + esc(r.owner_name || (r.owner_id ? r.owner_id : 'nobody')) + '</td>'
             + '<td>' + (r.unread ? 'yes' : 'no') + '</td>'
             + '<td>' + (r.msg_count || 0) + '</td>'
             + '<td class="sub">' + esc(tShort(new Date(r.last_msg_at).getTime())) + '</td></tr>';
          }).join('')
        + '</tbody></table></div><p class="lead" style="margin:6px 0 0">A row shaded red is NOT in the Inbox — its folder says where it went.</p>'
      : '<p class="lead">Nothing in the database matches “' + esc(SRV.found_for || '') + '”.</p>') : '')
   + ((SRV && SRV.found_error) ? '<p class="lead" style="color:var(--bad)">' + esc(SRV.found_error) + '</p>' : '')
   + '</section>';
  h = box + h;
 } catch (e) {}
 return h;
};
const _rndFind = render;
render = function () {
 const a = document.activeElement, had = !!(a && a.id === 'srvlook'), pos = had ? a.selectionStart : null;
 const r = _rndFind.apply(this, arguments);
 try {
  const inp = document.getElementById('srvlook');
  if (inp) {
   inp.onchange = function () { SRVFIND2 = inp.value.trim(); };
   inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); SRVFIND2 = inp.value.trim(); srvLook(); } };
   if (had) { try { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); } catch (x) {} }
  }
  const b = document.querySelector('[data-srvlook]');
  if (b) b.onclick = function () { const i = document.getElementById('srvlook'); SRVFIND2 = i ? i.value.trim() : SRVFIND2; srvLook(); };
 } catch (e) {}
 return r;
};
function srvLook() {
 if (!SRVFIND2 || SRVFIND2.length < 3) { toast('Type at least three letters'); return; }
 const b = document.querySelector('[data-srvlook]'); if (b) { b.disabled = true; b.textContent = 'Looking…'; }
 api('serverStatus', { lines: 40, look: SRVFIND2 }).then(function (r) { SRV = r; SRVERR = ''; })
  .catch(function (e) { SRVERR = e.message || 'the server did not answer'; })
  .then(function () { if (app === 'admin' && adminTab === 'srv') render(); });
}
/* __findconvui:end */</script>`;

s = s.replace(/\s*$/, "") + "\n" + block + "\n";
fs.writeFileSync(file, s);
console.log("app: the Server page has a 'Where is a conversation?' box");
