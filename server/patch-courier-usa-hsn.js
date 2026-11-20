// 20 Nov 2026: USA invoice - every item needs its HSN code and content (Description). Other countries unchanged.
const fs=require('fs');
const edits=[
 // helper
 ["function FORMHTML(){","function isUSA(c){const n=String(c||'').toUpperCase().replace(/[^A-Z]/g,'');return n==='USA'||n==='US'||n==='AMERICA'||n.startsWith('UNITEDSTATES')||n.startsWith('USAREST')}\nfunction FORMHTML(){"],
 // note in packets panel
 ["<div class=\"panel\"><h2>2. Packets and items</h2><div id=\"pk\"></div>","<div class=\"panel\"><h2>2. Packets and items</h2><p class=\"note\" id=\"usnote\" style=\"color:var(--bad,#c0392b);font-weight:700\" ${isUSA(d.dest_country||b.country)?'':'hidden'}>USA invoice: HSN code and content (Description) are mandatory for every item.</p><div id=\"pk\"></div>"],
 // check on save
 ["if(!d.packets.length||!flatItems(d).some(i=>(+i.qty||0)*(+i.rate||0)>0)){m.innerHTML=fail('Add at least one item with quantity and rate.');return}","if(!d.packets.length||!flatItems(d).some(i=>(+i.qty||0)*(+i.rate||0)>0)){m.innerHTML=fail('Add at least one item with quantity and rate.');return}\n  if(isUSA(d.dest_country)){for(let pi=0;pi<d.packets.length;pi++)for(let ii=0;ii<d.packets[pi].items.length;ii++){const it=d.packets[pi].items[ii],k=!String(it.hsn||'').trim()?'hsn':!String(it.desc||'').trim()?'desc':'';if(k){m.innerHTML=fail('USA invoice: enter the '+(k==='hsn'?'HSN code':'content (Description)')+' for packet '+(pi+1)+', item '+(ii+1)+' (mandatory for USA).');const pe=$('pk').querySelectorAll('[data-p]')[pi],rows=pe?[...pe.querySelectorAll('tbody tr')].filter(tr=>[...tr.querySelectorAll('input')].some(x=>['prod','desc','rate'].includes(x.dataset.k)&&x.value.trim())):[],inp=rows[ii]&&rows[ii].querySelector('[data-k='+k+']');if(inp)inp.focus();return}}}"],
 // live toggle of the note
 ["function bindForm(){const n=$('b_name'),c=$('b_code');if(!n||!c)return;","function bindForm(){const dc=$('f_dcountry'),un=$('usnote');if(dc&&un){const t=()=>{un.hidden=!isUSA(dc.value)};dc.addEventListener('input',t);dc.addEventListener('change',t)}const n=$('b_name'),c=$('b_code');if(!n||!c)return;"],
];
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
