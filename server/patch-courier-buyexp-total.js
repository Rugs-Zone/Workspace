const fs=require('fs');
const edits=[
 // a bill line saved with an empty amount still counts its charges (before GST)
 ["amt=bs.reduce((s,b)=>s+nm(b.amount),0),bp=billParts(bs)","amt=bs.reduce((s,b)=>s+billAmt(b),0),bp=billParts(bs)"],
 ["const isDuty=b=>b.kind==='duty';","const isDuty=b=>b.kind==='duty';\nconst billAmt=b=>nm(b.amount)||(Array.isArray(b.charges)?b.charges.filter(c=>c&&!/gst|igst|cgst|sgst|\btax\b/i.test(String(c.name))).reduce((s,c)=>s+nm(c.amount),0):0);"],
 // headline: total = billed + rate-list estimate for invoices with no bill
 ["<div class=\"kpi dk\"><b>${inr2(tot)}</b>Courier expense (billed)</div><div class=\"kpi\"><b>${inr2(tEst)}</b>Estimated, bill not uploaded</div>",
  "<div class=\"kpi dk\"><b>${inr2(tot+tEst)}</b>Total courier expense<br><span style=\"font-size:12px;opacity:.8\">${inr2(tot)} from courier bills + ${inr2(tEst)} rate-list estimate</span></div><div class=\"kpi\"><b>${inr2(tot)}</b>From uploaded courier bills${tot?'':'<br><span class=\"note\">no courier bills uploaded yet - upload them in Team accounts</span>'}</div>"],
 // table: no bill -> say so instead of ₹0; no tracking -> say so instead of "-"
 ["<td><b>${inr2(x.exp)}</b></td><td>${x.est?inr2(x.est)+' <span class=\"note\">est.</span>':'-'}</td>",
  "<td>${x.inv.some(i=>i.bs.length)?'<b>'+inr2(x.exp)+'</b>':'<span class=\"note\">no bill yet</span>'}</td><td>${x.est?inr2(x.est)+' <span class=\"note\">est.</span>':x.inv.some(i=>i.st==='notrack')?'<span class=\"note\">no tracking no.</span>':'-'}</td>"],
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
