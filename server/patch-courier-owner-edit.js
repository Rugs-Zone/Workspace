// Courier Invoices: the person who made an approved invoice (and admins) get "Edit".
// Edit = cd_inv_reopen (approval + signatures cleared, back to draft) and the form opens at once.
// Locking it again follows the normal flow: Local -> approved automatically, International -> Preeti.
const fs=require('fs');
const edits=[
 ["  if(r.status==='Approved')b.push(`<button class=\"btn sm pri\" data-a=\"print\" data-id=\"${r.id}\">PDF</button>`);",
  "  if(r.status==='Approved')b.push(`<button class=\"btn sm pri\" data-a=\"print\" data-id=\"${r.id}\">PDF</button>`);\n  if(r.status==='Approved'&&o&&ME.role!=='rec')b.push(`<button class=\"btn sm\" data-a=\"redit\" data-id=\"${r.id}\" title=\"Change this invoice. It goes back for approval after the change.\">Edit</button>`);"],
 ["  if(ME.role==='adm')h+=`<button class=\"btn\" data-a=\"reopen\"",
  "  if(r.status==='Approved'&&(r.owner===ME.id||ME.role==='adm')&&ME.role!=='rec')h+=`<button class=\"btn\" data-a=\"redit\" data-id=\"${r.id}\">Edit invoice</button>`;\n  if(ME.role==='adm')h+=`<button class=\"btn\" data-a=\"reopen\""],
 ["  case 'reopen':{",
  "  case 'redit':{const r0=find(id);const loc=r0&&r0.ship_type==='Local';if(!await ask('Edit approved invoice','<p>This takes the approval off and makes the invoice a draft again. The PDF cannot be downloaded until it is approved again.</p><p>After your change, lock it again: '+(loc?'a Local invoice is approved automatically.':'it goes to Preeti for approval.')+'</p>','Edit invoice'))break;\n    const x=await api('cd_inv_reopen',{p_id:id});if(!upd(x))break;const f=await getFull(id);if(!f){go();break}view={t:'form',cur:{id:f.id,inv_no:f.inv_no,ship:f.ship_type,d:f.d}};if(!view.cur.d.courier)view.cur.d.courier={};toast('Invoice is a draft again. Make your change, then lock it.');go();break}\n  case 'reopen':{"],
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
