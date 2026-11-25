/* 25 Nov 2026 - one row per conversation again, dated by its NEWEST mail, opening on the newest.
   Seen as Jatin: "PO 174871 AND 173728 PILLOWS" showed as 3 rows (Megan Tue 7:53 pm, SCProduction
   Mon 7:53 pm, Aman Mon 7:14 pm) - all ONE Gmail thread (1a163b70bd362ace). Cause: the 24 Nov
   "every mail is its own row" (explode) made one row per received mail, each row carrying the
   conversation's newest sender name, and the 25 Nov click rule opened the clicked (old) mail.
   Gmail Date headers checked: Megan 24 Nov 14:23:02 UTC, SCProduction 23 Nov 14:23:07 UTC - real.
   Usage: node server/mailapp-b64.js decode; node server/patch-one-row-per-conv.js; ...encode */
const fs=require('fs'),F='.tmp/email.html';let s=fs.readFileSync(F,'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1)throw new Error('anchor x'+n+': '+a.slice(0,60));s=s.replace(a,()=>b)}
if(s.includes('__oneRowConv'))throw new Error('already applied');
rep("/* 24 Nov 2026: conv is fixed at false - every mail is its own row for everybody */\nconst LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:false});",
    "/* 25 Nov 2026: conv is fixed at TRUE - one row per conversation, Outlook way (patch-one-row-per-conv.js) */\nconst LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:true});");
rep("last:Date.parse(r.last_msg_at)||Date.now(),",
    "last:Math.max(Date.parse(r.last_msg_at)||0,...ms.map(m=>Date.parse(m.sent_at)||0))||Date.now(),");
rep("const bd=boxDept(),have=new Set(S.threads.map(t=>t.id));let n=0;\n (r.threads||[]).forEach(row=>{const home=bd[String(row.mailbox).toLowerCase()];if(!home)return;const id=home+':'+row.gmail_thread_id;if(have.has(id))return;",
    "const bd=boxDept(),have=new Map(S.threads.map((t,i)=>[t.id,i]));let n=0;\n (r.threads||[]).forEach(row=>{const home=bd[String(row.mailbox).toLowerCase()];if(!home)return;const id=home+':'+row.gmail_thread_id;if(have.has(id)){const o=S.threads[have.get(id)];const nl=Date.parse(row.last_msg_at)||0;if(!o||o._local||nl<=o.last||metaSaved[id]!==JSON.stringify(metaOf(o)))return;const k0=row.mailbox+'|'+row.gmail_thread_id,t0=mapRow(row,by[k0]||[],ac[k0]||[],o,home);if(t0.msgs.length>=o.msgs.length){S.threads[have.get(id)]=t0;metaSaved[id]=JSON.stringify(metaOf(t0));n++}return}");
rep("/* --- the View menu (above the mail list) --- */",
`/* __oneRowConv 25 Nov 2026: never two rows for one conversation; row time = newest mail; open = newest mail */
function convDedupe(){const seen=new Map();let drop=false;S.threads.forEach((t,i)=>{const nw=t.msgs&&t.msgs.length?Math.max(...t.msgs.map(m=>m.at||0)):0;if(nw>t.last)t.last=nw;const j=seen.get(t.id);if(j==null)seen.set(t.id,i);else{drop=true;const a=S.threads[j];if((t.last||0)>(a.last||0)||((t.last||0)===(a.last||0)&&t.msgs.length>a.msgs.length))seen.set(t.id,i)}});
 if(drop){const keep=new Set(seen.values());S.threads=S.threads.filter((t,i)=>keep.has(i))}}
const _lrOne=listRows;listRows=function(){try{convDedupe()}catch(e){}return _lrOne()};
const _openOne=open;open=function(id){if(id!==openId){const t=T_(id);if(t&&t.msgs&&t.msgs.length)openMsgs[t.id]=new Set([t.msgs.length-1])}return _openOne(id)};
/* --- the View menu (above the mail list) --- */`);
fs.writeFileSync(F,s);console.log('ok one-row-per-conv');
