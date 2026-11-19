/* 19 Nov 2026 - "after login it still says loading emails" (people were complaining).
   What people saw: the sign-in screen closed after 15 s, and then the Inbox list still carried an
   orange bar at the TOP saying "Still loading the last 365 days of this mailbox...". That bar was
   written for 60 days of history; since history went to 365 days (17 Nov) the background loader
   walks back a whole year, so the bar stayed on screen for many minutes and looked broken.
   Now the loading is in TWO phases:
     1. "recent" - the newest RECENT_DAYS (30) days of the mailbox the person lands on. The sign-in
        screen WAITS for this (up to ~18 s inside its 30 s budget) and shows the count growing, so
        the Inbox is complete when the app opens.
     2. "all"    - the rest of the year, quietly in the background, with a short pause between pages
        (gentle on the small server and on old PCs). No loading bar at the top any more; a plain
        grey line sits at the BOTTOM of the list ("Older mail is still arriving in the background"),
        and it turns into the usual "all mail from the last N days is shown" when it finishes.
   Also: the empty-folder note "Loading mail from Google..." now only looks at the mailbox being
   viewed (with 9 mailboxes one of them is nearly always backfilling, so it never went away).
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-login-load.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- 1. two-phase background loader ---------- */
edit('loadMoreBox in two phases',
  "async function loadMoreBox(deptId){const d=dept(deptId);if(!d||!window.__liveReady)return;const box=mailOf(d).toLowerCase(),st=MORE[box]||(MORE[box]={busy:false,done:false});if(st.busy||st.done)return;\n"
+ " const lim=Date.now()-HIST_DAYS*D;st.busy=true;\n"
+ " try{for(let page=0;page<80;page++){const mine=S.threads.filter(t=>t.dept===deptId&&!t._cache&&t.msgs.some(m=>!m.ours&&!m.by));const oldest=mine.length?Math.min(...mine.map(t=>t.last)):Date.now();\n"
+ "   if(oldest<=lim){st.done=true;break}\n"
+ "   const r=await api('more',{box,before:oldest,limit:500});if(r.history_days)HIST_DAYS=r.history_days;const n=mergeList(r);\n"
+ "   if(app==='mail')renderListKeep();renderFolders();\n"
+ "   if((r.threads||[]).length<500||!n){st.done=true;break}}}\n"
+ " catch(e){toast('Could not load older mail: '+e.message)}finally{st.busy=false;if(app==='mail')renderListKeep()}}",

  "/* 19 Nov 2026: phase \"recent\" = the newest RECENT_DAYS days (the sign-in screen waits for this, so\n"
+ "   the Inbox is complete when it opens); phase \"all\" = the rest of HIST_DAYS, quietly afterwards. */\n"
+ "const RECENT_DAYS=30;\n"
+ "let MORE_PAGE=null,MORE_DL=0;   // progress hook and deadline - used by the sign-in screen only\n"
+ "async function loadMoreBox(deptId,phase){const d=dept(deptId);if(!d||!window.__liveReady)return;const box=mailOf(d).toLowerCase(),st=MORE[box]||(MORE[box]={busy:false,done:false,recent:false});if(st.busy||st.done)return;\n"
+ " const all=phase==='all',lim=Date.now()-(all?HIST_DAYS:Math.min(RECENT_DAYS,HIST_DAYS))*D;st.busy=true;\n"
+ " try{for(let page=0;page<80;page++){const mine=S.threads.filter(t=>t.dept===deptId&&!t._cache&&t.msgs.some(m=>!m.ours&&!m.by));const oldest=mine.length?Math.min(...mine.map(t=>t.last)):Date.now();\n"
+ "   if(oldest<=lim){if(all)st.done=true;st.recent=true;break}\n"
+ "   if(!all&&MORE_DL&&Date.now()>MORE_DL)break;   // sign-in has waited long enough: the rest goes on quietly\n"
+ "   const r=await api('more',{box,before:oldest,limit:500});if(r.history_days)HIST_DAYS=r.history_days;const n=mergeList(r);\n"
+ "   if(app==='mail')renderListKeep();renderFolders();if(MORE_PAGE)try{MORE_PAGE(deptId)}catch(e){}\n"
+ "   if((r.threads||[]).length<500||!n){st.done=true;st.recent=true;break}\n"
+ "   if(all)await new Promise(r=>setTimeout(r,window.SLOW_PC?900:250))}}   // gentle on a small server and an old PC\n"
+ " catch(e){if(!all)toast('Could not load older mail: '+e.message)}finally{st.busy=false;if(app==='mail')renderListKeep()}}");

