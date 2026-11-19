/* 19 Nov 2026 - Outlook-style STATUS BAR along the bottom of Rugs Email.
   Asked for: "like Outlook at the bottom, after opening it shows that mail are downloading -
   a progress tab we can also make". Outlook keeps a thin line at the bottom of its window
   ("Downloading messages: 120 of 3,000", "Updating this folder", "All folders are up to date"),
   and that is what this adds, in plain words:
     left  - what the folder you are looking at holds:  Items: 1,431 · Unread: 26
     right - what the app is doing RIGHT NOW, with a small progress bar:
               Getting your mail ready...                  (sign-in)
               Downloading your mail... 2,000 conversations (the newest 30 days)
               Downloading older mail... 6,400 conversations · back to 20 May   (background)
               Checking for new mail...                     (a sync / the 15-second check)
               All mail from the last 365 days is downloaded (for a few seconds when it ends)
               All folders are up to date · checked 10:42    (nothing left to do)
               No internet - Rugs Email will catch up when it is back
     a green / amber / red dot on the far right, like Outlook's connection mark.
   Clicking the text checks for new mail (same as the Sync button). Hidden on phones (no room,
   the app already has its own bottom bar there) and while nobody is signed in.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-status-bar.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- 1. the bar itself: its own row at the bottom of the window ---------- */
edit('status bar markup',
  '<nav class="mobnav" id="mobnav" aria-label="Apps"></nav>',
  '<div class="stbar" id="statusbar" role="status" aria-live="polite" hidden></div>\n'
+ '<nav class="mobnav" id="mobnav" aria-label="Apps"></nav>');

/* ---------- 2. what the folder holds (counted once, where the list is already counting) ---------- */
edit('remember the row count for the status bar',
  " const rows=special?[]:listRows();const isInbox=view.type==='box'&&view.folder==='inbox';",
  " const rows=special?[]:listRows();const isInbox=view.type==='box'&&view.folder==='inbox';\n"
+ " try{window.LCNT={n:special?S.drafts.length:rows.length,u:0}}catch(e){}   /* 19 Nov 2026: for the bottom status bar */");

edit('remember the unread count for the status bar',
  " const sm=document.querySelector('.list .lhead h2 small');if(!sm)return;const rows=listRows(),u=view.type==='all'?inboxUnreadN():inboxUnreadN(view.dept);",
  " const sm=document.querySelector('.list .lhead h2 small');if(!sm)return;const rows=listRows(),u=view.type==='all'?inboxUnreadN():inboxUnreadN(view.dept);\n"
+ " try{(window.LCNT=window.LCNT||{}).u=u;window.LCNT.n=rows.length}catch(e){}   /* 19 Nov 2026: bottom status bar */");

/* ---------- 3. the downloader tells the bar what it is doing ---------- */
edit('downloader reports it has started',
  " const all=phase==='all',lim=Date.now()-(all?HIST_DAYS:Math.min(RECENT_DAYS,HIST_DAYS))*D;st.busy=true;",
  " const all=phase==='all',lim=Date.now()-(all?HIST_DAYS:Math.min(RECENT_DAYS,HIST_DAYS))*D;st.busy=true;\n"
+ " DLS.busy=true;DLS.phase=all?'all':'recent';try{stbarPaint()}catch(e){}");

edit('downloader reports progress',
  "   if(oldest<=lim){if(all)st.done=true;st.recent=true;break}",
  "   DLS.oldest=oldest;DLS.n=mine.length;try{stbarPaint()}catch(e){}\n"
+ "   if(oldest<=lim){if(all)st.done=true;st.recent=true;break}");

edit('downloader reports it has finished',
  " catch(e){if(!all)toast('Could not load older mail: '+e.message)}finally{st.busy=false;if(app==='mail')renderListKeep()}}",
  " catch(e){if(!all)toast('Could not load older mail: '+e.message)}\n"
+ " finally{st.busy=false;DLS.busy=false;if(st.done)DLS.doneAt=Date.now();try{stbarPaint()}catch(e){}if(app==='mail')renderListKeep()}}");

