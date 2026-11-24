/* 24 Nov 2026 - a mail from a COLLEAGUE is incoming mail for the mailbox that receives it.
 *
 * Why: every @rugscreation.com sender is stored as direction 'out' (the 14 Nov rule "anyone
 * @rugscreation.com = our side", which is right for reply times). But rebuildThread then used
 * that same word for "did somebody write to us?", so a mail from packaging@ to teampulse@:
 *   - never made the conversation UNREAD   (unread only looked at direction 'in')
 *   - never REOPENED a conversation already marked Done
 * The conversation therefore stayed closed and read, so it was missing from the Inbox under the
 * Open / Unread filters and from every work list, while Sent still showed it (our reply is in it).
 *
 * A colleague's mail = direction 'out', NOT sent from Rugs Email (no sent_by) and from an
 * address that is not the mailbox itself. has_in / has_out / counterpart / first_reply_at are
 * deliberately NOT changed: the auto-assign rules, the topic tagger and the out-of-office reply
 * read has_in, and "our side" is still our side for reply times.
 *
 *   node server/patch-colleague-mail.js
 */
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, 'local-server', 'rugs-mail.bundle.mjs');
let s = fs.readFileSync(F, 'utf8');
const before = s;
let n = 0;
const sub = (a, b) => {
  const i = s.split(a).length - 1;
  if (i !== 1) throw new Error('anchor found ' + i + ' times: ' + a.slice(0, 70));
  s = s.replace(a, b); n++;
};

/* 1. rebuildThread needs sent_by to tell a colleague's mail from one sent here */
sub(
  `select("direction,subject,snippet,sent_at,labels,from_email,from_name,to_text,cc_text,delivered_to,list_unsub")`,
  `select("direction,subject,snippet,sent_at,labels,from_email,from_name,to_text,cc_text,delivered_to,list_unsub,sent_by")`
);

/* 2. one helper next to ext() */
sub(
  `  const ext = (x) => x.direction === "in" && !isOwn(String(x.from_email || "").toLowerCase());
  const last = ms[ms.length - 1], firstIn = ms.find(ext);`,
  `  const ext = (x) => x.direction === "in" && !isOwn(String(x.from_email || "").toLowerCase());
  /* 24 Nov 2026: a colleague's mail (another @rugscreation.com address, not sent from Rugs Email)
     is mail somebody sent TO this mailbox - it makes the conversation unread and reopens it. */
  const colleague = (x) => x.direction === "out" && !x.sent_by && String(x.from_email || "").toLowerCase() !== String(box).toLowerCase() && isOwn(String(x.from_email || "").toLowerCase());
  const inb = (x) => ext(x) || colleague(x);
  const last = ms[ms.length - 1], firstIn = ms.find(ext);`
);

/* 3. unread: a colleague's new mail counts too */
sub(
  `    unread: ms.some((x) => ext(x) && (x.labels || []).includes("UNREAD")),`,
  `    unread: ms.some((x) => inb(x) && (x.labels || []).includes("UNREAD")),`
);

/* 4. reopen a Done conversation when a colleague writes back */
sub(
  `  } else if (!auto && cur && cur.status === "done" && newIn && last.direction === "in") {`,
  `  } else if (!auto && cur && cur.status === "done" && newIn && inb(last)) {`
);

/* 5. ... and tell rebuildThread that such a mail IS new incoming mail */
sub(
  `        touched.set(m.threadId, touched.get(m.threadId) || false || r.direction === "in");`,
  `        touched.set(m.threadId, touched.get(m.threadId) || false || r.direction === "in" || (!r.sent_by && String(r.from_email || "").toLowerCase() !== String(box).toLowerCase() && isOwn(String(r.from_email || "").toLowerCase())));`
);

/* 6. Mark unread must reach Gmail for a conversation whose only incoming mail is a colleague's
      (there is no direction 'in' row to put the UNREAD label on). */
sub(
  `        const { data: m } = await sb.from("rm_messages").select("gmail_id").eq("mailbox", box).eq("gmail_thread_id", tid).eq("direction", "in").order("sent_at", { ascending: false }).limit(1).maybeSingle();`,
  `        let { data: m } = await sb.from("rm_messages").select("gmail_id").eq("mailbox", box).eq("gmail_thread_id", tid).eq("direction", "in").order("sent_at", { ascending: false }).limit(1).maybeSingle();
        if (!m) {
          /* 24 Nov 2026: a colleague's mail - newest message that is not ours and was not sent from here */
          const { data: all } = await sb.from("rm_messages").select("gmail_id,from_email,sent_by,sent_at").eq("mailbox", box).eq("gmail_thread_id", tid).order("sent_at", { ascending: false }).limit(20);
          m = (all || []).find((x) => !x.sent_by && String(x.from_email || "").toLowerCase() !== String(box).toLowerCase()) || null;
        }`
);

if (s === before) throw new Error('nothing changed');
fs.writeFileSync(F, s);
console.log('rugs-mail.bundle.mjs patched, ' + n + ' edits');
