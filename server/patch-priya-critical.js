/* 20 Nov 2026 - three things for Priya (CRM for the whole company, not a member of any one team):
   (1) "give the option to assign a mail to a merchant too" - Vinay's mailbox has only Vinay in it, so
       when she finds something there she could not hand it to a merchant. The Owner box on a mail now
       lists this team's people as before AND, under them, the people of every other team. Picking one
       of those moves the conversation to that team and gives it to that person in one go (exactly what
       Transfer does, in one click), so it lands in his Inbox and his My work.
   (2) "Priya should not see Vinay's mail, but she must see the critical issues in it" - Vinay's mailbox
       is hidden from her everywhere (lists, counts, Home) EXCEPT conversations that carry a critical
       flag (claim, shipment delay, cancellation and the rest of the alert words), because there is
       nobody else in that mailbox to catch them. Written as a list, CRIT_ONLY, so it can be changed
       for anybody without touching the rest.
   (3) "make a proper dashboard for all critical issues" - a new ⚠ Critical issues entry in the left
       pane (for the people who hand work out: Admin / CRM / Manager / Lead) that shows EVERY critical
       conversation she can see, from every team at once - Vinay's included - newest first, with its
       team, its owner and its age. The existing per-word pages (⚠ Claim, ⚠ Shipment delay…) still work.
       It also plugs a hole: those pages used to ignore which mailboxes a person may see; now they
       don't.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-priya-critical.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- (3a) the critical view: all words at once, and only mailboxes you may see ---------- */
edit('the Critical issues view',
  "function inView(t){if(view.type==='crit')return t.folder!=='deleted'&&critOf(t).includes(view.id)&&(view.all||t.status!=='done');",
  "function inView(t){if(view.type==='crit')return t.folder!=='deleted'&&inScope(t)&&(view.id==='*'?!!critOf(t).length:critOf(t).includes(view.id))&&(view.all||t.status!=='done');   /* 20 Nov 2026: '*' = every critical issue; inScope so a page never shows a mailbox you may not see */");

edit('its heading',
  "if(view.type==='crit')return '⚠ '+(alertGroups().find(g=>g.id===view.id)?.name||'Critical');",
  "if(view.type==='crit')return view.id==='*'?'⚠ Critical issues — every team':'⚠ '+(alertGroups().find(g=>g.id===view.id)?.name||'Critical');");

/* ---------- (3b) the entry in the left pane ---------- */
edit('Critical issues in the left pane',
  "const fav=[['mine','My work',ico('user'),cnt(t=>t.owner===ME&&st(t)!=='done'&&hasRecv(t))],",
  "const fav=[...(canAssignOut()?[['crit','\\u26a0 Critical issues',ico('alert'),cnt(t=>inScope(t)&&t.folder!=='deleted'&&t.status!=='done'&&!!critOf(t).length)]]:[]),\n"
+ " ['mine','My work',ico('user'),cnt(t=>t.owner===ME&&st(t)!=='done'&&hasRecv(t))],");

edit('clicking it opens the page',
  " if(d.fav){",
  " if(d.fav==='crit'){app='mail';view={type:'crit',id:'*'};openId=null;filt='all';lfilt='';render();return}   /* 20 Nov 2026 */\n"
+ " if(d.fav){");

