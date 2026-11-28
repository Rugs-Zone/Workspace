// 28 Nov 2026 (app build +1): (1) a reply never lands on our OWN mailbox: when no real other party can be found the
// To box is left empty (the person types it, and it goes) instead of filling in teampulse@ itself; Cc of our own
// mails is also searched. (2) isOtp() remembers its answer on the conversation (it ran ~5,000 times per click).
// Usage: node server/patch-reply-speed.js .tmp/email.html
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b, n) => { const c = s.split(a).length - 1; if (c !== n) throw new Error('expected ' + n + ' of: ' + a.slice(0, 80) + ' found ' + c); s = s.split(a).join(b); };
// (1) replyTo
rep("return t.email||''}catch(e){return t.email||''}}",
    "for(let i=ms.length-1;i>=0;i--){const m=ms[i];if(m&&(m.ours||m.by)){const a=(String(m.cc||'').match(/[^\\s<>,;\"']+@[^\\s<>,;\"']+/g)||[]).filter(x=>x.toLowerCase()!==box);if(a.length)return [...new Set(a.map(x=>x.toLowerCase()))].join(', ')}}\n return (t.email&&String(t.email).toLowerCase()!==box)?t.email:''}catch(e){return ''}}", 1);
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = '2026-11-28-' + (+m[2] + 1);
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
