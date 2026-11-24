/* 24 Nov 2026 - Rugs Email 2.0 (the live layout) opens an attached mail (.eml) in its own
 * full-screen viewer, next to pictures, PDF, Excel, Word and PowerPoint.
 * Before: kindOf() knew no .eml, so it came out as v:"none" and the viewer answered
 * "This kind of file can't be previewed". The reader itself already existed in the app
 * (emlMount) and is now handed over on window.rzEmlMount.
 *   node server/patch-eml-v2.js
 */
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'mail-v2.js');
let s = fs.readFileSync(F, 'utf8');
/* this file is saved with Windows line endings - work in plain newlines and put them back */
const CRLF = s.indexOf('\r\n') >= 0;
if (CRLF) s = s.split('\r\n').join('\n');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 60));
  s = s.replace(a, b); n++;
};

/* 1. an attached mail is its own kind of file (.eml, and Outlook's .msg) */
sub(
  'l: "ZIP", v: "none" }\n  ];',
  'l: "ZIP", v: "none" },\n' +
  '    /* 24 Nov 2026: a mail sent as a file - drawn by the app\'s own .eml reader (window.rzEmlMount) */\n' +
  '    { re: ' + String.raw`/\.eml$/i` + ', c: "#0f6cbd", l: "MAIL", v: "eml" },\n' +
  '    { re: ' + String.raw`/\.msg$/i` + ', c: "#0f6cbd", l: "MAIL", v: "msg" }\n  ];'
);

/* 2. ... and message/rfc822 even when the file name does not end in .eml */
sub(
  '    if (/^image' + String.raw`\/` + '/i.test(mime || "")) return KIND[4];',
  '    if (/message' + String.raw`\/` + 'rfc822/i.test(mime || "")) return { c: "#0f6cbd", l: "MAIL", v: "eml" };\n' +
  '    if (/^image' + String.raw`\/` + '/i.test(mime || "")) return KIND[4];'
);

/* 3. draw it. Outlook .msg cannot be read in a browser, so it says so and offers the file. */
sub(
  '    if (k.v === "none") { fail("This kind of file can\'t be previewed. Download it to open it."); return; }',
  [
    '    if (k.v === "msg") {',
    '      body.innerHTML = \'<div class="v2vmsg"><b>\' + txt(a.name) + \'</b><span>This is an Outlook .msg file. It cannot be opened here \\u2014 download it and open it in Outlook.</span><div class="v2vacts"><button type="button" class="v2vb" data-vw="dl">\\u2b07 Download</button></div></div>\';',
    '      return;',
    '    }',
    '    /* 24 Nov 2026: a mail sent as a file, read in the browser and drawn like a received mail',
    '       (header, body in the same sandboxed frame, pictures from the internet blocked, its own',
    '       files openable) - Google Drive has no viewer for message/rfc822 at all. */',
    '    if (k.v === "eml") {',
    '      if (typeof window.rzEmlMount !== "function") { fail("This mail file cannot be shown on this page. Download it to open it."); return; }',
    '      if (!a.gid) { fail("The original mail is not available."); return; }',
    '      bytes(a).then(function (b) {',
    '        if (VW !== me || VW.cur !== a) return;',
    '        body.innerHTML = \'<div class="v2veml"></div>\';',
    '        window.rzEmlMount(body.firstChild, b.u8, a.name);',
    '      }).catch(function (e) { if (VW !== me || VW.cur !== a) return; fail(e && e.message ? e.message : "Could not open the mail file."); });',
    '      return;',
    '    }',
    '    if (k.v === "none") { fail("This kind of file can\'t be previewed. Download it to open it."); return; }'
  ].join('\n')
);

/* 4. room for it: the mail inside is drawn on a white sheet and scrolls like a document */
sub(
  "    '@media (max-width:760px){body.v2 .v2vnav",
  "    'body.v2 .v2veml{background:#fff;color:#201f1e;padding:14px 16px;max-width:980px;margin:0 auto;width:100%;overflow:auto}',\n" +
  "    'body.v2 .v2veml .emlh{background:#f5f5f5;border-color:#e1dfdd}',\n" +
  "    '@media (max-width:760px){body.v2 .v2vnav"
);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(F, s);
console.log('mail-v2.js patched, ' + n + ' edits');
