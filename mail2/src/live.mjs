// Rugs Email v2 - turn the v1 server's READ-ONLY 'list' answer into rows for one mailbox.
export const MAX_ROWS = 500;   // memory rule M1: newest 500 conversations only

export function when(iso, now = new Date()) {
  const d = new Date(iso); if (!iso || isNaN(d)) return '';
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function toRows(r, box, now = new Date()) {
  const want = String(box).toLowerCase();
  const msgs = {};
  for (const m of r.messages || []) if (String(m.mailbox).toLowerCase() === want) (msgs[m.gmail_thread_id] ||= []).push(m);
  const rows = (r.threads || [])
    .filter(t => String(t.mailbox).toLowerCase() === want)
    .sort((a, b) => String(b.last_msg_at || '').localeCompare(String(a.last_msg_at || '')))
    .slice(0, MAX_ROWS)
    .map((t, i) => {
      const ms = (msgs[t.gmail_thread_id] || []).sort((a, b) => String(a.sent_at || '').localeCompare(String(b.sent_at || '')));
      const last = ms[ms.length - 1] || {};
      const f = String(t.folder || 'inbox').toLowerCase();
      const other = t.counterpart_name || t.counterpart_email || '';
      return {
        id: i + 1, folder: f === 'purged' ? 'deleted' : f,
        from: last.direction === 'out' ? 'To: ' + other : (last.from_name || last.from_email || other),
        subj: t.subject || '(no subject)', pre: t.snippet || last.snippet || '',
        time: when(t.last_msg_at, now), unread: !!t.unread,
        msgs: ms.map(m => ({ from: m.from_name || m.from_email || '', at: when(m.sent_at, now), text: m.snippet || '' })),
        _sent: !!t.has_out,
      };
    });
  // Sent (preview rule): conversations this mailbox wrote in. Per-person Sent comes with rm2_sent.
  const sent = rows.filter(m => m._sent).map(m => ({ ...m, id: m.id + 100000, folder: 'sent', unread: false }));
  return rows.concat(sent);
}
