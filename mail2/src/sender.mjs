// Rugs Email v2 - who SENT a mail. Decided once, stored in rm2_sent, never guessed again.
// Order: (1) sent from the app -> we already know the user id.
//        (2) From address is someone's login / alias -> that person.
//        (3) From NAME matches exactly ONE person's name alias -> that person.
//        Two people with the same name -> nobody (no guessing).

// "Arun – Rugs Creation", "Arun | Team Pulse", "Arun (Rugs Creation)" -> "arun"
export function cleanSenderName(name) {
  if (!name) return '';
  let n = String(name).replace(/^"|"$/g, '').trim();
  n = n.replace(/\s*\((?:[^)]*)\)\s*$/, '');           // trailing (Company)
  n = n.split(/\s+[–—\-|:@]\s+/)[0];                   // "Name – Company"
  n = n.replace(/\s*[–—|]\s*.*$/, '');                 // "Name–Company" without spaces
  return n.replace(/\s+/g, ' ').trim().toLowerCase();
}

// aliases: [{ user_id, kind:'email'|'name', value }]
export function whoSent(msg, aliases) {
  if (msg.app_user_id) return { user_id: msg.app_user_id, how: 'app' };
  const from = String(msg.from_email || '').trim().toLowerCase();
  const byEmail = aliases.filter(a => a.kind === 'email' && a.value === from);
  if (byEmail.length === 1) return { user_id: byEmail[0].user_id, how: 'gmail-login' };
  const name = cleanSenderName(msg.from_name);
  if (!name) return null;
  const owners = new Set(aliases.filter(a => a.kind === 'name' && a.value === name).map(a => a.user_id));
  if (owners.size === 1) return { user_id: [...owners][0], how: 'gmail-alias' };
  return null; // zero or 2+ people -> do not guess
}
