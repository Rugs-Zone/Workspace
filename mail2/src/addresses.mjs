// Rugs Email v2 - the ONE function that turns a To / Cc / Bcc header into addresses.
// Rule: addresses come only from real header text, never guessed from the mail body.

const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/;
// Outlook internal / plumbing addresses that must never become a recipient.
const JUNK_DOMAINS = ['shadow.outlook.com'];

function splitTopLevel(text) {
  // Split on , or ; but not inside "quoted names" or <angle brackets>.
  const parts = []; let cur = ''; let q = false; let a = false;
  for (const ch of text) {
    if (ch === '"' && !a) q = !q;
    else if (ch === '<' && !q) a = true;
    else if (ch === '>' && !q) a = false;
    if ((ch === ',' || ch === ';') && !q && !a) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map(s => s.trim()).filter(Boolean);
}

export function parseAddressList(header) {
  if (!header || typeof header !== 'string') return [];
  // Drop pasted image markers like [cid:image001.png@01DC5E7A.12345] before anything else.
  const text = header.replace(/\[cid:[^\]]*\]?/gi, ' ').replace(/\[image:[^\]]*\]/gi, ' ');
  const out = []; const seen = new Set();
  for (const part of splitTopLevel(text)) {
    let name = ''; let email = '';
    const m = part.match(/^(.*)<\s*([^<>]+?)\s*>\s*$/);
    if (m) { name = m[1].trim().replace(/^"|"$/g, '').trim(); email = m[2]; }
    else email = part.replace(/^mailto:/i, '');
    email = email.trim().replace(/^mailto:/i, '').toLowerCase();
    if (!EMAIL.test(email)) continue;
    const domain = email.split('@')[1];
    if (JUNK_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ name: name === email ? '' : name, email });
  }
  return out;
}
