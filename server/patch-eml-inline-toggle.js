/* 24 Nov 2026 - the "Show hidden inline images" link inside a previewed .eml must be handled by
 * the preview itself, not by the reading pane's global handler. The global one (added with the
 * attachment-bar rule) stops the click and redraws the READING PANE, which is not where the
 * attached mail is drawn - so inside a .eml the link did nothing. The key of a .eml's own list
 * starts with "eml:", and the global handler now leaves those alone.
 *   node server/patch-eml-inline-toggle.js   (then: node server/mailapp-b64.js encode)
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const a = ` if(!sh&&!hd)return;e.preventDefault();e.stopPropagation();
 const g=(sh||hd).getAttribute(sh?'data-attshow':'data-atthide');`;
if (s.split(a).length - 1 !== 1) throw new Error('anchor found ' + (s.split(a).length - 1) + ' times');
s = s.replace(a, ` if(!sh&&!hd)return;
 const g=(sh||hd).getAttribute(sh?'data-attshow':'data-atthide');
 if(String(g||'').indexOf('eml:')===0)return;   /* a previewed .eml draws and toggles its own list */
 e.preventDefault();e.stopPropagation();`);
fs.writeFileSync(F, s);
console.log('email.html patched, 1 edit');
