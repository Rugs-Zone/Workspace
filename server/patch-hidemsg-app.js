// 28 Nov 2026: "Delete this mail only" in a mail's ... menu (reading pane). Rugs Email only, any team member,
// Undo for 10 s and "Bring back" from the conversation's trail. Server action: hideMsg (server/patch-server-hidemsg.js).
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const BLOCK = `<script>/* __hidemsg:start 28 Nov 2026 - see server/patch-hidemsg-app.js */
(function(){
function H(){try{var v=S.settings&&S.settings.hidden_msgs;return v&&typeof v==='object'?v:{}}catch(e){return{}}}
function key(t,m){return String(t.box||'').toLowerCase()+'|'+String(m.gid||'')}
/* every conversation the server sends is filtered once, here */
try{var _mr=mapRow;mapRow=function(){var t=_mr.apply(this,arguments);try{var h=H();
 if(t&&t.msgs&&t.msgs.length>1){var keep=t.msgs.filter(function(m){return !(m.gid&&h[key(t,m)])});
  if(keep.length&&keep.length<t.msgs.length){t._hid=t.msgs.length-keep.length;t.msgs=keep}}}catch(e){}return t}}catch(e){}
/* other people's deletes arrive every 3 minutes */
setInterval(function(){try{if(!window.__liveReady||document.hidden)return;
 api('getSetting',{key:'hidden_msgs'}).then(function(r){if(r&&r.value&&typeof r.value==='object'){S.settings=S.settings||{};S.settings.hidden_msgs=r.value}}).catch(function(){})}catch(e){}},180000);
/* the ... button on one mail: add the item */
var PEND=null;
document.addEventListener('click',function(e){var b=e.target.closest('[data-olkmore]');if(!b)return;
 var art=b.closest('article.mail');var t=openId&&T_(openId);PEND=null;if(!art||!t)return;
 var mi=+String(art.id||'').split('-').pop();var m=t.msgs[mi];if(!m||!m.gid||t.msgs.length<2)return;
 if(canSee(t.dept)!=='full')return;
 PEND={t:t,m:m};
 setTimeout(function(){var mn=document.querySelector('.cmenu');if(!mn||mn.querySelector('[data-cm="delmsg"]'))return;
  var bt=document.createElement('button');bt.type='button';bt.setAttribute('role','menuitem');bt.dataset.cm='delmsg';
  bt.textContent='\\u{1F5D1} Delete this mail only';bt.title='Takes only this one mail out of the conversation for the whole team. Gmail keeps it.';
  var rep=mn.querySelector('[data-cm="report"]');if(rep)mn.insertBefore(bt,rep.previousElementSibling&&rep.previousElementSibling.tagName==='HR'?rep.previousElementSibling:rep);else mn.appendChild(bt)},0)},true);
function hide(t,m,undo){
 return api('hideMsg',{mailbox:t.box,threadId:gidOf(t),gmailId:m.gid,undo:!!undo}).then(function(r){S.settings=S.settings||{};if(r&&r.hidden)S.settings.hidden_msgs=r.hidden;return r})}
document.addEventListener('click',function(e){var b=e.target.closest('[data-cm="delmsg"]');if(!b)return;
 e.preventDefault();var p=PEND;PEND=null;try{cmClose()}catch(x){}if(!p)return;var t=p.t,m=p.m;
 if(!confirm('Delete only this mail from the conversation?\\n\\n"'+String(m.from||'')+'" \\u2013 '+new Date(m.at).toLocaleString('en-IN')+'\\n\\nThe rest of the conversation stays. Gmail keeps the mail.'))return;
 hide(t,m,false).then(function(){var i=t.msgs.indexOf(m);if(i>=0)t.msgs.splice(i,1);t._hid=(t._hid||0)+1;try{save()}catch(x){}render();
  var bar=document.createElement('div');bar.className='undobar';bar.setAttribute('role','status');
  bar.innerHTML='<span>Mail deleted from this conversation</span><button type="button" class="btn">Undo</button>';document.body.appendChild(bar);
  var tm=setTimeout(function(){bar.remove()},10000);
  bar.querySelector('button').onclick=function(){clearTimeout(tm);bar.remove();hide(t,m,true).then(function(){t.msgs.push(m);t.msgs.sort(function(a,b){return a.at-b.at});t._hid=Math.max(0,(t._hid||1)-1);try{save()}catch(x){}render();toast('Mail brought back')}).catch(function(er){toast('Could not bring it back: '+er.message)})}})
 .catch(function(er){toast('Not deleted: '+er.message)})},true);
})();
/* __hidemsg:end */</script>`;
const a = s.indexOf('<script>/* __hidemsg:start'), b = s.indexOf('/* __hidemsg:end */</script>');
if (a >= 0 && b > a) s = s.slice(0, a) + BLOCK + s.slice(b + '/* __hidemsg:end */</script>'.length);
else s = s + '\n' + BLOCK + '\n';
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = m[1] === '2026-11-28' ? '2026-11-28-' + (+m[2] + 1) : '2026-11-28-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
