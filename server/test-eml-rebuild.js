/* The attached-mail rules taken out of the shipped bundle and run on Gmail payloads:
 *   - a mail kept whole by Gmail (its own attachmentId) is listed as before
 *   - a mail EXPANDED by Gmail (no attachmentId) is now listed and can be rebuilt
 *   - signature pictures are marked inline, real files are not
 *   node server/test-eml-rebuild.js
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'local-server', 'rugs-mail.bundle.mjs'), 'utf8');
const cut = (from, to) => {
  const a = src.indexOf(from); if (a < 0) throw new Error('not found: ' + from);
  const b = src.indexOf(to, a); if (b < 0) throw new Error('end not found for ' + from);
  return src.slice(a, b);
};
const body = cut('function attachments(p, out = []) {', 'var toStdB64')
  + '\nvar toStdB64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/");\n'
  + 'return { attachments, rfc822Raw };';
const { attachments, rfc822Raw } = new Function('E', body)(class E extends Error { constructor(m) { super(m); } });

const b64u = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const checks = [];
const ok = (n, pass, extra) => checks.push({ n, pass, extra });

/* (1) the ordinary shape, as every real sample looked today */
const whole = {
  mimeType: 'multipart/mixed', parts: [
    { mimeType: 'text/html', body: { data: b64u('<p>hi</p>'), size: 9 } },
    { mimeType: 'message/rfc822', filename: 'ONE - Vessel Departure Notification.eml', body: { attachmentId: 'AID1', size: 32701 }, headers: [{ name: 'Content-Disposition', value: 'attachment' }] }
  ]
};
let a = attachments(whole);
ok('a mail Gmail kept whole is listed with its id', a.length === 1 && a[0].id === 'AID1' && a[0].name === 'ONE - Vessel Departure Notification.eml' && !a[0].rebuild);

/* (2) the suspected shape: no attachmentId, the mail expanded into parts */
const inner = {
  mimeType: 'multipart/alternative',
  headers: [
    { name: 'From', value: '"Venu GOPAL" <venu.gopal@jja-sa.com>' },
    { name: 'To', value: 'teampulse@rugscreation.com' },
    { name: 'Subject', value: 'DO/SO booking charge' },
    { name: 'Date', value: 'Sun, 23 Nov 2026 18:49:28 +0530' },
    { name: 'Content-Type', value: 'multipart/alternative; boundary="IN1"' },
    { name: 'Content-Transfer-Encoding', value: 'quoted-printable' }
  ],
  parts: [
    { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=utf-8' }], body: { data: b64u('plain words'), size: 11 } },
    { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: { data: b64u('<p>Dear <b>Sir</b></p>'), size: 22 } }
  ]
};
const expanded = { mimeType: 'multipart/mixed', parts: [
  { mimeType: 'text/html', body: { data: b64u('<p>see attached</p>'), size: 19 } },
  { mimeType: 'message/rfc822', filename: '', body: { size: 2048 }, headers: [{ name: 'Content-Type', value: 'message/rfc822' }], parts: [inner] }
] };
a = attachments(expanded);
const em = a.find(x => x.rebuild);
ok('a mail Gmail expanded is now listed at all', !!em);
ok('it is named after its subject when the part has no file name (no slashes in a file name)', !!em && em.name === 'DO SO booking charge.eml', em && em.name);
ok('it is marked as a mail file', !!em && em.mime === 'message/rfc822' && em.id === '');

const raw = rfc822Raw(em.part);
ok('the rebuilt file keeps From / To / Subject / Date', /^From: "Venu GOPAL"/m.test(raw) && /^To: teampulse@/m.test(raw) && /^Subject: DO\/SO booking charge/m.test(raw) && /^Date: Sun, 23 Nov 2026/m.test(raw));
ok('it uses CRLF line endings only', raw.indexOf('\n') >= 0 && !/[^\r]\n/.test(raw));
ok('the boundary from the original Content-Type is used', raw.indexOf('--IN1\r\n') >= 0 && raw.indexOf('--IN1--') >= 0);
ok('each body is written as base64 and says so', (raw.match(/Content-Transfer-Encoding: base64/g) || []).length === 2);
ok('the old quoted-printable header is not left behind', !/quoted-printable/i.test(raw));
const htmlPart = Buffer.from((raw.split('--IN1')[2] || '').split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
ok('the body comes back exactly', htmlPart === '<p>Dear <b>Sir</b></p>', JSON.stringify(htmlPart));

/* a nested mail with no parts at all cannot be rebuilt - it must say so, not crash */
let said = '';
try { rfc822Raw({ mimeType: 'message/rfc822', parts: [] }); } catch (e) { said = e.message; }
ok('a mail Gmail could not expand says so instead of crashing', /could not be read/.test(said), said);

/* (3) inline / signature pictures are marked */
const sig = { mimeType: 'multipart/related', parts: [
  { mimeType: 'text/html', body: { data: b64u('<img src="cid:image001.png@01DD">'), size: 10 } },
  { mimeType: 'image/png', filename: 'image001.png', body: { attachmentId: 'A2', size: 4925 }, headers: [{ name: 'Content-Disposition', value: 'inline; filename="image001.png"' }, { name: 'Content-ID', value: '<image001.png@01DD>' }] },
  { mimeType: 'application/pdf', filename: 'Invoice.pdf', body: { attachmentId: 'A3', size: 180000 }, headers: [{ name: 'Content-Disposition', value: 'attachment; filename="Invoice.pdf"' }] },
  { mimeType: 'image/jpeg', filename: 'Rug photo.jpg', body: { attachmentId: 'A4', size: 900000 }, headers: [{ name: 'Content-Disposition', value: 'attachment; filename="Rug photo.jpg"' }] }
] };
a = attachments(sig);
ok('a signature picture is marked inline, with its cid', a[0].inline === true && a[0].cid === 'image001.png@01DD');
ok('a real PDF is not marked inline', !a[1].inline);
ok('a real photo sent on purpose is not marked inline', !a[2].inline);

let bad = 0;
checks.forEach(c => { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.n + (c.pass || !c.extra ? '' : '  -> ' + c.extra)); });
console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
process.exitCode = bad ? 1 : 0;
