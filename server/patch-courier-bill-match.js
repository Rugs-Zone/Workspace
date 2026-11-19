const fs=require('fs');
const CHK=`
/* invoice vs courier bill: one check per field, green = matches, red = does not, grey = cannot compare */
const chkCol=c=>c.ok===true?['#ECFDF3','#0B6B3A','&#10003;']:c.ok===false?['#FDECEC','#B42318','&#10007;']:['#F2F4F7','#475467','?'];
const chkChip=c=>{const k=chkCol(c);return '<div style="background:'+k[0]+';color:'+k[1]+';border-radius:6px;padding:3px 7px;margin-bottom:4px;font-weight:600;font-size:12.5px" title="Invoice: '+esc(c.inv)+' | Courier bill: '+esc(c.bill)+'">'+k[2]+' '+esc(c.k)+(c.ok===false?': bill '+esc(c.bill)+', invoice '+esc(c.inv):c.ok===true?' matches':' - cannot check ('+esc(c.inv)+')')+'</div>'};
const chkTable=x=>(x.checks||[]).length?'<div class="step" style="margin-bottom:10px"><b>Invoice vs courier bill</b><div class="tbl"><table><thead><tr><th>Check</th><th>Invoice</th><th>Courier bill</th><th>Result</th></tr></thead><tbody>'+x.checks.map(c=>{const k=chkCol(c);return '<tr style="background:'+k[0]+'"><td><b>'+esc(c.k)+'</b></td><td>'+esc(c.inv)+'</td><td>'+esc(c.bill)+'</td><td style="color:'+k[1]+';font-weight:700">'+k[2]+' '+(c.ok===true?'Matches':c.ok===false?'Does not match':'Cannot check')+'</td></tr>'}).join('')+'</tbody></table></div></div>':'';
`;
const edits=[
 ["const base={ck,dc,guess","const base={checks:[],ck,dc,guess"],
 ["  const resolved=disp","  const checks=[],tol=est&&!est.err?Math.max(nm(R.tolAmt),est.pre*nm(R.tolPct)/100):0;\n  if(bw>0)checks.push({k:'Weight',inv:dc.rw?dc.rw+' kg':'not entered',bill:up05(bw)+' kg',ok:dc.rw?up05(bw)<=dc.rw:null});\n  if(pc)checks.push({k:'Packages',inv:dc.n?String(dc.n):'not entered',bill:String(pc),ok:dc.n?pc===dc.n:null});\n  if(bd.length)checks.push({k:'Size',inv:dc.dims.length?dc.dims.map(t=>t.join('x')).join(', ')+' cm':'not entered',bill:bd.map(t=>t.join('x')).join(', ')+' cm',ok:dc.dims.length?!issues.some(s=>s.indexOf('Billed size')===0):null});\n  checks.push(est&&!est.err?{k:'Amount before GST',inv:inr2(est.pre)+' rate list',bill:inr2(bp.pre),ok:diff<=tol}:{k:'Amount before GST',inv:est?est.err:'no rate',bill:inr2(bp.pre),ok:null});\n  const resolved=disp"],
 ["return Object.assign(base,{st:issues.length?(resolved?'done':'issue'):'ok',bw,amt,bp,est,issues,disp,diff})}","return Object.assign(base,{st:issues.length?(resolved?'done':'issue'):'ok',bw,amt,bp,est,issues,disp,diff,checks})}"+CHK],
 ["red?'background:#FDECEC;box-shadow:inset 4px 0 #D92D20':x.st==='done'?'background:#EEF4FF':''","red?'background:#FDECEC;box-shadow:inset 4px 0 #D92D20':x.st==='done'?'background:#EEF4FF':x.st==='ok'?'background:#F3FBF6;box-shadow:inset 4px 0 #12B76A':''"],
 ["<td>${x.issues.map(m=>","<td>${x.checks.length?x.checks.map(chkChip).join(''):x.issues.map(m=>"],
 ["${esc(m)}</div>`).join('')}${x.disp?","${esc(m)}</div>`).join('')}${x.disp?"], // anchor check only
 ["function breakdown(x){const e=x.est,bp=x.bp,dc=x.dc;","function breakdown(x){const e=x.est,bp=x.bp,dc=x.dc,ct=chkTable(x);"],
 ["  return wt+`<div class=\"steps\">${ex}${bl}${dt}</div>`+dp}","  return ct+wt+`<div class=\"steps\">${ex}${bl}${dt}</div>`+dp}"],
 ["<th>On invoice?</th>","<th>Matching invoice</th><th>Invoice kg</th>"],
 ["<td>${ACC.inv.some(i=>awbKey(i.tracking_no)===awbKey(s.awb))?'Yes':'<span style=\"color:#B42318\">No</span>'}</td>",
  "${(()=>{const iv=ACC.inv.find(i=>i.tracking_no&&awbKey(i.tracking_no)===awbKey(s.awb));if(!iv)return '<td style=\"background:#FDECEC;color:#B42318;font-weight:700\">&#10007; No invoice has this tracking no.</td><td>-</td>';const c=compare(iv),bk=up05(nm(s.billed_weight_kg)),ok=c.dc.rw&&bk?bk<=c.dc.rw:null;return '<td style=\"background:#ECFDF3;color:#0B6B3A;font-weight:700\">&#10003; '+esc(iv.inv_no)+'</td><td style=\"'+(ok===false?'background:#FDECEC;color:#B42318;font-weight:700':ok?'background:#ECFDF3;color:#0B6B3A;font-weight:700':'')+'\">'+(ok===false?'&#10007; ':ok?'&#10003; ':'')+(c.dc.rw||'-')+' kg'+(ok===false?' (bill '+bk+' kg)':'')+'</td>'})()}"],
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
