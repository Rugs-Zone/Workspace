/* 24 Nov 2026 - Rugs Email: "Report a problem", so the owner stops taking complaint calls
 * one at a time.
 *
 * Deliberately small. One click from two places:
 *   - the menu under the person's own name ("Report a problem")
 *   - right-click on a mail (then the conversation is attached to the report)
 *
 * It sends one line of text plus what is needed to understand it without ringing anybody back:
 * the conversation id and mailbox, who reported it, the app build, which page they were on,
 * the browser, and whether their session had been switched. Nothing else - no mail text.
 *
 * The admin gets a list: Admin -> "Problems", newest first, with the person, when, the page,
 * the build, the note, a link that opens the conversation they were looking at, and a
 * "Handled" button. The count of waiting reports is shown on the tab.
 *
 * Server: rugs-mail-list gets "report" (anyone signed in), "reports" and "reportDone"
 * (Admin only) - see server/patch-server-report.js. The table rm_reports is created by
 * server.mjs at start-up.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-report-problem.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('expected 1 match for ' + what + ', found ' + c);
  s = s.replace(find, repl);
  n++;
}

/* 1. the dialog, the sending, and the admin list ----------------------------- */
const REP = [
"",
"/* ---------- 24 Nov 2026: Report a problem ---------- */",
"let REPS=null,repsAt=0;                                  /* what the admin's list last showed */",
"function repWhere(){return app==='mail'?(view.type==='box'?(dept(view.dept)?.name||view.dept)+' \\u00b7 '+view.folder:view.type+' \\u00b7 '+(view.id||view.folder||'')):String(app||'')}",
"function repDlg(t){",
" const L=dlg('Report a problem',",
"  '<div class=\"fld\"><label for=\"rpN\">What went wrong? One line is enough.</label><input type=\"text\" id=\"rpN\" maxlength=\"300\" placeholder=\"e.g. this mail shows only the short preview\"></div>'+",
"  '<p class=\"lead\" style=\"margin:0;font-size:12.5px\">Sent with it: '+(t?'this conversation ('+esc(cleanSub(t.sub).slice(0,60))+'), ':'')+'your name, the page you are on ('+esc(repWhere())+') and the app version ('+esc(APP_BUILD)+') \\u2014 so nobody has to ring you back to ask. The mail itself is not sent.</p>',",
"  '<button class=\"btn\" data-c>Cancel</button><button class=\"btn pri\" data-ok>Send to the admin</button>');",
" L.querySelector('[data-c]').onclick=()=>{L.innerHTML=''};",
" setTimeout(()=>L.querySelector('#rpN')?.focus(),30);",
" L.querySelector('[data-ok]').onclick=()=>{",
"  const note=(L.querySelector('#rpN').value||'').trim();",
"  if(note.length<3){toast('Please write one line about the problem');return}",
"  const b=L.querySelector('[data-ok]');b.disabled=true;b.textContent='Sending\\u2026';",
"  api('report',{note,thread:t?gidOf(t):'',box:t?t.box:'',page:repWhere(),build:APP_BUILD,agent:String(navigator.userAgent||'').slice(0,200)})",
"   .then(()=>{L.innerHTML='';toast('Thank you \\u2014 the admin has it, with everything needed to look into it')})",
"   .catch(e=>{b.disabled=false;b.textContent='Send to the admin';toast('Could not send it: '+e.message)})};",
"}",
"function repsLoad(force){if(REPS&&!force&&Date.now()-repsAt<20000)return;repsAt=Date.now();",
" api('reports',{limit:200}).then(r=>{REPS=r.reports||[];if(app==='admin')render()}).catch(e=>{REPS=[];toast('Could not load the problem reports: '+e.message)})}",
"function repsHTML(){",
" if(!REPS)return '<p class=\"lead\">Loading\\u2026</p>';",
" if(!REPS.length)return '<p class=\"lead\">Nothing reported. When somebody presses \\u201cReport a problem\\u201d it appears here.</p>';",
" const row=r=>'<tr'+(r.done_at?' style=\"opacity:.55\"':'')+'><td>'+esc(tShort(new Date(r.at).getTime()))+'</td><td><b>'+esc(who(r.user_id)?.name||r.user_id||'?')+'</b></td><td>'+esc(r.note||'')+'</td><td>'+esc(r.page||'')+'<br><span style=\"color:var(--muted)\">'+esc(r.build||'')+'</span></td><td>'+(r.gmail_thread_id?'<button class=\"btn\" data-rpopen=\"'+esc(r.mailbox+'|'+r.gmail_thread_id)+'\">Open the mail</button>':'')+'</td><td>'+(r.done_at?'\\u2713 handled':'<button class=\"btn pri\" data-rpdone=\"'+r.id+'\">Handled</button>')+'</td></tr>';",
" return '<section class=\"box\"><h3>Problems people reported</h3><div style=\"overflow:auto\"><table><thead><tr><th>When</th><th>Who</th><th>What they wrote</th><th>Where / version</th><th>Mail</th><th></th></tr></thead><tbody>'+REPS.map(row).join('')+'</tbody></table></div></section>';",
"}",
"document.addEventListener('click',e=>{",
" const o=e.target.closest('[data-rpopen]');",
" if(o){const [box,tid]=o.dataset.rpopen.split('|');const t=S.threads.find(z=>z.box===box&&gidOf(z)===tid);",
"  if(t){app='mail';view={type:'box',dept:t.dept,folder:t.folder==='deleted'?'deleted':'inbox'};open(t.id);return}",
"  toast('Fetching that conversation\\u2026');api('find',{ids:[box+'|'+tid]}).then(r=>{mergeList(r);const t2=S.threads.find(z=>z.box===box&&gidOf(z)===tid);",
"   if(!t2)return toast('That conversation is not in the mailboxes you can see');app='mail';view={type:'box',dept:t2.dept,folder:'inbox'};open(t2.id)}).catch(err=>toast('Could not open it: '+err.message));return}",
" const d=e.target.closest('[data-rpdone]');",
" if(d){const id=d.dataset.rpdone;d.disabled=true;api('reportDone',{id:Number(id)}).then(()=>{const r=(REPS||[]).find(x=>String(x.id)===String(id));if(r)r.done_at=new Date().toISOString();render()}).catch(err=>{d.disabled=false;toast(err.message)})}",
"});",
""].join('\n');
one("function pageAdmin(){", REP + "function pageAdmin(){", 'report dialog + admin list');

