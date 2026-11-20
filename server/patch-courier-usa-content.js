// 20 Nov 2026: USA invoice - a "Content" box per item appears when the country is USA; HSN + Content mandatory there; Content printed under the description.
const fs=require('fs');
const edits=[
 ["<div id=\"pk\"></div>","<style>#pk .uscol{display:none}#pk.isus .uscol{display:table-cell}#pk.isus .ushs::after{content:' *';color:#c0392b}</style><div id=\"pk\" class=\"${isUSA(d.dest_country||b.country)?'isus':''}\"></div>",1],
 ["USA invoice: HSN code and content (Description) are mandatory for every item.","USA invoice: HSN code and Content are mandatory for every item.",1],
 ["<th>Description</th><th>HSN code</th><th>Qty</th>","<th>Description</th><th class=\"ushs\">HSN code</th><th class=\"uscol\">Content (USA) *</th><th>Qty</th>",1],
 ["placeholder=\"e.g. 5703\"></td>","placeholder=\"e.g. 5703\"></td><td class=\"uscol\"><input data-k=\"content\" value=\"${esc(it.content||'')}\" style=\"width:150px\" placeholder=\"e.g. 100% Wool\"></td>",1],
 ["!String(it.desc||'').trim()?'desc':''","!String(it.content||'').trim()?'content':''",1],
 ["(k==='hsn'?'HSN code':'content (Description)')","(k==='hsn'?'HSN code':'Content')",1],
 ["const t=()=>{un.hidden=!isUSA(dc.value)};","const t=()=>{const u=isUSA(dc.value);un.hidden=!u;const pk=$('pk');if(pk)pk.classList.toggle('isus',u)};",1],
 ["<td>${esc(it.desc)}</td><td>${esc(it.hsn||'')}</td>","<td>${esc(it.desc)}${it.content?'<br>Content: '+esc(it.content):''}</td><td>${esc(it.hsn||'')}</td>",2],
];
function patch(t,label){for(const [a,b,c] of edits){const n=t.split(a).length-1;if(n!==c)throw new Error(label+': expected '+c+', found '+n+' for: '+a.slice(0,70));t=t.split(a).join(b)}return t}
let idx=fs.readFileSync('index.html','utf8');
const re=/(COURIER_HTML_B64\s*=\s*["'`])([A-Za-z0-9+\/=]+)/;const m=idx.match(re);
const live=Buffer.from(m[2],'base64').toString('utf8');
if(Buffer.from(live,'utf8').toString('base64')!==m[2])throw new Error('base64 does not round-trip');
const nl=patch(live,'index.html');
const cd=patch(fs.readFileSync('courier_dashboard.html','utf8'),'courier_dashboard.html');
fs.writeFileSync('index.html',idx.replace(re,(_,p)=>p+Buffer.from(nl,'utf8').toString('base64')));
fs.writeFileSync('courier_dashboard.html',cd);
console.log('patched both');
