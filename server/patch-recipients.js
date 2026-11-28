// 28 Nov 2026: "an address added in To / Cc does not go". Outlook habit is "a@x.com; b@y.com" (semicolons),
// or a trailing comma/space. Gmail needs a clean comma list in the To header. The app now cleans To, Cc and Bcc
// before they are sent and says so if an address is not valid. Usage: node server/patch-recipients.js .tmp/email.html
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b, n) => { const c = s.split(a).length - 1; if (c !== n) throw new Error('expected ' + n + ' of: ' + a + ' found ' + c); s = s.split(a).join(b); };

const helper = `/* 28 Nov 2026: clean a To / Cc / Bcc box. People type "a@x.com; b@y.com", add a trailing comma or paste
   "Name <a@x.com>". Gmail wants one comma list of plain addresses, so take every address out and join with ", ". */
function normRcpt(v){try{const a=String(v||'').match(/[^\\s<>,;"'()\\[\\]]+@[^\\s<>,;"'()\\[\\]]+/g)||[];const seen=new Set(),o=[];a.forEach(x=>{x=x.replace(/[.]+$/,'');const k=x.toLowerCase();if(/^[^@]+@[^@]+\\.[^@.]+$/.test(x)&&!seen.has(k)){seen.add(k);o.push(x)}});return o.join(', ')}catch(e){return String(v||'')}}
function sendReply(`;
rep('function sendReply(', helper, 1);
rep("const toV=q('#ct').value.trim();if(!toV){toast('Add who it goes to');return}",
    "const toRaw=q('#ct').value.trim(),toV=normRcpt(toRaw);if(!toV){toast(toRaw?'That address does not look right - check the To box':'Add who it goes to');return}\n  {const ccRaw=q('#cc').value.trim();if(ccRaw&&!normRcpt(ccRaw)){toast('That address does not look right - check the Cc box');return}}",1);
rep("ccV=q('#cc').value.trim()", "ccV=normRcpt(q('#cc').value)", 1);
rep("to:fwd?(t._fwdTo||''):(t._replyTo||replyTo(t)),cc:t.cc||''", "to:normRcpt(fwd?(t._fwdTo||''):(t._replyTo||replyTo(t))),cc:normRcpt(t.cc)", 2);
rep("bcc:o.bcc||''", "bcc:normRcpt(o.bcc)", 1);

const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const today = '2026-11-28';
const nb = m[1] === today ? today + '-' + (+m[2] + 1) : today + '-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