/* 2. the admin tab ----------------------------------------------------------- */
one(
  "const tabs=[['overview','Overview'],['depts','Departments'],['users','Users & passwords'],['access','Visibility & sharing'],['switch','🔁 Switch ID']];",
  "const waitN=(REPS||[]).filter(r=>!r.done_at).length;\n" +
  " const tabs=[['overview','Overview'],['depts','Departments'],['users','Users & passwords'],['access','Visibility & sharing'],['switch','🔁 Switch ID'],['probs','🛠 Problems'+(waitN?' ('+waitN+')':'')]];   /* 24 Nov 2026 */\n" +
  " if(adminTab==='probs')repsLoad();",
  'admin tab'
);

/* 3. its page --------------------------------------------------------------- */
one(
  " if(adminTab==='overview'){const act=PEOPLE.filter(p=>p.active);",
  " if(adminTab==='probs'){body=repsHTML()}\n" +
  " if(adminTab==='overview'){const act=PEOPLE.filter(p=>p.active);",
  'admin page body'
);

/* 4. in the menu under the person's own name --------------------------------- */
one(
  "<button id=\"mT\">${ico('sun')} Light / dark</button>",
  "<button id=\"mB\">\\u{1F6E0} Report a problem</button><button id=\"mT\">${ico('sun')} Light / dark</button>",
  'profile menu item'
);
one(
  " $('#mP').onclick=()=>{$('#layer').innerHTML='';profileDlg()};",
  " $('#mP').onclick=()=>{$('#layer').innerHTML='';profileDlg()};\n" +
  " $('#mB').onclick=()=>{$('#layer').innerHTML='';repDlg(openId?T_(openId):null)};   /* 24 Nov 2026 */",
  'profile menu wiring'
);

/* 5. right-click on a mail --------------------------------------------------- */
one(
  "+it('ignore',ign?'🔔 Stop ignoring':'🔕 Ignore conversation',full?'':'View only')+it('del','🗑 Delete',!full||!can('delete')?\"You can't delete this mail\":'');",
  "+it('ignore',ign?'🔔 Stop ignoring':'🔕 Ignore conversation',full?'':'View only')+it('del','🗑 Delete',!full||!can('delete')?\"You can't delete this mail\":'')+'<hr>'+it('report','\\u{1F6E0} Report a problem');",
  'right-click item'
);
one(
  " if(a==='move'){m.querySelector('.cmsub').classList.toggle('open');return}\n cmClose();",
  " if(a==='move'){m.querySelector('.cmsub').classList.toggle('open');return}\n cmClose();\n" +
  " if(a==='report'){repDlg(t);return}   /* 24 Nov 2026 */",
  'right-click wiring'
);

fs.writeFileSync(F, s);
console.log('patch-report-problem: ' + n + ' edits applied');
