/* 24 Nov 2026 - Rugs Email: a bulk "Done" now ASKS FIRST, and warns about unanswered mail.
 *
 * Why: on 16 Nov between 19:10 and 19:30 IST, 367 Team Alpha conversations were marked done
 * from the select-many bar in twenty minutes. In 178 of them the BUYER had written last and
 * nobody had answered - so real, waiting work was closed and vanished from My work, Needs
 * owner, To assign, Home and the reports. The bar did it with one click and no question.
 *
 * Now, pressing the bar's "Done" (and a Quick step that marks mail done) shows a dialog with
 * the count, and - if any of the ticked conversations have an incoming newest mail - a red
 * warning naming how many and listing the first few, with a safe option that closes only the
 * ones we have already answered.
 *
 * Nothing else changes: marking ONE conversation done from the reading pane is still one
 * click, unless the other side wrote last, in which case it asks that one question too.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-bulk-done-confirm.js
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

/* 1. the helper + the question ------------------------------------------------ */
const ASK = `
/* 24 Nov 2026: a bulk "Done" used to close everything ticked in one click with no question.
   On 16 Nov that closed 367 Team Alpha conversations in twenty minutes, 178 of them buyer
   mails nobody had answered - real work, gone from every work list. So it asks first, shows
   the count, and warns about exactly those. askBulkDone(list, go) calls go(list to close). */
const lastInMsg=t=>{const l=(t&&t.msgs)||[],m=l[l.length-1];return !!m&&recvMsg(m,t)};
function askBulkDone(ts,go){
 const todo=(ts||[]).filter(t=>t&&t.status!=='done');
 if(!todo.length){toast('Nothing to mark done');return}
 const wait=todo.filter(lastInMsg),N=todo.length,M=wait.length;
 if(N===1&&!M){go(todo);return}                                  /* one answered mail: as before */
 const list=wait.slice(0,8).map(t=>'<li><b>'+esc(rowName(t))+'</b> - '+esc(t.sub||'(no subject)')+' <span style="color:var(--muted)">'+esc(tShort(t.last))+'</span></li>').join('');
 const L=dlg('Mark '+N+' conversation'+(N===1?'':'s')+' done?',
  '<p class="lead">'+(N===1?'This conversation':'These '+N+' conversations')+' will be closed: they leave My work, Needs owner, To assign, Home and the reports, and stop counting as open work. The mail itself is not moved, deleted or changed.</p>'+
  (M?'<div style="border:1px solid var(--red);background:var(--redbg);border-radius:10px;padding:10px 12px;margin:10px 0">'+
     '<b style="color:var(--red)">In '+M+' of '+N+', the other side wrote last and nobody has answered yet.</b>'+
     '<div style="margin-top:4px">Closing '+(M===1?'it':'those')+' hides work somebody is still waiting for. That is what happened on 16 November, when 178 unanswered buyer mails were closed in one go.</div>'+
     '<ul style="margin:8px 0 0 18px;padding:0">'+list+'</ul>'+(M>8?'<div style="margin-top:4px">...and '+(M-8)+' more.</div>':'')+
     '</div>':''),
  '<button class="btn" data-c>Cancel</button>'+
  (M&&M<N?'<button class="btn" data-dall>Mark all '+N+' done</button><button class="btn pri" data-dsafe>Close the '+(N-M)+' answered, leave '+M+' waiting</button>'
   :M?'<button class="btn" data-dall>Mark '+(N===1?'it':'all '+N)+' done anyway</button>'
   :'<button class="btn pri" data-dall>Mark '+N+' done</button>'));
 const shut=()=>{$('#layer').innerHTML=''};
 L.querySelector('[data-c]').onclick=shut;
 const sf=L.querySelector('[data-dsafe]');if(sf)sf.onclick=()=>{shut();go(todo.filter(t=>!lastInMsg(t)))};
 L.querySelector('[data-dall]').onclick=()=>{shut();go(todo)};
}
try{window.rzAskBulkDone=askBulkDone}catch(e){}
`;
one(
  "document.addEventListener('click',e=>{const b=e.target.closest('[data-bk]');if(!b)return;",
  ASK + "document.addEventListener('click',e=>{const b=e.target.closest('[data-bk]');if(!b)return;",
  'askBulkDone helper'
);

/* 2. the select-many bar's Done button asks first ---------------------------- */
one(
  " if(k==='done')ts.forEach(t=>{if(t.status!=='done')done(t)});",
  " if(k==='done'){askBulkDone(ts,l=>{l.forEach(t=>done(t));SEL.clear();toast(l.length+' mail'+(l.length===1?'':'s')+' marked done');render()});return}   /* 24 Nov 2026: ask first, warn about unanswered mail */",
  'bulk bar Done'
);

fs.writeFileSync(F, s);
console.log('patch-bulk-done-confirm: ' + n + ' edits applied');
