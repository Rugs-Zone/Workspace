import fs from "node:fs";
const src=fs.readFileSync(".tmp/email.html","utf8");
const cut=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);return src.slice(i,j)};
let pass=0,fail=0;
const ck=(n,g,w)=>{const ok=typeof w==='function'?w(g):JSON.stringify(g)===JSON.stringify(w);
 console.log((ok?"  PASS  ":"  FAIL  ")+n+(ok?"":"   (got "+JSON.stringify(g)+")"));ok?pass++:fail++};
const LVsort=cut("const _lrV=listRows;listRows=function(){","/* __oneRowConv");
const mk=new Function("ROWS",`
const LV_DEF={sort:'date',dir:'desc',vf:'all',pane:'right',conv:true,lines:1};
const S={prefs:{}};
const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:true});
let view={type:'box',dept:'tp',folder:'sent'};
const hasAtt=()=>false,sizeOf=()=>0,mentionsMe=()=>false,toMe=()=>false;
const cleanSub=x=>String(x||'');
const lastOut=t=>t.last;
function explode(r){return r}
let listRows=()=>ROWS;
${LVsort}
return {listRows,setView:v=>{view=v}}`);
/* the real shape: a PINNED Tuesday conversation and an unpinned one from today */
const T=iso=>Date.parse(iso);
const tue={id:'roshni',sub:'OOB R091 17/11/2026',pinned:true, last:T('2026-11-24T06:47:00Z'),msgs:[]};
const today={id:'eek',  sub:'Eekhoorn PO',        pinned:false,last:T('2026-11-26T08:53:00Z'),msgs:[]};
const a=mk([tue,today]);
const order=a.listRows().map(x=>x.id);
console.log("     Sent order: "+order.join("  then  "));
ck("today's mail is first again, not the pinned Tuesday one", order[0], 'eek');
ck("the pinned Tuesday conversation is below it", order[1], 'roshni');
a.setView({type:'box',dept:'tp',folder:'inbox'});
ck("same in the Inbox", a.listRows().map(x=>x.id)[0], 'eek');
ck("the pin itself is untouched on the conversation", tue.pinned, true);
console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
