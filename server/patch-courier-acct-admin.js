const fs=require('fs');
const edits=[
 ["['acct','Team accounts',['acc','adm']],",""],
 ["['--','Admin',['adm']],","['--','Admin',['adm']],['acct','Team accounts',['adm']],"],
 // a non-admin who still lands on the page (old link, saved page) sees nothing of it
 ["AFTER.acct=async()=>{","AFTER.acct=async()=>{if(!ME||ME.role!=='adm'){$('accBody').innerHTML=fail('Team accounts is for admins only.');return}"],
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
