/* 25 Nov 2026 - Rugs Email: Admin -> "Server" page (and the Rugs Zone tile opens it).

   Read-only. It asks the office mail server for its own state through the new
   "serverStatus" action, which only answers somebody signed in as role Admin,
   so this page shows nothing a non-admin could not already be refused.

   What it shows: online/offline, which VERSION is running, up time, the mail /
   thread / user counts, every mailbox's sync state, the one-time job results and
   the last log lines (with REFUSED / CRASHED / ERROR picked out in red).

   Edit this file, then run:  node server/patch-admin-server-page.js
   and afterwards:            node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
const done = [], skip = [];

function once(name, marker, find, make) {
  if (s.includes(marker)) { skip.push(name); return; }
  const i = s.indexOf(find);
  if (i < 0) throw new Error("not found for " + name + ": " + find.slice(0, 70));
  if (s.indexOf(find, i + 1) >= 0) throw new Error("appears more than once for " + name);
  s = s.slice(0, i) + make() + s.slice(i + find.length);
  done.push(name);
}

/* ---- 1. the tab itself ---- */
once("admin tab", "['srv','\\u{1F5A5}",
  "['probs','\u{1F6E0} Problems'+(waitN?' ('+waitN+')':'')]];",
  () => "['probs','\u{1F6E0} Problems'+(waitN?' ('+waitN+')':'')],['srv','\u{1F5A5} Server']];");

/* ---- 2. what that tab draws ---- */
once("admin tab body", "if(adminTab==='srv')",
  " if(adminTab==='probs'){body=repsHTML()}",
  () => " if(adminTab==='probs'){body=repsHTML()}\n if(adminTab==='srv'){body=srvHTML()}");

