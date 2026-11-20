// 20 Nov 2026: Edit on your own approved invoice opens it straight away (no "Edit approved invoice" question).
// After the change, locking it sends an International invoice to Preeti again (a Local one is approved automatically).
// The server side (cd_inv_reopen allowing the invoice's owner, not only admins) is a separate SQL change.
const fs=require('fs');
const OLD_ASK="const loc=r0&&r0.ship_type==='Local';if(!await ask('Edit approved invoice','<p>This takes the approval off and makes the invoice a draft again. The PDF cannot be downloaded until it is approved again.</p><p>After your change, lock it again: '+(loc?'a Local invoice is approved automatically.':'it goes to Preeti for approval.')+'</p>','Edit invoice'))break;";
const NEW_ASK="const loc=r0&&r0.ship_type==='Local';";
const OLD_MSG="toast('Invoice is a draft again. Make your change, then lock it.');go();break}";
const NEW_MSG="toast(loc?'Invoice is open for editing. Make your change, then lock it - a Local invoice is approved automatically.':'Invoice is open for editing. Make your change, then lock it - it goes to Preeti for approval.');go();break}";
const edits=[[OLD_ASK,NEW_ASK],[OLD_MSG,NEW_MSG]];
function patch(t,label){for(const [a,b] of edits){const n=t.split(a).length-1;if(n!==1)throw new Error(label+': expected 1 match, found '+n+' for: '+a.slice(0,70));t=t.replace(a,()=>b)}return t}
let idx=fs.readFileSync('index.html','utf8');
const re=/(COURIER_HTML_B64\s*=\s*["'`])([A-Za-z0-9+\/=]+)/;const m=idx.match(re);
const live=Buffer.from(m[2],'base64').toString('utf8');
if(Buffer.from(live,'utf8').toString('base64')!==m[2])throw new Error('base64 does not round-trip');
const nl=patch(live,'index.html');
const cd=patch(fs.readFileSync('courier_dashboard.html','utf8'),'courier_dashboard.html');
fs.writeFileSync('index.html',idx.replace(re,(_,p)=>p+Buffer.from(nl,'utf8').toString('base64')));
fs.writeFileSync('courier_dashboard.html',cd);
console.log('patched both');
