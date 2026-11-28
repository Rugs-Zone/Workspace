// 28 Nov 2026: "Not sent - this mail is too big (24.4 MB)" and "Not sent - No internet connection" on a reply.
// The quoted mails under a reply carry every old picture as a data: URL (here 24.4 MB). Like Outlook keeps it
// sendable: when a mail would be over the limit, the BIG pictures inside the quoted mails are replaced by a
// short "[picture]" note - your own text, your pasted pictures, the quoted words and the signature stay.
// Also: the editor's table borders no longer draw boxes round the signature.
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const W = "const _w=_weigh();if(_w.total>WIRE_MAX){_tooBig(_w);return}";
const n = s.split(W).length - 1;
if (n > 0) s = s.split(W).join("let _w=_weigh();if(_w.total>WIRE_MAX&&_w.quote&&window.slimQuoteEl){const _k=window.slimQuoteEl(ed);_w=_weigh();if(_k&&_w.total<=WIRE_MAX)toast(_k+' big picture'+(_k>1?'s':'')+' in the quoted mails left out so the mail can go - your text and the quoted words are kept')}if(_w.total>WIRE_MAX){_tooBig(_w);return}");
else if (!s.includes('window.slimQuoteEl(ed)')) throw new Error('weigh line not found');
const BLOCK = `<script>/* __slimquote:start 28 Nov 2026 - see server/patch-slim-quote.js */
(function(){
var BIG=40000;                 /* a data: picture longer than this (about 30 KB) counts as big */
var LIMIT=15*1024*1024;        /* outgoing HTML above this gets its quoted pictures slimmed */
var NOTE='<span style="color:#9c948e;font-size:12px">[picture]</span>';
function slimIn(root){var k=0;
 root.querySelectorAll('[data-trail] img,[data-qm] img').forEach(function(im){
  var src=im.getAttribute('src')||'';
  if(src.slice(0,5)==='data:'&&src.length>BIG){var sp=document.createElement('span');sp.innerHTML=NOTE;im.replaceWith(sp.firstChild);k++}});
 return k}
window.slimQuoteEl=function(ed){try{return ed?slimIn(ed):0}catch(e){return 0}};
try{var _og=outgoingHTML;outgoingHTML=function(m){var h=_og.apply(this,arguments);
 try{if(h&&h.length>LIMIT){var d=new DOMParser().parseFromString('<div id="__sq">'+h+'</div>','text/html');
  if(slimIn(d))h=d.getElementById('__sq').innerHTML}}catch(e){}
 return h}}catch(e){}
try{var st=document.createElement('style');st.textContent='.editor [data-sig] td,.rich [data-sig] td,.editor [data-sig] table,.rich [data-sig] table{border:0}';document.head.appendChild(st)}catch(e){}
})();
/* __slimquote:end */</script>`;
const a = s.indexOf('<script>/* __slimquote:start'), b = s.indexOf('/* __slimquote:end */</script>');
if (a >= 0 && b > a) s = s.slice(0, a) + BLOCK + s.slice(b + '/* __slimquote:end */</script>'.length);
else s = s + '\n' + BLOCK + '\n';
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = m[1] === '2026-11-28' ? '2026-11-28-' + (+m[2] + 1) : '2026-11-28-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb, 'weigh lines', n);
