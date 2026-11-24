/* 24 Nov 2026 - in a .eml, pictures from the internet are REALLY blocked, not just announced.
 *
 * The bar is drawn by emlMount, but the blocking itself happens inside picHTML, which injects a
 * Content-Security-Policy only when picsOk() says no. picsOk says yes for a sender we have ever
 * written to (the 18 Nov rule), and the sender of an attached mail is somebody else's
 * correspondent, so a .eml could quietly load pictures from the internet. A mail arriving as a
 * file is read-only and has never been through the Inbox's own picture rule, so here the policy
 * goes in whatever picsOk thinks, until the reader presses Show pictures.
 *   node server/patch-eml-open2.js   (then: node server/mailapp-b64.js encode)
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 60));
  s = s.replace(a, b); n++;
};

/* the helper, next to the reader */
sub(
  `/* draw a parsed .eml into any container, like a received mail */`,
  `/* pictures from the internet in an attached mail: blocked until asked for, whoever sent it */
function emlPicHTML(pm,h){const out=picHTML(pm,h);
 if(pm.showPics||!hasRemote(h)||out.indexOf(PIC_CSP)>=0)return out;
 const hd=out.match(/<head\\b[^>]*>/i);return hd?out.replace(hd[0],hd[0]+PIC_CSP):PIC_CSP+out}
/* draw a parsed .eml into any container, like a received mail */`
);

/* use it for the .eml body */
sub(
  `srcdoc="'+esc(picHTML(pm,emlSafe(bodyHTML)))+'"`,
  `srcdoc="'+esc(emlPicHTML(pm,emlSafe(bodyHTML)))+'"`
);

fs.writeFileSync(F, s);
console.log('email.html patched, ' + n + ' edits');
