/* Opens a real .eml inside the real built app (mail-app.html, which is what mail.html loads,
 * with the live 2.0 layout from mail-v2.js) in a real browser.
 *   node server/test-eml-preview.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
/* the real live page: mail.html fetches mail-app.html and then adds mail-v2.js (the 2.0 layout
   everybody sees), so it has to be served over http, the same way the office site does. */
const PORT = 8739;
const FILE = 'http://127.0.0.1:' + PORT + '/mail.html';
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.txt': 'text/plain', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const srv = require('http').createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/') f = '/mail.html';
  require('fs').readFile(path.join(ROOT, f), (e, d) => {
    if (e) { r.writeHead(404); return r.end('not here'); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    r.end(d);
  });
}).listen(PORT);

process.on('uncaughtException', () => {});   /* the browser closing after the run is not a failure */
const checks = [];
const ok = (n, pass, extra) => checks.push({ n, pass, extra });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(3000);

  const r = await page.evaluate(async () => {
    const out = {};
    /* a signed-in screen, so the app's own handlers have a person to look at */
    DEPTS = [{ id: 'tp', name: 'Team Pulse', box: 'teampulse@rugscreation.com', color: '#0a0' }];
    PEOPLE = [{ id: 'ashok', name: 'Ashok', login: 'merchandiser5@rugscreation.com', dept: 'tp', role: 'Executive', perm: {}, access: {}, active: true }];
    ME = 'ashok';
    document.body.classList.remove('signedout');
    /* a real mail file: encoded subject, an inline picture, a remote picture, a script,
       a PDF attachment and a mail attached inside it */
    const CRLF = '\r\n';
    const inner = [
      'From: Inner Sender <inner@example.com>', 'To: box@rugscreation.com',
      'Subject: The mail inside', 'Date: Mon, 17 Nov 2026 10:00:00 +0530',
      'Content-Type: text/plain; charset=utf-8', '', 'I am the mail inside.'
    ].join(CRLF);
    const eml = [
      'From: "Venu GOPAL" <venu.gopal@jja-sa.com>',
      'To: teampulse@rugscreation.com',
      'Cc: sahil@rugscreation.com',
      'Date: Sun, 23 Nov 2026 18:49:28 +0530',
      'Subject: =?UTF-8?B?' + btoa(unescape(encodeURIComponent('Booking – DO/SO charge'))) + '?=',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="BB"',
      '',
      '--BB',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '<html><head><script>window.__evil=1<\/script><style>p{color:#c00}</style></head>' +
      '<body><p>Dear Sir,</p><p>Please note the <b>charge</b>.</p>' +
      '<img src=3D"https://example.com/tracker.gif" width=3D"1">' +
      '<a href=3D"javascript:alert(1)">bad</a></body></html>',
      '--BB',
      'Content-Type: application/pdf; name="Invoice 77/26.pdf"',
      'Content-Disposition: attachment; filename="Invoice 77/26.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      btoa('%PDF-1.4 fake'),
      '--BB',
      'Content-Type: message/rfc822',
      'Content-Disposition: attachment; filename="The mail inside.eml"',
      '',
      inner,
      '--BB--', ''
    ].join(CRLF);
    const u8 = new TextEncoder().encode(eml);

    out.exportedMount = typeof window.rzEmlMount === 'function';
    out.exportedIs = typeof window.rzEmlIs === 'function' && window.rzEmlIs('a.eml', '') === true
      && window.rzEmlIs('a.pdf', 'message/rfc822') === true && window.rzEmlIs('a.pdf', 'application/pdf') === false;

    /* the app's own reader, drawn straight into a box */
    const box = document.createElement('div');
    document.body.appendChild(box);
    window.rzEmlMount(box, u8, 'Booking.eml');
    const hdr = box.querySelector('.emlh') ? box.querySelector('.emlh').textContent : '';
    out.hdrFrom = /venu\.gopal@jja-sa\.com/.test(hdr);
    out.hdrTo = /teampulse@rugscreation\.com/.test(hdr);
    out.hdrCc = /sahil@rugscreation\.com/.test(hdr);
    out.hdrDate = /23 Nov 2026/.test(hdr);
    out.hdrSubject = hdr.indexOf('Booking') >= 0 && hdr.indexOf('DO/SO charge') >= 0;   // encoded word decoded
    out.picsBlocked = !!box.querySelector('[data-emlpics]');
    const fr = box.querySelector('.raw iframe');
    out.sandboxed = !!fr && fr.getAttribute('sandbox') !== null && fr.getAttribute('sandbox').indexOf('allow-scripts') < 0;
    const doc = fr ? fr.getAttribute('srcdoc') : '';
    out.bodyShown = /Please note the/.test(doc) && /<b>charge<\/b>/.test(doc);
    out.noScript = !/<script/i.test(doc) && !window.__evil;
    out.noJsLink = !/javascript:/i.test(doc);
    /* blocking is done with a Content-Security-Policy inside the frame (not by stripping src) */
    out.remoteBlocked = /Content-Security-Policy/i.test(doc) && /img-src data: blob: cid:/.test(doc);
    out.files = box.querySelectorAll('.emlat .cf').length;
    out.fileNames = [...box.querySelectorAll('.emlat .cfn')].map(x => x.textContent).join(' | ');
    out.canOpenFile = !!box.querySelector('[data-emlv="0"]');
    out.canSaveFile = !!box.querySelector('[data-emld="0"]');
    /* Show pictures brings them back */
    const b = box.querySelector('[data-emlpics]'); if (b) b.click();
    const fr2 = box.querySelector('.raw iframe');
    out.picsShown = !!fr2 && !/Content-Security-Policy/i.test(fr2.getAttribute('srcdoc'))
      && /example\.com\/tracker\.gif/.test(fr2.getAttribute('srcdoc'));

    /* now the live 2.0 viewer: a tile for the same file, clicked like a person would */
    window.rzAttBytes = () => Promise.resolve({ u8, mime: 'message/rfc822' });
    document.body.classList.add('v2');
    let read = document.getElementById('read');
    if (!read) { read = document.createElement('div'); read.id = 'read'; document.body.appendChild(read); }
    read.innerHTML = '<div class="v2atts"><button type="button" class="v2att" data-v2att data-box="teampulse@rugscreation.com"' +
      ' data-gid="1a2089079a40961b" data-name="Booking.eml" data-size="' + u8.length + '" data-mime="message/rfc822" data-link=""></button></div>';
    read.querySelector('[data-v2att]').click();
    await new Promise(r => setTimeout(r, 400));
    const vw = document.querySelector('.v2vw');
    out.viewerOpened = !!vw;
    out.viewerNotRefusing = !!vw && !/can't be previewed/i.test(vw.textContent);
    out.viewerDrewMail = !!vw && !!vw.querySelector('.v2veml .emlh');
    out.viewerHasDownload = !!vw && !!vw.querySelector('[data-vw="dl"]');
    out.viewerBadge = !!vw && /MAIL/.test(vw.querySelector('.v2badge') ? vw.querySelector('.v2badge').textContent : '');
    out.viewerPicsBlocked = !!vw && !!vw.querySelector('[data-emlpics]');
    out.viewerFiles = vw ? vw.querySelectorAll('.emlat .cf').length : -1;
    /* an Outlook .msg says so instead of "can't be previewed" */
    read.querySelector('[data-v2att]').setAttribute('data-name', 'Something.msg');
    read.querySelector('[data-v2att]').setAttribute('data-mime', 'application/vnd.ms-outlook');
    if (vw) vw.querySelector('[data-vw="close"]').click();
    read.querySelector('[data-v2att]').click();
    await new Promise(r => setTimeout(r, 300));
    const vw2 = document.querySelector('.v2vw');
    out.msgSaysOutlook = !!vw2 && /Outlook \.msg file/.test(vw2.textContent) && !!vw2.querySelector('[data-vw="dl"]');
    /* DOWNLOAD: the viewer's ⬇ Download, and Save on a file inside the attached mail.
       saveFile() is the app's one way of handing a file to the browser - it is watched here. */
    const saved = [];
    const realSave = window.rzSaveFile;
    window.rzSaveFile = (data, nm, mime) => { saved.push({ nm, mime, n: data && (data.length || data.size) || 0 }); };
    read.querySelector('[data-v2att]').setAttribute('data-name', 'Booking.eml');
    read.querySelector('[data-v2att]').setAttribute('data-mime', 'message/rfc822');
    if (document.querySelector('.v2vw')) document.querySelector('[data-vw="close"]').click();
    read.querySelector('[data-v2att]').click();
    await new Promise(r => setTimeout(r, 400));
    document.querySelector('.v2vw [data-vw="dl"]').click();
    await new Promise(r => setTimeout(r, 400));
    out.dlName = saved.length ? saved[0].nm : '';
    out.dlMime = saved.length ? String(saved[0].mime || '') : '';
    out.dlBytes = saved.length ? saved[0].n : 0;
    out.emlSize = u8.length;
    window.rzSaveFile = realSave;
    /* a file inside the attached mail: saveFile() puts a download link in the page, clicks it and
       takes it away again, so the link itself is what gets watched here */
    const links = [];
    new MutationObserver(ms => ms.forEach(m => [...m.addedNodes].forEach(nd => {
      if (nd.tagName === 'A' && nd.hasAttribute('download')) links.push(nd.getAttribute('download'));
    }))).observe(document.body, { childList: true, subtree: true });
    box.querySelector('[data-emld="0"]').click();
    box.querySelector('[data-emld="1"]').click();
    await new Promise(r => setTimeout(r, 300));
    out.innerName = links[0] || '';
    out.nestedName = links[1] || '';
    out.innerBytes = links.length ? 1 : 0;
    /* a damaged file does not fail silently */
    const box2 = document.createElement('div'); document.body.appendChild(box2);
    window.rzEmlMount(box2, new Uint8Array(0), 'empty.eml');
    out.emptySaysSo = /empty or damaged/.test(box2.textContent);
    return out;
  });

  ok('the app hands its .eml reader to the 2.0 layout (window.rzEmlMount)', r.exportedMount);
  ok('a .eml and a message/rfc822 file are recognised, a PDF is not', r.exportedIs);
  ok('From is shown', r.hdrFrom);
  ok('To is shown', r.hdrTo);
  ok('Cc is shown', r.hdrCc);
  ok('Date is shown', r.hdrDate);
  ok('the subject is decoded, not shown as =?UTF-8?B?...', r.hdrSubject);
  ok('the body is drawn, with its formatting', r.bodyShown);
  ok('the body is in a sandboxed frame with no scripts allowed', r.sandboxed);
  ok('the script inside the mail is removed and did not run', r.noScript);
  ok('a javascript: link is removed', r.noJsLink);
  ok('pictures from the internet are blocked by default', r.picsBlocked && r.remoteBlocked);
  ok('"Show pictures" brings them back', r.picsShown);
  ok('its own files are listed (PDF + the mail inside it)', r.files === 2, 'files=' + r.files + ' [' + r.fileNames + ']');
  ok('each file has Open and Save', r.canOpenFile && r.canSaveFile);
  ok('the 2.0 viewer opens on a click', r.viewerOpened);
  ok('it no longer answers "This kind of file can\'t be previewed"', r.viewerNotRefusing);
  ok('it draws the mail, with its header', r.viewerDrewMail);
  ok('Download is offered in the viewer', r.viewerHasDownload);
  ok('the tile and viewer badge say MAIL', r.viewerBadge);
  ok('pictures are blocked in the viewer too', r.viewerPicsBlocked);
  ok('the files of the attached mail are listed in the viewer', r.viewerFiles === 2, 'files=' + r.viewerFiles);
  ok('an Outlook .msg explains itself and offers Download', r.msgSaysOutlook);
  ok('Download in the viewer saves the file under its own name', r.dlName === 'Booking.eml', 'got "' + r.dlName + '"');
  ok('it is saved as a mail file (message/rfc822)', /message\/rfc822/.test(r.dlMime), 'got "' + r.dlMime + '"');
  ok('every byte of it is saved', r.dlBytes === r.emlSize, r.dlBytes + ' of ' + r.emlSize + ' bytes');
  ok('a file inside the attached mail saves under its own name', /Invoice 77.26.pdf/.test(r.innerName), 'got "' + r.innerName + '"');
  ok('a mail attached inside the mail saves too (.eml in .eml)', /\.eml$/.test(r.nestedName), 'got "' + r.nestedName + '"');
  ok('an empty or damaged mail file says so', r.emptySaysSo);
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  let bad = 0;
  checks.forEach(c => { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.n + (c.pass || !c.extra ? '' : '  -> ' + c.extra)); });
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  await browser.close();
  srv.close();
  process.exitCode = bad ? 1 : 0;
})();
