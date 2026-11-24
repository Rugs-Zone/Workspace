/* 24 Nov 2026 - the download side of an attached mail (.eml).
 *
 * Checked first against real Gmail (seven mailboxes, 60 days): every attached mail IS stored by
 * Gmail as its own part with its own attachmentId, and the bytes come back fine - so nothing was
 * wrong with finding or fetching them. The one real failure was SIZE: a mail sent as a file
 * carries the original's own attachments, so it is often far bigger than an ordinary file (real
 * ones found today: 27 MB, 8.6 MB, 4.4 MB, 1.9 MB) and the download refused everything over
 * 15 MB. On this server that limit is no longer needed (it was written for an edge function with
 * 150 MB of memory for everything); it is raised to 25 MB and, past that, the message says the
 * real size and what to do instead of a bare "Over 15 MB".
 *
 * Also: when two parts of one mail have the same file name (a mail forwarded as a file, with the
 * same mail attached inside it again), the right one is the outer part - the one the attachment
 * list shows - so the search now prefers a match whose size is the one the list recorded.
 *
 *   node server/patch-eml-server.js
 */
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, 'local-server', 'rugs-mail.bundle.mjs');
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 70));
  s = s.replace(a, b); n++;
};

sub(
  '      const a2 = attachments(m.payload).find((x) => x.name === p.name) || inlineParts(m.payload).find((x) => x.name === p.name);\n' +
  '      if (!a2) throw new E("Attachment not found", 404);\n' +
  '      if ((a2.size || 0) > 15 * 1024 * 1024) throw new E("Over 15 MB \\u2014 open it in Google Drive or Gmail");',

  '      /* 24 Nov 2026: with p.size (the size the attachment list recorded) the right part is picked\n' +
  '         when one mail carries two parts of the same name - a mail attached inside a mail. */\n' +
  '      const named = attachments(m.payload).filter((x) => x.name === p.name).concat(inlineParts(m.payload).filter((x) => x.name === p.name));\n' +
  '      const want = Number(p.size) || 0;\n' +
  '      const a2 = (want && named.find((x) => Math.abs((x.size || 0) - want) <= 64)) || named[0];\n' +
  '      if (!a2) throw new E("Attachment not found", 404);\n' +
  '      const mb = (a2.size || 0) / 1048576;\n' +
  '      if (mb > 25) throw new E("This file is " + mb.toFixed(1) + " MB \\u2014 too big to open in Rugs Email. Open the mail in Gmail to get it.");'
);

fs.writeFileSync(F, s);
console.log('rugs-mail.bundle.mjs patched, ' + n + ' edits');