/* ---------- 2. no "still loading" bar at the top of the list ---------- */
edit('quiet line at the bottom instead of the orange top bar',
  "const _rlM=renderList;renderList=function(){_rlM();if(!(view.type==='box'&&view.folder==='inbox'))return;const d=dept(view.dept),st=d&&MORE[mailOf(d).toLowerCase()];\n"
+ " const m=document.querySelector('.list .msgs');const _lding=!(st&&st.done);\n"
+ " if(m)m.insertAdjacentHTML(_lding?'afterbegin':'beforeend',`<div class=\"inb60${_lding?' lding':''}\">${_lding?'⏳ Still loading the last '+HIST_DAYS+' days of this mailbox — older mail keeps arriving for about a minute…':'✓ All mail from the last '+HIST_DAYS+' days is shown — older mail: use Search'}</div>`);\n"
+ " if(!S.loadingMail&&!(st&&(st.busy||st.done)))setTimeout(()=>loadMoreBox(view.dept),50)};",

  "const _rlM=renderList;renderList=function(){_rlM();if(!(view.type==='box'&&view.folder==='inbox'))return;const d=dept(view.dept),st=d&&MORE[mailOf(d).toLowerCase()];\n"
+ " const m=document.querySelector('.list .msgs');\n"
+ " if(m)m.insertAdjacentHTML('beforeend',st&&st.done\n"
+ "  ?'<div class=\"inb60\">✓ All mail from the last '+HIST_DAYS+' days is shown — older mail: use Search</div>'\n"
+ "  :'<div class=\"inb60 quiet\">Older mail is still arriving in the background — everything new is already here, and Search finds anything older</div>');\n"
+ " if(!S.loadingMail&&!(st&&st.busy)){if(!(st&&st.recent))setTimeout(()=>loadMoreBox(view.dept,'recent'),50);else if(!st.done)setTimeout(()=>loadMoreBox(view.dept,'all'),50)}};");

edit('style for the quiet bottom line',
  "'.inb60.lding{background:#fff6ed;border-bottom:1px solid var(--line);color:#9a4a00;font-weight:600}',",
  "'.inb60{padding:12px 14px;text-align:center;color:var(--muted);font-size:12px;line-height:1.5}',\n '.inb60.quiet{opacity:.8}',");

/* ---------- 3. sign-in screen: finish the Inbox before the app opens ---------- */
edit('sign-in screen may take up to 30 s',
  'const PRELOAD_MAX_MS=15000,', 'const PRELOAD_MAX_MS=30000,');

edit('preload finishes the recent Inbox first',
  " try{\n  // the newest conversations of the Inbox this person lands on\n  let list=[];",

  " try{\n"
+ "  // 19 Nov 2026: first finish the newest RECENT_DAYS days of the Inbox this person lands on, so the\n"
+ "  // list is COMPLETE when the app opens and nobody sees \"still loading\" in it. The rest of the year\n"
+ "  // keeps loading quietly afterwards (phase \"all\"), with no bar on the list.\n"
+ "  try{if(view&&view.type==='box'&&view.dept){preStage('Loading your inbox…');\n"
+ "    MORE_DL=Date.now()+(window.SLOW_PC?20000:18000);\n"
+ "    MORE_PAGE=id=>{try{preStage('Loading your inbox… '+S.threads.filter(t=>t.dept===id).length.toLocaleString('en-IN')+' conversations')}catch(e){}};\n"
+ "    await loadMoreBox(view.dept,'recent')}}catch(e){}\n"
+ "  MORE_PAGE=null;MORE_DL=0;\n"
+ "  if(PRE.stop)return;\n"
+ "  // the newest conversations of the Inbox this person lands on\n  let list=[];");

/* ---------- 4. the empty-folder note follows the mailbox you are looking at ---------- */
edit('loadingNote only for the mailbox being viewed',
  "function loadingNote(){if(S.loadingMail)return 'Loading your mail…';const b=(S.boxes||[]).filter(x=>x.status&&x.status!=='live');if(!b.length)return '';return 'Loading mail from Google…'}",

  "function loadingNote(){if(S.loadingMail)return 'Loading your mail…';\n"
+ " let bx='';try{if(view&&view.type==='box'&&view.dept)bx=mailOf(dept(view.dept)).toLowerCase()}catch(e){}\n"
+ " const b=(S.boxes||[]).filter(x=>x.status&&x.status!=='live'&&(!bx||String(x.mailbox||'').toLowerCase()===bx));\n"
+ " if(!b.length)return '';return 'Loading mail from Google…'}");

/* ---------- 5. new build, so every open page refreshes onto it ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-1';", "const APP_BUILD='2026-11-19-2';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