/* ---- 3. the page ---- */
const block = String.raw`
<script>/* __srvpage:start  25 Nov 2026: Admin -> Server (read-only view of the office mail server) */
let SRV=null,SRVERR='',SRVAT=0,SRVBUSY=false,SRVTAB=false,SRVLINES=200,SRVFIND='';
const srvAgo=t=>{if(!t)return'never';const s=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/1000));
 if(s<60)return s+' s ago';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';return Math.round(s/86400)+' days ago'};
const srvUp=s=>{if(s==null)return'';const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
 return (d?d+'d ':'')+(d||h?h+'h ':'')+m+'m'};
function srvLoad(force){
 if(SRVBUSY)return;if(!force&&SRV&&Date.now()-SRVAT<10000)return;
 SRVBUSY=true;SRVAT=Date.now();
 api('serverStatus',{lines:SRVLINES,find:SRVFIND}).then(r=>{SRV=r;SRVERR='';}).catch(e=>{SRVERR=e.message||'the server did not answer';})
  .then(()=>{SRVBUSY=false;if(app==='admin'&&adminTab==='srv')render()})}
function srvHTML(){
 const head='<section class="box"><h3>Office mail server <span>'+esc(API.replace(/^https?:\/\//,'').replace(/\/rugs-mail$/,''))+'</span></h3>';
 if(SRVERR)return head+'<p class="lead" style="color:var(--bad)"><b>The server did not answer.</b> '+esc(SRVERR)+'</p>'+
  '<p class="lead">It may be restarting after an update (that takes a few seconds), or the PC it runs on is off. Mail already on this screen keeps working.</p>'+
  '<div class="srvbar"><button class="btn pri" data-srvref>Try again</button></div></section>';
 if(!SRV)return head+'<p class="lead">Asking the server…</p></section>';
 const d=SRV.db||{},on=k=>k==='on'?'<b style="color:var(--good)">on</b>':'<b style="color:var(--bad)">off</b>';
 const t=(a,b,c)=>'<div class="tile'+(c?' '+c:'')+'"><b>'+a+'</b><span>'+b+'</span></div>';
 const nn=v=>v==null?'?':Number(v).toLocaleString('en-IN');
 const dot='<span class="srvdot'+(SRVERR?' bad':'')+'"></span>';
 let h=head+
  '<div class="srvbar">'+dot+'<b>online</b><span class="srvv">'+esc(SRV.version)+'</span>'+
   '<span class="sub">up '+esc(srvUp(SRV.up_seconds))+' · '+esc(SRV.host||'')+' · Node '+esc(SRV.node||'')+' · '+esc(String(SRV.memory_mb))+' MB</span>'+
   '<button class="btn" data-srvref title="Ask the server again">↻ Refresh</button></div>'+
  '<div class="tiles">'+t(nn(d.messages),'Mail')+t(nn(d.threads),'Conversations')+
   t(nn(d.active_users)+' / '+nn(d.users),'Active people','good')+t(nn(d.mailboxes),'Mailboxes')+
   t(nn(d.sessions),'People signed in','cool')+t(esc(d.db_size||'?'),'Database size')+'</div>'+
  (d.ok===false?'<p class="lead" style="color:var(--bad)">The server is running but cannot read the database: '+esc(d.error||'')+'</p>':'')+
  '<div class="prow"><span class="nm">New mail every 30 seconds (timers)</span><span class="vv">'+on(SRV.timers)+'</span></div>'+
  '<div class="prow"><span class="nm">Updates itself from GitHub</span><span class="vv">'+on(SRV.self_update)+' · every '+esc(String(SRV.update_every_min))+' min</span></div>'+
  '<div class="prow"><span class="nm">Gmail key</span><span class="vv">'+(/^loaded/.test(SRV.gmail_key||'')?'<b style="color:var(--good)">loaded</b>':'<b style="color:var(--bad)">'+esc(SRV.gmail_key||'?')+'</b>')+'</span></div>'+
  (SRV.waiting_mail||d.waiting_mail?'<div class="prow"><span class="nm">Mail waiting to be sent later</span><span class="vv">'+nn(d.waiting_mail)+'</span></div>':'')+
  '</section>';
 if((SRV.boxes||[]).length)h+='<section class="box"><h3>Mailboxes <span>'+SRV.boxes.length+'</span></h3><div class="atable"><table><thead><tr><th>Mailbox</th><th>State</th><th>Last check</th><th>What it last did</th></tr></thead><tbody>'+
  SRV.boxes.map(b=>'<tr><td><b>'+esc(b.mailbox)+'</b></td><td>'+(b.status==='live'?'<span style="color:var(--good)">live</span>':'<span style="color:var(--warn,#b86e00)">'+esc(b.status||'?')+'</span>')+'</td><td>'+esc(srvAgo(b.last_sync))+'</td><td class="sub">'+esc(b.note||'')+'</td></tr>').join('')+
  '</tbody></table></div></section>';
 if((SRV.jobs||[]).length)h+='<section class="box"><h3>One-time jobs <span>'+SRV.jobs.length+'</span></h3>'+
  SRV.jobs.map(j=>'<div class="prow"><span class="nm">'+esc(j.id)+'</span><span class="vv">'+esc(j.summary||(j.kind==='report'?'dry run written':'done'))+' · '+esc(srvAgo(j.at))+'</span></div>').join('')+
  '<p class="lead" style="margin:6px 0 0">A job here has already run and can never run twice. "dry run" means it only counted something and changed nothing.</p></section>';
 const line=x=>'<div class="srvl'+(/REFUSED|CRASHED|ERROR|FAILED|error:/i.test(x)?' bad':/admin:|one-time job|dry run|update/i.test(x)?' note':'')+'">'+esc(x)+'</div>';
 h+='<section class="box"><h3>Log <span>'+(SRV.log||[]).length+' lines</span></h3>'+
  '<div class="srvbar"><input type="search" id="srvfind" value="'+esc(SRVFIND)+'" placeholder="Find in the log — e.g. REFUSED, saveOrg, a name">'+
   '<select id="srvlines" aria-label="How many lines">'+[100,200,500,900].map(n=>'<option value="'+n+'"'+(n===SRVLINES?' selected':'')+'>last '+n+' lines</option>').join('')+'</select>'+
   '<span class="sub">'+esc(SRV.log_source||'')+'</span></div>'+
  '<div class="srvlog">'+((SRV.log||[]).length?SRV.log.map(line).join(''):'<div class="srvl">Nothing matches that.</div>')+'</div>'+
  '<p class="lead" style="margin:6px 0 0">Newest at the bottom. A line in red was refused or crashed — that is where to look when somebody says something did not work. Passwords and sign-in tokens are never written here.</p></section>';
 return h}
/* the page is drawn by the admin page; this keeps it fresh and keeps the typing boxes alive */
(function(){
 const st=document.createElement('style');
 st.textContent='.srvbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}'+
  '.srvbar input[type=search]{flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}'+
  '.srvbar select{padding:7px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}'+
  '.srvv{font-weight:700;background:var(--chip,rgba(127,127,127,.15));padding:2px 8px;border-radius:999px;font-size:12.5px}'+
  '.srvdot{width:9px;height:9px;border-radius:50%;background:#1f8a4c;display:inline-block;box-shadow:0 0 0 3px rgba(31,138,76,.18)}'+
  '.srvdot.bad{background:#c62828;box-shadow:0 0 0 3px rgba(198,40,40,.18)}'+
  '.srvlog{max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:6px;background:var(--bg);padding:6px}'+
  '.srvl{font:12px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-word;padding:1px 4px}'+
  '.srvl.bad{color:#c62828;background:rgba(198,40,40,.07)}.srvl.note{color:var(--muted)}';
 document.head.appendChild(st);
})();
const _rndSrv=render;
render=function(){
 const a=document.activeElement,had=!!(a&&a.id==='srvfind'),pos=had?a.selectionStart:null;
 _rndSrv.apply(this,arguments);
 const inTab=app==='admin'&&adminTab==='srv';
 if(!inTab){SRVTAB=false;return}
 if(!SRVTAB){SRVTAB=true;SRV=null;SRVERR='';SRVAT=0}        /* just opened it: ask at once */
 document.querySelectorAll('[data-srvref]').forEach(b=>b.onclick=()=>{SRV=null;SRVERR='';srvLoad(true);render()});
 const f=document.getElementById('srvfind');
 if(f){f.onchange=()=>{SRVFIND=f.value.trim();srvLoad(true)};
  f.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();SRVFIND=f.value.trim();srvLoad(true)}};
  if(had){try{f.focus();if(pos!=null)f.setSelectionRange(pos,pos)}catch(e){}}}
 const n=document.getElementById('srvlines');
 if(n)n.onchange=()=>{SRVLINES=Number(n.value)||200;srvLoad(true)};
 srvLoad(false);
};
/* Rugs Zone opens this page with mail.html?go=srv */
(function(){try{
 if(!/[?&]go=srv\b/.test(location.search))return;
 const t=setInterval(()=>{try{
  if(!ME||ME==='me'||!who(ME))return;
  clearInterval(t);
  if(who(ME).role!=='Admin')return;
  app='admin';adminTab='srv';render();
 }catch(e){clearInterval(t)}},400);
 setTimeout(()=>clearInterval(t),60000);
}catch(e){}})();
/* __srvpage:end */</script>`;

if (s.includes("__srvpage:start")) skip.push("server page block");
else { s = s.replace(/\s*$/, "") + "\n" + block + "\n"; done.push("server page block"); }

fs.writeFileSync(file, s);
console.log("patched .tmp/email.html");
console.log("  applied:      ", done.join(", ") || "(nothing)");
console.log("  already there:", skip.join(", ") || "(none)");
