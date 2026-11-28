// 28 Nov 2026: Arun's Sent was empty - every conversation he wrote in today had been moved to Deleted
// (status done), and a Deleted conversation was hidden from every list, Sent included.
// Like Gmail and Outlook, deleting a conversation no longer takes YOUR sent mail out of Sent.
// "Empty Deleted" (folder 'purged') still removes it. Who may see it is unchanged (seeMine, R15 sentSeen).
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const BLOCK = `<script>/* __sentkeepsdel:start 28 Nov 2026 - see server/patch-sent-keeps-deleted.js */
(function(){
var _iv=inView;
inView=function(t){
 try{
  if(t&&view&&view.type==='box'&&view.folder==='sent'&&t.dept===view.dept&&t.folder==='deleted'){
   var ok=(t.msgs||[]).some(function(m){return sentByUs(m,t)});
   if(!ok)return false;
   if(typeof seeMine==='function'&&!seeMine(t))return false;
   if(typeof critOnly==='function'&&critOnly(t))return false;
   if(typeof sentSeen==='function'&&!sentSeen(t))return false;
   if(typeof beforeLive==='function'&&beforeLive(t)&&!(document.getElementById('q')&&document.getElementById('q').value.trim()))return false;
   return true}
 }catch(e){}
 return _iv.apply(this,arguments)};
})();
/* __sentkeepsdel:end */</script>`;
const a = s.indexOf('<script>/* __sentkeepsdel:start'), b = s.indexOf('/* __sentkeepsdel:end */</script>');
if (a >= 0 && b > a) s = s.slice(0, a) + BLOCK + s.slice(b + '/* __sentkeepsdel:end */</script>'.length);
else s = s + '\n' + BLOCK + '\n';
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = m[1] === '2026-11-28' ? '2026-11-28-' + (+m[2] + 1) : '2026-11-28-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
