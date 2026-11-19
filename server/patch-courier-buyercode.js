const fs=require('fs');
const edits=[
 ['<label class="l" for="b_code">Buyer code</label><input id="b_code" value="${esc(b.code)}" placeholder="e.g. ADR">',
  '<label class="l" for="b_code">Buyer code (mandatory, 3 characters)</label><input id="b_code" value="${esc(b.code)}" placeholder="e.g. ADR" maxlength="3" autocapitalize="characters" style="text-transform:uppercase" required>'],
 ['placeholder="e.g. Ms. Neha Dhingra"','placeholder="Name of the contact person"'],
 ["  try{localStorage.setItem('cd_sender',d.sender_phone)}catch(e){}",
  "  {const bc=String((d.buyer||{}).code||'').trim();if(!/^[A-Za-z0-9]{3}$/.test(bc)){m.innerHTML=fail('Enter the 3-character buyer code (mandatory), e.g. ADR.');$('b_code').focus();return}d.buyer.code=bc.toUpperCase()}\n  try{localStorage.setItem('cd_sender',d.sender_phone)}catch(e){}"],
];
function patch(t,label){for(const [a,b] of edits){const n=t.split(a).length-1;if(n!==1)throw new Error(label+': expected 1 match, found '+n+' for: '+a.slice(0,70));t=t.replace(a,()=>b)}return t}
let idx=fs.readFileSync('index.html','utf8');
const re=/(COURIER_HTML_B64\s*=\s*["'`])([A-Za-z0-9+\/=]+)/;const m=idx.match(re);
const live=Buffer.from(m[2],'base64').toString('utf8');
if(Buffer.from(live,'utf8').toString('base64')!==m[2])throw new Error('base64 does not round-trip');
const nl=patch(live,'index.html');fs.writeFileSync('.tmp/courier-patched.html',nl);
fs.writeFileSync('index.html',idx.replace(re,(_,p)=>p+Buffer.from(nl,'utf8').toString('base64')));
fs.writeFileSync('courier_dashboard.html',patch(fs.readFileSync('courier_dashboard.html','utf8'),'courier_dashboard.html'));
console.log('patched both');
