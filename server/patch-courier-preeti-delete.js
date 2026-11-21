// 21 Nov 2026: Courier - Preeti (role 'rec') can delete an invoice she approved by mistake.
// Delete button on approved invoices, in the list and on the invoice page; a clear question first.
// Server side: server/sql/2026-11-21-courier-preeti-delete.sql (cd_inv_delete lets 'rec' delete Approved ones).
const fs=require('fs');
const edits=[
 // list
 ["  if(ME.role!=='rec'&&o&&(ME.role==='adm'||r.status!=='Approved'))b.push(`<button class=\"btn sm bad\" data-a=\"del\" data-id=\"${r.id}\">Delete</button>`);",
  "  if(ME.role!=='rec'&&o&&(ME.role==='adm'||r.status!=='Approved'))b.push(`<button class=\"btn sm bad\" data-a=\"del\" data-id=\"${r.id}\">Delete</button>`);\n  if(ME.role==='rec'&&r.status==='Approved')b.push(`<button class=\"btn sm bad\" data-a=\"del\" data-id=\"${r.id}\" title=\"Approved by mistake? Delete this invoice\">Delete</button>`);"],
 // invoice page
 ["  if(r.status==='Approved'&&r.owner===ME.id)h+=`<button class=\"btn\" data-a=\"redit\" data-id=\"${r.id}\">Edit invoice</button>`;",
  "  if(r.status==='Approved'&&r.owner===ME.id)h+=`<button class=\"btn\" data-a=\"redit\" data-id=\"${r.id}\">Edit invoice</button>`;\n  if(ME.role==='rec'&&r.status==='Approved')h+=`<button class=\"btn bad\" data-a=\"del\" data-id=\"${r.id}\" title=\"Approved by mistake? Delete this invoice\">Delete invoice</button>`;"],
 // the question
 ["case 'del':{if(!await ask('Delete invoice','<p>This permanently deletes <b>'+esc(r?r.inv_no:'')+'</b>. This cannot be undone.</p>','Delete'))break;",
  "case 'del':{if(!await ask('Delete invoice','<p>This permanently deletes <b>'+esc(r?r.inv_no:'')+'</b>. This cannot be undone.</p>'+(r&&r.status==='Approved'?'<p><b>This invoice is already approved.</b> It disappears for everyone, including '+esc(r.owner_name||'the person who made it')+', and its PDF can no longer be printed. They will have to make a new invoice if one is needed.</p>':''),'Delete'))break;"]
];
function patch(t,label){for(const [a,b] of edits){const n=t.split(a).length-1;if(n!==1)throw new Error(label+': expected 1 match, found '+n+' for: '+a.slice(0,70));t=t.replace(a,()=>b)}return t}
let idx=fs.readFileSync('index.html','utf8');
const re=/(COURIER_HTML_B64\s*=\s*["'`])([A-Za-z0-9+\/=]+)/;const m=idx.match(re);
const live=Buffer.from(m[2],'base64').toString('utf8');
if(Buffer.from(live,'utf8').toString('base64')!==m[2])throw new Error('base64 does not round-trip');
const nl=patch(live,'index.html');
fs.writeFileSync('index.html',idx.replace(re,(_,p)=>p+Buffer.from(nl,'utf8').toString('base64')));
// keep the standalone copy in step where it has the same lines
try{const cd=patch(fs.readFileSync('courier_dashboard.html','utf8'),'courier_dashboard.html');fs.writeFileSync('courier_dashboard.html',cd);console.log('courier_dashboard.html patched')}catch(e){console.log('courier_dashboard.html skipped: '+e.message)}
console.log('index.html patched');