/* ---------- (1) hand a mail to someone in another team ---------- */
edit('the Owner box can reach the other teams',
  "function renderRead(){_renderRead();fitFrames()}",

  "/* 20 Nov 2026: who may hand work out of their own team - Priya (CRM for the whole company), a\n"
+ "   manager, a lead, an admin. */\n"
+ "function canAssignOut(){const p=who(ME);return !!p&&(p.role==='Admin'||['CRM','Manager','Lead'].includes(p.role)||!!(p.perm&&(p.perm.crm_depts||[]).length))}\n"
+ "/* The Owner box lists this team first, then everybody else, team by team. Picking somebody from\n"
+ "   another team moves the conversation to that team and gives it to him in one step - the same thing\n"
+ "   Transfer does - so it reaches his Inbox and his My work. */\n"
+ "const _ownBase=ownerSelect;ownerSelect=function(t){\n"
+ " const base=_ownBase(t);\n"
+ " if(!canAssignOut())return base;\n"
+ " const by={};PEOPLE.filter(p=>p.dept!==t.dept&&isWorker(p)&&p.active!==false&&p.role!=='Admin').forEach(p=>{(by[p.dept]=by[p.dept]||[]).push(p)});\n"
+ " const groups=Object.keys(by).filter(d=>dept(d)).map(d=>'<optgroup label=\"'+esc(dept(d).name)+'\">'\n"
+ "  +by[d].map(p=>'<option value=\"x:'+p.id+'\">'+esc(p.name)+(onLeave(p.id)?' \\u00b7 on leave':'')+'</option>').join('')+'</optgroup>').join('');\n"
+ " return groups?base.replace('</select>',groups+'</select>'):base};\n"
+ "/* giving a mail to somebody in another team = move it there and make it his */\n"
+ "function assignAway(t,pid){const p=who(pid);if(!p)return;const from=dept(t.dept),to=dept(p.dept);\n"
+ " t.dept=p.dept;t.owner=pid;t.status='open';t.folder='inbox';t.unread=true;\n"
+ " hist(t,'x','Moved from '+from.name+' to '+to.name+' by '+who(ME).name);\n"
+ " hist(t,'a','Assigned to '+p.name+' by '+who(ME).name);\n"
+ " save();toast('Given to '+p.name.split(' ')[0]+' in '+to.name+' \\u21aa')}\n"
+ "function renderRead(){_renderRead();fitFrames()}");

edit('the Owner box acts on it',
  " if(e.target.dataset.own){const t=T_(e.target.dataset.own);assign(t,e.target.value);render()}});",
  " if(e.target.dataset.own){const t=T_(e.target.dataset.own),v=String(e.target.value||'');\n"
+ "  if(v.slice(0,2)==='x:')assignAway(t,v.slice(2));else assign(t,v);render()}});");

/* ---------- (2) Priya: Vinay's mailbox only when it is critical ---------- */
edit('a mailbox somebody sees only the critical mail of',
  "const _ivMine=inView;inView=function(t){return seeMine(t)&&_ivMine(t)};\n"
+ "const _imMine=isInboxMail;isInboxMail=function(t){return seeMine(t)&&_imMine(t)};\n"
+ "const _lrMine=listRows;listRows=function(){return _lrMine().filter(seeMine)};",

  "/* 20 Nov 2026: a mailbox somebody sees ONLY the critical mail of. Priya is CRM for the whole company\n"
+ "   but Vinay's ordinary mail is not hers to read - the critical ones are, because there is nobody\n"
+ "   else in that mailbox to catch them. person id -> the departments this applies to. */\n"
+ "const CRIT_ONLY={pr:['dmvkxxow5']};\n"
+ "function critOnly(t){const l=t&&CRIT_ONLY[ME];return !!l&&l.indexOf(t.dept)>=0&&!critOf(t).length}\n"
+ "const _seeM=t=>seeMine(t)&&!critOnly(t);\n"
+ "const _ivMine=inView;inView=function(t){return _seeM(t)&&_ivMine(t)};\n"
+ "const _imMine=isInboxMail;isInboxMail=function(t){return _seeM(t)&&_imMine(t)};\n"
+ "const _lrMine=listRows;listRows=function(){return _lrMine().filter(_seeM)};");

edit('APP_BUILD', "const APP_BUILD='2026-11-20-3';", "const APP_BUILD='2026-11-20-4';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');

/* ---------- follow-up, same change: the dashboards must agree with the lists ----------
   pageDash and the three report pages build their own scope (inS), so Vinay's ordinary mail would
   still have been counted on Priya's Home and in her reports. Applied there too (scratchpad step,
   kept here for the record):
     961 : inS=t=>scope.includes(t.dept)&&seeMine(t)   ->   ...&&seeMine(t)&&!critOnly(t)
     2845/4023/4055: inS=t=>scope.includes(t.dept)     ->   ...&&!critOnly(t)
*/
