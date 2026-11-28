// 28 Nov 2026: a reply stayed on "Sending..." for ever, even after a refresh: the office server restarted
// (self-update) while it was sending, no answer ever came, and the "sending" mark was kept in the saved copy.
// Now a mail that is "sending" but has no request running in THIS page (left from before a refresh), or whose
// request is older than 2 minutes, turns into "Not sent" with Try again - and says to check Gmail Sent first.
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const BLOCK = `<script>/* __stucksend:start 28 Nov 2026 - see server/patch-stuck-sending.js */
(function(){
var LIVE=new WeakMap();
try{var _ls=liveSend;liveSend=function(t,m){try{if(m)LIVE.set(m,Date.now())}catch(e){}return _ls.apply(this,arguments)}}catch(e){}
function sweep(){try{
 var list=[];var ot=(typeof openId!=='undefined'&&openId)?T_(openId):null;if(ot)list.push(ot);
 (S.threads||[]).forEach(function(t){var l=t&&t.msgs&&t.msgs[t.msgs.length-1];if(l&&l.sending&&t!==ot)list.push(t)});
 var ch=false;
 list.forEach(function(t){(t.msgs||[]).forEach(function(m){
  if(!m||!m.sending||m.gid)return;
  var st=LIVE.get(m);
  if(st&&Date.now()-st<120000)return;
  m.sending=false;m.failed=true;
  m.failErr=st?'No answer from the mail server for 2 minutes - check Gmail Sent before trying again':'Sending was interrupted - check Gmail Sent before trying again';
  ch=true})});
 if(ch){try{save()}catch(e){}try{render()}catch(e){}}
}catch(e){}}
setTimeout(sweep,4000);setInterval(sweep,20000);
})();
/* __stucksend:end */</script>`;
const a = s.indexOf('<script>/* __stucksend:start'), b = s.indexOf('/* __stucksend:end */</script>');
if (a >= 0 && b > a) s = s.slice(0, a) + BLOCK + s.slice(b + '/* __stucksend:end */</script>'.length);
else s = s + '\n' + BLOCK + '\n';
// signature: keep HALL / STAND numbers on one line in a narrow pane
s = s.split("font-size:24px;line-height:28px;font-weight:bold;color:'+INK+'\">11.0").join("font-size:24px;line-height:28px;font-weight:bold;white-space:nowrap;color:'+INK+'\">11.0");
s = s.split("font-size:24px;line-height:28px;font-weight:bold;color:'+OR+'\">B79").join("font-size:24px;line-height:28px;font-weight:bold;white-space:nowrap;color:'+OR+'\">B79");
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = m[1] === '2026-11-28' ? '2026-11-28-' + (+m[2] + 1) : '2026-11-28-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb, 'nowrap', (s.match(/white-space:nowrap;color:'\+(INK|OR)\+'">(11\.0|B79)/g) || []).length);
