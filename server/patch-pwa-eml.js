/* 24 Nov 2026 - OPTIONAL: Rugs Email can be installed as an app, and then Windows can hand it a
 * .eml file to open (double-click a downloaded mail, no Outlook).
 *
 * What the browser really allows, and nothing more:
 *   - file_handlers in the manifest is supported by Edge and Chrome on Windows. It only works
 *     when the site is INSTALLED as an app, and Windows/the browser asks the person once
 *     ("Allow Rugs Email to open .eml files?"). It cannot be forced from here, and Firefox and
 *     Safari do not support it at all.
 *   - Without installing, nothing changes and nothing is lost: the .eml preview opens from the
 *     attachment bar in the normal browser tab, and a file already on the computer opens with
 *     "Open an .eml file" in the menu under your own name, or by dropping it on the window.
 *
 *   node server/patch-pwa-eml.js
 */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');

/* ---- the manifest: say we can open mail files ---- */
const MF = path.join(R, 'mail-manifest.json');
const m = JSON.parse(fs.readFileSync(MF, 'utf8'));
m.file_handlers = [{
  action: './mail.html',
  name: 'Email message',
  accept: { 'message/rfc822': ['.eml'] },
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  launch_type: 'single-client'
}];
m.launch_handler = { client_mode: 'navigate-existing' };
fs.writeFileSync(MF, JSON.stringify(m, null, 2) + '\n');
console.log('mail-manifest.json: file_handlers + launch_handler written');

/* ---- mail.html keeps the file the app was started with, until the app is ready for it ---- */
const MH = path.join(R, 'mail.html');
let h = fs.readFileSync(MH, 'utf8');
const CRLF = h.indexOf('\r\n') >= 0;
if (CRLF) h = h.split('\r\n').join('\n');
const anchor = '(function () {';
if (h.indexOf('__RUGS_LAUNCH_FILES__') < 0) {
  const i = h.indexOf(anchor);
  if (i < 0) throw new Error('could not find the loader in mail.html');
  h = h.slice(0, i) + `/* 24 Nov 2026: when Windows starts the installed app WITH a .eml file, the file arrives
   before the mail app has loaded. It is kept here and the app picks it up when it is ready. */
(function () {
  try {
    if (!('launchQueue' in window)) return;
    window.__RUGS_LAUNCH_FILES__ = [];
    launchQueue.setConsumer(function (p) {
      if (!p || !p.files || !p.files.length) return;
      p.files[0].getFile().then(function (f) {
        if (typeof window.rzEmlOpenLocal === 'function') window.rzEmlOpenLocal(f);
        else window.__RUGS_LAUNCH_FILES__.push(f);
      }).catch(function () {});
    });
  } catch (e) {}
})();
` + h.slice(i);
  if (CRLF) h = h.split('\n').join('\r\n');
  fs.writeFileSync(MH, h);
  console.log('mail.html: the file the app was started with is kept for the app');
} else console.log('mail.html: already done');

/* ---- the app looks for such a file once it is running ---- */
const AF = path.join(R, '.tmp', 'email.html');
let s = fs.readFileSync(AF, 'utf8');
const a2 = 'window.rzEmlPick=emlPick;';
if (s.split(a2).length - 1 !== 1) throw new Error('anchor found ' + (s.split(a2).length - 1) + ' times in the app');
s = s.replace(a2, a2 + `
/* a file the installed app was started with (kept by mail.html before the app existed) */
setTimeout(()=>{try{const q=window.__RUGS_LAUNCH_FILES__;if(q&&q.length)emlOpenLocal(q.shift())}catch(e){}},1200);`);
fs.writeFileSync(AF, s);
console.log('app: picks up a file the app was started with (run: node server/mailapp-b64.js encode)');
