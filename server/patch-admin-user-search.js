/* 23 Nov 2026 — Rugs Email, Admin panel → Users & passwords.
 *
 * Reported: "in admin panel I still can't see [Jatin] ... give a search option
 * ... and fix the page because it is not fitting properly".
 *
 * There are 82 people in one long table of 13 columns, with no way to search,
 * so finding one person meant scrolling the whole list; and the table is wider
 * than the window, so the right-hand columns were cut off at the screen edge.
 *
 * What this patch does:
 *   1. a search box above the list — name, user ID, team, role, status,
 *      auto-assign domains and aliases; several words all have to match;
 *      the heading count turns into "3 of 82" while searching.
 *   2. the Person column is frozen, so whose row you are on stays visible
 *      while you scroll sideways, and the sideways scrollbar is made visible
 *      instead of being invisible until you touch it.
 *   3. the fields are given sensible widths so far more of the table fits
 *      on screen in the first place.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-admin-user-search.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const before = s;
let n = 0;
function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('expected 1 match for ' + what + ', found ' + c);
  s = s.replace(find, repl);
  n++;
}

/* 1. styles -------------------------------------------------------------- */
one(
  '.atable tr.off td{opacity:.55}',
  '.atable tr.off td{opacity:.55}\n' +
  '.usrbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:-2px 0 2px}\n' +
  '.usrbar input{flex:1;min-width:220px;max-width:430px;border:1px solid var(--line);background:var(--pane2);border-radius:10px;padding:8px 12px;font:inherit;color:inherit}\n' +
  '.usrbar .sub{font-size:12px;color:var(--muted)}\n' +
  '.atable{max-width:100%;scrollbar-width:thin}\n' +
  '.atable::-webkit-scrollbar{height:10px}\n' +
  '.atable::-webkit-scrollbar-thumb{background:var(--line);border-radius:6px}\n' +
  '.atable td:first-child{position:sticky;left:0;z-index:1;background:var(--pane)}\n' +
  '.atable th:first-child{position:sticky;left:0;z-index:3;background:var(--pane2)}\n' +
  '.atable input[type=text],.atable input[type=email],.atable select{min-width:0}\n' +
  '.atable .uName{width:148px}.atable .uLogin{width:186px}.atable .uDept{width:150px}.atable .uRole{width:130px}\n' +
  '.atable .uDom{min-width:0!important;width:130px}.atable .uAli{min-width:0!important;width:160px}',
  'admin table styles'
);

/* 2. the query has to survive a redraw ----------------------------------- */
one(
  "let adminTab='overview';",
  "let adminTab='overview';\nlet USRQ='';/* 23 Nov 2026: what is typed in the Admin -> Users search box */",
  'USRQ variable'
);

/* 3. the search box itself ----------------------------------------------- */
one(
  '<h3>Users <span>${PEOPLE.length}</span></h3>',
  '<h3>Users <span id="usrn">${PEOPLE.length}</span></h3>' +
  '<div class="usrbar"><input type="search" id="usrq" value="${esc(USRQ)}" placeholder="Search a person — name, user ID, team or role" aria-label="Search users">' +
  '<span class="sub" id="usrhint"></span></div>',
  'users search box'
);

/* 4. filtering, and keeping the box usable across redraws ---------------- */
const tail = `
/* 23 Nov 2026 — Admin -> Users & passwords: live search over the user list.
   The rows are drawn as before; this only hides the ones that do not match,
   so nothing about saving, passwords or permissions changes. */
function admUsrFilter(){
  const box=document.getElementById('usrq');if(!box)return;
  const words=String(USRQ||'').trim().toLowerCase().split(/\\s+/).filter(Boolean);
  let shown=0,total=0;
  document.querySelectorAll('tr[data-urow]').forEach(function(tr){
    total++;
    const val=function(sel){const e=tr.querySelector(sel);return e?String(e.value||''):''};
    const ds=tr.querySelector('.uDept');
    const dept=(ds&&ds.options[ds.selectedIndex])?ds.options[ds.selectedIndex].text:'';
    const hay=(val('.uName')+' '+val('.uLogin')+' '+dept+' '+val('.uRole')+' '+
      (tr.classList.contains('off')?'off inactive deactivated':'active')+' '+
      val('.uDom')+' '+val('.uAli')).toLowerCase();
    const ok=!words.length||words.every(function(w){return hay.indexOf(w)>=0});
    tr.style.display=ok?'':'none';
    if(ok)shown++;
  });
  const n=document.getElementById('usrn');
  if(n)n.textContent=words.length?(shown+' of '+total):String(total);
  const h=document.getElementById('usrhint');
  if(h)h.textContent=words.length?(shown?'':'Nobody matches that.'):'Scroll the table sideways for the rest of the columns.';
}
const _rndUsr=render;
render=function(){
  const a=document.activeElement;
  const had=!!(a&&a.id==='usrq');
  const pos=had?a.selectionStart:null;
  _rndUsr.apply(this,arguments);
  const box=document.getElementById('usrq');
  if(!box)return;
  box.value=USRQ;
  box.oninput=function(){USRQ=box.value;admUsrFilter()};
  admUsrFilter();
  if(had){try{box.focus();if(pos!=null)box.setSelectionRange(pos,pos)}catch(e){}}
};
`;
const endMark = '/* __olpack:end */</script>';
if (s.split(endMark).length - 1 !== 1) throw new Error('could not find the end of the app script');
s = s.replace(endMark, '/* __olpack:end */' + tail + '</script>');
n++;

if (s === before) throw new Error('nothing changed');
fs.writeFileSync(F, s);
console.log('patched ' + F + ' — ' + n + ' edits');
