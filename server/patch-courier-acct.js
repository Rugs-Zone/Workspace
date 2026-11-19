const fs=require('fs');
const edits=[
 ["function declared(d,div){const pk=(d&&d.packets)||[];","function declared(d,div){const pk=(d&&Array.isArray(d.packets))?d.packets.filter(p=>p&&typeof p==='object'):[];"],
 ["function compare(inv){const R=RR();","/* one bad invoice must never stop the whole page (it used to stay on Loading...) */\nfunction compare(inv){try{return compareRaw(inv)}catch(e){console.error('Courier accounts: cannot check invoice',inv&&inv.inv_no,e);return {ck:'',dc:{n:0,act:0,vol:0,chg:0,rw:0,dims:[],pcs:[]},guess:false,bs:[],ds:[],duty:0,issues:['Could not check this invoice - some details are missing on it ('+((e&&e.message)||e)+')'],est:{err:'Could not check this invoice'},bp:null,disp:null,diff:0,st:'err'}}}\nfunction compareRaw(inv){const R=RR();if(!inv.d||typeof inv.d!=='object')inv=Object.assign({},inv,{d:{}});"],
 ["const STL={ok:['Matches','Approved'],","const STL={err:['Could not check','Rejected'],ok:['Matches','Approved'],"],
 ["${esc(CK[x.ck]||((x.inv.d.courier||{}).name)||'-')}","${esc(CK[x.ck]||(((x.inv.d||{}).courier||{}).name)||'-')}"],
 ["AFTER.acct=async()=>{if(!(await accLoad(true))){$('accBody').innerHTML=fail(ACC.err);return}drawAcct()};","AFTER.acct=async()=>{if(!(await accLoad(true))){$('accBody').innerHTML=fail(ACC.err);return}try{drawAcct()}catch(e){console.error(e);$('accBody').innerHTML=fail('Could not show this page: '+((e&&e.message)||e))}};"],
 ["AFTER.buyexp=async()=>{if(!(await accLoad(true))){$('buyBody').innerHTML=fail(ACC.err);return}drawBuy()};","AFTER.buyexp=async()=>{if(!(await accLoad(true))){$('buyBody').innerHTML=fail(ACC.err);return}try{drawBuy()}catch(e){console.error(e);$('buyBody').innerHTML=fail('Could not show this page: '+((e&&e.message)||e))}};"],
];
function patch(t,label){for(const [a,b] of edits){const n=t.split(a).length-1;if(n!==1)throw new Error(label+': expected 1 match, found '+n+' for: '+a.slice(0,60));t=t.replace(a,()=>b)}return t}
// 1) live module inside index.html
let idx=fs.readFileSync('index.html','utf8');
const re=/(COURIER_HTML_B64\s*=\s*["'`])([A-Za-z0-9+\/=]+)/;const m=idx.match(re);
const live=Buffer.from(m[2],'base64').toString('utf8');
if(Buffer.from(live,'utf8').toString('base64')!==m[2])throw new Error('base64 does not round-trip');
const nl=patch(live,'index.html');
fs.writeFileSync('.tmp/courier-patched.html',nl);
idx=idx.replace(re,(_,p)=>p+Buffer.from(nl,'utf8').toString('base64'));
fs.writeFileSync('index.html',idx);
// 2) the separate copy
fs.writeFileSync('courier_dashboard.html',patch(fs.readFileSync('courier_dashboard.html','utf8'),'courier_dashboard.html'));
console.log('patched both');