/* ---------- 4. the bar's own code and look ---------- */
edit('status bar code',
  "/* ================= Nov 2026: choose the alert sound ================= */",

  "/* ================= 19 Nov 2026: Outlook-style status bar along the bottom =================\n"
+ "   Left: what this folder holds. Right: what the app is doing now, with a progress bar while\n"
+ "   mail is being downloaded, and \"All folders are up to date\" when there is nothing left.\n"
+ "   Click the text to check for new mail. Hidden on phones and while signed out. */\n"
+ "const DLS={busy:false,phase:'',n:0,oldest:0,doneAt:0};\n"
+ "function stbarMount(){const el=document.getElementById('statusbar');if(!el)return null;\n"
+ " if(!el.firstChild)el.innerHTML='<span class=\"stleft\" id=\"stL\"></span><span class=\"stgrow\"></span>'\n"
+ "  +'<span class=\"stprog\" id=\"stP\" role=\"progressbar\" aria-valuemin=\"0\" aria-valuemax=\"100\" hidden><span></span></span>'\n"
+ "  +'<button type=\"button\" class=\"stmsg\" id=\"stT\" title=\"Check for new mail\"></button>'\n"
+ "  +'<span class=\"stdot ok\" id=\"stD\" aria-hidden=\"true\"></span>';\n"
+ " return el}\n"
+ "function stbarPaint(){const el=stbarMount();if(!el)return;\n"
+ " if(document.body.classList.contains('signedout')||!window.__liveReady){el.hidden=true;return}\n"
+ " el.hidden=false;\n"
+ " const L=el.querySelector('#stL'),P=el.querySelector('#stP'),T=el.querySelector('#stT'),Dt=el.querySelector('#stD'),c=window.LCNT||{};\n"
+ " L.innerHTML=(app==='mail'&&c.n!=null)?'Items: <b>'+(+c.n).toLocaleString('en-IN')+'</b>'+(c.u?' <i>·</i> Unread: <b>'+(+c.u).toLocaleString('en-IN')+'</b>':''):'';\n"
+ " let msg='',pct=-1,dot='ok';\n"
+ " const nC=DLS.n?DLS.n.toLocaleString('en-IN')+' conversation'+(DLS.n===1?'':'s'):'';\n"
+ " if(!navigator.onLine){msg='No internet \\u2014 Rugs Email will catch up when it is back';dot='off'}\n"
+ " else if(S.loadingMail){msg='Getting your mail ready\\u2026';dot='work';pct=2}\n"
+ " else if(DLS.busy){dot='work';const span=(DLS.phase==='all'?HIST_DAYS:RECENT_DAYS)*D;\n"
+ "  pct=DLS.oldest?Math.max(2,Math.min(99,Math.round(100*(Date.now()-DLS.oldest)/span))):2;\n"
+ "  msg=(DLS.phase==='all'?'Downloading older mail\\u2026':'Downloading your mail\\u2026')+(nC?' '+nC:'')\n"
+ "   +(DLS.phase==='all'&&DLS.oldest?' \\u00b7 back to '+new Date(DLS.oldest).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'')}\n"
+ " else if(syncing||polling){msg='Checking for new mail\\u2026';dot='work'}\n"
+ " else if(DLS.doneAt&&Date.now()-DLS.doneAt<8000)msg='\\u2713 All mail from the last '+HIST_DAYS+' days is downloaded';\n"
+ " else msg='All folders are up to date'+(S.lastSync?' \\u00b7 checked '+new Date(S.lastSync).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}):'');\n"
+ " T.textContent=msg;el.title=msg+(DLS.busy?' \\u2014 you can work while the rest arrives':'');\n"
+ " if(pct<0)P.hidden=true;else{P.hidden=false;P.firstChild.style.width=pct+'%';P.setAttribute('aria-valuenow',pct)}\n"
+ " Dt.className='stdot '+dot}\n"
+ "const _rdST=render;render=function(){_rdST();try{stbarPaint()}catch(e){}};\n"
+ "document.addEventListener('click',e=>{if(!e.target.closest('#stT'))return;e.preventDefault();\n"
+ " if(typeof syncNow==='function')syncNow();try{stbarPaint()}catch(e){}});\n"
+ "setInterval(()=>{try{if(DLS.busy||syncing||polling||S.loadingMail||(DLS.doneAt&&Date.now()-DLS.doneAt<9000))stbarPaint()}catch(e){}},1000);\n"
+ "addEventListener('online',()=>{try{stbarPaint()}catch(e){}});addEventListener('offline',()=>{try{stbarPaint()}catch(e){}});\n"
+ "(function(){const st=document.createElement('style');st.textContent=[\n"
+ " '.stbar{flex:none;display:flex;align-items:center;gap:10px;height:26px;padding:0 12px;background:var(--pane2);border-top:1px solid var(--line);color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden}',\n"
+ " '.stbar[hidden]{display:none}',\n"
+ " '.stbar .stgrow{flex:1}',\n"
+ " '.stbar .stleft{overflow:hidden;text-overflow:ellipsis}',\n"
+ " '.stbar b{font-weight:600;color:var(--fg)}',\n"
+ " '.stbar i{font-style:normal;opacity:.5;margin:0 2px}',\n"
+ " '.stbar .stprog{flex:none;width:120px;height:6px;border-radius:3px;background:var(--line);overflow:hidden}',\n"
+ " '.stbar .stprog[hidden]{display:none}',\n"
+ " '.stbar .stprog>span{display:block;height:100%;width:0;background:var(--brand);transition:width .4s ease}',\n"
+ " '.stbar .stmsg{color:var(--muted);font-size:12px;padding:2px 4px;border-radius:6px;max-width:52vw;overflow:hidden;text-overflow:ellipsis}',\n"
+ " '.stbar .stmsg:hover{background:var(--hover);color:var(--fg)}',\n"
+ " '.stbar .stdot{flex:none;width:8px;height:8px;border-radius:50%;background:#22c55e}',\n"
+ " '.stbar .stdot.work{background:#f59e0b}',\n"
+ " '.stbar .stdot.off{background:var(--red,#dc2626)}',\n"
+ " '@media (max-width:640px){.stbar{display:none}}'\n"
+ "].join('\\n');document.head.appendChild(st)})();\n"
+ "/* ================= Nov 2026: choose the alert sound ================= */");

/* ---------- 5. new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-2';", "const APP_BUILD='2026-11-19-3';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');

/* NOTE for whoever runs this again: one more edit was needed and is part of this change -
   the app had no body margin reset, so the browser's default 8px margin plus
   html,body{height:100%} and overflow:hidden pushed the bottom 8px of the app off the screen
   (harmless while the panes scrolled themselves, but it cut the new status bar in half):
      edit('body margin', 'html,body{height:100%}', 'html,body{height:100%;margin:0}');
*/
