// 28 Nov 2026: reply goes to the real other party (not our own mailbox), and the To you type is used
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b, n) => { const c = s.split(a).length - 1; if (c !== n) throw new Error('expected ' + n + ' of: ' + a + ' found ' + c); s = s.split(a).join(b); };

const helper = `/* 28 Nov 2026: who a reply goes to. If the conversation's other side is our own mailbox
   (we wrote the last mail), reply to the newest real other party - like Outlook. */
function replyTo(t){try{const box=String(t.box||mailOf(dept(t.dept))||'').toLowerCase(),em=String(t.email||'').toLowerCase();
 if(em&&em!==box)return t.email;
 const ms=t.msgs||[];
 for(let i=ms.length-1;i>=0;i--){const m=ms[i];if(!m)continue;
  if(m.ours||m.by){const a=(String(m.to||'').match(/[^\\s<>,;"']+@[^\\s<>,;"']+/g)||[]).filter(x=>x.toLowerCase()!==box);if(a.length)return [...new Set(a.map(x=>x.toLowerCase()))].join(', ')}
  else if(m.email&&String(m.email).toLowerCase()!==box)return m.email}
 return t.email||''}catch(e){return t.email||''}}
function compose(o){`;
rep('function compose(o){', helper, 1);
rep("const to=o.to??(t&&!o.fwd?t.email:'');", "const to=o.to??(t&&!o.fwd?replyTo(t):'');", 1);
rep("if(o.fwd)t._fwdTo=toV;sendReply(", "if(o.fwd)t._fwdTo=toV;else t._replyTo=toV;sendReply(", 1);
rep("to:fwd?(t._fwdTo||''):t.email", "to:fwd?(t._fwdTo||''):(t._replyTo||replyTo(t))", 3);

const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const today = '2026-11-28';
const nb = m[1] === today ? today + '-' + (+m[2] + 1) : today + '-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
