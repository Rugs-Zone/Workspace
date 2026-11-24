/* An attached mail (.eml) in the REAL live page: mail.html fetches mail-app.html and adds
 * mail-v2.js (the 2.0 layout everybody sees), so it is served over http here, as the site does.
 * Checks the Rugs Email look, that pictures show, that scripts cannot, the file list, the
 * download, and opening a .eml that is already on the computer.
 *   node server/test-eml-preview.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '.tmp', 'node_modules', 'playwright-core'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
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
process.on('uncaughtException', () => {});

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
    DEPTS = [{ id: 'tp', name: 'Team Pulse', box: 'teampulse@rugscreation.com', color: '#0a0' }];
    PEOPLE = [{ id: 'ashok', name: 'Ashok', login: 'merchandiser5@rugscreation.com', dept: 'tp', role: 'Executive', perm: {}, access: {}, active: true }];
    ME = 'ashok';
    document.body.classList.remove('signedout');

    const CRLF = '\r\n';
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    const inner = ['From: Inner Sender <inner@example.com>', 'To: box@rugscreation.com',
      'Subject: The mail inside', 'Date: Mon, 17 Nov 2026 10:00:00 +0530',
      'Content-Type: text/plain; charset=utf-8', '', 'I am the mail inside.'].join(CRLF);
    const eml = [
      'From: "Venu GOPAL" <venu.gopal@jja-sa.com>',
      'To: teampulse@rugscreation.com, Sahil <sahil@rugscreation.com>',
      'Cc: accounts@jja-sa.com',
      'Date: Sun, 23 Nov 2026 18:49:28 +0530',
      'Subject: =?UTF-8?B?' + btoa(unescape(encodeURIComponent('Booking – DO/SO charge'))) + '?=',
      'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="BB"', '',
      '--BB', 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '',
      '<html><head><script>window.__evil=1<\/script><style>p{color:#c00}</style></head>' +
      '<body><p>Dear Sir,</p><p>Please note the <b>charge</b>.</p>' +
      '<img src=3D"cid:image001.png@01DD" width=3D"120">' +
      '<img src=3D"https://example.com/remote.gif" width=3D"80">' +
      '<a href=3D"javascript:alert(1)">bad</a></body></html>',
      '--BB', 'Content-Type: image/png; name="image001.png"',
      'Content-Disposition: inline; filename="image001.png"', 'Content-ID: <image001.png@01DD>',
      'Content-Transfer-Encoding: base64', '', PNG,
      '--BB', 'Content-Type: image/png; name="Outlook-signature.png"',
      'Content-Disposition: inline; filename="Outlook-signature.png"', 'Content-Transfer-Encoding: base64', '', PNG,
      '--BB', 'Content-Type: application/pdf; name="Invoice 77-26.pdf"',
      'Content-Disposition: attachment; filename="Invoice 77-26.pdf"', 'Content-Transfer-Encoding: base64', '',
      btoa('%PDF-1.4 fake'),
      '--BB', 'Content-Type: message/rfc822', 'Content-Disposition: attachment; filename="The mail inside.eml"', '',
      inner, '--BB--', ''
    ].join(CRLF);
    const u8 = new TextEncoder().encode(eml);

    out.exported = typeof window.rzEmlMount === 'function' && typeof window.rzEmlOpenLocal === 'function' && typeof window.rzEmlPick === 'function';

    const box = document.createElement('div');
    document.body.appendChild(box);
    window.rzEmlMount(box, u8, 'Booking.eml');

    out.tag = (box.querySelector('.emltag') || {}).textContent || '';
    out.subjectTitle = (box.querySelector('.emlsub') || {}).textContent || '';
    const card = box.querySelector('article.mail');
    out.isMessageCard = !!card;
    out.hasAvatar = !!(card && card.querySelector('header > span, header .av'));
    const hdr = card ? card.querySelector('header').textContent : '';
    out.name = /Venu GOPAL/.test(hdr);
    out.address = /venu\.gopal@jja-sa\.com/.test(hdr);
    out.toLine = /To:/.test(hdr) && /teampulse@rugscreation\.com/.test(hdr);
    out.ccLine = /Cc:/.test(hdr) && /accounts@jja-sa\.com/.test(hdr);
    out.date = /23 Nov/.test(hdr) && /6:49/.test(hdr);   /* the app's own date format, as in the reading pane */
    const fr = card && card.querySelector('.mbody .raw iframe');
    out.sameFrame = !!fr && (fr.getAttribute('sandbox') || '').indexOf('allow-scripts') < 0;
    const doc = fr ? fr.getAttribute('srcdoc') : '';
    out.body = /Please note the/.test(doc) && /<b>charge<\/b>/.test(doc);
    out.cidPicture = /src="data:image\/png;base64,/.test(doc);
    out.remotePicture = /example\.com\/remote\.gif/.test(doc) && !/Content-Security-Policy/i.test(doc);
    out.noScript = !/<script/i.test(doc) && !window.__evil;
    out.noJsLink = !/javascript:/i.test(doc);
    out.noPicBar = !box.querySelector('[data-emlpics]');
    const chips = [...box.querySelectorAll('.att')].map(x => x.textContent);
    out.chipCount = chips.length;
    out.chips = chips.join(' | ');
    out.hidLink = !!box.querySelector('[data-attshow]');
    out.hidText = (box.querySelector('[data-attshow]') || {}).textContent || '';
    out.canPreview = !!box.querySelector('[data-emlv]');
    out.canDownload = !!box.querySelector('[data-emld]');
    if (box.querySelector('[data-attshow]')) box.querySelector('[data-attshow]').click();
    out.chipsAfterShow = box.querySelectorAll('.att').length;
    if (box.querySelector('[data-atthide]')) box.querySelector('[data-atthide]').click();
    out.chipsAfterHide = box.querySelectorAll('.att').length;

    /* the live 2.0 viewer, opened by clicking a tile */
    window.rzAttBytes = () => Promise.resolve({ u8, mime: 'message/rfc822' });
    document.body.classList.add('v2');
    let read = document.getElementById('read');
    if (!read) { read = document.createElement('div'); read.id = 'read'; document.body.appendChild(read); }
    read.innerHTML = '<div class="v2atts"><button type="button" class="v2att" data-v2att data-box="teampulse@rugscreation.com"' +
      ' data-gid="1a2089079a40961b" data-name="Booking.eml" data-size="' + u8.length + '" data-mime="message/rfc822" data-link=""></button></div>';
    read.querySelector('[data-v2att]').click();
    await new Promise(x => setTimeout(x, 500));
    const vw = document.querySelector('.v2vw');
    out.viewerOpened = !!vw;
    out.viewerNotRefusing = !!vw && !/can't be previewed/i.test(vw.textContent);
    out.viewerRugsLook = !!vw && !!vw.querySelector('.v2veml article.mail header') && !!vw.querySelector('.v2veml .emlsub');
    out.viewerTag = !!vw && /Attached email \(\.eml\)/.test(vw.textContent);
    out.viewerDownload = !!vw && !!vw.querySelector('[data-vw="dl"]');

    /* download */
    const saved = [];
    const real = window.rzSaveFile;
    window.rzSaveFile = (data, nm, mime) => { saved.push({ nm, mime, n: (data && (data.length || data.size)) || 0 }); };
    vw.querySelector('[data-vw="dl"]').click();
    await new Promise(x => setTimeout(x, 400));
    out.dlName = saved.length ? saved[0].nm : '';
    out.dlMime = saved.length ? String(saved[0].mime || '') : '';
    out.dlBytes = saved.length ? saved[0].n : 0;
    out.emlSize = u8.length;
    window.rzSaveFile = real;
    const links = [];
    new MutationObserver(ms => ms.forEach(mu => [...mu.addedNodes].forEach(nd => {
      if (nd.tagName === 'A' && nd.hasAttribute('download')) links.push(nd.getAttribute('download'));
    }))).observe(document.body, { childList: true, subtree: true });
    box.querySelectorAll('[data-emld]').forEach(b => b.click());
    await new Promise(x => setTimeout(x, 300));
    out.innerSaved = links.join(' | ');

    /* a .eml already on this computer, dropped on the window */
    const f = new File([u8], 'From the PC.eml', { type: 'message/rfc822' });
    const dt = new DataTransfer(); dt.items.add(f);
    if (document.querySelector('.v2vw [data-vw="close"]')) document.querySelector('.v2vw [data-vw="close"]').click();
    window.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    out.dropHint = !!document.querySelector('.emldrop');
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise(x => setTimeout(x, 800));
    const ov = document.querySelector('.cfview');
    out.dropOpened = !!ov && /From the PC\.eml/.test(ov.textContent);
    out.dropRugsLook = !!ov && !!ov.querySelector('article.mail header') && /Venu GOPAL/.test(ov.textContent);
    out.dropHintGone = !document.querySelector('.emldrop');
    if (ov && ov.querySelector('[data-cfvx]')) ov.querySelector('[data-cfvx]').click();
    return out;
  });

  ok('the reader and the local-file openers are available to the whole app', r.exported);
  ok('a small "Attached email (.eml)" label is shown', /Attached email \(\.eml\)/.test(r.tag), r.tag);
  ok('the subject is the title, decoded', /Booking/.test(r.subjectTitle) && /DO\/SO charge/.test(r.subjectTitle), r.subjectTitle);
  ok('it is drawn as the app\'s own message card, with the avatar', r.isMessageCard && r.hasAvatar);
  ok('sender name and address are shown', r.name && r.address);
  ok('the To line is shown', r.toLine);
  ok('the Cc line is shown', r.ccLine);
  ok('the date is shown, in the app\'s own format', r.date);
  ok('the body is in the same sandboxed frame as a normal mail, no scripts allowed', r.sameFrame);
  ok('the body is drawn with its formatting', r.body);
  ok('a pasted (cid:) signature picture IS shown, from the mail\'s own parts', r.cidPicture);
  ok('a picture from the internet IS shown, as in a normal mail', r.remotePicture);
  ok('no "Show pictures" bar is in the way', r.noPicBar);
  ok('the script inside the mail is removed and did not run', r.noScript);
  ok('a javascript: link is removed', r.noJsLink);
  ok('only real files are listed: the PDF and the mail inside it', r.chipCount === 2, 'got ' + r.chipCount + ' [' + r.chips + ']');
  ok('the signature picture is hidden, behind a link (the pasted one is not listed at all)', r.hidLink && /Show hidden inline images \(1\)/.test(r.hidText), r.hidText);
  ok('the link puts them back', r.chipsAfterShow === 3, 'got ' + r.chipsAfterShow);
  ok('and takes them away again', r.chipsAfterHide === 2, 'got ' + r.chipsAfterHide);
  ok('every listed file has Open preview and Download', r.canPreview && r.canDownload);
  ok('the 2.0 viewer opens an attached mail on a click', r.viewerOpened && r.viewerNotRefusing);
  ok('the viewer draws the same Rugs Email card', r.viewerRugsLook && r.viewerTag);
  ok('Download in the viewer saves it under its own name', r.dlName === 'Booking.eml', 'got "' + r.dlName + '"');
  ok('it is saved as a mail file (message/rfc822)', /message\/rfc822/.test(r.dlMime), r.dlMime);
  ok('every byte of it is saved', r.dlBytes === r.emlSize, r.dlBytes + ' of ' + r.emlSize);
  ok('files inside it save too, including a mail inside a mail', /Invoice 77-26\.pdf/.test(r.innerSaved) && /\.eml/.test(r.innerSaved), r.innerSaved);
  ok('dragging a .eml onto the window shows "drop it here"', r.dropHint);
  ok('dropping it opens the same preview, read in the page', r.dropOpened && r.dropRugsLook);
  ok('the hint goes away afterwards', r.dropHintGone);
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  let bad = 0;
  checks.forEach(c => { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.n + (c.pass || !c.extra ? '' : '  -> ' + c.extra)); });
  console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
  await browser.close();
  srv.close();
  process.exitCode = bad ? 1 : 0;
})();
