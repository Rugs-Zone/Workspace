/* 18 Nov 2026 — "the signature shows twice in New mail".
   It is not a real duplicate: since 17 Nov the signature is written INSIDE the message, and the old
   signature PREVIEW panel is still drawn right under the editor (mail-v2 compose wrapper does
   `pv.classList.add('insig'); ed.after(pv)`), with its "Signature · <name>" label hidden by
   `#sigPrev.insig small{display:none}`. So the person sees the same signature twice, one of them
   unlabelled. Only the one inside the message is sent — buyers always got one.
   Fix: do not show that preview at all. The Signature dropdown (on / off / other signatures) stays,
   and it keeps working, because it edits the block inside the message.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-no-sig-preview.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');

const old = ` if(sp&&sel&&pv){pv.classList.add('insig');ed.after(pv);`;
const nw = ` if(sp&&sel&&pv){pv.classList.add('insig');pv.hidden=true;ed.after(pv);   /* 18 Nov 2026: the signature is inside the message now, so the preview below it only looked like a second signature */`;

const n = s.split(old).length - 1;
if (n !== 1) { console.error('FAILED: compose signature preview found ' + n + ' times'); process.exit(1); }
s = s.replace(old, nw);

/* the dropdown's own handler un-hides the preview; keep it hidden there too */
const old2 = ` q('#cSig').onchange=e=>{q('#sigPrev').hidden=!e.target.value};`;
const nw2 = ` q('#cSig').onchange=e=>{const pv=q('#sigPrev');if(pv&&!pv.classList.contains('insig'))pv.hidden=!e.target.value};`;
const n2 = s.split(old2).length - 1;
if (n2 !== 1) { console.error('FAILED: signature dropdown handler found ' + n2 + ' times'); process.exit(1); }
s = s.replace(old2, nw2);

fs.writeFileSync(F, s);
console.log('ok  the signature preview under the editor is gone (2 edits)');
