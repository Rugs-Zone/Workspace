// Edit on an approved invoice: only the person who made it (every role, admins too only on their own).
const fs=require('fs');
const edits=[
 ["  if(r.status==='Approved'&&o&&ME.role!=='rec')b.push(`<button class=\"btn sm\" data-a=\"redit\"","  if(r.status==='Approved'&&r.owner===ME.id)b.push(`<button class=\"btn sm\" data-a=\"redit\""],
 ["  if(r.status==='Approved'&&(r.owner===ME.id||ME.role==='adm')&&ME.role!=='rec')h+=`<button class=\"btn\" data-a=\"redit\"","  if(r.status==='Approved'&&r.owner===ME.id)h+=`<button class=\"btn\" data-a=\"redit\""],
 ["  case 'redit':{const r0=find(id);","  case 'redit':{const r0=find(id);if(!r0||r0.owner!==ME.id){toast('You can edit only your own invoices.');break}"],
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
